import { Router } from 'express';
import {
  sendOTP,
  verifyOTP,
  signup,
  login,
  resetPin
} from '../controllers/authController';

const router = Router();

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/signup', signup);
router.post('/login', login);
router.post('/reset-pin', resetPin);

export default router;
