import { Router } from 'express';
import { proxyGetByPhone } from '../controllers-postgres/userProxyController';

const router = Router();

// Get user by phone number (proxy to 99platforms backend to avoid browser CORS)
router.get('/by-phone/:phone', proxyGetByPhone);

export default router;
