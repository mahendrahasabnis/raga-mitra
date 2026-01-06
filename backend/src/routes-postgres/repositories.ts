import express from 'express';
import { authenticate } from '../middleware/auth-postgres';
import {
  searchOrCreateUnverifiedDoctor,
  searchUnverifiedDoctors
} from '../controllers-postgres/repositoryController';
import {
  searchPharmacies,
  getPharmacyById
} from '../controllers-postgres/repositoryController';
import {
  searchDiagnosticsCenters,
  getDiagnosticsCenterById
} from '../controllers-postgres/repositoryController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Unverified doctors
router.post('/unverified-doctors', searchOrCreateUnverifiedDoctor);
router.get('/unverified-doctors', searchUnverifiedDoctors);

// Pharmacies
router.get('/pharmacies', searchPharmacies);
router.get('/pharmacies/:id', getPharmacyById);

// Diagnostics centers
router.get('/diagnostics-centers', searchDiagnosticsCenters);
router.get('/diagnostics-centers/:id', getDiagnosticsCenterById);

export default router;

