import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import * as healthController from '../controllers-postgres/healthController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/csv' ||
      file.originalname?.toLowerCase().endsWith('.xlsx') ||
      file.originalname?.toLowerCase().endsWith('.xls') ||
      file.originalname?.toLowerCase().endsWith('.csv');
    if (ok) cb(null, true);
    else cb(new Error('Only Excel (.xlsx, .xls) or CSV (.csv) files are allowed'));
  },
});

const router = Router();

// Appointments
router.get('/appointments/my-patients', authenticate, healthController.getMyPatientAppointments);
router.get('/appointments', authenticate, healthController.getAppointments);
router.get('/appointments/:id', authenticate, healthController.getAppointment);
router.get('/appointments/:id/details', authenticate, healthController.getAppointmentDetails);
router.post('/appointments/scan-lookup', authenticate, healthController.scanLookup);
router.post('/appointments/scan-checkin', authenticate, healthController.scanCheckin);
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
router.get('/reports', authenticate, healthController.listReports);
router.get('/reports/:reportId', authenticate, healthController.getReport);
router.get('/reports/:reportId/file', authenticate, healthController.getReportFile);
router.delete('/reports/:reportId', authenticate, healthController.deleteReport);
router.post('/reports/:reportId/extract', authenticate, healthController.extractReport);
router.post('/vitals/confirm', authenticate, healthController.confirmVitals);

// Vitals
router.get('/vitals', authenticate, healthController.getVitals);
router.get('/vitals/graph', authenticate, healthController.getVitalsGraph);
router.get('/vitals/trends', authenticate, healthController.getVitalsTrends);
router.post('/vitals', authenticate, healthController.addVital);
router.put('/vitals/:id', authenticate, healthController.updateVital);
router.delete('/vitals/:id', authenticate, healthController.deleteVitals);
router.delete('/vitals', authenticate, healthController.deleteVitals);

// Live Monitoring (Institution Admissions)
router.get('/admissions', authenticate, healthController.getAdmissions);
router.get('/admissions/:id', authenticate, healthController.getAdmission);
router.post('/admissions', authenticate, healthController.createAdmission);
router.put('/admissions/:id', authenticate, healthController.updateAdmission);
router.delete('/admissions/:id', authenticate, healthController.deleteAdmission);
router.get('/admissions/:admissionId/readings', authenticate, healthController.getMonitoringReadings);
router.get('/admissions/:admissionId/readings/template', authenticate, healthController.getMonitoringTemplate);
router.post('/admissions/:admissionId/readings', authenticate, healthController.addMonitoringReadings);
router.delete('/admissions/:admissionId/readings', authenticate, healthController.deleteMonitoringReadings);
router.post('/admissions/:admissionId/readings/preview', authenticate, upload.single('file'), healthController.previewMonitoringImport);
router.post('/admissions/:admissionId/readings/import', authenticate, upload.single('file'), healthController.importMonitoringReadings);
router.get('/admissions/:admissionId/treatments', authenticate, healthController.getAdmissionTreatments);
router.post('/admissions/:admissionId/treatments', authenticate, healthController.addAdmissionTreatment);

export default router;
