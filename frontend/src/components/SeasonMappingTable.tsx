import React from 'react';
import { getAllSeasons, getAllMarathiMonths } from '../utils/marathiCalendar';

const SeasonMappingTable: React.FC = () => {
  const seasons = getAllSeasons();
  const months = getAllMarathiMonths();

  return (
    <div className="bg-gray-800 rounded-lg p-6 text-white">
      <h3 className="text-2xl font-bold mb-6 text-center text-blue-300">
        Marathi Calendar & Raga Seasons Mapping
      </h3>
      
      {/* Season Overview */}
      <div className="mb-8">
        <h4 className="text-xl font-semibold mb-4 text-green-300">Raga Seasons (ऋतू) Overview</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {seasons.map((season, index) => (
            <div key={season.english} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center justify-between mb-2">
                <div className="text-lg font-bold text-white">{season.marathi}</div>
                <div className="text-sm text-gray-300">#{index + 1}</div>
              </div>
              <div className="text-sm text-gray-300 mb-2">{season.english}</div>
              <div className="text-xs text-gray-400 mb-2">{season.description}</div>
              <div className="text-xs text-blue-300">{season.ragaCharacteristics}</div>
              <div className="mt-2 text-xs text-gray-500">
                Months: {season.months.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Month-Season Mapping Table */}
      <div className="mb-8">
        <h4 className="text-xl font-semibold mb-4 text-purple-300">Month-Season Mapping Table</h4>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-600">
            <thead>
              <tr className="bg-gray-700">
                <th className="border border-gray-600 px-4 py-2 text-left text-sm font-semibold">Marathi Month</th>
                <th className="border border-gray-600 px-4 py-2 text-left text-sm font-semibold">English Month</th>
                <th className="border border-gray-600 px-4 py-2 text-left text-sm font-semibold">Season (ऋतू)</th>
                <th className="border border-gray-600 px-4 py-2 text-left text-sm font-semibold">Gregorian Period</th>
                <th className="border border-gray-600 px-4 py-2 text-left text-sm font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month, index) => {
                const season = seasons.find(s => s.english === month.season);
                return (
                  <tr key={month.english} className={index % 2 === 0 ? 'bg-gray-700' : 'bg-gray-600'}>
                    <td className="border border-gray-600 px-4 py-2">
                      <div className="font-semibold text-white">{month.marathi}</div>
                    </td>
                    <td className="border border-gray-600 px-4 py-2 text-gray-300">
                      {month.english}
                    </td>
                    <td className="border border-gray-600 px-4 py-2">
                      <div className="text-green-300 font-semibold">{season?.marathi}</div>
                      <div className="text-xs text-gray-300">{season?.english}</div>
                    </td>
                    <td className="border border-gray-600 px-4 py-2 text-gray-300 text-sm">
                      {month.gregorianMonths}
                    </td>
                    <td className="border border-gray-600 px-4 py-2 text-gray-300 text-sm">
                      {month.description}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raga Characteristics by Season */}
      <div>
        <h4 className="text-xl font-semibold mb-4 text-yellow-300">Raga Characteristics by Season</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {seasons.map((season) => (
            <div key={season.english} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center mb-3">
                <div className="text-lg font-bold text-white mr-3">{season.marathi}</div>
                <div className="text-sm text-gray-300">({season.english})</div>
              </div>
              <div className="text-sm text-gray-300 mb-2">{season.description}</div>
              <div className="text-xs text-blue-300 bg-blue-900/20 p-2 rounded">
                <strong>Raga Characteristics:</strong> {season.ragaCharacteristics}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                <strong>Months:</strong> {season.months.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SeasonMappingTable;
