import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as healthController from '../controllers-postgres/healthController';

const router = Router();

// Appointments
router.get('/appointments', authenticate, healthController.getAppointments);
router.post('/appointments', authenticate, healthController.createAppointment);

// Vitals
router.get('/vitals', authenticate, healthController.getVitals);
router.post('/vitals', authenticate, healthController.addVital);
router.post('/vitals/confirm', authenticate, healthController.confirmVitals);

// Diagnostics / OCR stubs
router.post('/reports/upload', authenticate, healthController.uploadReport);
router.post('/reports/:reportId/extract', authenticate, healthController.extractReport);

export default router;
