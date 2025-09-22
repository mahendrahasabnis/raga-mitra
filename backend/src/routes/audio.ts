import express from 'express';
import { 
  uploadAudio, 
  streamAudio, 
  deleteAudio, 
  listAudioFiles, 
  getAudioInfo, 
  upload 
} from '../controllers/audioController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Upload audio file (protected route)
router.post('/upload', authenticate, upload.single('audio'), uploadAudio);

// Stream audio file (public route for playback)
router.get('/stream/:fileId', streamAudio);

// Get audio file info
router.get('/info/:fileId', getAudioInfo);

// List all audio files (protected route)
router.get('/files', authenticate, listAudioFiles);

// Delete audio file (protected route)
router.delete('/:fileId', authenticate, deleteAudio);

export default router;
