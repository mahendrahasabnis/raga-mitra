import React, { useState, useEffect } from "react";
import { Calendar, Plus, Edit, Trash2, Dumbbell, GripVertical } from "lucide-react";
import { fitnessApi } from "../../services/api";
import ExerciseLibrary from "./ExerciseLibrary";
import SelectDropdown from "../UI/SelectDropdown";

interface WeeklyPlanBuilderProps {
  selectedClient?: string | null;
  onRefresh?: () => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const WeeklyPlanBuilder: React.FC<WeeklyPlanBuilderProps> = ({
  selectedClient,
  onRefresh,
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [exerciseEditor, setExerciseEditor] = useState<{
    dayIndex: number;
    sessionId: string;
    exerciseIndex: number;
  } | null>(null);
  const [exerciseForm, setExerciseForm] = useState({
    set_01_rep: "",
    weight_01: "",
    set_02_rep: "",
    weight_02: "",
    set_03_rep: "",
    weight_03: "",
    duration: "",
    weight_unit: "kg",
  });

  const fetchTemplateDetails = async (id: string) => {
    try {
      const res = await fitnessApi.getWeekTemplate(id);
      setSelectedTemplate(res.template);
    } catch (error) {
      console.error("Failed to fetch template details:", error);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fitnessApi.getWeekTemplates(selectedClient || undefined);
      const activeTemplates = (res.templates || []).filter((t: any) => t.is_active !== false);
      setTemplates(activeTemplates);
      if (!selectedTemplate && res.templates && res.templates.length > 0) {
        const firstActive = activeTemplates[0];
        if (firstActive?.id) {
          fetchTemplateDetails(firstActive.id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    const name = prompt("Template name:");
    if (!name) return;

    try {
      const templateData = {
        name,
        description: "",
        days: DAYS.map((_, index) => ({
          day_of_week: index,
          is_rest_day: false,
          sessions: [],
        })),
        client_id: selectedClient || undefined,
      };

      const res = await fitnessApi.createWeekTemplate(templateData);
      await fetchTemplates();
      if (res.template) {
        setSelectedTemplate(res.template);
      }
    } catch (error) {
      console.error("Failed to create template:", error);
      alert("Failed to create template");
    }
  };

  const handleAddSession = async (dayIndex: number) => {
    if (!selectedTemplate) return;

    const sessionName = prompt("Session name (e.g., Morning, Evening):");
    if (!sessionName) return;

    try {
      const day = selectedTemplate.days[dayIndex];
      if (!day) return;

      // For simplicity, we'll recreate the template with the new session
      // In a real implementation, you'd have an API endpoint to add sessions
      const updatedDays = [...selectedTemplate.days];
      if (!updatedDays[dayIndex].sessions) {
        updatedDays[dayIndex].sessions = [];
      }
      updatedDays[dayIndex].sessions.push({
        session_name: sessionName,
        session_order: updatedDays[dayIndex].sessions.length,
        exercises: [],
      });

      const templateData = {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        days: updatedDays,
        client_id: selectedClient || undefined,
      };

      const res = await fitnessApi.updateWeekTemplate(selectedTemplate.id, templateData);
      if (res.template) {
        setSelectedTemplate(res.template);
      }
      onRefresh && onRefresh();
    } catch (error) {
      console.error("Failed to add session:", error);
      alert("Failed to add session");
    }
  };

  const handleAddExercises = (
    dayIndex: number | null,
    sessionId: string | null,
    exerciseTemplates: any[]
  ) => {
    setShowExerciseLibrary(false);
    setSelectedDayIndex(null);
    setSelectedSessionId(null);

    if (!selectedTemplate || dayIndex === null || !sessionId) return;

    const updatedDays = [...selectedTemplate.days];
    const day = updatedDays[dayIndex];
    const session = day.sessions.find((s: any) => s.id === sessionId);

    if (session) {
      if (!session.exercises) {
        session.exercises = [];
      }
      exerciseTemplates.forEach((exerciseTemplate) => {
        const dur = exerciseTemplate.duration_default_text ?? exerciseTemplate.duration_default;
        session.exercises.push({
          exercise_template_id: exerciseTemplate.id,
          exercise_name: exerciseTemplate.name,
          exercise_order: session.exercises.length,
          sets: exerciseTemplate.sets_default,
          reps: exerciseTemplate.reps_default,
          duration: dur,
          set_01_rep: exerciseTemplate.set_01_rep || null,
          weight_01: exerciseTemplate.weight_01 || null,
          set_02_rep: exerciseTemplate.set_02_rep || null,
          weight_02: exerciseTemplate.weight_02 || null,
          set_03_rep: exerciseTemplate.set_03_rep || null,
          weight_03: exerciseTemplate.weight_03 || null,
          weight_unit: "kg",
        });
      });

      const templateData = {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        days: updatedDays,
        client_id: selectedClient || undefined,
      };

      fitnessApi.updateWeekTemplate(selectedTemplate.id, templateData).then((res) => {
        if (res.template) {
          setSelectedTemplate(res.template);
        }
        onRefresh && onRefresh();
      });
    }
  };

  const handleExerciseLibraryOpen = (dayIndex: number, sessionId: string) => {
    setSelectedDayIndex(dayIndex);
    setSelectedSessionId(sessionId);
    setShowExerciseLibrary(true);
  };

  const openExerciseEditor = (dayIndex: number, sessionId: string, exerciseIndex: number) => {
    if (!selectedTemplate) return;
    const day = selectedTemplate.days?.find((d: any) => d.day_of_week === dayIndex);
    const session = day?.sessions?.find((s: any) => s.id === sessionId);
    const exercise = session?.exercises?.[exerciseIndex];
    if (!exercise) return;
    setExerciseForm({
      set_01_rep: exercise.set_01_rep ?? "",
      weight_01: exercise.weight_01 ?? "",
      set_02_rep: exercise.set_02_rep ?? "",
      weight_02: exercise.weight_02 ?? "",
      set_03_rep: exercise.set_03_rep ?? "",
      weight_03: exercise.weight_03 ?? "",
      duration: (exercise.duration_text ?? exercise.duration ?? "") as string,
      weight_unit: exercise.weight_unit ?? "kg",
    });
    setExerciseEditor({ dayIndex, sessionId, exerciseIndex });
  };

  const handleSaveExerciseSettings = async () => {
    if (!selectedTemplate || !exerciseEditor) return;
    const { dayIndex, sessionId, exerciseIndex } = exerciseEditor;
    const updatedDays = [...selectedTemplate.days];
    const day = updatedDays[dayIndex];
    const session = day.sessions.find((s: any) => s.id === sessionId);
    if (!session) return;
    const exercise = session.exercises?.[exerciseIndex];
    if (!exercise) return;

    const hasSet2 = exerciseForm.set_02_rep || exerciseForm.weight_02;
    const hasSet3 = exerciseForm.set_03_rep || exerciseForm.weight_03;
    const hasSet1 = exerciseForm.set_01_rep || exerciseForm.weight_01;
    const computedSets = hasSet3 ? 3 : hasSet2 ? 2 : hasSet1 ? 1 : null;

    session.exercises[exerciseIndex] = {
      ...exercise,
      set_01_rep: exerciseForm.set_01_rep || null,
      weight_01: exerciseForm.weight_01 || null,
      set_02_rep: exerciseForm.set_02_rep || null,
      weight_02: exerciseForm.weight_02 || null,
      set_03_rep: exerciseForm.set_03_rep || null,
      weight_03: exerciseForm.weight_03 || null,
      weight_unit: exerciseForm.weight_unit || "kg",
      sets: computedSets,
      reps: exerciseForm.set_01_rep || exercise.reps || null,
      weight: exerciseForm.weight_01 || exercise.weight || null,
      duration: exerciseForm.duration || null,
    };

    const templateData = {
      name: selectedTemplate.name,
      description: selectedTemplate.description,
      days: updatedDays,
      client_id: selectedClient || undefined,
    };

    try {
      const res = await fitnessApi.updateWeekTemplate(selectedTemplate.id, templateData);
      if (res.template) {
        setSelectedTemplate(res.template);
      }
      setExerciseEditor(null);
      onRefresh && onRefresh();
    } catch (error) {
      console.error("Failed to update exercise settings:", error);
      alert("Failed to update exercise settings");
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    if (!confirm("Delete this weekly template?")) return;
    try {
      const payload = {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        is_active: false,
        days: selectedTemplate.days || [],
        client_id: selectedClient || undefined,
      };
      await fitnessApi.updateWeekTemplate(selectedTemplate.id, payload);
      setSelectedTemplate(null);
      await fetchTemplates();
      onRefresh && onRefresh();
    } catch (error) {
      console.error("Failed to delete template:", error);
      alert("Failed to delete template");
    }
  };

  const handleDeleteSession = async (dayIndex: number, sessionId: string) => {
    if (!selectedTemplate) return;
    if (!confirm("Delete this session?")) return;
    const updatedDays = [...selectedTemplate.days];
    const day = updatedDays[dayIndex];
    if (!day?.sessions) return;
    day.sessions = day.sessions.filter((s: any) => s.id !== sessionId);
    const templateData = {
      name: selectedTemplate.name,
      description: selectedTemplate.description,
      days: updatedDays,
      client_id: selectedClient || undefined,
    };
    try {
      const res = await fitnessApi.updateWeekTemplate(selectedTemplate.id, templateData);
      if (res.template) {
        setSelectedTemplate(res.template);
      }
      onRefresh && onRefresh();
    } catch (error) {
      console.error("Failed to delete session:", error);
      alert("Failed to delete session");
    }
  };

  const handleDeleteExercise = async (dayIndex: number, sessionId: string, exerciseIndex: number) => {
    if (!selectedTemplate) return;
    if (!confirm("Delete this exercise?")) return;
    const updatedDays = [...selectedTemplate.days];
    const day = updatedDays[dayIndex];
    const session = day?.sessions?.find((s: any) => s.id === sessionId);
    if (!session?.exercises) return;
    session.exercises = session.exercises.filter((_: any, idx: number) => idx !== exerciseIndex);
    const templateData = {
      name: selectedTemplate.name,
      description: selectedTemplate.description,
      days: updatedDays,
      client_id: selectedClient || undefined,
    };
    try {
      const res = await fitnessApi.updateWeekTemplate(selectedTemplate.id, templateData);
      if (res.template) {
        setSelectedTemplate(res.template);
      }
      onRefresh && onRefresh();
    } catch (error) {
      console.error("Failed to delete exercise:", error);
      alert("Failed to delete exercise");
    }
  };

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading templates...</p>
      </div>
    );
  }

  if (showExerciseLibrary && selectedDayIndex !== null && selectedSessionId !== null) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setShowExerciseLibrary(false);
            setSelectedDayIndex(null);
            setSelectedSessionId(null);
          }}
          className="btn-secondary"
        >
          ← Back to Builder
        </button>
        <ExerciseLibrary
          selectedClient={selectedClient}
          onSelectMultiple={(templates) =>
            handleAddExercises(selectedDayIndex, selectedSessionId, templates)
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Template Selection */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Weekly Templates</h3>
          <button onClick={handleCreateTemplate} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Template
          </button>
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-gray-400">No templates yet. Create one to get started.</p>
        ) : (
          <SelectDropdown
            value={selectedTemplate?.id || ""}
            options={[
              { value: "", label: "Select a template..." },
              ...templates.map((t) => ({ value: t.id, label: t.name })),
            ]}
            onChange={(value) => {
              const template = templates.find((t) => t.id === value);
              if (template) {
                fetchTemplateDetails(template.id);
              }
            }}
          />
        )}
      </div>

      {/* Template Builder */}
      {selectedTemplate && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{selectedTemplate.name}</h3>
              <button
                onClick={handleDeleteTemplate}
                className="btn-secondary text-xs flex items-center gap-1"
                title="Delete template"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>

            <div className="space-y-4">
              {DAYS.map((dayName, dayIndex) => {
                const day = selectedTemplate.days?.find((d: any) => d.day_of_week === dayIndex);
                const isRestDay = day?.is_rest_day;

                return (
                  <div key={dayIndex} className="border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{dayName}</h4>
                      {isRestDay && (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-500/20 text-gray-400">
                          Rest Day
                        </span>
                      )}
                    </div>

                    {!isRestDay && (
                      <div className="space-y-3">
                        {day?.sessions?.map((session: any) => (
                          <div key={session.id} className="bg-white/5 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium text-sm">{session.session_name}</h5>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleExerciseLibraryOpen(dayIndex, session.id)}
                                  className="text-xs btn-secondary"
                                >
                                  Add Exercise
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSession(dayIndex, session.id);
                                  }}
                                  className="text-xs btn-secondary"
                                  title="Delete session"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {session.exercises?.length > 0 ? (
                              <div className="space-y-2">
                                {session.exercises.map((exercise: any, idx: number) => (
                                  <div
                                    key={exercise.id || idx}
                                    className="flex items-center justify-between p-2 bg-white/5 rounded text-sm cursor-pointer hover:bg-white/10"
                                    onClick={() => openExerciseEditor(dayIndex, session.id, idx)}
                                    title="Edit sets, reps, weight, duration"
                                  >
                                    <div className="flex items-center gap-2">
                                      <GripVertical className="h-4 w-4 text-gray-400" />
                                      <span>{exercise.exercise_name}</span>
                                      {exercise.sets && <span className="text-gray-400">({exercise.sets} sets)</span>}
                                      {exercise.reps && <span className="text-gray-400">{exercise.reps} reps</span>}
                                      {(exercise.set_01_rep || exercise.weight_01) && (
                                        <span className="text-gray-400">
                                          Set-01: {exercise.set_01_rep || "-"} / {exercise.weight_01 || "-"}{exercise.weight_unit ? ` ${exercise.weight_unit}` : ""}
                                        </span>
                                      )}
                                      {(exercise.set_02_rep || exercise.weight_02) && (
                                        <span className="text-gray-400">
                                          Set-02: {exercise.set_02_rep || "-"} / {exercise.weight_02 || "-"}{exercise.weight_unit ? ` ${exercise.weight_unit}` : ""}
                                        </span>
                                      )}
                                      {(exercise.set_03_rep || exercise.weight_03) && (
                                        <span className="text-gray-400">
                                          Set-03: {exercise.set_03_rep || "-"} / {exercise.weight_03 || "-"}{exercise.weight_unit ? ` ${exercise.weight_unit}` : ""}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteExercise(dayIndex, session.id, idx);
                                      }}
                                      className="text-xs btn-secondary"
                                      title="Delete exercise"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">No exercises yet</p>
                            )}
                          </div>
                        ))}

                        <button
                          onClick={() => handleAddSession(dayIndex)}
                          className="text-xs btn-secondary w-full"
                        >
                          + Add Session
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {exerciseEditor && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Exercise Settings</h3>
              <button className="btn-secondary" onClick={() => setExerciseEditor(null)}>
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Set-01 Rep</label>
                  <input
                    type="text"
                    value={exerciseForm.set_01_rep}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, set_01_rep: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Weight-01</label>
                  <input
                    type="text"
                    value={exerciseForm.weight_01}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, weight_01: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Set-02 Rep</label>
                  <input
                    type="text"
                    value={exerciseForm.set_02_rep}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, set_02_rep: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Weight-02</label>
                  <input
                    type="text"
                    value={exerciseForm.weight_02}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, weight_02: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Set-03 Rep</label>
                  <input
                    type="text"
                    value={exerciseForm.set_03_rep}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, set_03_rep: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Weight-03</label>
                  <input
                    type="text"
                    value={exerciseForm.weight_03}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, weight_03: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
              </div>
            <div>
              <label className="text-xs text-gray-400">Weight Unit</label>
              <SelectDropdown
                value={exerciseForm.weight_unit}
                options={[
                  { value: "kg", label: "Kg" },
                  { value: "lbs", label: "Lbs" },
                ]}
                onChange={(value) => setExerciseForm({ ...exerciseForm, weight_unit: value })}
              />
            </div>
              <div>
                <label className="text-xs text-gray-400">Duration or Distance</label>
                <input
                  type="text"
                  value={exerciseForm.duration}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, duration: e.target.value })}
                  className="input-field w-full"
                  placeholder="e.g. 30, 5Hr 20min, 5km, 10 mile"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn-primary" onClick={handleSaveExerciseSettings}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyPlanBuilder;
