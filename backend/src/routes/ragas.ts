import { Router } from 'express';
import { getRagas, getRagaById, createRaga, updateRaga, deleteRaga, deleteAllRagas, batchImportRagas } from '../controllers/ragaController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', getRagas);
router.get('/:id', getRagaById);
router.post('/', authenticate, requireAdmin, createRaga);
router.post('/batch-import', authenticate, requireAdmin, batchImportRagas);
router.put('/:id', authenticate, requireAdmin, updateRaga);
router.delete('/:id', authenticate, requireAdmin, deleteRaga);
router.delete('/', authenticate, requireAdmin, deleteAllRagas);

export default router;
