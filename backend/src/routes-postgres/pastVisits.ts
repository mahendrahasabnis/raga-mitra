import express from 'express';
import { authenticate } from '../middleware/auth-postgres';
import {
  createPastVisit,
  getPastVisits,
  getPastVisitDetails,
  updatePastVisit,
  deletePastVisit
} from '../controllers-postgres/pastVisitController';
import {
  uploadPrescription,
  uploadReceipt,
  uploadTestResult,
  updatePrescription,
  deletePrescription,
  updateReceipt,
  deleteReceipt,
  updateTestResult,
  deleteTestResult
} from '../controllers-postgres/pastVisitDocumentController';
import { scanReceiptAndCreateVisit, extractReceiptDataOnly } from '../controllers-postgres/receiptScanController';
import { extractPrescriptionDataOnly, extractTestResultDataOnly } from '../controllers-postgres/documentExtractController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Past visits CRUD
router.post('/', createPastVisit);
router.get('/', getPastVisits);

// Receipt scanning endpoints
router.post('/extract-receipt', extractReceiptDataOnly); // Extract data only (for form population)
router.post('/scan-receipt', scanReceiptAndCreateVisit); // Extract and auto-create visit

// Document extraction endpoints (extract-only, no appointment_id required)
router.post('/extract-prescription', extractPrescriptionDataOnly); // Extract prescription data only
router.post('/extract-test-result', extractTestResultDataOnly); // Extract test result data only

// Document uploads (must come before /:appointment_id route)
router.post('/:appointment_id/prescription', uploadPrescription);
router.post('/:appointment_id/receipt', uploadReceipt);
router.post('/:appointment_id/test-result', uploadTestResult);

// Document updates and deletes (must come before /:appointment_id route)
router.put('/prescriptions/:prescription_id', updatePrescription);
router.delete('/prescriptions/:prescription_id', deletePrescription);
router.put('/receipts/:receipt_id', updateReceipt);
router.delete('/receipts/:receipt_id', deleteReceipt);
router.put('/test-results/:test_result_id', updateTestResult);
router.delete('/test-results/:test_result_id', deleteTestResult);

// Past visit details and updates (must come after specific routes)
router.get('/:appointment_id', getPastVisitDetails);
router.put('/:appointment_id', updatePastVisit);
router.delete('/:appointment_id', deletePastVisit);

export default router;

