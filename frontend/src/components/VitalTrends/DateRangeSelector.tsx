import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar } from 'lucide-react';

interface DateRangeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (start: Date, end: Date) => void;
  initialStart: Date;
  initialEnd: Date;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialStart,
  initialEnd
}) => {
  const [startDate, setStartDate] = useState(
    initialStart.toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    initialEnd.toISOString().split('T')[0]
  );

  const handleConfirm = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    // Validate dates
    if (start > end) {
      alert('Start date cannot be after end date');
      return;
    }

    if (end > now) {
      alert('End date cannot be in the future');
      return;
    }

    onConfirm(start, end > now ? now : end);
  };

  const handleQuickSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  if (!isOpen) return null;

  const maxDate = new Date().toISOString().split('T')[0];

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Select Date Range</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Quick Select Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Select
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickSelect(30)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Last 30 Days
              </button>
              <button
                onClick={() => handleQuickSelect(90)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Last 3 Months
              </button>
              <button
                onClick={() => handleQuickSelect(180)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Last 6 Months
              </button>
              <button
                onClick={() => handleQuickSelect(365)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Last 1 Year
              </button>
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                max={maxDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                max={maxDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum allowed: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Range
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DateRangeSelector;

