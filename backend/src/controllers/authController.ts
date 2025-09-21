import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import otpService from '../services/otpService';

export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const result = await otpService.sendOTP(phone);
    
    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(400).json({ message: result.message });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone and OTP are required' });
    }

    const isValid = otpService.verifyOTP(phone, otp);
    
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { phone, pin } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({ message: 'Phone and PIN are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash PIN
    const saltRounds = 10;
    const pinHash = await bcrypt.hash(pin, saltRounds);

    // Create user
    const user = new User({
      phone,
      pinHash,
      credits: 5,
      role: phone === process.env.ADMIN_PHONE ? 'admin' : 'user'
    });

    await user.save();

    // Generate JWT with expiration
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        phone: user.phone,
        credits: user.credits,
        role: user.role,
        isAdmin: user.role === 'admin'
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { phone, pin } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({ message: 'Phone and PIN are required' });
    }

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Verify PIN
    const isValidPin = await bcrypt.compare(pin, user.pinHash);
    if (!isValidPin) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT with expiration
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        phone: user.phone,
        credits: user.credits,
        role: user.role,
        isAdmin: user.role === 'admin'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const resetPin = async (req: Request, res: Response) => {
  try {
    const { phone, otp, newPin } = req.body;

    if (!phone || !otp || !newPin) {
      return res.status(400).json({ message: 'Phone, OTP, and new PIN are required' });
    }

    // Verify OTP
    const isValid = otpService.verifyOTP(phone, otp);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Hash new PIN
    const saltRounds = 10;
    const pinHash = await bcrypt.hash(newPin, saltRounds);

    // Update user
    user.pinHash = pinHash;
    await user.save();

    res.json({ message: 'PIN reset successfully' });
  } catch (error) {
    console.error('Reset PIN error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
