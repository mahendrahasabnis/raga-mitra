import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as resourcesController from '../controllers-postgres/resourcesController';

const router = Router();

router.get('/', authenticate, resourcesController.listResources);
router.post('/', authenticate, resourcesController.addResource);
router.put('/:id/access', authenticate, resourcesController.updateResourceAccess);
router.delete('/:id', authenticate, resourcesController.deleteResource);
router.get('/clients', authenticate, resourcesController.listClients);
router.post('/patients', authenticate, resourcesController.addPatientByDoctor);
router.get('/dash-patients', authenticate, resourcesController.listDashPatients);

export default router;
