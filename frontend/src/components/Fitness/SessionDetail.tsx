import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, Circle, Camera, FileText, X, Save, Plus, Trash2 } from "lucide-react";
import { fitnessApi } from "../../services/api";
import ExerciseLibrary from "./ExerciseLibrary";

interface SessionDetailProps {
  date: string;
  session: any;
  selectedClient?: string | null;
  onComplete?: () => void;
}

const SessionDetail: React.FC<SessionDetailProps> = ({
  date,
  session,
  selectedClient,
  onComplete,
}) => {
  const [sessionData, setSessionData] = useState<any>(session);
  const [sessionTracking, setSessionTracking] = useState<any>({});
  const [exerciseTracking, setExerciseTracking] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");
  const [pictures, setPictures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [exerciseDetails, setExerciseDetails] = useState<Record<string, any[]>>({});
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const readOnly = !!selectedClient;
  const canAddExercises = true;
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false);

  useEffect(() => {
    fetchTracking();
  }, [date, sessionData?.id]);

  useEffect(() => {
    setSessionData((prev) => {
      if (!prev) return session;
      const prevCount = prev?.exercises?.length || 0;
      const nextCount = session?.exercises?.length || 0;
      return nextCount >= prevCount ? session : prev;
    });
  }, [session]);

  useEffect(() => {
    if (!sessionData?.id) return;
    if (sessionData.exercises && sessionData.exercises.length > 0) return;
    const hydrateFromEntry = async () => {
      try {
        const entryRes = await fitnessApi.getCalendarEntry(date, selectedClient || undefined);
        const entry = entryRes.entry;
        const updated = entry?.sessions?.find((s: any) => s.id === sessionData.id);
        if (updated?.exercises?.length) {
          setSessionData(updated);
        }
      } catch (error) {
        console.warn("⚠️ Failed to refresh session exercises", error);
      }
    };
    hydrateFromEntry();
  }, [date, selectedClient, sessionData?.id]);

  const fetchTracking = async () => {
    try {
      const res = await fitnessApi.getTracking(
        selectedClient || undefined,
        date,
        date
      );
      const sessionRows = res.tracking?.filter((t: any) => t.calendar_session_id === sessionData?.id) || [];
      const sessionOnly = sessionRows.find((t: any) => !t.calendar_exercise_id);
      if (sessionOnly) {
        setSessionTracking(sessionOnly);
        setNotes(sessionOnly.notes || "");
        setPictures(sessionOnly.pictures || []);
      }

      const exerciseMap: Record<string, any> = {};
      sessionRows
        .filter((t: any) => t.calendar_exercise_id)
        .forEach((t: any) => {
          exerciseMap[t.calendar_exercise_id] = t;
        });
      setExerciseTracking(exerciseMap);
    } catch (error) {
      console.error("Failed to fetch tracking:", error);
    }
  };

  const getSetsCount = (exercise: any) => {
    if (exercise.sets && Number(exercise.sets) > 0) return Number(exercise.sets);
    return 1;
  };

  const getRecommendedForSet = (exercise: any, index: number) => {
    const fallbackReps = exercise.reps || "";
    const fallbackWeight = exercise.weight || "";
    const fallbackDuration = (exercise.duration_text || exercise.duration) ?? "";
    if (index === 0) {
      return {
        reps: exercise.set_01_rep || fallbackReps,
        weight: exercise.weight_01 || fallbackWeight,
        duration: fallbackDuration,
      };
    }
    if (index === 1) {
      return {
        reps: exercise.set_02_rep || fallbackReps,
        weight: exercise.weight_02 || fallbackWeight,
        duration: fallbackDuration,
      };
    }
    return {
      reps: exercise.set_03_rep || fallbackReps,
      weight: exercise.weight_03 || fallbackWeight,
      duration: fallbackDuration,
    };
  };

  const buildSetDetails = (exercise: any, existing?: any[]) => {
    const count = getSetsCount(exercise);
    const base = Array.from({ length: count }).map((_, index) => {
      const recommended = getRecommendedForSet(exercise, index);
      return {
        completed: false,
        reps: "",
        weight: "",
        duration: "",
        recommended_reps: recommended.reps || "",
        recommended_weight: recommended.weight || "",
        recommended_duration: recommended.duration || "",
      };
    });

    if (!existing || !Array.isArray(existing) || existing.length === 0) return base;

    return base.map((row, index) => {
      const current = existing[index] || {};
      return {
        ...row,
        ...current,
        recommended_reps: row.recommended_reps || current.recommended_reps || "",
        recommended_weight: row.recommended_weight || current.recommended_weight || "",
        recommended_duration: row.recommended_duration || current.recommended_duration || "",
      };
    });
  };

  const ensureDetailsForExercise = (exercise: any) => {
    setExerciseDetails((prev) => {
      if (prev[exercise.id]) return prev;
      const existing = exerciseTracking[exercise.id]?.completed_sets_detail;
      return {
        ...prev,
        [exercise.id]: buildSetDetails(exercise, existing),
      };
    });
  };

  const getExerciseStatus = (exercise: any, index: number, exercises: any[]) => {
    const trackingRow = exerciseTracking[exercise.id];
    const isDone = trackingRow?.completion_status === "completed";
    if (isDone) return "Done";
    const firstPendingIndex = exercises.findIndex((e: any) => {
      const row = exerciseTracking[e.id];
      return row?.completion_status !== "completed";
    });
    if (firstPendingIndex === -1) return "Done";
    return firstPendingIndex === index ? "In Prog" : "Next";
  };

  const upsertSessionCompletion = async (status: "completed" | "partial" | "pending") => {
    if (!sessionData) return;
    const trackingData = {
      calendar_entry_id: sessionData.calendar_entry_id,
      calendar_session_id: sessionData.id,
      tracked_date: date,
      completion_status: status,
      client_id: selectedClient || undefined,
    };

    if (sessionTracking.id) {
      await fitnessApi.updateTracking(sessionTracking.id, trackingData);
    } else {
      await fitnessApi.createTracking(trackingData);
    }
  };

  const updateCalendarEntrySessions = async (sessions: any[]) => {
    const entryRes = await fitnessApi.getCalendarEntry(date, selectedClient || undefined);
    const entry = entryRes.entry;
    const payload = {
      date,
      week_template_id: entry?.week_template_id || null,
      template_day_id: entry?.template_day_id || null,
      is_override: true,
      sessions,
      client_id: selectedClient || undefined,
    };
    return fitnessApi.createCalendarEntry(payload);
  };

  const handleAddSessionAdhoc = async () => {
    const sessionName = prompt("Session name (e.g., Morning, Evening):");
    if (!sessionName) return;
    setLoading(true);
    try {
      const entryRes = await fitnessApi.getCalendarEntry(date, selectedClient || undefined);
      const entry = entryRes.entry;
      const existingSessions = entry?.sessions || [];
      const maxOrder = existingSessions.reduce((max: number, s: any) => Math.max(max, s.session_order || 0), -1);
      const newSession = {
        session_name: sessionName,
        session_order: maxOrder + 1,
        notes: null,
        exercises: [],
      };
      const created = await updateCalendarEntrySessions([...existingSessions, newSession]);
      const createdSessions = created.entry?.sessions || [];
      const createdSession = createdSessions.find((s: any) =>
        s.session_name === sessionName && s.session_order === newSession.session_order
      ) || createdSessions[createdSessions.length - 1];
      if (createdSession) {
        setSessionData(createdSession);
      }
    } catch (error) {
      console.error("Failed to add session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionData) return;
    if (!confirm("Delete this session?")) return;
    setLoading(true);
    try {
      const entryRes = await fitnessApi.getCalendarEntry(date, selectedClient || undefined);
      const entry = entryRes.entry;
      const remainingSessions = (entry?.sessions || []).filter((s: any) => s.id !== sessionData.id);
      const created = await updateCalendarEntrySessions(remainingSessions);
      const nextSession = created.entry?.sessions?.[0];
      if (nextSession) {
        setSessionData(nextSession);
      } else {
        setSessionData(null);
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExercise = async (exercise: any, exerciseIndex: number) => {
    if (!sessionData) return;
    if (!confirm("Delete this exercise?")) return;
    setLoading(true);
    try {
      const entryRes = await fitnessApi.getCalendarEntry(date, selectedClient || undefined);
      const entry = entryRes.entry;
      const updatedSessions = (entry?.sessions || []).map((s: any) => {
        if (s.id !== sessionData.id) return s;
        const exercises = s.exercises || [];
        const filtered = exercises.filter((ex: any, idx: number) =>
          exercise?.id ? ex.id !== exercise.id : idx !== exerciseIndex
        );
        return { ...s, exercises: filtered };
      });
      const created = await updateCalendarEntrySessions(updatedSessions);
      const updatedSession = created.entry?.sessions?.find((s: any) =>
        s.session_name === sessionData.session_name && s.session_order === sessionData.session_order
      );
      if (updatedSession) {
        setSessionData(updatedSession);
      }
    } catch (error) {
      console.error("Failed to delete exercise:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExercise = async (exercise: any) => {
    if (!sessionData) return;
    const details = exerciseDetails[exercise.id] || [];
    const completedCount = details.filter((d) => d.completed).length;
    const completionStatus =
      completedCount === 0 ? "pending" : completedCount === details.length ? "completed" : "partial";

    const numericReps = details
      .map((d) => parseInt(d.reps, 10))
      .filter((v) => !Number.isNaN(v));
    const totalReps = numericReps.length > 0 ? numericReps.reduce((a, b) => a + b, 0) : null;

    const numericDuration = details
      .map((d) => parseInt(d.duration, 10))
      .filter((v) => !Number.isNaN(v));
    const totalDuration =
      numericDuration.length === details.length && details.length > 0
        ? numericDuration.reduce((a, b) => a + b, 0)
        : null;

    const numericWeights = details
      .map((d) => parseFloat(d.weight))
      .filter((v) => !Number.isNaN(v));
    const avgWeight = numericWeights.length > 0
      ? (numericWeights.reduce((a, b) => a + b, 0) / numericWeights.length)
      : null;

    const trackingData = {
      calendar_entry_id: sessionData.calendar_entry_id,
      calendar_session_id: sessionData.id,
      calendar_exercise_id: exercise.id,
      tracked_date: date,
      completion_status: completionStatus,
      completed_sets: completedCount,
      completed_reps: totalReps !== null ? String(totalReps) : null,
      completed_duration: totalDuration,
      completed_weight: avgWeight,
      completed_sets_detail: details,
      client_id: selectedClient || undefined,
    };

    setLoading(true);
    try {
      const existing = exerciseTracking[exercise.id];
      if (existing?.id) {
        await fitnessApi.updateTracking(existing.id, trackingData);
      } else {
        await fitnessApi.createTracking(trackingData);
      }
      if (sessionData.exercises?.length) {
        const allCompleted = sessionData.exercises.every((ex: any) => {
          if (ex.id === exercise.id) return completionStatus === "completed";
          return exerciseTracking[ex.id]?.completion_status === "completed";
        });
        const anyCompleted = sessionData.exercises.some((ex: any) => {
          if (ex.id === exercise.id) return completionStatus !== "pending";
          const status = exerciseTracking[ex.id]?.completion_status;
          return status && status !== "pending";
        });
        const sessionStatus = allCompleted ? "completed" : anyCompleted ? "partial" : "pending";
        await upsertSessionCompletion(sessionStatus);
      }
      await fetchTracking();
      onComplete && onComplete();
    } catch (error) {
      console.error("Failed to save exercise tracking:", error);
    } finally {
      setLoading(false);
    }
  };

  const scheduleAutoSave = (exercise: any) => {
    if (readOnly) return;
    if (saveTimersRef.current[exercise.id]) {
      clearTimeout(saveTimersRef.current[exercise.id]);
    }
    saveTimersRef.current[exercise.id] = setTimeout(() => {
      handleSaveExercise(exercise);
      delete saveTimersRef.current[exercise.id];
    }, 800);
  };

  const markAllSetsComplete = (exercise: any) => {
    if (readOnly) return;
    ensureDetailsForExercise(exercise);
    setExerciseDetails((prev) => {
      const next = [...(prev[exercise.id] || [])].map((d) => ({ ...d, completed: true }));
      return { ...prev, [exercise.id]: next };
    });
    handleSaveExercise(exercise);
  };

  const normalizeValue = (value: any) => String(value || "").trim();

  const shouldAutoComplete = (setDetail: any) => {
    const hasDuration = normalizeValue(setDetail.recommended_duration) !== "";
    if (hasDuration) {
      return normalizeValue(setDetail.duration) !== "" &&
        normalizeValue(setDetail.duration) === normalizeValue(setDetail.recommended_duration);
    }
    const repsMatch =
      normalizeValue(setDetail.reps) !== "" &&
      normalizeValue(setDetail.reps) === normalizeValue(setDetail.recommended_reps);
    const weightMatch =
      normalizeValue(setDetail.weight) === normalizeValue(setDetail.recommended_weight);
    return repsMatch && weightMatch;
  };

  const handleSaveNotes = async () => {
    if (!sessionData) return;

    setLoading(true);
    try {
      const trackingData = {
        calendar_entry_id: sessionData.calendar_entry_id,
        calendar_session_id: sessionData.id,
        tracked_date: date,
        notes,
        pictures,
        client_id: selectedClient || undefined,
      };

      if (sessionTracking.id) {
        await fitnessApi.updateTracking(sessionTracking.id, trackingData);
      } else {
        await fitnessApi.createTracking(trackingData);
      }

      await fetchTracking();
    } catch (error) {
      console.error("Failed to save notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPicture = () => {
    const url = prompt("Picture URL:");
    if (url) {
      setPictures([...pictures, url]);
    }
  };

  const handleRemovePicture = (index: number) => {
    setPictures(pictures.filter((_, i) => i !== index));
  };

  if (!sessionData) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">No session selected</p>
      </div>
    );
  }

  const exercises = sessionData.exercises || [];
  const isCompleted = exercises.length > 0
    ? exercises.every((exercise: any) => exerciseTracking[exercise.id]?.completion_status === "completed")
    : sessionTracking.completion_status === "completed";
  const hasInProgress = exercises.length > 0
    ? exercises.some((exercise: any) => {
        const status = exerciseTracking[exercise.id]?.completion_status;
        return status && status !== "pending";
      })
    : sessionTracking.completion_status === "partial";

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Session Header */}
      <div className="card p-4">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">{sessionData.session_name}</h2>
              <p className="text-sm text-gray-400">{new Date(date).toLocaleDateString()}</p>
            </div>
            {!readOnly && (
              <div className={`flex items-center gap-2 ${isCompleted ? "text-emerald-300" : hasInProgress ? "text-blue-300" : "text-gray-400"}`}>
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                <span>{isCompleted ? "Completed" : hasInProgress ? "In Progress" : "Not Started"}</span>
              </div>
            )}
          </div>
          {(canAddExercises || !readOnly) && (
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                onClick={() => setShowExerciseLibrary(true)}
                className="btn-secondary text-xs flex items-center justify-center gap-1 w-full h-9 truncate"
                title="Add exercise"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
              <button
                onClick={handleDeleteSession}
                className="btn-secondary text-xs flex items-center justify-center gap-1 w-full h-9 truncate"
                title="Delete session"
                disabled={loading}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Exercises Checklist */}
      {exercises.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold mb-4">Exercises</h3>
          <div className="space-y-3">
            {exercises.map((exercise: any, index: number) => {
              const status = getExerciseStatus(exercise, index, exercises);
              const isExpanded = expandedExerciseId === exercise.id;
              const detail = exerciseDetails[exercise.id] || [];

              return (
                <div
                  key={exercise.id || `${exercise.exercise_name || "exercise"}-${index}`}
                  className="p-3 bg-white/5 rounded-lg"
                  onClick={() => {
                    const next = isExpanded ? null : exercise.id;
                    setExpandedExerciseId(next);
                    if (!isExpanded) {
                      ensureDetailsForExercise(exercise);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-medium">{exercise.exercise_name}</h4>
                      <div className="flex gap-4 text-sm text-gray-400 mt-1">
                        {exercise.sets && <span>{exercise.sets} sets</span>}
                        {exercise.reps && <span>{exercise.reps} reps</span>}
                        {(exercise.duration_text ?? exercise.duration) && (
                          <span>
                            {typeof exercise.duration === "number" || (exercise.duration && !Number.isNaN(Number(exercise.duration)))
                              ? `${exercise.duration}s`
                              : (exercise.duration_text || exercise.duration)}
                          </span>
                        )}
                        {exercise.weight && <span>{exercise.weight}kg</span>}
                      </div>
                      {exercise.notes && (
                        <p className="text-sm text-gray-300 mt-2">{exercise.notes}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        status === "Done"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : status === "In Prog"
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-white/10 text-gray-300"
                      }`}
                    >
                      {status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteExercise(exercise, index);
                      }}
                      className="btn-secondary text-xs"
                      title="Delete exercise"
                      disabled={loading}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {isExpanded && (
                    <div
                      className="mt-4 border-t border-white/10 pt-4 space-y-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                        <div>
                          <div className="font-medium text-gray-200 mb-1">Expected</div>
                          <div>Sets: {exercise.sets || 1}</div>
                          {exercise.reps && <div>Reps: {exercise.reps}</div>}
                          {(exercise.duration_text ?? exercise.duration) && (
                            <div>
                              Duration:{" "}
                              {typeof exercise.duration === "number" || (exercise.duration && !Number.isNaN(Number(exercise.duration)))
                                ? `${exercise.duration}s`
                                : (exercise.duration_text || exercise.duration)}
                            </div>
                          )}
                          {exercise.weight && <div>Weight: {exercise.weight}kg</div>}
                        </div>
                        <div>
                          <div className="font-medium text-gray-200 mb-1">Actual</div>
                          <div>Completed Sets: {detail.filter((d) => d.completed).length}</div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {detail.map((setDetail: any, setIndex: number) => (
                          <div key={setIndex} className="card p-3 bg-white/5">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Set {setIndex + 1}</span>
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={setDetail.completed}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setExerciseDetails((prev) => {
                                      const next = [...(prev[exercise.id] || [])];
                                      next[setIndex] = { ...next[setIndex], completed: checked };
                                      return { ...prev, [exercise.id]: next };
                                    });
                                    scheduleAutoSave(exercise);
                                  }}
                                onClick={(e) => e.stopPropagation()}
                                  disabled={readOnly}
                                />
                                Completed
                              </label>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              <div>
                                <div className="text-gray-400 mb-1">Rep (Recommended)</div>
                                <input
                                  type="text"
                                  value={setDetail.recommended_reps}
                                  readOnly
                                  className="input-field w-full opacity-70"
                                />
                              </div>
                              <div>
                                <div className="text-gray-400 mb-1">Rep (Actual)</div>
                                <input
                                  type="text"
                                  value={setDetail.reps}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setExerciseDetails((prev) => {
                                      const next = [...(prev[exercise.id] || [])];
                                      const updated = { ...next[setIndex], reps: value };
                                      updated.completed = shouldAutoComplete(updated) || updated.completed;
                                      next[setIndex] = updated;
                                      return { ...prev, [exercise.id]: next };
                                    });
                                    scheduleAutoSave(exercise);
                                  }}
                                  placeholder="Reps"
                                  className="input-field w-full"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={readOnly}
                                />
                              </div>
                              <div>
                                <div className="text-gray-400 mb-1">Weight (Recommended)</div>
                                <input
                                  type="text"
                                  value={setDetail.recommended_weight}
                                  readOnly
                                  className="input-field w-full opacity-70"
                                />
                              </div>
                              <div>
                                <div className="text-gray-400 mb-1">Weight (Actual)</div>
                                <input
                                  type="text"
                                  value={setDetail.weight}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setExerciseDetails((prev) => {
                                      const next = [...(prev[exercise.id] || [])];
                                      const updated = { ...next[setIndex], weight: value };
                                      updated.completed = shouldAutoComplete(updated) || updated.completed;
                                      next[setIndex] = updated;
                                      return { ...prev, [exercise.id]: next };
                                    });
                                    scheduleAutoSave(exercise);
                                  }}
                                  placeholder="Weight"
                                  className="input-field w-full"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={readOnly}
                                />
                              </div>
                              <div>
                                <div className="text-gray-400 mb-1">Duration or Distance (Recommended)</div>
                                <input
                                  type="text"
                                  value={setDetail.recommended_duration}
                                  readOnly
                                  className="input-field w-full opacity-70"
                                />
                              </div>
                              <div>
                                <div className="text-gray-400 mb-1">Duration or Distance (Actual)</div>
                                <input
                                  type="text"
                                  value={setDetail.duration}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setExerciseDetails((prev) => {
                                      const next = [...(prev[exercise.id] || [])];
                                      const updated = { ...next[setIndex], duration: value };
                                      updated.completed = shouldAutoComplete(updated) || updated.completed;
                                      next[setIndex] = updated;
                                      return { ...prev, [exercise.id]: next };
                                    });
                                    scheduleAutoSave(exercise);
                                  }}
                                  placeholder="e.g. 5Hr 20min, 5km, 10 mile"
                                  className="input-field w-full"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={readOnly}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveExercise(exercise);
                            }}
                            className="btn-secondary p-2"
                            disabled={loading}
                            title="Save Exercise"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAllSetsComplete(exercise);
                            }}
                            className="btn-secondary p-2"
                            disabled={loading}
                            title="Mark All Sets Complete"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Notes */}
      {!selectedClient && (
        <div className="card p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Notes
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field w-full"
            rows={4}
            placeholder="Add notes about this session..."
          />
        </div>
      )}

      {showExerciseLibrary && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-0">
          <div className="card w-full h-full md:h-auto md:max-w-5xl md:max-h-[90vh] p-4 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Add Exercise</h3>
              <button className="btn-secondary" onClick={() => setShowExerciseLibrary(false)}>
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ExerciseLibrary
                selectedClient={selectedClient}
                onSelectMultiple={async (templates) => {
                  try {
                    setLoading(true);
                    const appended = templates.map((t: any, idx: number) => ({
                      exercise_template_id: t.id,
                      exercise_name: t.name,
                      exercise_order: idx,
                      sets: t.sets_default || null,
                      reps: t.reps_default || null,
                      duration: t.duration_default || null,
                      weight: t.weight_01 || t.weight_default || null,
                      weight_unit: "kg",
                      set_01_rep: t.set_01_rep || null,
                      weight_01: t.weight_01 || null,
                      set_02_rep: t.set_02_rep || null,
                      weight_02: t.weight_02 || null,
                      set_03_rep: t.set_03_rep || null,
                      weight_03: t.weight_03 || null,
                      rest_seconds: null,
                      notes: null,
                    }));
                    setShowExerciseLibrary(false);
                    const entryRes = await fitnessApi.getCalendarEntry(date, selectedClient || undefined);
                    const entry = entryRes.entry;
                    if (!entry?.sessions) return;

                    const updatedSessions = entry.sessions.map((s: any) => {
                      if (s.id !== sessionData.id) return s;
                      const existingExercises = s.exercises || [];
                      const startOrder = existingExercises.length;
                      const appended = templates.map((t: any, idx: number) => ({
                        exercise_template_id: t.id,
                        exercise_name: t.name,
                        exercise_order: startOrder + idx,
                        sets: t.sets_default || null,
                        reps: t.reps_default || null,
                        duration: t.duration_default || null,
                        weight: t.weight_01 || t.weight_default || null,
                        weight_unit: "kg",
                        set_01_rep: t.set_01_rep || null,
                        weight_01: t.weight_01 || null,
                        set_02_rep: t.set_02_rep || null,
                        weight_02: t.weight_02 || null,
                        set_03_rep: t.set_03_rep || null,
                        weight_03: t.weight_03 || null,
                        rest_seconds: null,
                        notes: null,
                      }));
                      return {
                        ...s,
                        exercises: [...existingExercises, ...appended],
                      };
                    });
                    const localUpdated = updatedSessions.find((s: any) => s.id === sessionData.id);
                    if (localUpdated) {
                      setSessionData(localUpdated);
                    }

                    const payload = {
                      date,
                      week_template_id: entry.week_template_id,
                      template_day_id: entry.template_day_id,
                      is_override: true,
                      sessions: updatedSessions,
                      client_id: selectedClient || undefined,
                    };

                  await fitnessApi.createCalendarEntry(payload);
                  const refreshed = await fitnessApi.getCalendarEntry(date, selectedClient || undefined);
                  const currentSessionId = sessionData?.id;
                  const currentSessionName = sessionData?.session_name;
                  const currentSessionOrder = sessionData?.session_order;
                  const updatedSession = refreshed.entry?.sessions?.find((s: any) =>
                    currentSessionId ? s.id === currentSessionId : (s.session_name === currentSessionName && s.session_order === currentSessionOrder)
                  );
                  if (updatedSession) {
                    if (!localUpdated || (updatedSession.exercises?.length || 0) >= (localUpdated.exercises?.length || 0)) {
                      setSessionData(updatedSession);
                    }
                    return;
                  }
                  if (localUpdated) {
                    setSessionData(localUpdated);
                  }
                    setShowExerciseLibrary(false);
                  } catch (error) {
                    console.error("Failed to add exercises:", error);
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Pictures */}
      {!selectedClient && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Pictures
            </h3>
            <button onClick={handleAddPicture} className="btn-secondary text-sm">
              Add Picture
            </button>
          </div>
          {pictures.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {pictures.map((url, index) => (
                <div key={index} className="relative">
                  <img
                    src={url}
                    alt={`Session picture ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleRemovePicture(index)}
                    className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No pictures added</p>
          )}
        </div>
      )}

      {/* Save Button */}
      {!selectedClient && (
        <button
          onClick={handleSaveNotes}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? "Saving..." : "Save Notes & Pictures"}
        </button>
      )}
    </div>
  );
};

export default SessionDetail;
