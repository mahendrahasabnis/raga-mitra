import React, { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface AppointmentsCalendarViewProps {
  appointments: any[];
}

const AppointmentsCalendarView: React.FC<AppointmentsCalendarViewProps> = ({ appointments }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getWeekDates = () => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    const dates: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const formatDateKey = (date: Date) => date.toISOString().split("T")[0];

  const getAppointmentDate = (apt: any) => {
    const raw =
      apt?.datetime ||
      apt?.scheduled_at ||
      apt?.start_time ||
      apt?.appointment_time ||
      apt?.date ||
      apt?.created_at;
    const parsed = raw ? new Date(raw) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const groupedByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    appointments.forEach((apt) => {
      const parsed = getAppointmentDate(apt);
      if (!parsed) return;
      const key = formatDateKey(parsed);
      if (!groups[key]) groups[key] = [];
      groups[key].push(apt);
    });
    return groups;
  }, [appointments]);

  const weekDates = getWeekDates();

  const monthAppointments = useMemo(() => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return appointments.filter((apt) => {
      const date = getAppointmentDate(apt);
      if (!date) return false;
      return date >= monthStart && date <= monthEnd;
    });
  }, [appointments, currentDate]);

  const now = Date.now();
  const upcoming = monthAppointments.filter((apt) => {
    const date = getAppointmentDate(apt)?.getTime() || 0;
    return (apt.status || "").toLowerCase() !== "completed" && date >= now;
  });
  const completed = monthAppointments.filter((apt) => {
    const date = getAppointmentDate(apt)?.getTime() || 0;
    return (apt.status || "").toLowerCase() === "completed" || date < now;
  });

  const formatDayLabel = (date: Date) => {
    const day = date.toLocaleDateString("en-US", { weekday: "short" });
    const shortDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${day} · ${shortDate}`;
  };

  return (
    <div className="card p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-300">
            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
            onClick={() => {
              const next = new Date(currentDate);
              next.setDate(currentDate.getDate() - 7);
              setCurrentDate(next);
            }}
            title="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 transition"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </button>
          <button
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
            onClick={() => {
              const next = new Date(currentDate);
              next.setDate(currentDate.getDate() + 7);
              setCurrentDate(next);
            }}
            title="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {weekDates.map((date) => {
          const key = formatDateKey(date);
          const dayAppointments = groupedByDate[key] || [];
          return (
            <div key={key} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-gray-400 mb-2">{formatDayLabel(date)}</p>
              {dayAppointments.length === 0 ? (
                <p className="text-xs text-gray-500">No appointments</p>
              ) : (
                <div className="space-y-2">
                  {dayAppointments.slice(0, 3).map((apt) => (
                    <div key={apt.id} className="rounded-md bg-white/10 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-100">
                          {apt.doctor_name || apt.doctor_user_id || "Doctor"}
                        </p>
                        <span className="text-[11px] text-gray-400">
                          {apt.status || "planned"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {getAppointmentDate(apt)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "Time TBD"}
                      </p>
                    </div>
                  ))}
                  {dayAppointments.length > 3 && (
                    <p className="text-xs text-gray-500">+{dayAppointments.length - 3} more</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-200 mb-2">Upcoming (This Month)</h4>
          {upcoming.length === 0 ? (
            <p className="text-xs text-gray-500">No upcoming appointments</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((apt) => (
                <div key={apt.id} className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-100">{apt.title || "Appointment"}</span>
                    <span className="text-blue-200">Upcoming</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {apt.doctor_name || apt.doctor_user_id || "Doctor"} · {getAppointmentDate(apt)?.toLocaleString() || "TBD"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-200 mb-2">Completed (This Month)</h4>
          {completed.length === 0 ? (
            <p className="text-xs text-gray-500">No completed appointments</p>
          ) : (
            <div className="space-y-2">
              {completed.map((apt) => (
                <div key={apt.id} className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-100">{apt.title || "Appointment"}</span>
                    <span className="text-emerald-200">Completed</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {apt.doctor_name || apt.doctor_user_id || "Doctor"} · {getAppointmentDate(apt)?.toLocaleString() || "TBD"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentsCalendarView;
