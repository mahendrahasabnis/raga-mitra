import React from "react";

interface AppointmentTicketProps {
  id: string;
  patient: string;
  provider?: string;
  date?: string;
  time?: string;
  status?: string;
}

const AppointmentTicket: React.FC<AppointmentTicketProps> = ({
  id,
  patient,
  provider = "—",
  date = "Not scheduled",
  time = "",
  status = "No upcoming appointments",
}) => {
  return (
    <div className="card border-red-500/20 bg-neutral-900/80">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{id}</p>
          <p className="text-base font-semibold text-white">{status}</p>
          <p className="text-sm text-gray-400">Patient: {patient}</p>
          <p className="text-sm text-gray-400">Provider: {provider}</p>
        </div>
        <div className="text-right text-sm text-gray-300">
          <p>{date}</p>
          {time && <p>{time}</p>}
        </div>
      </div>
    </div>
  );
};

export default AppointmentTicket;
