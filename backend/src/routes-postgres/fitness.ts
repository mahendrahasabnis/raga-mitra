import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import * as fitnessController from '../controllers-postgres/fitnessController';

// Configure multer for file uploads (memory storage for Excel files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept Excel files
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

// Exercise Templates (Library)
// IMPORTANT: Specific routes must come before parameterized routes
router.get('/exercise-templates/export', authenticate, fitnessController.exportExerciseTemplates);
router.post('/exercise-templates/import', authenticate, upload.single('file'), fitnessController.importExerciseTemplates);
router.get('/exercise-templates', authenticate, fitnessController.getExerciseTemplates);
router.get('/exercise-templates/:id', authenticate, fitnessController.getExerciseTemplate);
router.post('/exercise-templates', authenticate, fitnessController.createExerciseTemplate);
router.put('/exercise-templates/:id', authenticate, fitnessController.updateExerciseTemplate);

// Weekly Templates
router.get('/week-templates', authenticate, fitnessController.getWeekTemplates);
router.get('/week-templates/:id', authenticate, fitnessController.getWeekTemplate);
router.post('/week-templates', authenticate, fitnessController.createWeekTemplate);
router.put('/week-templates/:id', authenticate, fitnessController.updateWeekTemplate);

// Calendar Entries (specific paths before :date)
router.get('/calendar', authenticate, fitnessController.getCalendarEntries);
router.post('/calendar/apply-week', authenticate, fitnessController.applyCalendarWeek);
router.post('/calendar/remove-week', authenticate, fitnessController.removeCalendarWeek);
router.get('/calendar/:date', authenticate, fitnessController.getCalendarEntry);
router.post('/calendar', authenticate, fitnessController.createCalendarEntry);

// Tracking
router.get('/tracking', authenticate, fitnessController.getTracking);
router.post('/tracking', authenticate, fitnessController.createTracking);
router.put('/tracking/:id', authenticate, fitnessController.updateTracking);

// Progress & Streak
router.get('/progress', authenticate, fitnessController.getProgress);

export default router;
