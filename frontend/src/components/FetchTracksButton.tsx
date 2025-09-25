import React, { useState } from 'react';
import { trackApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Music, AlertCircle } from 'lucide-react';

interface FetchTracksButtonProps {
  selectedRaga: any | null;
  selectedArtist: any | null;
  onTracksFound: (tracks: any[], quotaInfo?: any) => void;
  onTrackSelect: (track: any) => void;
}

const FetchTracksButton: React.FC<FetchTracksButtonProps> = ({
  selectedRaga,
  selectedArtist,
  onTracksFound,
  onTrackSelect
}) => {
  const { user, updateCredits } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quotaInfo, setQuotaInfo] = useState<any>(null);

  const handleFetchTracks = async () => {
    console.log('FetchTracks button clicked');
    console.log('User:', user);
    console.log('Selected raga:', selectedRaga);
    console.log('Selected artist:', selectedArtist);
    
    if (!user) {
      setError('Please login to use this feature');
      return;
    }

    if (user.credits <= 0) {
      setError('Insufficient credits. Please buy more credits.');
      return;
    }

    if (!selectedRaga) {
      setError('Please select a raga first');
      return;
    }

    if (!selectedArtist) {
      setError('Please select an artist first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Search YouTube for raga-based classical music
      const result = await searchYouTubeMusic(selectedRaga, selectedArtist);
      
      if (result.tracks && result.tracks.length > 0) {
        // Update credits if provided
        if (result.credits !== undefined) {
          updateCredits(result.credits);
        }
        
        // Store quota info for admin display
        setQuotaInfo(result.quotaInfo);
        
        onTracksFound(result.tracks, result.quotaInfo);
        // Auto-play first track
        onTrackSelect(result.tracks[0]);
      } else {
        setError('No tracks found. Try a different raga or artist combination.');
      }
    } catch (err: any) {
      console.error('Fetch tracks error:', err);
      if (err.message?.includes('credits')) {
        setError('Insufficient credits. Please buy more credits.');
      } else {
        setError('Failed to find tracks. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Real YouTube search function using the API
  const searchYouTubeMusic = async (raga: any, artist: any) => {
    try {
      const token = localStorage.getItem('token');
      console.log('FetchTracks searching YouTube with token:', token ? 'Present' : 'Missing');
      console.log('FetchTracks Raga:', raga?.name, 'Artist:', artist?.name);
      
      const response = await fetch(`http://localhost:3006/api/tracks/youtube/search?raga=${encodeURIComponent(raga?.name || '')}&artist=${encodeURIComponent(artist?.name || '')}&minDuration=1800&maxResults=10&orderBy=relevance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('FetchTracks API response status:', response.status);

      if (!response.ok) {
        if (response.status === 429) {
          const errorData = await response.json();
          throw new Error(`YouTube API quota exceeded. ${errorData.quotaStatus?.remaining || 0} requests remaining.`);
        }
        if (response.status === 400) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Insufficient credits');
        }
        throw new Error('Failed to search YouTube');
      }

      const data = await response.json();
      return {
        tracks: data.tracks || [],
        credits: data.credits,
        quotaInfo: {
          quotaUsed: data.quotaUsed,
          quotaStatus: data.quotaStatus,
          isAdmin: data.isAdmin
        }
      };
    } catch (error) {
      console.error('YouTube search error:', error);
      throw error;
    }
  };

  console.log('FetchTracksButton render - loading:', loading, 'user:', user, 'selectedRaga:', selectedRaga, 'selectedArtist:', selectedArtist, 'error:', error);
  
  return (
    <div className="space-y-4">
      <div className="text-center">
        <button
          onClick={handleFetchTracks}
          disabled={loading || !user || user.credits <= 0 || !selectedRaga || !selectedArtist}
          className="btn-primary text-sm px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Fetching...</span>
            </>
          ) : (
            <>
              <Music className="w-4 h-4" />
              <span>Fetch Tracks</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-center space-x-2 text-red-300 bg-red-500/20 border border-red-500/50 rounded-lg p-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
};

export default FetchTracksButton;
