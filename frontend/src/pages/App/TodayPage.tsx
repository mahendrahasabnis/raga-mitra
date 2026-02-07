import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { healthApi, fitnessApi, dietApi } from "../../services/api";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Scan,
  Activity,
  UtensilsCrossed,
  Scale,
  Pill,
  Dumbbell,
  Salad,
  Stethoscope,
} from "lucide-react";
import ScanDocumentModal from "../../components/Health/ScanDocumentModal";
import AppointmentsForm from "../../components/Health/AppointmentsForm";
import VitalsForm from "../../components/Health/VitalsForm";
import ActualsVsPlannedModal, { type SessionItemType } from "../../components/App/ActualsVsPlannedModal";

const cardBase = "rounded-xl border border-white/10 bg-white/5";

const getDateKey = (d: Date) => d.toISOString().split("T")[0];
const getWeekStart = (d: Date) => {
  const start = new Date(d);
  const dayIndex = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayIndex);
  start.setHours(0, 0, 0, 0);
  return start.toISOString().split("T")[0];
};
const getWeekEnd = (d: Date) => {
  const start = new Date(getWeekStart(d));
  start.setDate(start.getDate() + 6);
  return start.toISOString().split("T")[0];
};
const formatCompactDate = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

const TodayPage: React.FC = () => {
  const navigate = useNavigate();
  const datePickerRef = useRef<HTMLInputElement | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const selectedDateKey = getDateKey(selectedDate);
  const weekStart = getWeekStart(selectedDate);
  const weekEnd = getWeekEnd(selectedDate);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [fitnessEntries, setFitnessEntries] = useState<any[]>([]);
  const [dietEntries, setDietEntries] = useState<any[]>([]);
  const [fitnessProgress, setFitnessProgress] = useState<any>(null);
  const [dietProgress, setDietProgress] = useState<any>(null);

  const [showScanModal, setShowScanModal] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showActualsModal, setShowActualsModal] = useState(false);
  const [actualsItem, setActualsItem] = useState<{
    type: SessionItemType;
    planned: { title: string; subtitle?: string; planned_time?: string; details?: string };
  } | null>(null);

  const selectedClient = localStorage.getItem("client-context-id") || undefined;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [apptRes, medRes, vitRes, fitEntriesRes, dietEntriesRes, fitProgRes, dietProgRes] =
          await Promise.allSettled([
            healthApi.getAppointments(selectedClient),
            healthApi.getMedicines(selectedClient, true),
            healthApi.getVitals(selectedClient),
            fitnessApi.getCalendarEntries(selectedClient, selectedDateKey, selectedDateKey),
            dietApi.getCalendarEntries(selectedClient, selectedDateKey, selectedDateKey),
            fitnessApi.getProgress(selectedClient, weekStart, weekEnd),
            dietApi.getProgress(selectedClient, weekStart, weekEnd),
          ]);

        if (apptRes.status === "fulfilled") setAppointments(apptRes.value?.appointments || []);
        if (medRes.status === "fulfilled") setMedicines(medRes.value?.medicines || medRes.value || []);
        if (vitRes.status === "fulfilled") setVitals(vitRes.value?.vitals || vitRes.value || []);
        if (fitEntriesRes.status === "fulfilled")
          setFitnessEntries(fitEntriesRes.value?.entries || []);
        if (dietEntriesRes.status === "fulfilled")
          setDietEntries(dietEntriesRes.value?.entries || []);
        if (fitProgRes.status === "fulfilled") setFitnessProgress(fitProgRes.value);
        if (dietProgRes.status === "fulfilled") setDietProgress(dietProgRes.value);
      } catch {
        // ignore
      }
    };
    fetchData();
  }, [selectedDateKey, weekStart, weekEnd, selectedClient]);

  const dateAppointments = appointments.filter((a) => {
    const d = a.datetime || a.scheduled_at;
    if (!d) return true;
    return new Date(d).toISOString().split("T")[0] === selectedDateKey;
  });

  const lastWeight = vitals
    .filter(
      (v) =>
        (v.parameter_name || v.parameter || "")
          .toLowerCase()
          .includes("weight")
    )
    .sort((a, b) => {
      const at = new Date(a.measured_at || a.recorded_date || 0).getTime();
      const bt = new Date(b.measured_at || b.recorded_date || 0).getTime();
      return bt - at;
    })[0];

  const exerciseCompliance =
    fitnessProgress?.compliance != null
      ? Math.round(Number(fitnessProgress.compliance))
      : fitnessProgress?.complianceAvg != null
        ? Math.round(Number(fitnessProgress.complianceAvg))
        : null;
  const mealCompliance =
    dietProgress?.compliance != null
      ? Math.round(Number(dietProgress.compliance))
      : dietProgress?.complianceAvg != null
        ? Math.round(Number(dietProgress.complianceAvg))
        : null;
  const medicineCompliance = null;

  const openActuals = (
    type: SessionItemType,
    planned: { title: string; subtitle?: string; planned_time?: string; details?: string }
  ) => {
    setActualsItem({ type, planned });
    setShowActualsModal(true);
  };

  const handleActualsSave = (actual: {
    done: boolean;
    notes: string;
    actual_time?: string;
  }) => {
    // Could persist via API (e.g. update tracking, appointment status)
    console.log("Actuals saved:", actual);
  };

  const refreshData = () => {
    window.location.reload();
  };

  const dateSessionsFitness =
    fitnessEntries.find((e: any) => e.date === selectedDateKey)?.sessions || [];
  const dateSessionsDiet =
    dietEntries.find((e: any) => e.date === selectedDateKey)?.sessions || [];

  const isToday = selectedDateKey === getDateKey(new Date());

  return (
    <div className="space-y-4">
      {/* Date selection (same pattern as Fitness Calendar) */}
      <section className={`${cardBase} p-4`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              const prev = new Date(selectedDate);
              prev.setDate(prev.getDate() - 1);
              setSelectedDate(prev);
            }}
            className="p-2 rounded-lg hover:bg-white/10"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm min-w-[200px] text-center">
              {formatCompactDate(selectedDate)}
            </h3>
            <button
              type="button"
              onClick={() => {
                const picker = datePickerRef.current;
                if (!picker) return;
                if (typeof (picker as HTMLInputElement & { showPicker?: () => void }).showPicker === "function") {
                  (picker as HTMLInputElement & { showPicker: () => void }).showPicker();
                } else {
                  picker.focus();
                  picker.click();
                }
              }}
              className="p-2 rounded-lg hover:bg-white/10 inline-flex items-center gap-1"
              title="Pick a date"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className="btn-secondary text-xs px-3"
              title="Go to today"
            >
              Today
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = new Date(selectedDate);
              next.setDate(next.getDate() + 1);
              setSelectedDate(next);
            }}
            className="p-2 rounded-lg hover:bg-white/10"
            aria-label="Next day"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <input
          ref={datePickerRef}
          type="date"
          className="sr-only"
          aria-hidden
          value={selectedDateKey}
          onChange={(e) => {
            const picked = new Date(e.target.value);
            if (!Number.isNaN(picked.getTime())) setSelectedDate(picked);
          }}
        />
      </section>

      {/* Metrics row: Last known weight, Medicine / Exercise / Meal compliance */}
      <section className={`${cardBase} p-4`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg bg-white/5 p-3 border border-white/10">
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-1">
              <Scale className="h-3.5 w-3.5" />
              Last known weight
            </div>
            <p className="text-lg font-semibold">
              {lastWeight
                ? `${lastWeight.value} ${lastWeight.unit || "kg"}`
                : "—"}
            </p>
            {(lastWeight?.measured_at || lastWeight?.recorded_date) && (
              <p className="text-[11px] text-gray-500 mt-0.5">
                as on {new Date(lastWeight.measured_at || lastWeight.recorded_date).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-white/5 p-3 border border-white/10">
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-1">
              <Pill className="h-3.5 w-3.5" />
              Week medicine compliance
            </div>
            <p className="text-lg font-semibold">
              {medicineCompliance != null ? `${medicineCompliance}%` : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 p-3 border border-white/10">
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-1">
              <Dumbbell className="h-3.5 w-3.5" />
              Week exercise compliance
            </div>
            <p className="text-lg font-semibold">
              {exerciseCompliance != null ? `${exerciseCompliance}%` : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 p-3 border border-white/10">
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-1">
              <Salad className="h-3.5 w-3.5" />
              Week meal compliance
            </div>
            <p className="text-lg font-semibold">
              {mealCompliance != null ? `${mealCompliance}%` : "—"}
            </p>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className={`${cardBase} p-4`}>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowScanModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Scan className="h-4 w-4" />
            Scan document
          </button>
          <button
            onClick={() => setShowAppointmentForm(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <CalendarIcon className="h-4 w-4" />
            Add Appointment
          </button>
          <button
            onClick={() => navigate(`/app/fitness/session/${selectedDateKey}`)}
            className="btn-secondary flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            Record Exercise
          </button>
          <button
            onClick={() => navigate(`/app/diet/session/${selectedDateKey}`)}
            className="btn-secondary flex items-center gap-2"
          >
            <UtensilsCrossed className="h-4 w-4" />
            Record Meal
          </button>
          <button
            onClick={() => setShowVitalsForm(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Stethoscope className="h-4 w-4" />
            Add Vitals
          </button>
        </div>
      </section>

      {/* Four sections: Doctor appointments, Medicines schedule, Exercise sessions, Diet plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className={`${cardBase} p-4`}>
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-rose-200" />
            Doctor appointments
          </h3>
          <div className="space-y-2">
            {dateAppointments.length === 0 && (
              <p className="text-sm text-gray-400">
                {isToday ? "No appointments today." : `No appointments on ${formatCompactDate(selectedDate)}.`}
              </p>
            )}
            {dateAppointments.map((appt) => (
              <motion.button
                key={appt.id}
                type="button"
                whileHover={{ scale: 1.01 }}
                onClick={() =>
                  openActuals("appointment", {
                    title: appt.title || "Appointment",
                    subtitle: appt.location,
                    planned_time: appt.datetime || appt.scheduled_at,
                    details: appt.notes,
                  })
                }
                className="w-full text-left rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 hover:border-rose-400/30"
              >
                <p className="font-medium text-sm">{appt.title || "Checkup"}</p>
                <p className="text-xs text-gray-400">
                  {appt.datetime || appt.scheduled_at || "Today"} · {appt.location || "—"}
                </p>
              </motion.button>
            ))}
          </div>
        </section>

        <section className={`${cardBase} p-4`}>
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Pill className="h-4 w-4 text-rose-200" />
            Medicines schedule
          </h3>
          <div className="space-y-2">
            {medicines.length === 0 && (
              <p className="text-sm text-gray-400">No medicines scheduled.</p>
            )}
            {medicines.slice(0, 10).map((med: any) => (
              <motion.button
                key={med.id || med.name}
                type="button"
                whileHover={{ scale: 1.01 }}
                onClick={() =>
                  openActuals("medicine", {
                    title: med.name || med.medicine_name || "Medicine",
                    subtitle: med.dosage || med.timing,
                    details: med.instructions,
                  })
                }
                className="w-full text-left rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 hover:border-rose-400/30"
              >
                <p className="font-medium text-sm">{med.name || med.medicine_name}</p>
                <p className="text-xs text-gray-400">
                  {med.dosage || ""} {med.timing || ""}
                </p>
              </motion.button>
            ))}
          </div>
        </section>

        <section className={`${cardBase} p-4`}>
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-rose-200" />
            Exercise sessions planned
          </h3>
          <div className="space-y-2">
            {dateSessionsFitness.length === 0 && (
              <p className="text-sm text-gray-400">
                {isToday ? "No exercise sessions planned today." : `No sessions on ${formatCompactDate(selectedDate)}.`}
              </p>
            )}
            {dateSessionsFitness.map((s: any) => {
              const sessionTitle = s.session_name || s.name || "Session";
              const dotColor = s.week_template_id
                ? ["#60a5fa", "#34d399", "#f59e0b", "#a78bfa", "#ec4899"][
                    Math.abs(String(s.week_template_id).split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0)) % 5
                  ]
                : "rgba(255,255,255,0.4)";
              return (
                <motion.button
                  key={s.id}
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  onClick={() =>
                    navigate(`/app/fitness/session/${selectedDateKey}?sessionId=${s.id}`)
                  }
                  className="w-full text-left rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 hover:border-rose-400/30 flex items-center gap-2"
                >
                  <span
                    className="shrink-0 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: dotColor }}
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{sessionTitle}</p>
                    <p className="text-xs text-gray-400">
                      {s.planned_time || "Today"} · {s.exercises?.length || 0} exercises
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        <section className={`${cardBase} p-4`}>
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-rose-200" />
            Diet plan (meals)
          </h3>
          <div className="space-y-2">
            {dateSessionsDiet.length === 0 && (
              <p className="text-sm text-gray-400">
                {isToday ? "No meals planned today." : `No meals on ${formatCompactDate(selectedDate)}.`}
              </p>
            )}
            {dateSessionsDiet.map((s: any) => (
              <motion.button
                key={s.id}
                type="button"
                whileHover={{ scale: 1.01 }}
                onClick={() =>
                  openActuals("meal", {
                    title: s.name || "Meal",
                    subtitle: s.meal_type || s.category,
                    planned_time: s.planned_time,
                    details: s.meals?.length
                      ? `${s.meals.length} item(s)`
                      : undefined,
                  })
                }
                className="w-full text-left rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 hover:border-rose-400/30"
              >
                <p className="font-medium text-sm">{s.name || "Meal"}</p>
                <p className="text-xs text-gray-400">
                  {s.planned_time || s.meal_type || "Today"} · {s.meals?.length || 0} items
                </p>
              </motion.button>
            ))}
          </div>
        </section>
      </div>

      {/* Modals */}
      {showScanModal && (
        <ScanDocumentModal
          isOpen={showScanModal}
          onClose={() => setShowScanModal(false)}
          appointments={appointments}
          selectedClient={selectedClient || null}
          onCreated={refreshData}
        />
      )}

      {showAppointmentForm && (
        <AppointmentsForm
          isOpen={true}
          onClose={() => setShowAppointmentForm(false)}
          onSuccess={() => {
            setShowAppointmentForm(false);
            refreshData();
          }}
          appointment={{
            datetime: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 9, 0).toISOString().slice(0, 16),
          }}
          clientId={selectedClient}
          existingLocations={Array.from(
            new Set(appointments.map((a) => a.location).filter(Boolean))
          )}
        />
      )}

      {showVitalsForm && (
        <VitalsForm
          isOpen={true}
          onClose={() => setShowVitalsForm(false)}
          onSuccess={() => {
            setShowVitalsForm(false);
            refreshData();
          }}
          clientId={selectedClient}
        />
      )}

      {showActualsModal && actualsItem && (
        <ActualsVsPlannedModal
          isOpen={showActualsModal}
          onClose={() => {
            setShowActualsModal(false);
            setActualsItem(null);
          }}
          onSave={handleActualsSave}
          type={actualsItem.type}
          planned={actualsItem.planned}
        />
      )}
    </div>
  );
};

export default TodayPage;
