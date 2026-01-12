import { Router } from 'express';
import { register, login, verifyToken, logout } from '../controllers-postgres/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify', verifyToken);
router.post('/logout', logout);

export default router;
