import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  searchTracks,
  getCuratedTracks,
  rateTrack,
  useCredit,
  searchYouTubeTracks,
  getYouTubeQuotaStatus
} from '../controllers/trackController';

const router = Router();

// Legacy search
router.get('/search', authenticate, searchTracks);

// Enhanced YouTube search
router.get('/youtube/search', authenticate, searchYouTubeTracks);

// YouTube API quota status
router.get('/youtube/quota', authenticate, getYouTubeQuotaStatus);

// Curated tracks
router.get('/curated', authenticate, getCuratedTracks);

// Rate a track
router.post('/:trackId/rate', authenticate, rateTrack);

// Use credit
router.post('/use-credit', authenticate, useCredit);

export default router;
