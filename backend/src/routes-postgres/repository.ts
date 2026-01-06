import express from 'express';
import { authenticate } from '../middleware/auth-postgres';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth-postgres';

// Note: Practice/Specialization repository functions are handled by HCP routes
// These routes are kept for backward compatibility but return empty responses
// In integrated mode, practices are managed via /api/hcp routes

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Practice routes - Stub implementations (use /api/hcp routes for practice management)
const getAllPractices = async (req: AuthRequest, res: Response) => {
  res.json({
    message: 'Use /api/hcp/:hcpId/clinics/:clinicId/practices for practice management',
    practices: [],
    count: 0
  });
};

const getPracticeCategories = async (req: AuthRequest, res: Response) => {
  res.json({
    message: 'Use /api/hcp routes for practice categories',
    categories: []
  });
};

const addCustomPractice = async (req: AuthRequest, res: Response) => {
  res.status(400).json({
    message: 'Use POST /api/hcp/:hcpId/clinics/:clinicId/practices to add practices'
  });
};

const getSpecializationsByPractice = async (req: AuthRequest, res: Response) => {
  res.json({
    message: 'Specializations are managed via doctor profiles',
    specializations: [],
    count: 0
  });
};

const addCustomSpecialization = async (req: AuthRequest, res: Response) => {
  res.status(400).json({
    message: 'Specializations are managed via doctor profiles in /api/hcp routes'
  });
};

router.get('/practices', getAllPractices);
router.get('/practices/categories', getPracticeCategories);
router.post('/practices', addCustomPractice);

// Specialization routes
router.get('/specializations', getSpecializationsByPractice);
router.post('/specializations', addCustomSpecialization);

export default router;
