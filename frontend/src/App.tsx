import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import LoginModal from './components/LoginModal';
import RagaSelector from './components/RagaSelector';
import ArtistCarousel from './components/ArtistCarousel';
import SurpriseMeButton from './components/SurpriseMeButton';
import FetchTracksButton from './components/FetchTracksButton';
import NeoPlayMode from './components/NeoPlayMode';
import YouTubePlayer from './components/YouTubePlayer';
import AudioPlayer from './components/AudioPlayer';
import TrackList from './components/TrackList';
import AudioTrackList from './components/AudioTrackList';
import CreditPurchaseModal from './components/CreditPurchaseModal';
import TransactionReport from './components/TransactionReport';
import ConfigMenu from './components/ConfigMenu';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Music, CreditCard } from 'lucide-react';
import { getCurrentSeason, getCurrentMarathiMonth, formatSeasonDisplay, formatMonthDisplay } from './utils/marathiCalendar';
import { ragaApi, artistApi } from './services/api';
// import { Raga, Artist, Track } from './types';

function AppContent() {
  const { user, isAuthenticated, updateCredits, checkAuthState } = useAuth();
  const [showLogin, setShowLogin] = useState(!isAuthenticated);

  // Show login screen when user logs out
  useEffect(() => {
    // Check if we have auth data in localStorage but context is not updated
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser && !isAuthenticated) {
      // Force update the context
      checkAuthState();
    }
    
    if (!isAuthenticated) {
      setShowLogin(true);
    } else {
      setShowLogin(false);
    }
  }, [isAuthenticated]);
  
  // Removed auto-selection reset logic
  const [selectedRaga, setSelectedRaga] = useState<any | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<any | null>(null);
  const [currentTrack, setCurrentTrack] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<any[]>([]);
  const [showNeoPlay, setShowNeoPlay] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [isAudioMode, setIsAudioMode] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [creditPackages, setCreditPackages] = useState<any[]>([]);
  const [quotaInfo, setQuotaInfo] = useState<any>(null);
  const [ragas, setRagas] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  // Removed hasAutoSelected state - no longer needed
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  

  // Player control functions

  const handlePrevious = () => {
    if (tracks.length > 0) {
      const prevIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : tracks.length - 1;
      setCurrentTrackIndex(prevIndex);
      setCurrentTrack(tracks[prevIndex]);
      setIsPlaying(false);
    }
  };

  const handleNext = () => {
    if (tracks.length > 0) {
      const nextIndex = currentTrackIndex < tracks.length - 1 ? currentTrackIndex + 1 : 0;
      setCurrentTrackIndex(nextIndex);
      setCurrentTrack(tracks[nextIndex]);
      setIsPlaying(false);
    }
  };

  // Track selection handler that also updates the index
  const handleTrackSelect = (track: any) => {
    console.log('Track selected:', track);
    console.log('Current tracks array:', tracks);
    // Handle both _id (uploaded tracks) and id (YouTube tracks)
    const trackId = track._id || track.id;
    const trackIndex = tracks.findIndex(t => (t._id || t.id) === trackId);
    console.log('Track index found:', trackIndex);
    if (trackIndex !== -1) {
      setCurrentTrackIndex(trackIndex);
    }
    setCurrentTrack(track);
    setIsPlaying(false);
    console.log('Current track set to:', track);
  };

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Load ragas data
  useEffect(() => {
    const fetchRagas = async () => {
      try {
        const data = await ragaApi.getRagas();
        setRagas(data);
      } catch (error) {
        console.error('Error fetching ragas:', error);
      }
    };
    fetchRagas();
  }, [isAuthenticated]);

  // Load artists data
  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const data = await artistApi.getArtists();
        setArtists(data);
      } catch (error) {
        console.error('Error fetching artists:', error);
      }
    };
    fetchArtists();
  }, [isAuthenticated]);

  // AUTO-SELECTION DISABLED: User must manually select ragas and artists
  // Removed auto-selection logic completely

  const getSeasonName = (date: Date): string => {
    const currentSeason = getCurrentSeason(date);
    const currentMonth = getCurrentMarathiMonth(date);
    return `${formatSeasonDisplay(currentSeason.english)} - ${currentMonth.marathi} (${currentMonth.english})`;
  };

  const handleCreditPurchase = async (credits: number, amount: number) => {
    try {
      // TODO: Implement actual payment processing API call
      console.log(`Purchasing ${credits} credits for ₹${amount}`);
      
      // Update the user's credits locally
      if (user) {
        const updatedCredits = user.credits + credits;
        // Update the user context with new credits
        // This would normally be done through an API call
        console.log(`Credits updated: ${user.credits} + ${credits} = ${updatedCredits}`);
        
        // Update the user context
        updateCredits(updatedCredits);
      }
      
      // Show success message (you could add a toast notification here)
      alert(`Successfully purchased ${credits} credits for ₹${amount}!`);
    } catch (error) {
      console.error('Credit purchase failed:', error);
      alert('Purchase failed. Please try again.');
    }
  };

  const handlePackageUpdate = (packages: any[]) => {
    setCreditPackages(packages);
    console.log('Packages updated:', packages);
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const marathiMonth = getCurrentMarathiMonth(date);
    return `${day}-${month}-${year} (${marathiMonth.marathi})`;
  };

  // Check authentication state more robustly
  const hasToken = localStorage.getItem('token');
  const hasUser = localStorage.getItem('user');
  const isActuallyAuthenticated = isAuthenticated || (hasToken && hasUser);
  

  if (!isActuallyAuthenticated) {
    return <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />;
  }



  return (
        <div className="min-h-screen flex flex-col">
          {/* Clean header with welcome info */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold">राग उत्सव (Celebration of Raga)</h1>
                <p className="text-sm opacity-90">Welcome: {user?.phone}</p>
              </div>
              <div className="text-right">
                <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
                  Role: {user?.role?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          
          <Header 
            onBuyCredits={() => setShowCreditModal(true)} 
            onTransactionReport={() => setShowTransactionModal(true)}
            onConfigMenu={() => setShowConfigMenu(true)}
            isAdmin={user?.isAdmin || false}
          />
      
      <main className="flex-1 px-3 py-4 space-y-6 sm:px-4 sm:py-6 sm:space-y-8">
        {/* Raga Selection */}
        <RagaSelector
          selectedRaga={selectedRaga}
          onRagaSelect={setSelectedRaga}
          ragas={ragas}
        />

        {/* Artist Carousel */}
        <ArtistCarousel
          selectedRaga={selectedRaga}
          selectedArtist={selectedArtist}
          onArtistSelect={setSelectedArtist}
          artists={artists}
        />

        {/* Action Buttons */}
        <div className="space-y-4">
          {/* Searching Status */}
          {selectedRaga && selectedArtist && !isAudioMode && (
            <div className="text-center">
              <p className="text-sm text-white/60">
                <Music className="w-4 h-4 inline mr-1" />
                Searching for {selectedRaga.name} by {selectedArtist.name}
              </p>
            </div>
          )}
          
          {/* Buttons - Responsive Layout */}
          <div className="flex flex-col space-y-3 sm:flex-row sm:gap-3 sm:items-center sm:justify-center sm:space-y-0">
            <SurpriseMeButton
              selectedRaga={selectedRaga}
              selectedArtist={selectedArtist}
              ragas={ragas}
              artists={artists}
              onRagaSelect={setSelectedRaga}
              onArtistSelect={setSelectedArtist}
              onTracksFound={(tracks, quotaInfo) => {
                setTracks(tracks);
                setCurrentTrackIndex(0);
                setIsAudioMode(false);
                setQuotaInfo(quotaInfo);
              }}
              onTrackSelect={handleTrackSelect}
            />
            <FetchTracksButton
              selectedRaga={selectedRaga}
              selectedArtist={selectedArtist}
              onTracksFound={(tracks, quotaInfo) => {
                setTracks(tracks);
                setCurrentTrackIndex(0);
                setIsAudioMode(false);
                setQuotaInfo(quotaInfo);
              }}
              onTrackSelect={handleTrackSelect}
            />
            <NeoPlayMode
              selectedRaga={selectedRaga}
              onTracksFound={(tracks) => {
                setTracks(tracks);
                setCurrentTrackIndex(0);
                setIsAudioMode(true);
              }}
              onTrackSelect={handleTrackSelect}
              onPlayingChange={setIsPlaying}
            />
          </div>
          
          {/* Credit Information */}
          {user && (
            <div className="text-center space-y-1">
              <p className="text-sm text-white/60">
                Uses 1 credit • {user.credits} credits remaining
              </p>
              {/* Quota Information - Admin Only */}
              {quotaInfo && quotaInfo.isAdmin && (
                <p className="text-xs text-white/50">
                  This Search {quotaInfo.quotaUsed} | {quotaInfo.quotaStatus.used}/{quotaInfo.quotaStatus.limit} | {quotaInfo.quotaStatus.remaining} remaining
                </p>
              )}
            </div>
          )}
        </div>


        {/* Audio Player */}
        {console.log('Player visibility check - currentTrack:', currentTrack, 'tracks.length:', tracks.length)}
        {currentTrack && (
          <AudioPlayer
            currentTrack={currentTrack}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onTrackSelect={handleTrackSelect}
          />
        )}

        {/* Track List */}
        {console.log('Rendering track list. Tracks length:', tracks.length, 'isAudioMode:', isAudioMode)}
        {tracks.length > 0 && (
          <>
            {isAudioMode ? (
              <AudioTrackList
                tracks={tracks}
                onTrackSelect={handleTrackSelect}
              />
            ) : (
              <TrackList
                tracks={tracks}
                onTrackSelect={handleTrackSelect}
                selectedArtist={selectedArtist}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
              />
            )}
          </>
        )}
        {tracks.length === 0 && (
          <div className="text-center text-white/60 py-8">
            <p>No tracks loaded. Try using Surprise Me, Fetch Tracks, or NeoPlay buttons.</p>
          </div>
        )}
      </main>

      <Footer />
      
          {/* Credit Purchase Modal */}
          <CreditPurchaseModal
            isOpen={showCreditModal}
            onClose={() => setShowCreditModal(false)}
            onPurchase={handleCreditPurchase}
            currentCredits={user?.credits || 0}
            packages={creditPackages}
            userPhone={user?.phone || '+1234567890'}
          />
      
          
          {/* Transaction Report Modal */}
          <TransactionReport
            isOpen={showTransactionModal}
            onClose={() => setShowTransactionModal(false)}
            isAdmin={user?.isAdmin || false}
          />

          {/* Configuration Menu */}
          <ConfigMenu
            isOpen={showConfigMenu}
            onClose={() => setShowConfigMenu(false)}
            isAdmin={user?.isAdmin || false}
          />

    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;