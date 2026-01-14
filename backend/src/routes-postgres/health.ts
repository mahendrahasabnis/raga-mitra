import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as healthController from '../controllers-postgres/healthController';

const router = Router();

// Appointments
router.get('/appointments', authenticate, healthController.getAppointments);
router.get('/appointments/:id', authenticate, healthController.getAppointment);
router.post('/appointments', authenticate, healthController.createAppointment);
router.put('/appointments/:id', authenticate, healthController.updateAppointment);
router.post('/appointments/:appointmentId/attachments', authenticate, healthController.addAppointmentAttachment);

// Medicines
router.get('/medicines', authenticate, healthController.getMedicines);
router.post('/medicines', authenticate, healthController.addMedicine);
router.put('/medicines/:id', authenticate, healthController.updateMedicine);
router.delete('/medicines/:id', authenticate, healthController.deleteMedicine);

// Diagnostics
router.get('/diagnostics', authenticate, healthController.getDiagnostics);
router.post('/diagnostics', authenticate, healthController.addDiagnostic);
router.post('/reports/upload', authenticate, healthController.uploadReport);
router.post('/reports/:reportId/extract', authenticate, healthController.extractReport);
router.post('/vitals/confirm', authenticate, healthController.confirmVitals);

// Vitals
router.get('/vitals', authenticate, healthController.getVitals);
router.get('/vitals/graph', authenticate, healthController.getVitalsGraph);
router.get('/vitals/trends', authenticate, healthController.getVitalsTrends);
router.post('/vitals', authenticate, healthController.addVital);

export default router;
