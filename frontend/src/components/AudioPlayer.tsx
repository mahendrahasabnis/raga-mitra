import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';

interface AudioPlayerProps {
  currentTrack: any | null;
  onPrevious: () => void;
  onNext: () => void;
  onTrackSelect: (track: any) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentTrack,
  onPrevious,
  onNext,
  onTrackSelect
}) => {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCaching, setIsCaching] = useState(false);
  const [cacheProgress, setCacheProgress] = useState(0);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [youtubePlayerVisible, setYoutubePlayerVisible] = useState(false);
  const [youtubeError, setYoutubeError] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  // Create and manage audio element with immediate caching
  useEffect(() => {
    if (currentTrack) {
      // Handle YouTube tracks differently
      if (!currentTrack.isUploadedAudio) {
        console.log('YouTube track selected:', currentTrack.title);
        setDuration(0);
        setCurrentTime(0);
        setIsPlaying(false);
        setIsLoading(false);
        setIsCaching(false);
        setCacheProgress(0);
        setAudioElement(null);
        setYoutubePlayerVisible(true);
        setYoutubeError(false);
        return;
      }

      setIsCaching(true);
      setCacheProgress(0);
      
      // Create new audio element
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto'; // Preload entire file
      audio.autoplay = false; // Explicitly disable autoplay
      
      // Set up event listeners
      const handleLoadStart = () => {
        setIsLoading(true);
        setIsCaching(true);
        console.log('Audio caching started');
      };

      const handleProgress = () => {
        if (audio.buffered.length > 0) {
          const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
          const duration = audio.duration;
          if (duration > 0) {
            const progress = (bufferedEnd / duration) * 100;
            setCacheProgress(progress);
            console.log(`Cache progress: ${progress.toFixed(1)}%`);
          }
        }
      };

      const handleLoadedMetadata = () => {
        setDuration(audio.duration);
        console.log('Audio metadata loaded, duration:', audio.duration);
      };

      const handleCanPlay = () => {
        console.log('Audio can play (partially cached)');
        setIsLoading(false);
        // Don't auto-play, just indicate it's ready
      };

      const handleCanPlayThrough = () => {
        console.log('Audio fully cached and ready');
        setIsCaching(false);
        setIsLoading(false);
        setCacheProgress(100);
        // Don't auto-play, just indicate it's ready
      };

      const handleTimeUpdate = () => {
        if (!isDragging) {
          setCurrentTime(audio.currentTime);
        }
      };

      const handleEnded = () => {
        setCurrentTime(0);
        setIsPlaying(false);
        console.log('Audio ended');
      };

      const handleError = (e: any) => {
        console.error('Audio error:', e);
        setIsLoading(false);
        setIsCaching(false);
        setIsPlaying(false);
      };

      const handlePlay = () => {
        // This should only happen when user clicks play
        console.log('Audio play event triggered');
      };

      const handlePause = () => {
        // This should only happen when user clicks pause
        console.log('Audio pause event triggered');
      };

      audio.addEventListener('loadstart', handleLoadStart);
      audio.addEventListener('progress', handleProgress);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('canplaythrough', handleCanPlayThrough);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);

      // Ensure audio is paused initially
      audio.pause();

      // Set source and start caching immediately
      if (currentTrack.audioUrl) {
        audio.src = currentTrack.audioUrl;
        audio.load();
        console.log('Started caching audio file:', currentTrack.title);
      }

      setAudioElement(audio);

      // Cleanup
      return () => {
        audio.removeEventListener('loadstart', handleLoadStart);
        audio.removeEventListener('progress', handleProgress);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.pause();
        audio.src = '';
      };
    } else {
      setAudioElement(null);
      setDuration(0);
      setCurrentTime(0);
      setIsPlaying(false);
      setIsLoading(false);
      setIsCaching(false);
      setCacheProgress(0);
    }
  }, [currentTrack, isDragging]);

  // Handle play/pause - now seamless since file is cached
  const handlePlayPause = async () => {
    // Handle YouTube tracks
    if (currentTrack && !currentTrack.isUploadedAudio) {
      if (isPlaying) {
        setIsPlaying(false);
        setYoutubePlayerVisible(false);
        console.log('YouTube track paused (UI only)');
      } else {
        // Show YouTube player
        setYoutubePlayerVisible(true);
        setIsPlaying(true);
        console.log('Showing YouTube player for:', currentTrack.title);
      }
      return;
    }

    if (!audioElement) return;

    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
      console.log('Audio paused');
    } else {
      try {
        // Check if audio is ready to play
        if (audioElement.readyState < 2) {
          console.log('Audio not ready, waiting...');
          setIsLoading(true);
          
          // Wait for audio to be ready
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Audio loading timeout'));
            }, 10000);

            audioElement.addEventListener('canplay', () => {
              clearTimeout(timeout);
              resolve(void 0);
            });

            audioElement.addEventListener('error', (e) => {
              clearTimeout(timeout);
              reject(e);
            });
          });
        }

        // Ensure audio is paused before playing
        audioElement.pause();
        await audioElement.play();
        setIsPlaying(true);
        setIsLoading(false);
        console.log('Audio started playing from cache (user initiated)');
      } catch (err) {
        console.error('Error playing audio:', err);
        setIsLoading(false);
        setIsPlaying(false);
      }
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioElement) {
      audioElement.volume = newVolume;
    }
    if (isMuted && newVolume > 0) {
      setIsMuted(false);
    }
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    if (audioElement) {
      if (isMuted) {
        audioElement.volume = volume;
        setIsMuted(false);
      } else {
        audioElement.volume = 0;
        setIsMuted(true);
      }
    }
  };

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack || !progressRef.current || !audioElement) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickTime = (clickX / width) * duration;

    audioElement.currentTime = clickTime;
    setCurrentTime(clickTime);
  };

  // Format time in MM:SS
  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  if (!currentTrack) {
    return (
      <div className="bg-white/10 rounded-lg p-4 mb-6">
        <div className="text-center text-white/60">
          <p>No track selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* YouTube Player */}
      {youtubePlayerVisible && currentTrack && !currentTrack.isUploadedAudio && (
        <div className="bg-white/10 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">📺 YouTube Player</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setYoutubePlayerVisible(false);
                  setIsPlaying(false);
                }}
                className="text-white/70 hover:text-white transition-colors text-sm px-3 py-1 bg-white/10 rounded hover:bg-white/20"
              >
                Back to Audio Player
              </button>
              <button
                onClick={() => {
                  setYoutubePlayerVisible(false);
                  setIsPlaying(false);
                }}
                className="text-white/70 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            {youtubeError ? (
              <div className="absolute top-0 left-0 w-full h-full rounded-lg bg-gray-800 flex flex-col items-center justify-center text-white">
                <div className="text-center p-4">
                  <p className="text-lg mb-2">⚠️ Video cannot be embedded</p>
                  <p className="text-sm text-gray-400 mb-4">
                    This video may have embedding restrictions or is unavailable.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setYoutubeError(false)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      🔄 Retry
                    </button>
                    <a
                      href={currentTrack.url || currentTrack.audioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      📺 Watch on YouTube
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <iframe
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                src={`https://www.youtube.com/embed/${getYouTubeVideoId(currentTrack.url || currentTrack.audioUrl)}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&origin=${window.location.origin}`}
                title={currentTrack.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                onError={() => setYoutubeError(true)}
                onLoad={(e) => {
                  // Check if iframe loaded successfully
                  const iframe = e.target as HTMLIFrameElement;
                  if (iframe.contentWindow) {
                    setYoutubeError(false);
                  }
                }}
              />
            )}
          </div>
          <div className="mt-3 text-sm text-white/70">
            <p className="font-medium">{currentTrack.title}</p>
            <p className="text-xs">{currentTrack.artist} • {currentTrack.raga}</p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-yellow-400">🎵 Audio player hidden while video is playing</p>
              <a
                href={currentTrack.url || currentTrack.audioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                📺 Watch on YouTube
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Main Audio Player - Only show when YouTube player is not visible */}
      {!youtubePlayerVisible && (
        <div className="bg-white/10 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-4">
        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">
            {currentTrack.title || 'Unknown Title'}
          </h3>
          <p className="text-white/70 text-sm truncate">
            {currentTrack.artist || 'Unknown Artist'} • {currentTrack.raga || 'Unknown Raga'}
          </p>
          {currentTrack.event && (
            <p className="text-white/50 text-xs truncate">
              {currentTrack.event}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Previous Button */}
          <button
            onClick={onPrevious}
            className="p-2 text-white/70 hover:text-white transition-colors"
            title="Previous track"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            disabled={isLoading}
            className="p-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-full transition-colors"
            title={isLoading ? 'Loading...' : (isPlaying ? 'Pause' : 'Play')}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={onNext}
            className="p-2 text-white/70 hover:text-white transition-colors"
            title="Next track"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleMuteToggle}
            className="p-1 text-white/70 hover:text-white transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        {currentTrack.isUploadedAudio ? (
          <div className="flex items-center space-x-2 text-xs text-white/60">
            <span>{formatTime(currentTime)}</span>
            <div
              ref={progressRef}
              className="flex-1 h-2 bg-white/20 rounded-full cursor-pointer relative"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-200"
                style={{
                  width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%'
                }}
              />
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center text-xs text-white/60 py-2">
            <span>📺 YouTube Track - Use play button to show YouTube player</span>
          </div>
        )}
      </div>

      {/* Cache Progress Bar */}
      {isCaching && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-white/60 mb-1">
            <span>Caching audio file...</span>
            <span>{cacheProgress.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1 bg-white/10 rounded-full">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${cacheProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Info */}
      <div className="mt-2 flex items-center justify-between text-xs">
        {currentTrack.isUploadedAudio && (
          <div className="text-green-400">
            🎵 High Quality Uploaded Audio
          </div>
        )}
        {!currentTrack.isUploadedAudio && (
          <div className="text-yellow-400">
            📺 YouTube Track - Click play to show YouTube player
          </div>
        )}
        {isCaching && (
          <div className="text-blue-400">
            ⚡ Caching for seamless playback...
          </div>
        )}
        {!isCaching && !isLoading && !isPlaying && currentTrack.isUploadedAudio && (
          <div className="text-green-400">
            ✅ Ready to play
          </div>
        )}
        {!isCaching && !isLoading && !isPlaying && !currentTrack.isUploadedAudio && (
          <div className="text-yellow-400">
            🎬 Click play to show YouTube player
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;