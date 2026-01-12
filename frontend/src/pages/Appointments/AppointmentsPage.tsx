import React from "react";
import { Calendar, PlusCircle, Clock, AlertCircle } from "lucide-react";

const mockAppointments = [
  {
    id: "APT-1001",
    patient: "You",
    provider: "—",
    date: "Not scheduled",
    time: "",
    status: "No upcoming appointments",
  },
];

const AppointmentsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">Dashboard</p>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600">
            Your upcoming and past appointments will appear here.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition"
          disabled
          title="Appointment booking coming soon"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Book Appointment</span>
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Upcoming</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {mockAppointments.map((apt) => (
            <div key={apt.id} className="py-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{apt.id}</p>
                <p className="text-base font-semibold text-gray-900">
                  {apt.status}
                </p>
                <p className="text-sm text-gray-600">Patient: {apt.patient}</p>
                <p className="text-sm text-gray-600">Provider: {apt.provider}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end space-x-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{apt.date}</span>
                  {apt.time && <span>{apt.time}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start space-x-2 text-sm text-gray-600 bg-blue-50 border border-blue-100 px-3 py-2 rounded-md">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
          <p>
            Appointment booking and provider scheduling are coming soon. If you
            should already see appointments, please ensure your account has
            patient access and the backend is synced.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AppointmentsPage;
