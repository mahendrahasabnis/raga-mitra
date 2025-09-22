import React, { useState, useEffect, useRef } from 'react';
// import { Raga } from '../types';
import { ragaApi } from '../services/api';
import { Star, Search } from 'lucide-react';
import { getCurrentSeason } from '../utils/marathiCalendar';

interface RagaSelectorProps {
  selectedRaga: any | null;
  onRagaSelect: (raga: any) => void;
  ragas: any[];
}

const RagaSelector: React.FC<RagaSelectorProps> = ({ selectedRaga, onRagaSelect, ragas }) => {
  const [filteredRagas, setFilteredRagas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ragas.length > 0) {
      setFilteredRagas(ragas);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [ragas]);

  // Sort and filter ragas based on current season, hour, and popularity
  useEffect(() => {
    if (ragas.length === 0) return;

    const currentSeason = getCurrentSeason();
    const currentHour = new Date().getHours();
    
    // Filter ragas by current season
    const seasonFilteredRagas = ragas.filter(raga => 
      raga.seasons && raga.seasons.includes(currentSeason.english)
    );
    
    // If no ragas for current season, use all ragas
    const ragasToSort = seasonFilteredRagas.length > 0 ? seasonFilteredRagas : ragas;
    
    // Separate ragas into categories
    const starredRagas = ragasToSort.filter(raga => 
      raga.idealHours && raga.idealHours.includes(currentHour) && 
      raga.seasons && raga.seasons.includes(currentSeason.english)
    );
    
    const anyTimeRagas = ragasToSort.filter(raga => 
      raga.idealHours && raga.idealHours.includes(0)
    );
    
    const timeSpecificRagas = ragasToSort.filter(raga => 
      raga.idealHours && !raga.idealHours.includes(0) && 
      !(raga.idealHours.includes(currentHour) && raga.seasons && raga.seasons.includes(currentSeason.english))
    );
    
    // Sort starred ragas by popularity
    starredRagas.sort((a, b) => {
      const popularityOrder = {
        'highly listened': 1,
        'moderately listened': 2,
        'sparingly listened': 3,
        'rarely listened': 4
      };
      const aOrder = popularityOrder[a.popularity as keyof typeof popularityOrder] || 5;
      const bOrder = popularityOrder[b.popularity as keyof typeof popularityOrder] || 5;
      return aOrder - bOrder;
    });
    
    // Sort time-specific ragas by ascending time of day
    timeSpecificRagas.sort((a, b) => {
      const aMinHour = Math.min(...a.idealHours);
      const bMinHour = Math.min(...b.idealHours);
      return aMinHour - bMinHour;
    });
    
    // Sort any-time ragas by popularity
    anyTimeRagas.sort((a, b) => {
      const popularityOrder = {
        'highly listened': 1,
        'moderately listened': 2,
        'sparingly listened': 3,
        'rarely listened': 4
      };
      const aOrder = popularityOrder[a.popularity as keyof typeof popularityOrder] || 5;
      const bOrder = popularityOrder[b.popularity as keyof typeof popularityOrder] || 5;
      return aOrder - bOrder;
    });
    
    // Combine all ragas in order
    const sortedRagas = [...starredRagas, ...timeSpecificRagas, ...anyTimeRagas];
    
    // Apply search filter
    let filteredRagas = sortedRagas;
    if (searchTerm.trim() !== '') {
      filteredRagas = sortedRagas.filter(raga => {
        const searchLower = searchTerm.toLowerCase();
        const ragaName = raga.name.toLowerCase();
        const popularity = raga.popularity ? raga.popularity.toLowerCase() : '';
        const timeRange = formatTimeRange(raga.idealHours).toLowerCase();
        
        // Search by raga name
        if (ragaName.includes(searchLower)) return true;
        
        // Search by popularity
        if (popularity.includes(searchLower)) return true;
        
        // Search by time-related terms
        if (searchLower.includes('any time') || searchLower.includes('all day')) {
          return raga.idealHours && raga.idealHours.includes(0);
        }
        
        // Search by specific time
        if (searchLower.includes('am') || searchLower.includes('pm') || searchLower.includes('time')) {
          return timeRange.includes(searchLower);
        }
        
        // Search by hour number
        const hourMatch = searchLower.match(/\d+/);
        if (hourMatch) {
          const hour = parseInt(hourMatch[0]);
          return raga.idealHours && raga.idealHours.includes(hour);
        }
        
        return false;
      });
    }

    // Move selected raga to first position
    if (selectedRaga) {
      const selectedIndex = filteredRagas.findIndex(raga => raga._id === selectedRaga._id);
      if (selectedIndex > 0) {
        const selectedRagaItem = filteredRagas[selectedIndex];
        filteredRagas = [selectedRagaItem, ...filteredRagas.filter((_, index) => index !== selectedIndex)];
      }
    }

    setFilteredRagas(filteredRagas);
  }, [searchTerm, ragas, selectedRaga]);

  // Scroll to selected raga when it changes
  useEffect(() => {
    if (selectedRaga && scrollContainerRef.current) {
      // Add a small delay to ensure DOM is updated
      const timeoutId = setTimeout(() => {
        const selectedElement = scrollContainerRef.current?.querySelector(`[data-raga-id="${selectedRaga._id}"]`);
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
  }, [selectedRaga]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Select a Raga ({ragas.length})</h2>
        </div>
            <div className="scroll-container">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-40 h-14 bg-white/10 rounded-xl animate-pulse" />
              ))}
            </div>
      </div>
    );
  }

  const formatTimeRange = (idealHours: number[]) => {
    if (!idealHours || idealHours.length === 0) return 'Any time';
    
    // If 0 is in the array, it means "any time of day"
    if (idealHours.includes(0)) return 'Any time of day';
    
    const sortedHours = [...idealHours].sort((a, b) => a - b);
    const startHour = sortedHours[0];
    const endHour = sortedHours[sortedHours.length - 1];
    
    const formatHour = (hour: number) => {
      if (hour === 0) return '12 AM';
      if (hour < 12) return `${hour} AM`;
      if (hour === 12) return '12 PM';
      return `${hour - 12} PM`;
    };
    
    if (startHour === endHour) {
      return formatHour(startHour);
    }
    
    return `${formatHour(startHour)} - ${formatHour(endHour)}`;
  };

  const isRecommendedForCurrentHour = (raga: any) => {
    const currentHour = new Date().getHours();
    const currentSeason = getCurrentSeason();
    
    // Check if raga has current hour in idealHours array
    const hasCurrentHour = raga.idealHours && raga.idealHours.includes(currentHour);
    
    // Check if raga has current season in seasons array
    const hasCurrentSeason = raga.seasons && raga.seasons.includes(currentSeason.english);
    
    // Both conditions must be true for recommendation
    return hasCurrentHour && hasCurrentSeason;
  };

  const getPopularityColor = (popularity: string) => {
    switch (popularity) {
      case 'highly listened':
        return 'text-green-400';
      case 'moderately listened':
        return 'text-yellow-400';
      case 'sparingly listened':
      case 'rarely listened':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatPopularity = (popularity: string) => {
    switch (popularity) {
      case 'highly listened':
        return 'High';
      case 'moderately listened':
        return 'Medium';
      case 'sparingly listened':
        return 'Rare';
      case 'rarely listened':
        return 'Rare';
      default:
        return 'Unknown';
    }
  };


  return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Select a Raga ({ragas.length})</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
              <input
                type="text"
                placeholder="Search by name, time, popularity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-56 pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/60">
            <div className="flex items-center space-x-1">
              <Star className="w-3 h-3 text-yellow-400 fill-current" />
              <span>Recommended for current hour & season</span>
            </div>
          </div>
          
          {/* Divider line */}
          <div className="border-b border-white/20"></div>
      
      {filteredRagas.length === 0 ? (
        <div className="text-center py-8 text-white/60">
          <p>{searchTerm ? 'No ragas found matching your search' : 'No ragas available'}</p>
        </div>
      ) : (
        <div ref={scrollContainerRef} className="scroll-container max-w-full">
          {filteredRagas.map((raga) => {
            const isRecommendedForHour = isRecommendedForCurrentHour(raga);
            const popularityColor = getPopularityColor(raga.popularity);
            const popularityText = formatPopularity(raga.popularity);
            
            return (
              <div
                key={raga._id}
                data-raga-id={raga._id}
                onClick={() => onRagaSelect(raga)}
                className={`flex-shrink-0 w-40 h-24 rounded-xl p-3 cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[6rem] ${
                  selectedRaga?._id === raga._id
                    ? 'bg-primary-600/30 border-2 border-primary-500'
                    : 'bg-white/10 border border-white/20 hover:bg-white/20'
                }`}
              >
                <div className="flex items-center justify-center space-x-1 w-full h-12">
                  <h3 className="font-semibold text-white text-center break-words leading-tight max-w-full" style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    overflow: 'hidden'
                  }}>{raga.name}</h3>
                  {isRecommendedForHour && (
                    <Star className="w-4 h-4 text-yellow-400 fill-current flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-white/80 mt-1 text-center break-words max-w-full" style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  overflow: 'hidden'
                }}>
                  {formatTimeRange(raga.idealHours)}
                </p>
                <p className={`text-xs font-medium mt-1 ${popularityColor} break-words max-w-full`} style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  overflow: 'hidden'
                }}>
                  {popularityText}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RagaSelector;
