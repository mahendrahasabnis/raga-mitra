import React, { useState } from 'react';
// import { Raga, Artist, Track } from '../types';
import { trackApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Shuffle, Music, AlertCircle } from 'lucide-react';
import { getCurrentSeason } from '../utils/marathiCalendar';

interface SurpriseMeButtonProps {
  selectedRaga: any | null;
  selectedArtist: any | null;
  ragas: any[];
  artists: any[];
  onRagaSelect: (raga: any) => void;
  onArtistSelect: (artist: any) => void;
  onTracksFound: (tracks: any[], quotaInfo?: any) => void;
  onTrackSelect: (track: any) => void;
}

const SurpriseMeButton: React.FC<SurpriseMeButtonProps> = ({
  selectedRaga,
  selectedArtist,
  ragas,
  artists,
  onRagaSelect,
  onArtistSelect,
  onTracksFound,
  onTrackSelect
}) => {
  const { user, updateCredits } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quotaInfo, setQuotaInfo] = useState<any>(null);

  const selectRandomStarredRaga = () => {
    const currentSeason = getCurrentSeason();
    const currentHour = new Date().getHours();
    
    // Get all starred ragas (current hour + current season)
    const starredRagas = ragas.filter(raga => 
      raga.idealHours && raga.idealHours.includes(currentHour) && 
      raga.seasons && raga.seasons.includes(currentSeason.english)
    );
    
    if (starredRagas.length > 0) {
      const randomIndex = Math.floor(Math.random() * starredRagas.length);
      return starredRagas[randomIndex];
    }
    
    // Fallback to any raga if no starred ragas
    if (ragas.length > 0) {
      const randomIndex = Math.floor(Math.random() * ragas.length);
      return ragas[randomIndex];
    }
    
    return null;
  };

  const selectRandomArtist = () => {
    if (artists.length > 0) {
      const randomIndex = Math.floor(Math.random() * artists.length);
      return artists[randomIndex];
    }
    return null;
  };

  const handleSurpriseMe = async () => {
    if (!user) {
      setError('Please login to use this feature');
      return;
    }

    if (user.credits <= 0) {
      setError('Insufficient credits. Please buy more credits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Select random starred raga and random artist
      const randomRaga = selectRandomStarredRaga();
      const randomArtist = selectRandomArtist();
      
      if (!randomRaga) {
        setError('No ragas available');
        setLoading(false);
        return;
      }

      // Update the selected raga and artist
      onRagaSelect(randomRaga);
      onArtistSelect(randomArtist);

      // Search YouTube for raga-based classical music
      const searchQuery = `${randomRaga.name} classical music ${randomArtist?.name || ''}`.trim();
      const result = await searchYouTubeMusic(randomRaga, randomArtist);
      
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
        setError('No tracks found. Try again for a different combination.');
      }
    } catch (err: any) {
      console.error('Surprise me error:', err);
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
      const response = await fetch(`http://localhost:3001/api/tracks/youtube/search?raga=${encodeURIComponent(raga?.name || '')}&artist=${encodeURIComponent(artist?.name || '')}&minDuration=1800&maxResults=10&orderBy=relevance`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

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

  return (
    <div className="space-y-4">
      <div className="text-center">
        <button
          onClick={handleSurpriseMe}
          disabled={loading || !user || user.credits <= 0}
          className="btn-primary text-sm px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Shuffle className="w-4 h-4" />
              <span>Surprise Me!</span>
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

export default SurpriseMeButton;
