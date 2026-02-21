import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  User,
  PhoneCall,
  MessageCircle,
  MessageSquare,
  Stethoscope,
  ScanLine,
  RefreshCw,
} from "lucide-react";
import { healthApi } from "../../services/api";
import QrScannerModal from "./QrScannerModal";

interface MyPatientAppointmentsProps {
  sectionTitle?: string;
  forDoctorId?: string;
}

const formatDate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatDisplayDate = (d: Date) =>
  d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const isToday = (dateStr: string) => formatDate(new Date()) === dateStr;

const statusColors: Record<string, string> = {
  planned: "bg-blue-500/20 text-blue-300 border-blue-400/30",
  confirmed: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  waiting: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  consulting: "bg-violet-500/20 text-violet-300 border-violet-400/30",
  completed: "bg-gray-500/20 text-gray-300 border-gray-400/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-400/30",
};

const statusLabel = (status: string, waitingNumber?: number | null) => {
  if (status === "waiting" && waitingNumber) return `Waiting #${waitingNumber}`;
  return status;
};

const phoneDigits = (phone: string) => (phone || "").replace(/[^0-9+]/g, "");
const waPhone = (phone: string) => phoneDigits(phone).replace(/^\+/, "");

const MyPatientAppointments: React.FC<MyPatientAppointmentsProps> = ({
  sectionTitle = "My Patient Appointments",
  forDoctorId,
}) => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()));
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAppointments = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await healthApi.getMyPatientAppointments(date, forDoctorId);
      const rows = res.appointments || [];
      // Sort: waiting (by waiting_number) first, then consulting, then rest
      const statusOrder: Record<string, number> = { consulting: 0, waiting: 1, planned: 2, confirmed: 2, requested: 2, completed: 3, cancelled: 4 };
      rows.sort((a: any, b: any) => {
        const sa = statusOrder[(a.status || "planned").toLowerCase()] ?? 2;
        const sb = statusOrder[(b.status || "planned").toLowerCase()] ?? 2;
        if (sa !== sb) return sa - sb;
        if ((a.status || "").toLowerCase() === "waiting") {
          return (a.waiting_number || 999) - (b.waiting_number || 999);
        }
        return 0;
      });
      setAppointments(rows);
    } catch (err) {
      console.error("Failed to fetch patient appointments:", err);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [forDoctorId]);

  useEffect(() => {
    fetchAppointments(selectedDate);
  }, [selectedDate, fetchAppointments]);

  // Auto-refresh every 30s when viewing today
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (isToday(selectedDate)) {
      refreshTimerRef.current = setInterval(() => {
        fetchAppointments(selectedDate);
      }, 30000);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [selectedDate, fetchAppointments]);

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(formatDate(d));
  };

  const handleCardClick = (appt: any) => {
    if (forDoctorId) return;
    const patientId = appt.patient_user_id || appt.patient_id;
    if (!patientId) return;
    localStorage.setItem("client-context-id", patientId);
    navigate(`/app/health?tab=appointments&client=${patientId}`, {
      state: {
        patientFromDash: {
          id: patientId,
          name: appt.patient_name || "Patient",
          phone: appt.patient_phone || "",
        },
        expandAppointmentId: appt.id,
      },
    });
  };

  const dateObj = new Date(selectedDate + "T00:00:00");

  return (
    <div className="card p-4 my-patient-appointments-card">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="h-5 w-5 text-rose-400 shrink-0" />
        <h3 className="text-md font-semibold flex-1">{sectionTitle}</h3>
        <button
          onClick={() => fetchAppointments(selectedDate)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition text-gray-400 hover:text-gray-200"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          onClick={() => setShowScanner(true)}
          className="p-1.5 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-300 hover:bg-rose-500/25 transition"
          title="Scan patient QR"
        >
          <ScanLine className="h-4 w-4" />
        </button>
      </div>

      {/* Date picker row */}
      <div className="flex items-center gap-1 mb-4 p-2 rounded-lg bg-white/5 border border-white/10 date-picker-row">
        <button
          onClick={() => shiftDate(-1)}
          className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center">
          <span className="text-sm font-medium">
            {isToday(selectedDate) && (
              <span className="text-rose-400 mr-1.5">Today</span>
            )}
            {formatDisplayDate(dateObj)}
          </span>
        </div>
        <button
          onClick={() => setSelectedDate(formatDate(new Date()))}
          className={`shrink-0 text-xs px-2 py-1 rounded-md transition ${
            isToday(selectedDate)
              ? "bg-rose-500/20 text-rose-300"
              : "bg-white/10 hover:bg-white/15"
          }`}
        >
          Today
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
          className="sr-only"
          id={`patient-appt-date-picker-${forDoctorId || 'self'}`}
        />
        <label
          htmlFor={`patient-appt-date-picker-${forDoctorId || 'self'}`}
          className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          title="Pick a date"
        >
          <Calendar className="h-4 w-4" />
        </label>
        <button
          onClick={() => shiftDate(1)}
          className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition"
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-6 text-center">
          <p className="text-sm text-gray-400">Loading appointments...</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="py-6 text-center">
          <Calendar className="h-8 w-8 text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No patient appointments</p>
          <p className="text-xs text-gray-500 mt-1">
            {isToday(selectedDate) ? "No appointments scheduled for today" : `No appointments on ${formatDisplayDate(dateObj)}`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 mb-2">
            {appointments.length} appointment{appointments.length !== 1 ? "s" : ""}
          </p>
          {appointments.map((appt) => {
            const status = (appt.status || "planned").toLowerCase();
            const patientPhone = appt.patient_phone || "";
            return (
              <div
                key={appt.id}
                onClick={() => handleCardClick(appt)}
                className={`rounded-lg border border-white/10 bg-white/5 p-3 transition patient-appt-card ${forDoctorId ? '' : 'cursor-pointer hover:border-rose-400/30 hover:bg-white/8'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-rose-400 shrink-0" />
                      <span className="font-semibold text-sm truncate">
                        {appt.patient_name || "Unknown Patient"}
                      </span>
                    </div>
                    {appt.title && (
                      <p className="text-xs text-gray-300 truncate ml-6">
                        {appt.title}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      statusColors[status] || statusColors.planned
                    }`}
                  >
                    {statusLabel(status, appt.waiting_number)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-2 ml-6 text-xs text-gray-400">
                  {appt.datetime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(appt.datetime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  {appt.location && (
                    <span className="flex items-center gap-1 truncate max-w-[160px]">
                      <MapPin className="h-3 w-3" />
                      {appt.location}
                    </span>
                  )}
                </div>

                {patientPhone && (
                  <div className="flex items-center gap-1 mt-2 ml-6">
                    <span className="text-xs text-gray-500 mr-1">{patientPhone}</span>
                    <a
                      href={`tel:${patientPhone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded hover:bg-white/10 transition"
                      title="Call"
                    >
                      <PhoneCall className="h-3 w-3 text-gray-400" />
                    </a>
                    <a
                      href={`sms:${patientPhone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded hover:bg-white/10 transition"
                      title="SMS"
                    >
                      <MessageCircle className="h-3 w-3 text-gray-400" />
                    </a>
                    <a
                      href={`https://wa.me/${waPhone(patientPhone)}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded hover:bg-white/10 transition"
                      title="WhatsApp"
                    >
                      <MessageSquare className="h-3 w-3 text-gray-400" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showScanner && (
        <QrScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onCheckin={() => fetchAppointments(selectedDate)}
        />
      )}
    </div>
  );
};

export default MyPatientAppointments;
