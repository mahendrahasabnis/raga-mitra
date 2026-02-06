import { Router } from 'express';
import { proxyGetByPhone } from '../controllers-postgres/userProxyController';
import { createOrGetDoctor, searchDoctors, searchUsers } from '../controllers-postgres/userController';

const router = Router();

// Get user by phone number (proxy to 99platforms backend to avoid browser CORS)
router.get('/by-phone/:phone', proxyGetByPhone);

// Search users / doctors in shared DB
router.get('/search', searchUsers);
router.get('/search/doctors', searchDoctors);
router.post('/doctors', createOrGetDoctor);

export default router;
