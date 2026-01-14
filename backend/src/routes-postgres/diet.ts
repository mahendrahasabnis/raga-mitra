import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as dietController from '../controllers-postgres/dietController';

const router = Router();

// Weekly Templates
router.get('/week-templates', authenticate, dietController.getWeekTemplates);
router.get('/week-templates/:id', authenticate, dietController.getWeekTemplate);
router.post('/week-templates', authenticate, dietController.createWeekTemplate);
router.put('/week-templates/:id', authenticate, dietController.updateWeekTemplate);

// Calendar Entries
router.get('/calendar', authenticate, dietController.getCalendarEntries);
router.get('/calendar/:date', authenticate, dietController.getCalendarEntry);
router.post('/calendar', authenticate, dietController.createCalendarEntry);

// Tracking
router.get('/tracking', authenticate, dietController.getTracking);
router.post('/tracking', authenticate, dietController.createTracking);
router.put('/tracking/:id', authenticate, dietController.updateTracking);

// Ad-hoc Entries
router.get('/ad-hoc', authenticate, dietController.getAdHocEntries);
router.post('/ad-hoc', authenticate, dietController.createAdHocEntry);
router.put('/ad-hoc/:id', authenticate, dietController.updateAdHocEntry);
router.delete('/ad-hoc/:id', authenticate, dietController.deleteAdHocEntry);

// Progress & Stats
router.get('/progress', authenticate, dietController.getProgress);

export default router;
