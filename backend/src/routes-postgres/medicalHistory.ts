import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getMedicalHistory,
  getAllPrescriptions,
  getAllTestResults
} from '../controllers-postgres/medicalHistoryController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Medical history
router.get('/', getMedicalHistory);
router.get('/prescriptions', getAllPrescriptions);
router.get('/test-results', getAllTestResults);

export default router;

