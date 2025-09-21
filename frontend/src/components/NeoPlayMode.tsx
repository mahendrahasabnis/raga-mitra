import React, { useState } from 'react';
// import { Track } from '../types';
import { trackApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Music, Star, AlertCircle } from 'lucide-react';

interface NeoPlayModeProps {
  onTracksFound: (tracks: any[]) => void;
  onTrackSelect: (track: any) => void;
}

const NeoPlayMode: React.FC<NeoPlayModeProps> = ({ onTracksFound, onTrackSelect }) => {
  const { user, updateCredits } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNeoPlay = async () => {
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
      // Skip credit check for now - implement audio track loading directly
      // TODO: Re-enable credit system once JWT authentication is fixed
      // await trackApi.useCredit();
      // updateCredits(user.credits - 1);

      // Get curated audio tracks
      const tracks = await getCuratedAudioTracks();
      
      if (tracks.length > 0) {
        onTracksFound(tracks);
        // Auto-play first track
        onTrackSelect(tracks[0]);
      } else {
        setError('No curated audio tracks available at the moment.');
      }
    } catch (err) {
      console.error('NeoPlay error:', err);
      setError('Failed to load curated audio tracks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Mock function to get curated audio tracks from storage
  const getCuratedAudioTracks = async () => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock curated audio tracks data
    const curatedTracks = [
      {
        _id: 'audio1',
        title: 'Bageshri - Morning Meditation',
        audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', // Placeholder audio URL
        duration: '42:15',
        likes: 8500,
        raga: 'Bageshri',
        artist: 'Pandit Ravi Shankar',
        isCurated: true,
        quality: 'High Quality',
        ratings: [
          { userId: 'user1', rating: 5, createdAt: new Date() },
          { userId: 'user2', rating: 4, createdAt: new Date() }
        ]
      },
      {
        _id: 'audio2',
        title: 'Yaman - Evening Raga',
        audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        duration: '38:30',
        likes: 9200,
        raga: 'Yaman',
        artist: 'Ustad Vilayat Khan',
        isCurated: true,
        quality: 'Studio Master',
        ratings: [
          { userId: 'user1', rating: 5, createdAt: new Date() },
          { userId: 'user3', rating: 5, createdAt: new Date() }
        ]
      },
      {
        _id: 'audio3',
        title: 'Bhairavi - Spiritual Journey',
        audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        duration: '45:20',
        likes: 7800,
        raga: 'Bhairavi',
        artist: 'Pandit Jasraj',
        isCurated: true,
        quality: 'High Quality',
        ratings: [
          { userId: 'user2', rating: 4, createdAt: new Date() }
        ]
      },
      {
        _id: 'audio4',
        title: 'Darbari - Night Raga',
        audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        duration: '50:10',
        likes: 11200,
        raga: 'Darbari',
        artist: 'Ustad Amjad Ali Khan',
        isCurated: true,
        quality: 'Studio Master',
        ratings: [
          { userId: 'user1', rating: 5, createdAt: new Date() },
          { userId: 'user2', rating: 5, createdAt: new Date() },
          { userId: 'user3', rating: 4, createdAt: new Date() }
        ]
      },
      {
        _id: 'audio5',
        title: 'Kafi - Traditional Alap',
        audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        duration: '35:45',
        likes: 6800,
        raga: 'Kafi',
        artist: 'Pandit Hariprasad Chaurasia',
        isCurated: true,
        quality: 'High Quality',
        ratings: [
          { userId: 'user2', rating: 4, createdAt: new Date() }
        ]
      },
      {
        _id: 'audio6',
        title: 'Malkauns - Deep Meditation',
        audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        duration: '48:25',
        likes: 9500,
        raga: 'Malkauns',
        artist: 'Pandit Shivkumar Sharma',
        isCurated: true,
        quality: 'Studio Master',
        ratings: [
          { userId: 'user1', rating: 5, createdAt: new Date() },
          { userId: 'user3', rating: 5, createdAt: new Date() }
        ]
      },
      {
        _id: 'audio7',
        title: 'Todi - Morning Raga',
        audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        duration: '41:15',
        likes: 7200,
        raga: 'Todi',
        artist: 'Ustad Bismillah Khan',
        isCurated: true,
        quality: 'High Quality',
        ratings: [
          { userId: 'user2', rating: 4, createdAt: new Date() }
        ]
      },
      {
        _id: 'audio8',
        title: 'Hamsadhwani - Evening Bliss',
        audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        duration: '39:50',
        likes: 8800,
        raga: 'Hamsadhwani',
        artist: 'Ustad Zakir Hussain',
        isCurated: true,
        quality: 'Studio Master',
        ratings: [
          { userId: 'user1', rating: 5, createdAt: new Date() },
          { userId: 'user2', rating: 4, createdAt: new Date() }
        ]
      }
    ];

    return curatedTracks;
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

      {error && (
        <div className="flex items-center space-x-2 text-red-300 bg-red-500/20 border border-red-500/50 rounded-lg p-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
};

export default NeoPlayMode;
