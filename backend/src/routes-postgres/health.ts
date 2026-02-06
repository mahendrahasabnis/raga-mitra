import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as healthController from '../controllers-postgres/healthController';

const router = Router();

// Appointments
router.get('/appointments', authenticate, healthController.getAppointments);
router.get('/appointments/:id', authenticate, healthController.getAppointment);
router.get('/appointments/:id/details', authenticate, healthController.getAppointmentDetails);
router.post('/appointments', authenticate, healthController.createAppointment);
router.put('/appointments/:id', authenticate, healthController.updateAppointment);
router.put('/appointments/:id/details', authenticate, healthController.updateAppointmentDetails);
router.post('/appointments/:id/files', authenticate, healthController.uploadAppointmentFile);
router.get('/appointments/files/:fileId', authenticate, healthController.getAppointmentFile);
router.post('/appointments/:id/audio/summary', authenticate, healthController.summarizeAppointmentAudio);
router.post('/appointments/:appointmentId/attachments', authenticate, healthController.addAppointmentAttachment);
router.post('/uploads/signed-url', authenticate, healthController.getSignedUploadUrl);
router.post('/uploads/test-signed-url', authenticate, healthController.testSignedUploadFlow);

// Medicines
router.get('/medicines', authenticate, healthController.getMedicines);
router.post('/medicines', authenticate, healthController.addMedicine);
router.put('/medicines/:id', authenticate, healthController.updateMedicine);
router.delete('/medicines/:id', authenticate, healthController.deleteMedicine);

// Diagnostics
router.get('/diagnostics', authenticate, healthController.getDiagnostics);
router.post('/diagnostics', authenticate, healthController.addDiagnostic);
router.post('/reports/upload', authenticate, healthController.uploadReport);
router.get('/reports/:reportId', authenticate, healthController.getReport);
router.post('/reports/:reportId/extract', authenticate, healthController.extractReport);
router.post('/vitals/confirm', authenticate, healthController.confirmVitals);

// Vitals
router.get('/vitals', authenticate, healthController.getVitals);
router.get('/vitals/graph', authenticate, healthController.getVitalsGraph);
router.get('/vitals/trends', authenticate, healthController.getVitalsTrends);
router.post('/vitals', authenticate, healthController.addVital);

export default router;
