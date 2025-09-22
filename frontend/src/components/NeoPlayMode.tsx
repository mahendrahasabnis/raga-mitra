import React, { useState } from 'react';
// import { Track } from '../types';
import { audioApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Star, AlertCircle, Play, Pause, X } from 'lucide-react';

interface NeoPlayModeProps {
  onTracksFound: (tracks: any[]) => void;
  onTrackSelect: (track: any) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
}

const NeoPlayMode: React.FC<NeoPlayModeProps> = ({ onTracksFound, onTrackSelect, onPlayingChange }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Show error popup
  const showError = (errorMessage: string) => {
    setError(errorMessage);
    setShowErrorModal(true);
  };

  // Close error popup
  const closeErrorModal = () => {
    setShowErrorModal(false);
    setError('');
  };

  const handleNeoPlay = async () => {
    if (!user) {
      showError('Please login to use this feature');
      return;
    }

    if (user.credits <= 0) {
      showError('Insufficient credits. Please buy more credits.');
      return;
    }

    setLoading(true);

    try {
      // First try to get uploaded audio files from the database
      const response = await audioApi.getAudioFiles();
      const audioFiles = response.files || [];
      
      let tracks = [];
      
      if (audioFiles.length > 0) {
        // Convert uploaded audio files to track format
        tracks = audioFiles
          .map((file: any) => ({
            _id: file.filename,
            title: file.title || file.originalName,
            audioUrl: `http://localhost:3006/api/audio/stream/${file.filename}`,
            duration: file.duration || 'Unknown',
            likes: Math.floor(Math.random() * 10000) + 1000,
            raga: file.raga || 'Unknown',
            artist: file.artist || 'Unknown Artist',
            event: file.event || 'Unknown Event',
            isCurated: true,
            quality: 'High Quality',
            ratings: [],
            filename: file.filename,
            originalName: file.originalName,
            size: file.size,
            uploadDate: file.uploadDate,
            isUploadedAudio: true // Flag to identify uploaded audio
          }))
          .sort((a: any, b: any) => b.likes - a.likes)
          .slice(0, 10);
      } else {
        // Fallback to YouTube tracks if no uploaded audio files
        const youtubeResponse = await fetch('http://localhost:3006/api/tracks/youtube/search?raga=Yaman&artist=Pandit%20Jasraj&minDuration=1800&maxResults=10&orderBy=relevance', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (youtubeResponse.ok) {
          const youtubeData = await youtubeResponse.json();
          tracks = (youtubeData.tracks || []).map((track: any) => ({
            ...track,
            isUploadedAudio: false, // Flag to identify YouTube tracks
            audioUrl: track.url // Use YouTube URL for playback
          }));
        }
      }
      
      if (tracks.length > 0) {
        onTracksFound(tracks);
        // Auto-play first track
        playTrack(tracks[0]);
      } else {
        showError('No audio tracks available at the moment.');
      }
    } catch (err) {
      console.error('NeoPlay error:', err);
      showError('Failed to load audio tracks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Play track function
  const playTrack = (track: any) => {
    // Stop current track if playing
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }

    if (track.isUploadedAudio) {
      // Handle uploaded audio files - stream from GridFS
      const audio = new Audio(track.audioUrl);
      audio.preload = 'metadata';
      
      // Set up event listeners
      audio.addEventListener('loadstart', () => {
        console.log('Loading uploaded audio...');
      });
      
      audio.addEventListener('canplay', () => {
        console.log('Uploaded audio ready to play');
        audio.play().then(() => {
          setIsPlaying(true);
          setCurrentTrack(track);
          onTrackSelect(track);
          onPlayingChange?.(true);
        }).catch((err) => {
          console.error('Error playing uploaded audio:', err);
          showError('Error playing audio. Please try again.');
        });
      });
      
      audio.addEventListener('ended', () => {
        console.log('Uploaded audio ended');
        setIsPlaying(false);
        setCurrentTrack(null);
        onPlayingChange?.(false);
      });
      
      audio.addEventListener('error', (err) => {
        console.error('Uploaded audio error:', err);
        showError('Error loading audio. Please try again.');
        setIsPlaying(false);
      });
      
      // Store reference to audio element
      setAudioElement(audio);
    } else {
      // Handle YouTube tracks - use YouTube URL directly
      console.log('Playing YouTube track:', track.title);
      console.log('YouTube URL:', track.audioUrl);
      
      // For YouTube tracks, we can't play them directly in an Audio element
      // Instead, we'll just set the track as current and let the parent handle YouTube playback
      setCurrentTrack(track);
      onTrackSelect(track);
      onPlayingChange?.(true);
      setIsPlaying(true);
      
      // Show a message that this is a YouTube track
      console.log('YouTube track selected. Use the YouTube player to play this track.');
    }
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    if (!currentTrack) return;
    
    if (currentTrack.isUploadedAudio) {
      // Handle uploaded audio files
      if (!audioElement) return;
      
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
        onPlayingChange?.(false);
      } else {
        audioElement.play().then(() => {
          setIsPlaying(true);
          onPlayingChange?.(true);
        }).catch((err) => {
          console.error('Error playing audio:', err);
          showError('Error playing audio. Please try again.');
        });
      }
    } else {
      // Handle YouTube tracks - show message
      showError('YouTube tracks require the YouTube player. Please use the main track list to play YouTube videos.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <button
          onClick={handleNeoPlay}
          disabled={loading || !user || user.credits <= 0}
          className="btn-secondary text-sm px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <Star className="w-4 h-4" />
              <span>NeoPlay</span>
            </>
          )}
        </button>
      </div>

      {/* Current Playing Track */}
      {currentTrack && (
        <div className="bg-white/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={togglePlayPause}
                className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center hover:bg-primary-700 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white ml-1" />
                )}
              </button>
              <div>
                <h3 className="font-semibold text-white">{currentTrack.title}</h3>
                <p className="text-sm text-white/60">
                  {currentTrack.raga} • {currentTrack.artist}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/60">{currentTrack.duration}</p>
              <p className="text-xs text-white/40">{currentTrack.event}</p>
            </div>
          </div>
          
          {/* Progress bar placeholder */}
          <div className="w-full bg-white/20 rounded-full h-1">
            <div className="bg-primary-600 h-1 rounded-full" style={{ width: '0%' }}></div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-semibold text-gray-900">Error</h3>
              </div>
              <button
                onClick={closeErrorModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-700 mb-4">{error}</p>
            <div className="flex justify-end">
              <button
                onClick={closeErrorModal}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NeoPlayMode;
