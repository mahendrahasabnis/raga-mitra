import { Request, Response } from 'express';
import Track from '../models/Track';
import User from '../models/User';
import youtubeService from '../services/youtubeService';
import { AuthRequest } from '../middleware/auth';

export const searchTracks = async (req: AuthRequest, res: Response) => {
  try {
    const { raga, artist } = req.query;

    if (!raga || !artist) {
      return res.status(400).json({ message: 'Raga and artist are required' });
    }

    const tracks = await youtubeService.searchVideos(raga as string, artist as string);
    res.json(tracks);
  } catch (error) {
    console.error('Search tracks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCuratedTracks = async (req: AuthRequest, res: Response) => {
  try {
    const tracks = await youtubeService.getCuratedTracks();
    res.json(tracks);
  } catch (error) {
    console.error('Get curated tracks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const rateTrack = async (req: AuthRequest, res: Response) => {
  try {
    const { trackId } = req.params;
    const { rating } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const track = await Track.findById(trackId);
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    // Remove existing rating from this user
    track.ratings = track.ratings.filter(r => r.userId !== userId);
    
    // Add new rating
    track.ratings.push({
      userId,
      rating,
      createdAt: new Date()
    });

    await track.save();

    res.json({ message: 'Rating submitted successfully' });
  } catch (error) {
    console.error('Rate track error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to deduct credit
const deductCredit = async (userId: string): Promise<number> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.credits <= 0) {
    throw new Error('Insufficient credits');
  }

  user.credits -= 1;
  await user.save();
  return user.credits;
};

export const useCredit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const remainingCredits = await deductCredit(userId);

    res.json({ 
      message: 'Credit used successfully',
      remainingCredits
    });
  } catch (error: any) {
    console.error('Use credit error:', error);
    if (error.message === 'Insufficient credits') {
      return res.status(400).json({ message: 'Insufficient credits' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

export const searchYouTubeTracks = async (req: AuthRequest, res: Response) => {
  try {
    const { raga, artist, minDuration, maxResults } = req.query;
    const user = req.user;

    if (!raga) {
      return res.status(400).json({ message: 'Raga is required' });
    }

    const filters = {
      minDuration: minDuration ? parseInt(minDuration as string) : 1200, // 20 minutes default (more results)
      maxResults: maxResults ? parseInt(maxResults as string) : 100, // Increased from 50 to 100
      orderBy: 'relevance' as any
    };

    const searchResult = await youtubeService.searchVideos(
      raga as string,
      artist as string,
      filters
    );

    // Deduct credit for non-admin users
    let remainingCredits = 0;
    if (user && user.role !== 'admin') {
      try {
        remainingCredits = await deductCredit(user.id);
      } catch (creditError: any) {
        console.error('Credit deduction error:', creditError);
        return res.status(400).json({ 
          message: 'Insufficient credits. Please buy more credits.',
          credits: 0
        });
      }
    } else {
      // For admin users, get current credits without deducting
      if (user) {
        const adminUser = await User.findById(user.id).select('credits');
        remainingCredits = adminUser?.credits || 0;
      }
    }

    res.json({
      tracks: searchResult.tracks,
      quotaUsed: searchResult.quotaUsed,
      quotaStatus: searchResult.quotaStatus,
      searchParams: { raga, artist, filters },
      credits: remainingCredits,
      isAdmin: user?.role === 'admin'
    });
  } catch (error: any) {
    console.error('YouTube search error:', error);
    if (error.message.includes('quota')) {
      return res.status(429).json({
        message: 'YouTube API quota exceeded. Please try again later.',
        quotaStatus: youtubeService.getQuotaStatus()
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

export const getYouTubeQuotaStatus = async (req: AuthRequest, res: Response) => {
  try {
    const quotaStatus = youtubeService.getQuotaStatus();
    res.json(quotaStatus);
  } catch (error) {
    console.error('Get quota status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
