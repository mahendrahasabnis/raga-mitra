import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import * as dietController from '../controllers-postgres/dietController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

const router = Router();

// Meal Templates (Library)
router.get('/meal-templates/export', authenticate, dietController.exportMealTemplates);
router.post('/meal-templates/import', authenticate, upload.single('file'), dietController.importMealTemplates);
router.get('/meal-templates', authenticate, dietController.getMealTemplates);
router.get('/meal-templates/:id', authenticate, dietController.getMealTemplate);
router.post('/meal-templates', authenticate, dietController.createMealTemplate);
router.put('/meal-templates/:id', authenticate, dietController.updateMealTemplate);

// Weekly Templates
router.get('/week-templates', authenticate, dietController.getWeekTemplates);
router.get('/week-templates/:id', authenticate, dietController.getWeekTemplate);
router.post('/week-templates', authenticate, dietController.createWeekTemplate);
router.put('/week-templates/:id', authenticate, dietController.updateWeekTemplate);

// Calendar Entries (specific paths before :date)
router.get('/calendar', authenticate, dietController.getCalendarEntries);
router.post('/calendar/apply-week', authenticate, dietController.applyCalendarWeek);
router.post('/calendar/remove-week', authenticate, dietController.removeCalendarWeek);
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
