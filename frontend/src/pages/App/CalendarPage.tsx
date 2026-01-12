import React from "react";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

const cardBase = "card";

const CalendarPage: React.FC = () => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="space-y-4">
      <section className={`${cardBase} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <CalendarIcon className="h-5 w-5 text-rose-200" />
          <h2 className="text-lg font-semibold">Calendar</h2>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => (
            <button key={d} className="h-12 rounded-xl border border-white/10 bg-white/5 text-sm text-gray-200">
              {d}
            </button>
          ))}
        </div>
      </section>
      <section className={`${cardBase} p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-5 w-5 text-rose-200" />
          <h3 className="text-md font-semibold">Schedule</h3>
        </div>
        <p className="text-sm text-gray-400">Select a day to see appointments, sessions, and meals.</p>
      </section>
    </div>
  );
};

export default CalendarPage;
