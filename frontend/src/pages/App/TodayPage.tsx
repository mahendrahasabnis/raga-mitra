import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelectedClient } from "../../contexts/ClientContext";
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

const cardBase = "rounded-xl border border-white/10 bg-white/5 today-page-card";

const getDateKey = (d: Date) => d.toISOString().split("T")[0];
/** Monday = 0, returns YYYY-MM-DD for Monday of the week containing d (local). */
const getWeekStart = (d: Date) => {
  const start = new Date(d);
  const dayIndex = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayIndex);
  start.setHours(0, 0, 0, 0);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const getWeekEnd = (d: Date) => {
  const start = new Date(d);
  const dayIndex = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayIndex);
  start.setDate(start.getDate() + 6);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [fitnessTracking, setFitnessTracking] = useState<any[]>([]);
  const [dietTracking, setDietTracking] = useState<any[]>([]);
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

  const selectedClient = useSelectedClient() ?? undefined;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          apptRes,
          medRes,
          vitRes,
          fitEntriesRes,
          dietEntriesRes,
          fitTrackingRes,
          dietTrackingRes,
          fitProgRes,
          dietProgRes,
        ] = await Promise.allSettled([
          healthApi.getAppointments(selectedClient),
          healthApi.getMedicines(selectedClient, true),
          healthApi.getVitals(selectedClient),
          fitnessApi.getCalendarEntries(selectedClient, weekStart, selectedDateKey),
          dietApi.getCalendarEntries(selectedClient, weekStart, selectedDateKey),
          fitnessApi.getTracking(selectedClient, weekStart, selectedDateKey),
          dietApi.getTracking(selectedClient, weekStart, selectedDateKey),
          fitnessApi.getProgress(selectedClient, weekStart, selectedDateKey),
          dietApi.getProgress(selectedClient, weekStart, selectedDateKey),
        ]);

        if (apptRes.status === "fulfilled") setAppointments(apptRes.value?.appointments || []);
        if (medRes.status === "fulfilled") setMedicines(medRes.value?.medicines || medRes.value || []);
        if (vitRes.status === "fulfilled") setVitals(vitRes.value?.vitals || vitRes.value || []);
        if (fitEntriesRes.status === "fulfilled")
          setFitnessEntries(fitEntriesRes.value?.entries || []);
        if (dietEntriesRes.status === "fulfilled")
          setDietEntries(dietEntriesRes.value?.entries || []);
        if (fitTrackingRes.status === "fulfilled")
          setFitnessTracking(fitTrackingRes.value?.tracking || []);
        if (dietTrackingRes.status === "fulfilled")
          setDietTracking(dietTrackingRes.value?.tracking || []);
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
    .filter((v) => {
      const name = String(v.parameter_name ?? v.parameter ?? v.name ?? "").toLowerCase().trim();
      return name.includes("weight");
    })
    .sort((a, b) => {
      const at = new Date(a.measured_at || a.recorded_date || a.created_at || 0).getTime();
      const bt = new Date(b.measured_at || b.recorded_date || b.created_at || 0).getTime();
      return bt - at;
    })[0];

  /** Normalize to local YYYY-MM-DD. */
  const toLocalDateKey = (dateVal: any): string => {
    if (dateVal == null) return "";
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  /** Normalize tracking row date to YYYY-MM-DD for comparison (avoid timezone shifts). */
  const trackingDateKey = (t: any): string => {
    const raw = t?.tracked_date != null ? String(t.tracked_date).slice(0, 10) : "";
    return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : toLocalDateKey(t?.tracked_date);
  };

  /**
   * Week-to-date % = (completed sessions / total sessions) in range.
   * One session = one meal or one exercise session; complete = all items/exercises done or session marked complete.
   */
  const sessionBasedCompliance = (
    entries: any[],
    tracking: any[],
    startDateKey: string,
    endDateKey: string,
    type: "fitness" | "diet"
  ): { percent: number | null; completed: number; total: number } => {
    let total = 0;
    let completed = 0;
    const inRange = (dateKey: string) =>
      dateKey && dateKey >= startDateKey && dateKey <= endDateKey;

    // One entry per calendar day so we don't count the same session twice (e.g. duplicate API rows)
    const entryByDate = new Map<string, any>();
    entries.forEach((entry: any) => {
      const raw = entry.date != null ? String(entry.date).slice(0, 10) : "";
      const dateKey = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : toLocalDateKey(entry.date);
      if (!dateKey || !inRange(dateKey)) return;
      if (!entryByDate.has(dateKey)) entryByDate.set(dateKey, entry);
    });

    entryByDate.forEach((entry: any) => {
      const raw = entry.date != null ? String(entry.date).slice(0, 10) : "";
      const dateKey = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : toLocalDateKey(entry.date);
      const sessions = entry.sessions || [];
      const dayTracking = tracking.filter((t: any) => trackingDateKey(t) === dateKey);

      sessions.forEach((session: any) => {
        total += 1;
        if (type === "fitness") {
          const sessionLevel = dayTracking.find(
            (t: any) => t.calendar_session_id === session.id && !t.calendar_exercise_id
          );
          if (sessionLevel?.completion_status === "completed") {
            completed += 1;
            return;
          }
          const exercises = session.exercises || [];
          if (exercises.length === 0) {
            if (sessionLevel?.completion_status === "completed") completed += 1;
            return;
          }
          const allDone = exercises.every((ex: any) =>
            dayTracking.some(
              (t: any) =>
                t.calendar_exercise_id === ex.id && t.completion_status === "completed"
            )
          );
          if (allDone) completed += 1;
        } else {
          // Diet: only count session-level "completed" (explicit Complete action), not inferred from all items
          const sessionLevel = dayTracking.find(
            (t: any) => t.calendar_meal_id === session.id && !t.calendar_meal_item_id
          );
          if (sessionLevel?.completion_status === "completed") {
            completed += 1;
          }
        }
      });
    });

    if (total === 0) return { percent: null, completed: 0, total: 0 };
    return { percent: Math.round((completed / total) * 100), completed, total };
  };

  const exerciseComplianceResult = sessionBasedCompliance(
    fitnessEntries,
    fitnessTracking,
    weekStart,
    selectedDateKey,
    "fitness"
  );
  const exerciseCompliance = exerciseComplianceResult.percent;
  const mealComplianceResult = sessionBasedCompliance(
    dietEntries,
    dietTracking,
    weekStart,
    selectedDateKey,
    "diet"
  );
  const mealCompliance = mealComplianceResult.percent;
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

  const refetchVitals = async () => {
    try {
      const res = await healthApi.getVitals(selectedClient);
      setVitals(res?.vitals ?? []);
    } catch {
      // ignore
    }
  };

  const dateSessionsFitness =
    fitnessEntries.find((e: any) => e.date === selectedDateKey)?.sessions || [];
  const dateSessionsDiet =
    dietEntries.find((e: any) => e.date === selectedDateKey)?.sessions || [];

  const trackingForSelectedDate = (list: any[]) =>
    list.filter((t: any) => toLocalDateKey(t.tracked_date) === selectedDateKey);

  const getFitnessSessionStatus = (session: any) => {
    const exercises = session.exercises || [];
    const total = exercises.length;
    const dayTracking = trackingForSelectedDate(fitnessTracking);
    const sessionLevel = dayTracking.find(
      (t: any) => t.calendar_session_id === session.id && !t.calendar_exercise_id
    );
    const completedCount = exercises.filter((e: any) =>
      dayTracking.some(
        (t: any) =>
          t.calendar_exercise_id === e.id && t.completion_status === "completed"
      )
    ).length;
    const pct = total ? Math.round((completedCount / total) * 100) : 0;
    const status = sessionLevel?.completion_status
      ? sessionLevel.completion_status
      : total === 0
        ? "pending"
        : completedCount === total
          ? "completed"
          : completedCount > 0
            ? "partial"
            : "pending";
    return { status, pct, done: completedCount, total };
  };

  const getDietSessionStatus = (session: any) => {
    const items = session.items || [];
    const total = items.length;
    const dayTracking = trackingForSelectedDate(dietTracking);
    const sessionLevel = dayTracking.find(
      (t: any) => t.calendar_meal_id === session.id && !t.calendar_meal_item_id
    );
    const completedCount = items.filter((item: any) =>
      dayTracking.some(
        (t: any) =>
          t.calendar_meal_item_id === item.id && t.completion_status === "completed"
      )
    ).length;
    const pct = total ? Math.round((completedCount / total) * 100) : 0;
    const status = sessionLevel?.completion_status
      ? sessionLevel.completion_status
      : total === 0
        ? "pending"
        : completedCount === total
          ? "completed"
          : completedCount > 0
            ? "partial"
            : "pending";
    return { status, pct, done: completedCount, total };
  };

  const statusLabel = (status: string) =>
    status === "completed" ? "Done" : status === "partial" ? "Partial" : status === "skipped" ? "Skipped" : "Not started";

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

      {/* Metrics: Last known weight, Week-to-date % compliance (Monday = start of week) */}
      <section className={`${cardBase} p-4`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg bg-white/5 p-3 border border-white/10 today-metric-box">
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-1">
              <Scale className="h-3.5 w-3.5" />
              Last known weight
            </div>
            <p className="text-lg font-semibold">
              {lastWeight
                ? `${lastWeight.value} ${lastWeight.unit || "kg"}`
                : "—"}
            </p>
            {(lastWeight?.measured_at || lastWeight?.recorded_date || lastWeight?.created_at) && (
              <p className="text-[11px] text-gray-500 mt-0.5">
                as on {new Date(lastWeight.measured_at || lastWeight.recorded_date || lastWeight.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-white/5 p-3 border border-white/10 today-metric-box">
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-1">
              <Pill className="h-3.5 w-3.5" />
              Week to date (Mon–{selectedDateKey})
            </div>
            <p className="text-lg font-semibold">
              {medicineCompliance != null ? `${medicineCompliance}%` : "—"}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Medicine</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3 border border-white/10 today-metric-box">
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-1">
              <Dumbbell className="h-3.5 w-3.5" />
              Week to date (Mon–{selectedDateKey})
            </div>
            <p className="text-lg font-semibold">
              {exerciseCompliance != null ? `${exerciseCompliance}%` : "—"}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Exercise</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3 border border-white/10 today-metric-box">
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-1">
              <Salad className="h-3.5 w-3.5" />
              Week to date (Mon–{selectedDateKey})
            </div>
            <p className="text-lg font-semibold">
              {mealCompliance != null ? `${mealCompliance}%` : "—"}
              {mealComplianceResult.total > 0 && (
                <span className="text-xs font-normal text-gray-500 ml-1">
                  ({mealComplianceResult.completed}/{mealComplianceResult.total} sessions)
                </span>
              )}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Meals</p>
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

      {/* Sequence cards: Exercise, Diet, Medicine, Dr. appointment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
              const { status, pct, done, total } = getFitnessSessionStatus(s);
              const dotColor = s.week_template_id
                ? ["#60a5fa", "#34d399", "#f59e0b", "#a78bfa", "#ec4899"][
                    Math.abs(String(s.week_template_id).split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0)) % 5
                  ]
                : "rgba(255,255,255,0.4)";
              const statusColor =
                status === "completed"
                  ? "text-emerald-400"
                  : status === "skipped"
                    ? "text-amber-400"
                    : status === "partial"
                      ? "text-blue-400"
                      : "text-gray-400";
              return (
                <motion.button
                  key={s.id}
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  onClick={() =>
                    navigate(`/app/fitness/session/${selectedDateKey}?sessionId=${s.id}`)
                  }
                  className="w-full text-left rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 hover:border-rose-400/30 flex items-center gap-2 today-list-item"
                >
                  <span
                    className="shrink-0 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: dotColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{sessionTitle}</p>
                    <p className="text-xs text-gray-400">
                      {s.planned_time || "Today"} · {s.exercises?.length || 0} exercises
                    </p>
                    <p className={`text-xs mt-0.5 ${statusColor}`}>
                      {statusLabel(status)} · {total ? `${done}/${total} (${pct}%)` : "—"}
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
            {dateSessionsDiet.map((s: any) => {
              const { status, pct, done, total } = getDietSessionStatus(s);
              const statusColor =
                status === "completed"
                  ? "text-emerald-400"
                  : status === "skipped"
                    ? "text-amber-400"
                    : status === "partial"
                      ? "text-blue-400"
                      : "text-gray-400";
              return (
                <motion.button
                  key={s.id}
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  onClick={() =>
                    navigate(`/app/diet/session/${selectedDateKey}?sessionId=${s.id}`)
                  }
                  className="w-full text-left rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 hover:border-rose-400/30 today-list-item"
                >
                  <p className="font-medium text-sm">{s.session_name || s.name || "Meal"}</p>
                  <p className="text-xs text-gray-400">
                    {(s.items?.length ?? s.meals?.length ?? 0)} item(s) · Tap to track
                  </p>
                  <p className={`text-xs mt-0.5 ${statusColor}`}>
                    {statusLabel(status)} · {total ? `${done}/${total} (${pct}%)` : "—"}
                  </p>
                </motion.button>
              );
            })}
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
                className="w-full text-left rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 hover:border-rose-400/30 today-list-item"
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
                className="w-full text-left rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 hover:border-rose-400/30 today-list-item"
              >
                <p className="font-medium text-sm">{appt.title || "Checkup"}</p>
                <p className="text-xs text-gray-400">
                  {appt.datetime || appt.scheduled_at || "Today"} · {appt.location || "—"}
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
            refetchVitals();
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
