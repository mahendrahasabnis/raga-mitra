import React from 'react';
import { useParams } from 'react-router-dom';

const AppointmentDetails: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Appointment Details</h1>
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <p className="text-gray-600">
          Appointment details for ID: {appointmentId}
        </p>
        <p className="text-gray-600 mt-2">Appointment details page is under development.</p>
      </div>
    </div>
  );
};

export default AppointmentDetails;
