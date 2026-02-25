import { Router } from 'express';
import { register, login, verifyToken, logout, resetPin } from '../controllers-postgres/authController';
import otpService from '../services/otpService';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify', verifyToken);
router.post('/logout', logout);
router.post('/reset-pin', resetPin);
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone is required' });
    const result = await otpService.sendOTP(phone);
    if (!result.success) return res.status(400).json({ message: result.message });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ message: e?.message || 'Failed to send OTP' });
  }
});
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ message: 'Phone and OTP are required' });
    const isValid = otpService.verifyOTP(phone, otp);
    if (!isValid) return res.status(400).json({ message: 'Invalid or expired OTP' });
    res.json({ message: 'OTP verified successfully' });
  } catch (e: any) {
    res.status(500).json({ message: e?.message || 'Failed to verify OTP' });
  }
});

export default router;
