import React from "react";
import { Stethoscope, Calendar, Pill, Activity, FileText } from "lucide-react";

interface HealthOverviewProps {
  appointmentsCount: number;
  medicinesCount: number;
  diagnosticsCount: number;
  vitalsCount: number;
  upcomingAppointment?: any;
  latestDiagnostic?: any;
  keyVitals?: any[];
}

const HealthOverview: React.FC<HealthOverviewProps> = ({
  appointmentsCount,
  medicinesCount,
  diagnosticsCount,
  vitalsCount,
  upcomingAppointment,
  latestDiagnostic,
  keyVitals = [],
}) => {
  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="health-stat-card health-stat-card--rose card p-4 bg-gradient-to-br from-rose-500/20 to-rose-600/10 border border-rose-400/30">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-rose-200" />
            <p className="text-xs text-rose-100/80">Appointments</p>
          </div>
          <p className="text-2xl font-semibold text-rose-100">{appointmentsCount}</p>
        </div>

        <div className="health-stat-card health-stat-card--blue card p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-400/30">
          <div className="flex items-center gap-2 mb-2">
            <Pill className="h-4 w-4 text-blue-200" />
            <p className="text-xs text-blue-100/80">Medicines</p>
          </div>
          <p className="text-2xl font-semibold text-blue-100">{medicinesCount}</p>
        </div>

        <div className="health-stat-card health-stat-card--purple card p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-400/30">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-purple-200" />
            <p className="text-xs text-purple-100/80">Diagnostics</p>
          </div>
          <p className="text-2xl font-semibold text-purple-100">{diagnosticsCount}</p>
        </div>

        <div className="health-stat-card health-stat-card--emerald card p-4 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-400/30">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-emerald-200" />
            <p className="text-xs text-emerald-100/80">Vitals</p>
          </div>
          <p className="text-2xl font-semibold text-emerald-100">{vitalsCount}</p>
        </div>
      </div>

      {/* Upcoming Appointment */}
      {upcomingAppointment && (
        <div className="card p-4 health-overview-section">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="h-5 w-5 text-rose-200 health-overview-section-icon" />
            <h3 className="text-md font-semibold">Upcoming Appointment</h3>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{upcomingAppointment.title || "Appointment"}</p>
            {upcomingAppointment.datetime && (
              <p className="text-xs text-gray-400">
                {new Date(upcomingAppointment.datetime).toLocaleString()}
              </p>
            )}
            {upcomingAppointment.location && (
              <p className="text-xs text-gray-400">📍 {upcomingAppointment.location}</p>
            )}
          </div>
        </div>
      )}

      {/* Latest Diagnostic Summary */}
      {latestDiagnostic && (
        <div className="card p-4 health-overview-section">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-5 w-5 text-purple-200 health-overview-section-icon" />
            <h3 className="text-md font-semibold">Latest Diagnostic</h3>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{latestDiagnostic.test_name}</p>
            {latestDiagnostic.test_date && (
              <p className="text-xs text-gray-400">
                {new Date(latestDiagnostic.test_date).toLocaleDateString()}
              </p>
            )}
            {latestDiagnostic.diagnostics_center_name && (
              <p className="text-xs text-gray-400">🏥 {latestDiagnostic.diagnostics_center_name}</p>
            )}
          </div>
        </div>
      )}

      {/* Key Vitals */}
      {keyVitals.length > 0 && (
        <div className="card p-4 health-overview-section">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-5 w-5 text-emerald-200 health-overview-section-icon" />
            <h3 className="text-md font-semibold">Key Vitals</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {keyVitals.slice(0, 4).map((vital) => (
              <div key={vital.id || vital.parameter} className="rounded-lg border border-white/10 bg-white/5 p-3 health-key-vital-item">
                <p className="text-xs text-gray-400 mb-1">{vital.parameter_name || vital.parameter}</p>
                <p className="text-lg font-semibold">
                  {vital.value}
                  {vital.unit && <span className="text-sm text-gray-300 ml-1">{vital.unit}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthOverview;
