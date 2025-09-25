import React, { useState } from 'react';
// import { Track } from '../types';
import { trackApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Play, Clock, ThumbsUp, Star, StarOff } from 'lucide-react';

interface TrackListProps {
  tracks: any[];
  onTrackSelect: (track: any) => void;
  selectedArtist?: any;
  currentTrack?: any;
  isPlaying?: boolean;
}

const TrackList: React.FC<TrackListProps> = ({ tracks, onTrackSelect, selectedArtist, currentTrack, isPlaying }) => {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<{ [key: string]: number }>({});

  const formatDuration = (duration: string) => {
    // Handle duration in "MM:SS" or "HH:MM:SS" format
    return duration;
  };

  const handleRateTrack = async (track: any, rating: number) => {
    if (!user) return;

    try {
      const trackId = track._id || track.id;
      await trackApi.rateTrack(trackId, rating);
      setRatings(prev => ({ ...prev, [trackId]: rating }));
    } catch (error) {
      console.error('Error rating track:', error);
    }
  };

  const getAverageRating = (track: any) => {
    if (!track.ratings || track.ratings.length === 0) return 0;
    const sum = track.ratings.reduce((acc: number, rating: any) => acc + rating.rating, 0);
    return sum / track.ratings.length;
  };

  // Group tracks by artist
  const groupTracksByArtist = () => {
    if (!selectedArtist) {
      return {
        selectedArtistTracks: [],
        otherTracks: tracks.sort((a, b) => b.likes - a.likes)
      };
    }

    const selectedArtistTracks = tracks.filter(track => 
      track.artist && track.artist.toLowerCase().includes(selectedArtist.name.toLowerCase())
    ).sort((a, b) => b.likes - a.likes);

    const otherTracks = tracks.filter(track => 
      !track.artist || !track.artist.toLowerCase().includes(selectedArtist.name.toLowerCase())
    ).sort((a, b) => b.likes - a.likes);

    return { selectedArtistTracks, otherTracks };
  };

  const { selectedArtistTracks, otherTracks } = groupTracksByArtist();

  const renderTrack = (track: any, index: number) => {
    const averageRating = getAverageRating(track);
    const trackId = track._id || track.id;
    const userRating = ratings[trackId] || 0;
    const isCurrentTrack = currentTrack && (currentTrack._id === track._id || currentTrack.id === track.id);
    
    return (
      <div
        key={trackId}
        className={`card hover:bg-white/20 transition-colors cursor-pointer ${
          isCurrentTrack ? 'bg-primary-600/20 border-primary-500/50' : ''
        }`}
        onClick={() => onTrackSelect(track)}
      >
        <div className="flex items-center space-x-4">
          {/* Track Number */}
          <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm font-semibold text-white">
            {index + 1}
          </div>

          {/* Thumbnail */}
          <div className="flex-shrink-0 w-16 h-16 bg-white/10 rounded-lg overflow-hidden">
            {track.thumbnail ? (
              <img
                src={track.thumbnail}
                alt={track.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {isCurrentTrack && isPlaying ? (
                  <div className="w-6 h-6 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                ) : (
                  <Play className="w-6 h-6 text-white/60" />
                )}
              </div>
            )}
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{track.title}</h3>
            <p className="text-sm text-white/60 truncate">
              {track.raga && track.artist ? `${track.raga} • ${track.artist}` : 'Classical Music'}
            </p>
            
            <div className="flex items-center space-x-4 mt-1">
              <div className="flex items-center space-x-1 text-xs text-white/60">
                <Clock className="w-3 h-3" />
                <span>{formatDuration(track.duration)}</span>
              </div>
              
              <div className="flex items-center space-x-1 text-xs text-white/60">
                <ThumbsUp className="w-3 h-3" />
                <span>{(track.likes || 0).toLocaleString()}</span>
              </div>
              
              {track.isCurated && (
                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full">
                  Curated
                </span>
              )}
            </div>
          </div>

          {/* Rating */}
          <div className="flex-shrink-0 flex items-center space-x-1">
            {averageRating > 0 && (
              <div className="flex items-center space-x-1 text-xs text-white/60">
                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                <span>{averageRating.toFixed(1)}</span>
              </div>
            )}
            
            {/* User Rating */}
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRateTrack(track, star);
                  }}
                  className="text-white/40 hover:text-yellow-400 transition-colors"
                >
                  {star <= userRating ? (
                    <Star className="w-4 h-4 fill-current text-yellow-400" />
                  ) : (
                    <StarOff className="w-4 h-4" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Top 10 Tracks</h2>
      
      {/* Selected Artist Tracks */}
      {selectedArtistTracks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white/90">
            {tracks[0]?.raga || 'Raga'} by {selectedArtist?.name || 'Selected Artist'} (sorted by likes)
          </h3>
          <div className="space-y-2">
            {selectedArtistTracks.map((track, index) => renderTrack(track, index))}
          </div>
        </div>
      )}

      {/* Separator */}
      {selectedArtistTracks.length > 0 && otherTracks.length > 0 && (
        <div className="flex items-center space-x-4">
          <div className="flex-1 h-px bg-white/20"></div>
          <div className="text-sm text-white/60 px-4">•</div>
          <div className="flex-1 h-px bg-white/20"></div>
        </div>
      )}

      {/* Other Artists Tracks */}
      {otherTracks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white/90">
            {tracks[0]?.raga || 'Raga'} by Various Artists (sorted by likes)
          </h3>
          <div className="space-y-2">
            {otherTracks.map((track, index) => renderTrack(track, index + selectedArtistTracks.length))}
          </div>
        </div>
      )}

      {/* Fallback for no tracks */}
      {selectedArtistTracks.length === 0 && otherTracks.length === 0 && (
        <div className="text-center text-white/60 py-8">
          No tracks found
        </div>
      )}
    </div>
  );
};

export default TrackList;
