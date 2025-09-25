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
  const { user, isAuthenticated, updateCredits } = useAuth();
  const [showLogin, setShowLogin] = useState(!isAuthenticated);
  
  // Reset auto-selection when user logs in/out
  useEffect(() => {
    if (isAuthenticated) {
      setHasAutoSelected(false);
    }
  }, [isAuthenticated]);
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
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  
  console.log('App render:', { 
    showCreditModal, 
    userCredits: user?.credits, 
    ragasCount: ragas.length, 
    artistsCount: artists.length,
    isAuthenticated 
  });

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
    // Handle both _id (uploaded tracks) and id (YouTube tracks)
    const trackId = track._id || track.id;
    const trackIndex = tracks.findIndex(t => (t._id || t.id) === trackId);
    if (trackIndex !== -1) {
      setCurrentTrackIndex(trackIndex);
    }
    setCurrentTrack(track);
    setIsPlaying(false);
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
        console.log('Fetching ragas...', { isAuthenticated, token: localStorage.getItem('token') });
        const data = await ragaApi.getRagas();
        console.log('Ragas fetched successfully:', data.length, 'ragas');
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
        console.log('Fetching artists...', { isAuthenticated, token: localStorage.getItem('token') });
        const data = await artistApi.getArtists();
        console.log('Artists fetched successfully:', data.length, 'artists');
        setArtists(data);
      } catch (error) {
        console.error('Error fetching artists:', error);
      }
    };
    fetchArtists();
  }, [isAuthenticated]);

  // Auto-select random starred raga and artist when data is loaded
  useEffect(() => {
    if (ragas.length > 0 && artists.length > 0 && !hasAutoSelected) {
      const selectRandomStarredRaga = () => {
        const currentSeason = getCurrentSeason();
        const currentHour = new Date().getHours();
        
        console.log('Auto-selection debug:', {
          currentSeason: currentSeason.english,
          currentHour,
          totalRagas: ragas.length
        });
        
        // Get all starred ragas (current hour + current season)
        const starredRagas = ragas.filter(raga => 
          raga.idealHours && raga.idealHours.includes(currentHour) && 
          raga.seasons && raga.seasons.includes(currentSeason.english)
        );
        
        console.log('Starred ragas found:', starredRagas.map(r => ({ name: r.name, idealHours: r.idealHours, seasons: r.seasons })));
        
        if (starredRagas.length > 0) {
          const randomIndex = Math.floor(Math.random() * starredRagas.length);
          const selectedRaga = starredRagas[randomIndex];
          console.log('Selected starred raga:', selectedRaga.name);
          return selectedRaga;
        }
        
        console.log('No starred ragas found - not selecting any raga');
        // No fallback - only select from starred ragas
        return null;
      };

      const selectRandomArtist = () => {
        if (artists.length > 0) {
          const randomIndex = Math.floor(Math.random() * artists.length);
          return artists[randomIndex];
        }
        return null;
      };

      const randomRaga = selectRandomStarredRaga();
      const randomArtist = selectRandomArtist();
      
      if (randomRaga) {
        setSelectedRaga(randomRaga);
      }
      if (randomArtist) {
        setSelectedArtist(randomArtist);
      }
      setHasAutoSelected(true);
    }
  }, [ragas, artists, hasAutoSelected]);

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

  if (!isAuthenticated) {
    return <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />;
  }


  return (
        <div className="min-h-screen flex flex-col">
          <Header 
            onBuyCredits={() => setShowCreditModal(true)} 
            onTransactionReport={() => setShowTransactionModal(true)}
            onConfigMenu={() => setShowConfigMenu(true)}
            isAdmin={user?.isAdmin || false}
          />
      
      <main className="flex-1 px-4 py-6 space-y-8 pt-32">
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
          
          {/* Buttons in One Row */}
          <div className="flex gap-3 items-center justify-center">
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