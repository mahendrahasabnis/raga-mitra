import React, { useState } from 'react';
// import { Track } from '../types';
import { audioApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Star, AlertCircle, Play, Pause, X } from 'lucide-react';
import { audioCacheService } from '../services/audioCacheService';

interface NeoPlayModeProps {
  selectedRaga: any | null;
  onTracksFound: (tracks: any[]) => void;
  onTrackSelect: (track: any) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  onPlayerControl?: (action: 'play' | 'pause' | 'previous' | 'next') => void;
}

const NeoPlayMode: React.FC<NeoPlayModeProps> = ({ 
  selectedRaga,
  onTracksFound, 
  onTrackSelect, 
  onPlayingChange,
  onPlayerControl 
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [tracks, setTracks] = useState<any[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

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


  const handlePrevious = () => {
    if (tracks.length > 0) {
      const prevIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : tracks.length - 1;
      setCurrentTrackIndex(prevIndex);
      onTrackSelect(tracks[prevIndex]);
    }
    onPlayerControl?.('previous');
  };

  const handleNext = () => {
    if (tracks.length > 0) {
      const nextIndex = currentTrackIndex < tracks.length - 1 ? currentTrackIndex + 1 : 0;
      setCurrentTrackIndex(nextIndex);
      onTrackSelect(tracks[nextIndex]);
    }
    onPlayerControl?.('next');
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

    if (!selectedRaga) {
      showError('Please select a raga first to use NeoPlay.');
      return;
    }

    setLoading(true);

    try {
      console.log('Starting NeoPlay for raga:', selectedRaga.name);
      
      // First try to get uploaded audio files from the database
      const response = await audioApi.getAudioFiles();
      const audioFiles = response.files || [];
      
      let tracks = [];
      
      if (audioFiles.length > 0) {
        // Filter audio files by selected raga
        const filteredAudioFiles = audioFiles.filter((file: any) => {
          const fileRaga = file.raga ? file.raga.toLowerCase() : '';
          const selectedRagaName = selectedRaga.name ? selectedRaga.name.toLowerCase() : '';
          
          // Check for exact match or partial match
          return fileRaga.includes(selectedRagaName) || 
                 selectedRagaName.includes(fileRaga) ||
                 fileRaga === selectedRagaName;
        });

        console.log(`Found ${filteredAudioFiles.length} audio files for raga: ${selectedRaga.name}`);

        // Convert filtered uploaded audio files to track format
        tracks = filteredAudioFiles
          .map((file: any) => ({
            _id: file._id,
            title: file.title || file.originalName,
            audioUrl: `https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api/audio/stream/${file._id}`,
            duration: file.duration || 'Unknown',
            durationSeconds: file.durationSeconds || 0,
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
            isUploadedAudio: true,
            // Add metadata for better player experience
            metadata: {
              title: file.title || file.originalName,
              artist: file.artist || 'Unknown Artist',
              raga: file.raga || 'Unknown',
              event: file.event || 'Unknown Event',
              duration: file.durationSeconds || 0,
              size: file.size || 0
            }
          }))
          .sort((a: any, b: any) => b.likes - a.likes)
          .slice(0, 10);

        // Start background caching
        audioCacheService.preloadAudio(tracks);
      }
      
      // If no uploaded audio files found for the raga, try YouTube search
      if (tracks.length === 0) {
        console.log('No uploaded audio files found, searching YouTube for raga:', selectedRaga.name);
        
        const youtubeResponse = await fetch(`https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api/tracks/youtube/search?raga=${encodeURIComponent(selectedRaga.name)}&minDuration=1800&maxResults=10&orderBy=relevance`, {
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
        setTracks(tracks);
        setCurrentTrackIndex(0);
        onTracksFound(tracks);
        // Set first track as current but don't auto-play
        onTrackSelect(tracks[0]);
        console.log(`NeoPlay loaded ${tracks.length} tracks for raga: ${selectedRaga.name}`);
      } else {
        showError(`No audio tracks found for raga: ${selectedRaga.name}. Please try a different raga or upload some audio files.`);
      }
    } catch (err) {
      console.error('NeoPlay error:', err);
      showError('Failed to load audio tracks. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="space-y-4">
      <div className="text-center">
        <button
          onClick={handleNeoPlay}
          disabled={loading || !user || user.credits <= 0 || !selectedRaga}
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
              <span>NeoPlay {selectedRaga ? `(${selectedRaga.name})` : ''}</span>
            </>
          )}
        </button>
      </div>


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
