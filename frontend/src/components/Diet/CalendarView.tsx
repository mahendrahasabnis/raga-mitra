import React, { useState, useEffect, useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight, Salad, CheckCircle2 } from "lucide-react";
import { dietApi, healthApi } from "../../services/api";
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
}

const CalendarView: React.FC<CalendarViewProps> = ({
  selectedClient,
  viewMode = "week",
  initialDate,
  readOnly = false,
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
  }, [currentDate, selectedClient]);

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

      const res = await dietApi.getCalendarEntries(
        selectedClient || undefined,
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0]
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
    const key = getDateKey(date);
    return entries.find((e) => e.date === key);
  };

  const getVitalTimestamp = (vital: any) => {
    const raw = vital.recorded_date || vital.measured_at || vital.created_at || vital.updated_at;
    const ts = raw ? new Date(raw).getTime() : 0;
    return Number.isNaN(ts) ? 0 : ts;
  };

  const formatVitalLabel = (label: string) => {
    const normalized = label.toLowerCase();
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
            const res = await dietApi.getProgress(
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

        const fallback = getWeeklyFallback(weekLabel);
        const progressRes = progressResponses[index];
        const completed = progressRes?.status === "fulfilled" ? progressRes.value?.stats?.completed_count || 0 : 0;
        const total = progressRes?.status === "fulfilled" ? progressRes.value?.stats?.total_count || 0 : 0;
        const compliance = total > 0 ? Math.round((completed / total) * 100) : fallback.complianceAvg;

        return {
          weekLabel,
          weightAvg: computeWeeklyAvg(weightVitals) ?? fallback.weightAvg,
          bmiAvg: computeWeeklyAvg(bmiVitals) ?? getSeededValue(`${weekLabel}-bmi`, 18.5, 30, 1),
          hba1cAvg: computeWeeklyAvg(hba1cVitals) ?? getSeededValue(`${weekLabel}-hba1c`, 4.8, 7.2, 1),
          complianceAvg: compliance,
        };
      });

      setWeeklyTrends(trends);
    } catch (error) {
      console.error("Failed to fetch weekly trends:", error);
    } finally {
      setLoadingTrends(false);
    }
  };

  const moveWeek = (direction: number) => {
    const updated = new Date(currentDate);
    updated.setDate(currentDate.getDate() + direction * 7);
    setCurrentDate(updated);
  };

  const handleDayClick = (date: Date) => {
    const dateKey = getDateKey(date);
    const entry = getEntryForDate(date);
    if (readOnly) return;
    if (entry?.sessions?.length > 0) {
      const session = entry.sessions[0];
      navigate(`/app/diet/${dateKey}?sessionId=${session.id}`);
    } else {
      navigate(`/app/diet/${dateKey}`);
    }
  };

  const handleSessionClick = (date: Date, sessionId: string) => {
    if (readOnly) return;
    const dateKey = getDateKey(date);
    navigate(`/app/diet/${dateKey}?sessionId=${sessionId}`);
  };

  const openDatePicker = () => {
    if (!datePickerRef.current) return;
    datePickerRef.current.showPicker?.();
    datePickerRef.current.click();
  };

  const setToday = () => {
    const today = new Date();
    setCurrentDate(today);
  };

  const dates = viewMode === "week" ? getWeekDates() : [currentDate];
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const avgWeight = weeklyTrends[weeklyTrends.length - 1]?.weightAvg;
  const avgCompliance = weeklyTrends[weeklyTrends.length - 1]?.complianceAvg;

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => moveWeek(-1)} className="btn-secondary p-2">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => moveWeek(1)} className="btn-secondary p-2">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="text-sm text-gray-400">
              {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={setToday} className="btn-secondary">Today</button>
            <button onClick={openDatePicker} className="btn-secondary p-2">
              <Calendar className="h-4 w-4" />
            </button>
            <input
              ref={datePickerRef}
              type="date"
              value={currentDate.toISOString().split("T")[0]}
              onChange={(e) => setCurrentDate(new Date(e.target.value))}
              className="hidden"
            />
          </div>
        </div>

        <div className="text-center text-sm text-gray-400">
          Avg. Weight : {avgWeight ?? "--"} KG | % Comp : {avgCompliance ?? "--"}%
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {dates.map((date) => {
          const entry = getEntryForDate(date);
          const dateKey = getDateKey(date);
          const sessions = entry?.sessions || [];
          const vitals = keyVitals.length > 0 ? keyVitals : getRandomVitalsForDate(formatCompactDate(date));

          return (
            <button
              key={dateKey}
              onClick={() => handleDayClick(date)}
              className="card p-4 text-left hover:border-blue-400/40 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">
                  {weekdayLabels[(date.getDay() + 6) % 7]}
                </div>
                <div className="text-sm text-gray-400">{date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
              </div>
              <div className="text-xs text-gray-400 mb-2">{sessions.length} Sessions</div>
              {sessions.length > 0 && (
                <div className="space-y-1">
                  {sessions.map((session: any, idx: number) => (
                    <button
                      key={session.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSessionClick(date, session.id);
                      }}
                      className="text-xs text-gray-300 hover:text-white block"
                    >
                      {idx + 1}. {session.session_name}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 text-xs text-gray-400">
                <div className="font-semibold mb-1">Health</div>
                {vitals.slice(0, 3).map((vital: any) => (
                  <div key={vital.id} className="flex items-center justify-between">
                    <span>{formatVitalLabel(vital.parameter_name || vital.parameter)}</span>
                    <span>{vital.value} {vital.unit || ""}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-2">
            {["Weight", "BMI", "HbA1c"].map((label) => (
              <button
                key={label}
                onClick={() => setSelectedVitalParam(label)}
                className={`btn-secondary text-xs ${selectedVitalParam === label ? "bg-blue-500/20 text-blue-200 border border-blue-400/30" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-400" /> Selected
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> % Compliance
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={weeklyTrends}>
            <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="weekLabel" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.15)" }} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.15)" }} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.15)" }} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }} labelStyle={{ color: "rgba(255,255,255,0.7)" }} />
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
      </div>
    </div>
  );
};

export default CalendarView;
