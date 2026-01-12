import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as resourcesController from '../controllers-postgres/resourcesController';

const router = Router();

router.get('/', authenticate, resourcesController.listResources);
router.post('/', authenticate, resourcesController.addResource);
router.get('/clients', authenticate, resourcesController.listClients);

export default router;
