import React, { useState } from 'react';
import { Play, Clock, ThumbsUp, Star, StarOff, Music } from 'lucide-react';

interface AudioTrackListProps {
  tracks: any[];
  onTrackSelect: (track: any) => void;
}

const AudioTrackList: React.FC<AudioTrackListProps> = ({ tracks, onTrackSelect }) => {
  const [ratings, setRatings] = useState<{ [key: string]: number }>({});

  const handleRateTrack = async (track: any, rating: number) => {
    try {
      // TODO: Implement rating API call
      const trackId = track._id || track.id;
      console.log(`Rating track ${trackId} with ${rating} stars`);
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

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white flex items-center">
        <Music className="w-6 h-6 mr-2 text-purple-400" />
        Curated Audio Collection
      </h2>
      
      <div className="space-y-2">
        {tracks.map((track, index) => {
          const averageRating = getAverageRating(track);
        const trackId = track._id || track.id;
        const userRating = ratings[trackId] || 0;
        
        return (
            <div
              key={trackId}
              className="card hover:bg-white/20 transition-colors cursor-pointer"
              onClick={() => onTrackSelect(track)}
            >
              <div className="flex items-center space-x-4">
                {/* Track Number */}
                <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm font-semibold text-white">
                  {index + 1}
                </div>

                {/* Track Icon */}
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Music className="w-8 h-8 text-white" />
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
                      <span>{track.duration}</span>
                    </div>
                    
                    <div className="flex items-center space-x-1 text-xs text-white/60">
                      <ThumbsUp className="w-3 h-3" />
                      <span>{track.likes?.toLocaleString() || '0'}</span>
                    </div>
                    
                    {track.isCurated && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full">
                        Curated
                      </span>
                    )}

                    {track.quality && (
                      <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full">
                        {track.quality}
                      </span>
                    )}
                  </div>
                </div>

                {/* Play Button */}
                <div className="flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrackSelect(track);
                    }}
                    className="w-10 h-10 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center transition-colors"
                  >
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </button>
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
        })}
      </div>
    </div>
  );
};

export default AudioTrackList;
