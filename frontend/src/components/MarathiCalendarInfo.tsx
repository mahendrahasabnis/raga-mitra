import React from 'react';
import { getCurrentSeason, getCurrentMarathiMonth, getAllSeasons, getAllMarathiMonths } from '../utils/marathiCalendar';

interface MarathiCalendarInfoProps {
  showDetails?: boolean;
}

const MarathiCalendarInfo: React.FC<MarathiCalendarInfoProps> = ({ showDetails = false }) => {
  const currentSeason = getCurrentSeason();
  const currentMonth = getCurrentMarathiMonth();

  if (!showDetails) {
    return (
      <div className="text-center">
        <div className="text-lg font-semibold text-white mb-1">
          {currentSeason.marathi} ({currentSeason.english})
        </div>
        <div className="text-sm text-gray-300">
          {currentMonth.marathi} ({currentMonth.english})
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 text-white">
      <h3 className="text-xl font-bold mb-4 text-center">Marathi Calendar & Raga Seasons</h3>
      
      {/* Current Season and Month */}
      <div className="mb-6 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
        <h4 className="text-lg font-semibold mb-2 text-blue-300">Current Season & Month</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold text-blue-200">{currentSeason.marathi}</div>
            <div className="text-sm text-gray-300">{currentSeason.english} - {currentSeason.description}</div>
            <div className="text-xs text-gray-400 mt-1">{currentSeason.ragaCharacteristics}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-200">{currentMonth.marathi}</div>
            <div className="text-sm text-gray-300">{currentMonth.english} - {currentMonth.description}</div>
            <div className="text-xs text-gray-400 mt-1">{currentMonth.gregorianMonths}</div>
          </div>
        </div>
      </div>

      {/* All Seasons */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold mb-3 text-green-300">All Raga Seasons (ऋतू)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {getAllSeasons().map((season) => (
            <div key={season.english} className="bg-gray-700 rounded-lg p-3">
              <div className="font-semibold text-white">{season.marathi}</div>
              <div className="text-sm text-gray-300">{season.english}</div>
              <div className="text-xs text-gray-400 mt-1">{season.description}</div>
              <div className="text-xs text-blue-300 mt-1">{season.ragaCharacteristics}</div>
            </div>
          ))}
        </div>
      </div>

      {/* All Marathi Months */}
      <div>
        <h4 className="text-lg font-semibold mb-3 text-purple-300">Marathi Months (मराठी महिने)</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {getAllMarathiMonths().map((month) => (
            <div key={month.english} className="bg-gray-700 rounded-lg p-2 text-center">
              <div className="font-semibold text-white text-sm">{month.marathi}</div>
              <div className="text-xs text-gray-300">{month.english}</div>
              <div className="text-xs text-gray-400">{month.gregorianMonths}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MarathiCalendarInfo;
