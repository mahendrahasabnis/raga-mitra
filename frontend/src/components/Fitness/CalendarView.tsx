import React, { useState, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, Dumbbell, CheckCircle2 } from "lucide-react";
import { fitnessApi } from "../../services/api";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  useEffect(() => {
    fetchEntries();
  }, [currentDate, selectedClient]);

  useEffect(() => {
    if (initialDate) {
      const parsed = new Date(initialDate);
      if (!Number.isNaN(parsed.getTime())) {
        setCurrentDate(parsed);
      }
    }
  }, [initialDate]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const startDate = new Date(currentDate);
      if (viewMode === "week") {
        startDate.setDate(currentDate.getDate() - currentDate.getDay());
      }

      const endDate = new Date(startDate);
      if (viewMode === "week") {
        endDate.setDate(startDate.getDate() + 6);
      }

      const res = await fitnessApi.getCalendarEntries(
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
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getEntryForDate = (date: Date) => {
    const key = getDateKey(date);
    return entries.find((e) => e.date === key);
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

  const navigateToDate = (date: Date) => {
    const key = getDateKey(date);
    navigate(`/app/fitness/session/${key}`);
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
                    className="p-4 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition"
                    onClick={() => navigateToDate(currentDate)}
                  >
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
          <h3 className="font-semibold">
            {formatCompactDate(weekDates[0])} - {formatCompactDate(weekDates[6])}
          </h3>
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

        <div className="flex gap-2 overflow-x-auto md:grid md:grid-cols-7 md:gap-2">
          {weekDates.map((date) => {
            const entry = getEntryForDate(date);
            const isToday = getDateKey(date) === getDateKey(new Date());

            return (
              <div
                key={getDateKey(date)}
                className={`p-3 rounded-lg border min-w-[120px] md:min-w-0 ${
                  isToday ? "border-blue-400 bg-blue-500/10" : "border-white/10 bg-white/5"
                } cursor-pointer hover:bg-white/10 transition`}
                onClick={() => navigateToDate(date)}
              >
                <div className="text-xs text-gray-400 mb-1">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div className="text-lg font-semibold mb-2">{date.getDate()}</div>
                {entry?.is_rest_day ? (
                  <div className="text-xs text-gray-500">Rest</div>
                ) : entry?.sessions?.length > 0 ? (
                  <div className="space-y-1">
                    {entry.sessions.slice(0, 2).map((session: any) => (
                      <div key={session.id} className="text-xs">
                        <div className="flex items-center gap-1">
                          <Dumbbell className="h-3 w-3" />
                          {session.session_name}
                        </div>
                        {session.exercises?.length > 0 && (
                          <div className="text-[10px] text-gray-400 truncate">
                            {session.exercises.slice(0, 2).map((exercise: any) => {
                              const meta = formatExerciseMeta(exercise);
                              return `${exercise.exercise_name}${meta ? ` (${meta})` : ""}`;
                            }).join(" • ")}
                          </div>
                        )}
                      </div>
                    ))}
                    {entry.sessions.length > 2 && (
                      <div className="text-xs text-gray-400">+{entry.sessions.length - 2} more</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">-</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
