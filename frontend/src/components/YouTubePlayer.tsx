import React from 'react';
// import { Track } from '../types';

interface YouTubePlayerProps {
  track: any;
  onClose: () => void;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ track, onClose }) => {
  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
  };

  const formatDuration = (duration: string) => {
    // Handle duration in "MM:SS" or "HH:MM:SS" format
    return duration;
  };

  // No keyboard shortcuts needed for inline player

  return (
    <div className="w-full mb-6">
        {/* YouTube Player */}
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={getYouTubeEmbedUrl(track.url)}
            className="absolute top-0 left-0 w-full h-full rounded-xl"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={track.title}
          />
          {/* Close Button Overlay */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center transition-all duration-200 z-10"
            title="Close Player"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
    </div>
  );
};

export default YouTubePlayer;
