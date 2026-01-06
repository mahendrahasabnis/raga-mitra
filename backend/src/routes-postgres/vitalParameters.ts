import express from 'express';
import { authenticate } from '../middleware/auth-postgres';
import {
  getParameterDefinitions,
  addVitalParameter,
  getVitalParameters,
  getGraphData,
  getParametersByCategory,
  updateVitalParameter,
  deleteVitalParameter
} from '../controllers-postgres/vitalParametersController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Parameter definitions
router.get('/definitions', getParameterDefinitions);

// Categories
router.get('/categories', getParametersByCategory);

// Graph data (must come before /:id route)
router.get('/graph-data', getGraphData);

// CRUD operations
router.post('/', addVitalParameter);
router.get('/', getVitalParameters);
router.put('/:id', updateVitalParameter);
router.delete('/:id', deleteVitalParameter);

export default router;

