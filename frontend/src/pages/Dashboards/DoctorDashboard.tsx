import React from "react";
import { Stethoscope, Calendar, ClipboardList, Users } from "lucide-react";

const DoctorDashboard: React.FC = () => {
  const stats = [
    { label: "Today's Appointments", value: 0, icon: Calendar },
    { label: "Pending Notes", value: 0, icon: ClipboardList },
    { label: "Patients", value: 0, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-3 rounded-lg bg-red-600/20 text-red-300">
          <Stethoscope className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-gray-400">Dashboard</p>
          <h1 className="text-2xl font-bold text-white">Doctor</h1>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card border-red-500/20 bg-neutral-900/80">
            <div className="flex items-center space-x-3">
              <s.icon className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-sm text-gray-400">{s.label}</p>
                <p className="text-xl font-semibold text-white">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card border-red-500/20 bg-neutral-900/80">
        <h2 className="text-lg font-semibold text-white mb-2">Next appointment</h2>
        <p className="text-gray-400 text-sm">No appointments scheduled.</p>
      </div>
    </div>
  );
};

export default DoctorDashboard;
