import React from 'react';

interface AppointmentBookingProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const AppointmentBooking: React.FC<AppointmentBookingProps> = ({ onSuccess, onCancel }) => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Book Appointment</h1>
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <p className="text-gray-600">Appointment booking is under development.</p>
        <div className="mt-4 flex gap-4">
          <button
            onClick={onSuccess}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Success (Test)
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentBooking;
