import express from 'express';
import {
  createTransaction,
  getUserTransactions,
  getAllTransactions,
  getTransactionSummary,
  getTransactionStats
} from '../controllers/transactionController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Create transaction (public - called by Razorpay webhook)
router.post('/', createTransaction);

// Get user's own transactions
router.get('/user', authenticate, getUserTransactions);

// Admin routes
router.get('/admin/all', authenticate, getAllTransactions);
router.get('/admin/summary', authenticate, getTransactionSummary);
router.get('/admin/stats', authenticate, getTransactionStats);

export default router;
