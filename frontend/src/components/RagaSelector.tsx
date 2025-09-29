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

  const formatTimeRange = (idealHours: number[]) => {
    if (!idealHours || idealHours.length === 0) return 'Any time';
    
    const formatHour = (hour: number) => {
      if (hour === 0) return '12 AM';
      if (hour < 12) return `${hour} AM`;
      if (hour === 12) return '12 PM';
      return `${hour - 12} PM`;
    };
    
    // If only one element and it's 0, show "Any Time"
    if (idealHours.length === 1 && idealHours[0] === 0) {
      return 'Any Time';
    }
    
    // If only one element, show just that element
    if (idealHours.length === 1) {
      return formatHour(idealHours[0]);
    }
    
    // Show first element - last element
    const firstHour = idealHours[0];
    const lastHour = idealHours[idealHours.length - 1];
    
    return `${formatHour(firstHour)} - ${formatHour(lastHour)}`;
  };

  // Smart sorting: ragas with current+next hour, sorted by first hour
  useEffect(() => {
    if (ragas.length === 0) return;

    const currentHour = new Date().getHours();
    
    console.log('🕐 Current hour:', currentHour);
    
    // Find ragas whose idealHours array contains current hour AND are NOT "any time" ragas
    const currentHourRagas = ragas.filter(raga => {
      if (!raga.idealHours || raga.idealHours.length === 0) return false;
      // Must contain current hour AND must not be "any time" raga
      const hasCurrentHour = raga.idealHours.includes(currentHour);
      const isAnyTime = raga.idealHours.length === 1 && raga.idealHours.includes(0);
      const hasOnlyZero = raga.idealHours.every(hour => hour === 0);
      const hasValidHours = raga.idealHours.some(hour => hour > 0);
      
      // STRICT FILTERING: Must have current hour, not be any-time, not have only zeros, and have valid hours
      return hasCurrentHour && !isAnyTime && !hasOnlyZero && hasValidHours;
    });
    
    const anyTimeRagas = ragas.filter(raga => {
      if (!raga.idealHours || raga.idealHours.length === 0) return false;
      return raga.idealHours.length === 1 && raga.idealHours.includes(0);
    });
    
    // Get all remaining ragas (not current hour and not any-time)
    const currentHourIds = new Set(currentHourRagas.map(r => r._id));
    const anyTimeIds = new Set(anyTimeRagas.map(r => r._id));
    
    const remainingRagas = ragas.filter(raga => {
      return !currentHourIds.has(raga._id) && !anyTimeIds.has(raga._id);
    });
    
    // Sort current hour ragas by the first value in their idealHours array
    const sortedCurrentHourRagas = currentHourRagas.sort((a, b) => {
      const aFirstHour = a.idealHours && a.idealHours.length > 0 ? a.idealHours[0] : 24;
      const bFirstHour = b.idealHours && b.idealHours.length > 0 ? b.idealHours[0] : 24;
      return aFirstHour - bFirstHour;
    });
    
    // Sort remaining ragas by name for consistency
    const sortedRemainingRagas = remainingRagas.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
    
    // Combine: current hour ragas first, then any time ragas, then all remaining ragas
    const sortedRagas = [...sortedCurrentHourRagas, ...anyTimeRagas, ...sortedRemainingRagas];
    
    console.log('🎯 Current hour ragas (before sorting):', currentHourRagas.map(r => ({
      name: r.name,
      hours: r.idealHours,
      timeRange: formatTimeRange(r.idealHours)
    })));
    
    console.log('🎯 Current hour ragas (after sorting):', sortedCurrentHourRagas.map(r => ({
      name: r.name,
      firstHour: r.idealHours?.[0] || 'none',
      hours: r.idealHours,
      timeRange: formatTimeRange(r.idealHours)
    })));
    
    console.log('🕐 Any time ragas:', anyTimeRagas.map(r => ({
      name: r.name,
      hours: r.idealHours,
      timeRange: formatTimeRange(r.idealHours)
    })));
    
    console.log('🎵 Remaining ragas:', sortedRemainingRagas.length, 'ragas');
    
    // AUTO-SELECTION DISABLED: User will manually select ragas
    console.log('🔍 Auto-selection disabled - user must manually select ragas');
    console.log('🔍 Current hour:', currentHour);
    console.log('🔍 Total ragas:', ragas.length);
    console.log('🔍 Current hour ragas available:', sortedCurrentHourRagas.length);
    console.log('🔍 Any time ragas available:', anyTimeRagas.length);
    console.log('🔍 Remaining ragas available:', sortedRemainingRagas.length);
    console.log('🔍 Total in carousel:', sortedRagas.length);
    
    // Apply search filter
    let filteredRagas = sortedRagas;
    if (searchTerm.trim() !== '') {
      filteredRagas = sortedRagas.filter(raga => {
        const searchLower = searchTerm.toLowerCase();
        const ragaName = raga.name.toLowerCase();
        
        // Simple search by raga name only
        return ragaName.includes(searchLower);
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
                className="w-56 pl-10 pr-10 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60 hover:text-white/90 transition-colors"
                  title="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
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
                onClick={() => {
                  console.log('🎯 Raga clicked:', raga.name, 'ID:', raga._id);
                  onRagaSelect(raga);
                }}
                className={`flex-shrink-0 w-40 h-24 rounded-xl p-3 cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[6rem] ${
                  selectedRaga?._id === raga._id
                    ? 'bg-blue-600 border-4 border-blue-300 shadow-lg shadow-blue-500/50'
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
