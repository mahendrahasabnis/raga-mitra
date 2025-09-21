import { Request, Response } from 'express';
import Transaction, { ITransaction } from '../models/Transaction';
import User from '../models/User';

// Create a new transaction
export const createTransaction = async (req: Request, res: Response) => {
  try {
    const {
      phone,
      razorpayPaymentId,
      razorpayOrderId,
      amount,
      credits,
      packageId,
      gstAmount,
      totalAmount
    } = req.body;

    // Find user by phone
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const transaction = new Transaction({
      phone,
      razorpayPaymentId,
      razorpayOrderId,
      amount,
      credits,
      packageId,
      gstAmount,
      totalAmount,
      user: user._id,
      status: 'completed'
    });

    await transaction.save();

    // Update user credits
    user.credits += credits;
    await user.save();

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction: {
        id: transaction._id,
        phone: transaction.phone,
        razorpayPaymentId: transaction.razorpayPaymentId,
        amount: transaction.amount,
        credits: transaction.credits,
        status: transaction.status,
        transactionDate: transaction.transactionDate
      }
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get transactions for a specific user (by phone)
export const getUserTransactions = async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ phone })
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await Transaction.countDocuments({ phone });

    res.json({
      transactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalTransactions: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get all transactions (admin only)
export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const phone = req.query.phone as string;

    let query: any = {};
    if (phone) {
      // Escape special regex characters to prevent regex errors
      const escapedPhone = phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.phone = { $regex: escapedPhone, $options: 'i' };
    }

    const transactions = await Transaction.find(query)
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalTransactions: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching all transactions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get transaction summary grouped by phone (admin only)
export const getTransactionSummary = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    const summary = await Transaction.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: '$phone',
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalCredits: { $sum: '$credits' },
          lastTransaction: { $max: '$transactionDate' },
          firstTransaction: { $min: '$transactionDate' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'phone',
          as: 'user'
        }
      },
      {
        $unwind: { path: '$user', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          phone: '$_id',
          userName: { $ifNull: ['$user.name', 'N/A'] },
          totalTransactions: 1,
          totalAmount: 1,
          totalCredits: 1,
          lastTransaction: 1,
          firstTransaction: 1,
          currentCredits: { $ifNull: ['$user.credits', 0] }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    res.json({ summary });
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get transaction statistics (admin only)
export const getTransactionStats = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    const stats = await Transaction.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalRevenue: { $sum: '$amount' },
          totalCreditsSold: { $sum: '$credits' },
          averageTransactionValue: { $avg: '$amount' },
          uniqueUsers: { $addToSet: '$phone' }
        }
      },
      {
        $project: {
          _id: 0,
          totalTransactions: 1,
          totalRevenue: 1,
          totalCreditsSold: 1,
          averageTransactionValue: { $round: ['$averageTransactionValue', 2] },
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      }
    ]);

    // Get monthly revenue for the last 12 months
    const monthlyRevenue = await Transaction.aggregate([
      {
        $match: { 
          status: 'completed',
          transactionDate: { $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$transactionDate' },
            month: { $month: '$transactionDate' }
          },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      stats: stats[0] || {
        totalTransactions: 0,
        totalRevenue: 0,
        totalCreditsSold: 0,
        averageTransactionValue: 0,
        uniqueUsers: 0
      },
      monthlyRevenue
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
