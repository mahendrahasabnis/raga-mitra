import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, Circle, Camera, FileText, X, Save } from "lucide-react";
import { fitnessApi } from "../../services/api";

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
  const [sessionTracking, setSessionTracking] = useState<any>({});
  const [exerciseTracking, setExerciseTracking] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");
  const [pictures, setPictures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [exerciseDetails, setExerciseDetails] = useState<Record<string, any[]>>({});
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const readOnly = !!selectedClient;

  useEffect(() => {
    fetchTracking();
  }, [date, session?.id]);

  const fetchTracking = async () => {
    try {
      const res = await fitnessApi.getTracking(
        selectedClient || undefined,
        date,
        date
      );
      const sessionRows = res.tracking?.filter((t: any) => t.calendar_session_id === session?.id) || [];
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
    const fallbackDuration = exercise.duration || "";
    if (index === 0) {
      return {
        reps: exercise.set_01_rep || fallbackReps,
        weight: exercise.weight_01 || fallbackWeight,
        duration: exercise.duration || fallbackDuration,
      };
    }
    if (index === 1) {
      return {
        reps: exercise.set_02_rep || fallbackReps,
        weight: exercise.weight_02 || fallbackWeight,
        duration: exercise.duration || fallbackDuration,
      };
    }
    return {
      reps: exercise.set_03_rep || fallbackReps,
      weight: exercise.weight_03 || fallbackWeight,
      duration: exercise.duration || fallbackDuration,
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
    if (!session) return;
    const trackingData = {
      calendar_entry_id: session.calendar_entry_id,
      calendar_session_id: session.id,
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

  const handleSaveExercise = async (exercise: any) => {
    if (!session) return;
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
    const totalDuration = numericDuration.length > 0 ? numericDuration.reduce((a, b) => a + b, 0) : null;

    const numericWeights = details
      .map((d) => parseFloat(d.weight))
      .filter((v) => !Number.isNaN(v));
    const avgWeight = numericWeights.length > 0
      ? (numericWeights.reduce((a, b) => a + b, 0) / numericWeights.length)
      : null;

    const trackingData = {
      calendar_entry_id: session.calendar_entry_id,
      calendar_session_id: session.id,
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
      if (session.exercises?.length) {
        const allCompleted = session.exercises.every((ex: any) => {
          if (ex.id === exercise.id) return completionStatus === "completed";
          return exerciseTracking[ex.id]?.completion_status === "completed";
        });
        const anyCompleted = session.exercises.some((ex: any) => {
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
    if (!session) return;

    setLoading(true);
    try {
      const trackingData = {
        calendar_entry_id: session.calendar_entry_id,
        calendar_session_id: session.id,
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

  if (!session) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">No session selected</p>
      </div>
    );
  }

  const exercises = session.exercises || [];
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">{session.session_name}</h2>
            <p className="text-sm text-gray-400">{new Date(date).toLocaleDateString()}</p>
          </div>
          {!readOnly && (
            <div className={`flex items-center gap-2 ${isCompleted ? "text-emerald-300" : hasInProgress ? "text-blue-300" : "text-gray-400"}`}>
              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              <span>{isCompleted ? "Completed" : hasInProgress ? "In Progress" : "Not Started"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Exercises Checklist */}
      {session.exercises && session.exercises.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold mb-4">Exercises</h3>
          <div className="space-y-3">
            {exercises.map((exercise: any, index: number) => {
              const status = getExerciseStatus(exercise, index, exercises);
              const isExpanded = expandedExerciseId === exercise.id;
              const detail = exerciseDetails[exercise.id] || [];

              return (
                <div
                  key={exercise.id}
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
                        {exercise.duration && <span>{exercise.duration}s</span>}
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
                          {exercise.duration && <div>Duration: {exercise.duration}s</div>}
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
                                <div className="text-gray-400 mb-1">Duration (Recommended)</div>
                                <input
                                  type="text"
                                  value={setDetail.recommended_duration}
                                  readOnly
                                  className="input-field w-full opacity-70"
                                />
                              </div>
                              <div>
                                <div className="text-gray-400 mb-1">Duration (Actual)</div>
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
                                  placeholder="Duration"
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
