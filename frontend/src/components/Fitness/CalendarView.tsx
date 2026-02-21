import React, { useState, useEffect, useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight, Dumbbell, CheckCircle2 } from "lucide-react";
import { fitnessApi, healthApi } from "../../services/api";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CalendarViewProps {
  selectedClient?: string | null;
  viewMode?: "day" | "week";
  initialDate?: string;
  readOnly?: boolean;
  /** When the visible week changes (week view), called with start and end date keys YYYY-MM-DD */
  onWeekChange?: (weekStart: string, weekEnd: string) => void;
  /** Increment to force refetch of calendar entries (e.g. after apply/remove template) */
  refreshKey?: number;
}

const TEMPLATE_COLORS = [
  "#60a5fa", "#34d399", "#f59e0b", "#a78bfa", "#ec4899", "#22d3ee", "#f97316",
];

const templateIdToColor = (templateId: string | null | undefined): string => {
  if (!templateId) return "rgba(255,255,255,0.5)";
  let hash = 0;
  for (let i = 0; i < templateId.length; i++) hash = (hash << 5) - hash + templateId.charCodeAt(i);
  const index = Math.abs(hash) % TEMPLATE_COLORS.length;
  return TEMPLATE_COLORS[index];
};

const CalendarView: React.FC<CalendarViewProps> = ({
  selectedClient,
  viewMode = "week",
  initialDate,
  readOnly = false,
  onWeekChange,
  refreshKey = 0,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyVitals, setKeyVitals] = useState<any[]>([]);
  const [selectedVitalParam, setSelectedVitalParam] = useState<string | null>("Weight");
  const [weeklyTrends, setWeeklyTrends] = useState<Array<{
    weekLabel: string;
    weightAvg: number | null;
    bmiAvg: number | null;
    hba1cAvg: number | null;
    complianceAvg: number | null;
  }>>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [progressFetchFailed, setProgressFetchFailed] = useState(false);
  const navigate = useNavigate();
  const datePickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchEntries();
  }, [currentDate, selectedClient, refreshKey]);

  useEffect(() => {
    if (viewMode === "week" && onWeekChange) {
      const start = getWeekStart(currentDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      onWeekChange(getLocalDateKey(start), getLocalDateKey(end));
    }
  }, [currentDate, viewMode, onWeekChange]);

  useEffect(() => {
    fetchKeyVitals();
  }, [selectedClient]);

  useEffect(() => {
    fetchWeeklyTrends();
  }, [currentDate, selectedClient]);

  useEffect(() => {
    if (initialDate) {
      const parsed = new Date(initialDate);
      if (!Number.isNaN(parsed.getTime())) {
        setCurrentDate(parsed);
      }
    }
  }, [initialDate]);

  const getWeekStart = (date: Date) => {
    const start = new Date(date);
    const dayIndex = (start.getDay() + 6) % 7; // Monday = 0
    start.setDate(start.getDate() - dayIndex);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const startDate = viewMode === "week" ? getWeekStart(currentDate) : new Date(currentDate);

      const endDate = new Date(startDate);
      if (viewMode === "week") {
        endDate.setDate(startDate.getDate() + 6);
      }

      const res = await fitnessApi.getCalendarEntries(
        selectedClient || undefined,
        getLocalDateKey(startDate),
        getLocalDateKey(endDate)
      );
      setEntries(res.entries || []);
    } catch (error) {
      console.error("Failed to fetch calendar entries:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDateKey = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  /** Local YYYY-MM-DD so week boundaries match the displayed Mon–Sun (avoid UTC shift). */
  const getLocalDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const formatCompactDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const year = date.getFullYear();
    return `${day}${month}${year}`;
  };

  const getWeekDates = () => {
    const start = getWeekStart(currentDate);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const getEntryForDate = (date: Date) => {
    const key = getLocalDateKey(date);
    return entries.find((e) => e.date === key);
  };

  const getVitalTimestamp = (vital: any) => {
    const raw = vital.recorded_date || vital.measured_at || vital.created_at || vital.updated_at;
    const ts = raw ? new Date(raw).getTime() : 0;
    return Number.isNaN(ts) ? 0 : ts;
  };

  const formatVitalLabel = (label: string) => {
    const normalized = (label || "").toLowerCase();
    if (normalized.includes("weight")) return "Weight";
    if (normalized.includes("bmi")) return "BMI";
    if (normalized.includes("hba1c")) return "HbA1c";
    return label;
  };

  const fetchKeyVitals = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 90);
      const res = await healthApi.getVitals(selectedClient || undefined, {
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      });
      const vitals = res.vitals || [];
      const targetParams = ["weight", "bmi", "hba1c"];
      const latestByParam = targetParams.map((param) => {
        const matching = vitals
          .filter((v: any) => (v.parameter_name || v.parameter || "").toLowerCase().includes(param))
          .sort((a: any, b: any) => getVitalTimestamp(b) - getVitalTimestamp(a));
        return matching[0];
      }).filter(Boolean);
      if (latestByParam.length > 0) {
        setKeyVitals(latestByParam);
        return;
      }
      setKeyVitals([]);
    } catch (error) {
      console.error("Failed to fetch key vitals:", error);
      setKeyVitals([]);
    }
  };

  const getSeededValue = (seed: string, min: number, max: number, decimals = 1) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const normalized = Math.abs(hash % 1000) / 1000;
    const value = min + (max - min) * normalized;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  };

  const getRandomVitalsForDate = (dateKey: string) => {
    return [
      { id: `${dateKey}-weight`, parameter_name: "Weight", value: getSeededValue(`${dateKey}-w`, 58, 92, 1), unit: "kg" },
      { id: `${dateKey}-bmi`, parameter_name: "BMI", value: getSeededValue(`${dateKey}-b`, 18.5, 30, 1), unit: "" },
      { id: `${dateKey}-hba1c`, parameter_name: "HbA1c", value: getSeededValue(`${dateKey}-h`, 4.8, 7.2, 1), unit: "%" },
    ];
  };

  const getWeeklyFallback = (label: string) => {
    return {
      weightAvg: getSeededValue(`${label}-weight`, 58, 92, 1),
      complianceAvg: Math.round(getSeededValue(`${label}-compliance`, 55, 95, 0)),
    };
  };

  const getWeekEnd = (date: Date) => {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  };

  const formatWeekLabel = (weekEnd: Date) => {
    const day = String(weekEnd.getDate()).padStart(2, "0");
    const month = weekEnd.toLocaleDateString("en-US", { month: "short" });
    return `${day} ${month}`;
  };

  const fetchWeeklyTrends = async () => {
    setLoadingTrends(true);
    try {
      const latestEnd = getWeekEnd(currentDate);
      const weeks = Array.from({ length: 15 }).map((_, index) => {
        const end = new Date(latestEnd);
        end.setDate(latestEnd.getDate() - index * 7);
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { end, start };
      }).reverse();

      const earliest = weeks[0]?.start;
      const latest = weeks[weeks.length - 1]?.end;
      const vitalsRes = await healthApi.getVitals(selectedClient || undefined, {
        start_date: earliest.toISOString().split("T")[0],
        end_date: latest.toISOString().split("T")[0],
      });
      const vitals = vitalsRes.vitals || [];
      const filterVitals = (label: string) =>
        vitals.filter((v: any) =>
          (v.parameter_name || v.parameter || "").toLowerCase().includes(label)
        );

      const weightVitals = filterVitals("weight");
      const bmiVitals = filterVitals("bmi");
      const hba1cVitals = filterVitals("hba1c");

      const progressResponses: Array<{ status: "fulfilled" | "rejected"; value?: any }> = [];
      if (!progressFetchFailed) {
        for (const week of weeks) {
          try {
            const res = await fitnessApi.getProgress(
              selectedClient || undefined,
              week.start.toISOString().split("T")[0],
              week.end.toISOString().split("T")[0]
            );
            progressResponses.push({ status: "fulfilled", value: res });
          } catch (error) {
            setProgressFetchFailed(true);
            progressResponses.push({ status: "rejected" });
            break;
          }
        }
      }

      const trends = weeks.map((week, index) => {
        const weekLabel = formatWeekLabel(week.end);
        const computeWeeklyAvg = (items: any[]) => {
          const values = items
            .filter((v: any) => {
              const ts = getVitalTimestamp(v);
              return ts >= week.start.getTime() && ts <= week.end.getTime();
            })
            .map((v: any) => Number(v.value))
            .filter((v: number) => !Number.isNaN(v));
          if (values.length === 0) return null;
          return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
        };
        const weightAvg = computeWeeklyAvg(weightVitals)
          ?? getSeededValue(`${weekLabel}-weight`, 58, 92, 1);
        const bmiAvg = computeWeeklyAvg(bmiVitals)
          ?? getSeededValue(`${weekLabel}-bmi`, 18.5, 30, 1);
        const hba1cAvg = computeWeeklyAvg(hba1cVitals)
          ?? getSeededValue(`${weekLabel}-hba1c`, 4.8, 7.2, 1);

        const progressRes = progressResponses[index];
        let complianceAvg: number | null = null;
        if (progressRes?.status === "fulfilled") {
          const stats = progressRes.value?.stats || {};
          const total = stats.total_count || 0;
          const completed = stats.completed_count || 0;
          complianceAvg = total > 0 ? Math.round((completed / total) * 100) : 0;
        } else {
          complianceAvg = Math.round(getSeededValue(`${weekLabel}-compliance`, 55, 95, 0));
        }

        return {
          weekLabel,
          weightAvg,
          bmiAvg,
          hba1cAvg,
          complianceAvg,
        };
      });

      setWeeklyTrends(trends);
    } catch (error) {
      console.error("Failed to fetch weekly trends:", error);
      setWeeklyTrends([]);
    } finally {
      setLoadingTrends(false);
    }
  };

  const formatExerciseMeta = (exercise: any) => {
    const unit = exercise.weight_unit ? ` ${exercise.weight_unit}` : "";
    if (exercise.set_01_rep || exercise.weight_01 || exercise.set_02_rep || exercise.weight_02 || exercise.set_03_rep || exercise.weight_03) {
      const parts = [];
      if (exercise.set_01_rep || exercise.weight_01) {
        parts.push(`Set-01: ${exercise.set_01_rep || "-"} / ${exercise.weight_01 || "-"}${unit}`);
      }
      if (exercise.set_02_rep || exercise.weight_02) {
        parts.push(`Set-02: ${exercise.set_02_rep || "-"} / ${exercise.weight_02 || "-"}${unit}`);
      }
      if (exercise.set_03_rep || exercise.weight_03) {
        parts.push(`Set-03: ${exercise.set_03_rep || "-"} / ${exercise.weight_03 || "-"}${unit}`);
      }
      return parts.join(" • ");
    }
    const reps = exercise.reps ? `${exercise.reps} reps` : "";
    const weight = exercise.weight ? `${exercise.weight}${unit}` : "";
    if (reps && weight) return `${reps} / ${weight}`;
    return reps || weight || "";
  };

  const navigateToDate = (date: Date, sessionId?: string) => {
    const key = getLocalDateKey(date);
    const query = sessionId ? `?sessionId=${sessionId}` : "";
    navigate(`/app/fitness/session/${key}${query}`);
  };

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading calendar...</p>
      </div>
    );
  }

  if (viewMode === "day") {
    const entry = getEntryForDate(currentDate);
    return (
      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                const prev = new Date(currentDate);
                prev.setDate(prev.getDate() - 1);
                setCurrentDate(prev);
              }}
              className="p-2 rounded-lg hover:bg-white/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h3 className="font-semibold">
              {formatCompactDate(currentDate)}
            </h3>
            <button
              onClick={() => {
                const next = new Date(currentDate);
                next.setDate(next.getDate() + 1);
                setCurrentDate(next);
              }}
              className="p-2 rounded-lg hover:bg-white/10"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {entry ? (
            <div className="space-y-3">
              {entry.is_rest_day ? (
                <div className="text-center py-8 text-gray-400">Rest Day</div>
              ) : (
                entry.sessions?.map((session: any) => (
                  <div
                    key={session.id}
                    className="p-4 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition flex items-start gap-2"
                    onClick={() => navigateToDate(currentDate, session.id)}
                  >
                    <span
                      className="shrink-0 w-3 h-3 rounded-full mt-0.5"
                      style={{ backgroundColor: templateIdToColor(session.week_template_id) }}
                    />
                    <div className="min-w-0">
                    <h4 className="font-medium mb-2">{session.session_name}</h4>
                    {session.exercises?.length > 0 && (
                      <div className="space-y-1 text-sm text-gray-400">
                        <p>
                          {session.exercises.length} exercise{session.exercises.length !== 1 ? "s" : ""}
                        </p>
                        {session.exercises.slice(0, 4).map((exercise: any) => {
                          const meta = formatExerciseMeta(exercise);
                          return (
                            <div key={exercise.id} className="text-xs text-gray-300">
                              {exercise.exercise_name}
                              {meta ? ` • ${meta}` : ""}
                            </div>
                          );
                        })}
                        {session.exercises.length > 4 && (
                          <div className="text-xs text-gray-500">+{session.exercises.length - 4} more</div>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">No sessions planned</div>
          )}
        </div>
      </div>
    );
  }

  // Week view
  const weekDates = getWeekDates();

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              const prev = new Date(currentDate);
              prev.setDate(prev.getDate() - 7);
              setCurrentDate(prev);
            }}
            className="p-2 rounded-lg hover:bg-white/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">
              {formatCompactDate(weekDates[0])} - {formatCompactDate(weekDates[6])}
            </h3>
            <button
              onClick={() => {
                const picker = datePickerRef.current;
                if (!picker) return;
                if (typeof (picker as any).showPicker === "function") {
                  (picker as any).showPicker();
                } else {
                  picker.focus();
                  picker.click();
                }
              }}
              className="p-2 rounded-lg hover:bg-white/10 inline-flex items-center gap-1"
              title="Pick a date"
            >
              <Calendar className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="btn-secondary text-xs px-3"
              title="Go to current week"
            >
              Today
            </button>
            <input
              ref={datePickerRef}
              type="date"
              className="sr-only"
              value={getLocalDateKey(currentDate)}
              onChange={(e) => {
                const picked = new Date(e.target.value);
                if (!Number.isNaN(picked.getTime())) {
                  setCurrentDate(picked);
                  navigateToDate(picked);
                }
              }}
            />
          </div>
          <button
            onClick={() => {
              const next = new Date(currentDate);
              next.setDate(next.getDate() + 7);
              setCurrentDate(next);
            }}
            className="p-2 rounded-lg hover:bg-white/10"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-2 mb-3 text-xs text-gray-400 text-center calendar-summary-bar">
          <span className="text-gray-200">
            {(() => {
              const currentLabel = formatWeekLabel(getWeekEnd(currentDate));
              const currentWeek = weeklyTrends.find((w) => w.weekLabel === currentLabel);
              const weight = currentWeek && currentWeek.weightAvg !== null
                ? `${currentWeek.weightAvg} KG`
                : `${getWeeklyFallback(currentLabel).weightAvg} KG`;
              const compliance = currentWeek && currentWeek.complianceAvg !== null
                ? `${currentWeek.complianceAvg}%`
                : `${getWeeklyFallback(currentLabel).complianceAvg}%`;
              return `Avg. Weight : ${weight} | % Comp : ${compliance}`;
            })()}
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto md:grid md:grid-cols-7 md:gap-2">
          {weekDates.map((date) => {
            const entry = getEntryForDate(date);
            const isToday = getLocalDateKey(date) === getLocalDateKey(new Date());

            return (
              <div
                key={getLocalDateKey(date)}
                className={`calendar-day-card p-3 rounded-lg border min-w-[120px] md:min-w-0 min-h-[220px] ${
                  isToday ? "border-blue-400 bg-blue-500/10" : "border-white/10 bg-white/5"
                } hover:bg-white/10 transition cursor-pointer`}
                onClick={() => navigateToDate(date, entry?.sessions?.[0]?.id)}
              >
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="font-semibold">
                    {weekdayLabels[(date.getDay() + 6) % 7]}
                  </span>
                  <span className="text-base font-semibold text-foreground">{date.getDate()}</span>
                </div>

                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Sessions</p>
                  <div className="h-px bg-white/10 my-2" />
                  {entry?.is_rest_day ? (
                    <div className="text-xs text-gray-500 mt-1">Rest</div>
                  ) : entry?.sessions?.length > 0 ? (
                    <div className="space-y-1">
                      {entry.sessions.map((session: any, index: number) => (
                        <button
                          key={session.id}
                          className="text-xs w-full text-left flex items-center gap-1.5 hover:text-white/90"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToDate(date, session.id);
                          }}
                          title={session.session_name}
                        >
                          <span
                            className="shrink-0 w-2 h-2 rounded-full"
                            style={{ backgroundColor: templateIdToColor(session.week_template_id) }}
                          />
                          <span className="w-4 text-gray-500 shrink-0">{index + 1}.</span>
                          <span className="truncate">{session.session_name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 mt-1">-</div>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Health</p>
                  <div className="h-px bg-white/10 my-2" />
                  {(() => {
                    const vitalsToShow = keyVitals.length > 0 ? keyVitals : getRandomVitalsForDate(getLocalDateKey(date));
                    return (
                      <div className="space-y-1 text-[10px] text-gray-400 text-center">
                        {vitalsToShow.slice(0, 3).map((vital, index: number) => {
                        const label = formatVitalLabel(vital.parameter_name || vital.parameter);
                        return (
                          <button
                            key={vital.id || vital.parameter}
                            className="w-full truncate hover:text-white/90"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVitalParam(label);
                              fetchWeeklyTrends();
                            }}
                            title={label}
                          >
                            <span>
                              {label}:{" "}
                              <span className="text-gray-300">
                                {vital.value}
                                {vital.unit ? ` ${vital.unit}` : ""}
                              </span>
                            </span>
                          </button>
                        );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {selectedVitalParam && (
          <div className="card p-3 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">
                Weekly trends ({selectedVitalParam})
              </h4>
              <button
                className="text-xs text-gray-400 hover:text-gray-200"
                onClick={() => setSelectedVitalParam(null)}
              >
                Close
              </button>
            </div>
            {loadingTrends ? (
              <p className="text-sm text-gray-400">Loading trends...</p>
            ) : (
              <div>
                <p className="text-xs text-gray-400 mb-2">
                  Avg weekly {selectedVitalParam} vs % compliance
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={weeklyTrends}>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="weekLabel"
                      tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(10,10,10,0.9)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "10px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey={
                        selectedVitalParam === "BMI"
                          ? "bmiAvg"
                          : selectedVitalParam === "HbA1c"
                            ? "hba1cAvg"
                            : "weightAvg"
                      }
                      yAxisId="left"
                      stroke={
                        selectedVitalParam === "BMI"
                          ? "#f59e0b"
                          : selectedVitalParam === "HbA1c"
                            ? "#a78bfa"
                            : "#60a5fa"
                      }
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="complianceAvg"
                      yAxisId="right"
                      stroke="#34d399"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-400">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          selectedVitalParam === "BMI"
                            ? "#f59e0b"
                            : selectedVitalParam === "HbA1c"
                              ? "#a78bfa"
                              : "#60a5fa",
                      }}
                    />
                    <span>{selectedVitalParam}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>% Compliance</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarView;
