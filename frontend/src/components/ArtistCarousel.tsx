import React, { useState, useEffect, useRef } from 'react';
// import { Artist, Raga } from '../types';
import { artistApi } from '../services/api';
import { Star, Search } from 'lucide-react';

interface ArtistCarouselProps {
  selectedRaga: any | null;
  selectedArtist: any | null;
  onArtistSelect: (artist: any) => void;
  artists: any[];
}

const ArtistCarousel: React.FC<ArtistCarouselProps> = ({ 
  selectedRaga, 
  selectedArtist, 
  onArtistSelect,
  artists
}) => {
  const [filteredArtists, setFilteredArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (artists.length > 0) {
      setFilteredArtists(artists);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [artists]);

  // Filter artists based on search term and move selected artist to first position
  useEffect(() => {
    let filtered = artists;
    
    // Apply search filter
    if (searchTerm.trim() !== '') {
      filtered = artists.filter(artist =>
        artist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (artist.gharana && artist.gharana.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (artist.specialty && artist.specialty.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (artist.knownRagas && artist.knownRagas.some(raga => 
          raga.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
    }
    
    // Move selected artist to first position
    if (selectedArtist) {
      const selectedIndex = filtered.findIndex(artist => artist._id === selectedArtist._id);
      if (selectedIndex > 0) {
        const selectedArtistItem = filtered[selectedIndex];
        filtered = [selectedArtistItem, ...filtered.filter((_, index) => index !== selectedIndex)];
      }
    }
    
    setFilteredArtists(filtered);
  }, [searchTerm, artists, selectedArtist]);

  // Scroll to selected artist when it changes
  useEffect(() => {
    if (selectedArtist && scrollContainerRef.current) {
      // Add a small delay to ensure DOM is updated
      const timeoutId = setTimeout(() => {
        const selectedElement = scrollContainerRef.current?.querySelector(`[data-artist-id="${selectedArtist._id}"]`);
        if (selectedElement) {
          selectedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedArtist]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            {selectedRaga ? `Artists for ${selectedRaga.name}` : 'All Artists'}
          </h2>
        </div>
            <div className="scroll-container">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-48 h-20 bg-white/10 rounded-xl animate-pulse" />
              ))}
            </div>
      </div>
    );
  }

  return (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              {selectedRaga ? `Artists for ${selectedRaga.name} (${artists.length})` : `All Artists (${artists.length})`}
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
              <input
                type="text"
                placeholder="Search artists, gharana, specialty, or ragas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Divider line */}
          <div className="border-b border-white/20"></div>
      
      {filteredArtists.length === 0 ? (
        <div className="text-center py-8 text-white/60">
          <p>{searchTerm ? 'No artists found matching your search' : 'No artists found for this raga'}</p>
        </div>
      ) : (
        <div ref={scrollContainerRef} className="scroll-container max-w-full">
          {filteredArtists.map((artist) => (
            <div
              key={artist._id}
              data-artist-id={artist._id}
              onClick={() => onArtistSelect(artist)}
              className={`flex-shrink-0 w-48 h-20 rounded-xl p-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                selectedArtist?._id === artist._id
                  ? 'bg-primary-600/30 border-2 border-primary-500'
                  : 'bg-white/10 border border-white/20 hover:bg-white/20'
              }`}
            >
              {/* Artist Name and Gharana - Top Row */}
              <div className="flex flex-col items-center justify-center w-full flex-1 min-h-0">
                <h3 className="font-medium text-white text-center break-words hyphens-auto leading-tight" style={{
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  whiteSpace: 'normal',
                  lineHeight: '1.2',
                  fontSize: 'clamp(0.75rem, 2.5vw, 0.875rem)',
                  maxHeight: '100%',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>{artist.name}</h3>
                {artist.gharana && (
                  <p className="text-xs text-white/60 text-center mt-1 break-words" style={{
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'normal',
                    lineHeight: '1.1'
                  }}>{artist.gharana}</p>
                )}
              </div>
              
              {/* Specialty and Rating - Bottom Row */}
              <div className="flex items-center justify-between w-full">
                <span className="text-xs text-white/70 break-words flex-1 mr-2 max-w-full overflow-hidden" style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}>
                  {artist.specialty || artist.gharana || 'Classical'}
                </span>
                <div className="flex items-center space-x-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  <span className="text-xs text-white/80">{artist.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArtistCarousel;
