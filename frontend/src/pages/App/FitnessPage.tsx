import React, { useEffect, useMemo, useState } from "react";
import { useSelectedClient } from "../../contexts/ClientContext";
import { useAuth } from "../../contexts/AuthContext";
import { fitnessApi, resourcesApi } from "../../services/api";
import { Dumbbell, Calendar, Target, BookOpen, Layout } from "lucide-react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import FitnessOverview from "../../components/Fitness/FitnessOverview";
import WeeklyPlanBuilder from "../../components/Fitness/WeeklyPlanBuilder";
import CalendarView from "../../components/Fitness/CalendarView";
import SessionDetail from "../../components/Fitness/SessionDetail";
import ExerciseLibrary from "../../components/Fitness/ExerciseLibrary";
import SelectDropdown from "../../components/UI/SelectDropdown";
import MyPatientAppointments from "../../components/Shared/MyPatientAppointments";

type TabType = "overview" | "weekly" | "calendar" | "library";

const FitnessPage: React.FC = () => {
  const { date } = useParams<{ date?: string }>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const hasResourceRole = useMemo(() => {
    const plat = user?.privileges?.find((p) => p.platform === "aarogya-mitra");
    const roles = (plat?.roles || []).concat(user?.role ? [user.role] : []);
    return roles.some((r) => r && ['doctor', 'fitnesstrainer', 'fitness trainer', 'dietitian', 'dietition', 'nutritionist'].includes(String(r).toLowerCase()));
  }, [user]);

  const hasAssistantRole = useMemo(() => {
    const plat = user?.privileges?.find((p) => p.platform === "aarogya-mitra");
    const roles = (plat?.roles || []).concat(user?.role ? [user.role] : []);
    return roles.some((r) => r && ['receptionist', 'nurse', 'assistanttrainer', 'assistant trainer', 'familymember', 'family member'].includes(String(r).toLowerCase()));
  }, [user]);

  const [progress, setProgress] = useState<any>({});
  const [streak, setStreak] = useState(0);
  const [nextSession, setNextSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const selectedClient = useSelectedClient();

  const [employers, setEmployers] = useState<Array<{ id: string; name: string; phone: string; employerRoles: string[] }>>([]);

  useEffect(() => {
    if (!hasAssistantRole || selectedClient) return;
    resourcesApi.getMyEmployers().then(res => setEmployers(res.employers || [])).catch(() => setEmployers([]));
  }, [hasAssistantRole, selectedClient]);

  const trainerEmployers = useMemo(() =>
    employers.filter(e => e.employerRoles.some(r => ['fitnesstrainer', 'fitness trainer'].includes(r))),
    [employers]
  );
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [weekTemplates, setWeekTemplates] = useState<any[]>([]);
  const [calendarTemplateId, setCalendarTemplateId] = useState<string>(
    () => localStorage.getItem("calendar-template-id") || ""
  );
  const [calendarWeekStart, setCalendarWeekStart] = useState<string>("");
  const [calendarWeekEnd, setCalendarWeekEnd] = useState<string>("");
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [needsSessionSetup, setNeedsSessionSetup] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [removingTemplate, setRemovingTemplate] = useState(false);

  const templateOptions = [
    { value: "", label: "Latest template" },
    ...weekTemplates.map((template) => ({
      value: template.id,
      label: template.name,
    })),
  ];

  useEffect(() => {
    fetchOverviewData();
  }, [selectedClient]);

  useEffect(() => {
    if (date) {
      setActiveTab("calendar");
      fetchSessionForDate(date, sessionId || undefined);
    }
  }, [date, sessionId, selectedClient]);

  useEffect(() => {
    if (activeTab === "calendar" || date) {
      fetchWeekTemplates();
    }
  }, [activeTab, date, selectedClient]);

  const fetchWeekTemplates = async () => {
    try {
      const res = await fitnessApi.getWeekTemplates(selectedClient || undefined);
      const activeTemplates = (res.templates || []).filter((t: any) => t.is_active !== false);
      setWeekTemplates(activeTemplates);
      if (calendarTemplateId && !activeTemplates.find((t: any) => t.id === calendarTemplateId)) {
        setCalendarTemplateId("");
        localStorage.removeItem("calendar-template-id");
      }
      if (!calendarTemplateId && activeTemplates.length > 0) {
        setCalendarTemplateId(activeTemplates[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch week templates:", error);
    }
  };

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const [progressRes, calendarRes] = await Promise.allSettled([
        fitnessApi.getProgress(
          selectedClient || undefined,
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        ),
        fitnessApi.getCalendarEntries(
          selectedClient || undefined,
          new Date().toISOString().split("T")[0],
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        ),
      ]);

      if (progressRes.status === "fulfilled") {
        setProgress(progressRes.value);
        setStreak(progressRes.value.streak || 0);
      }

      if (calendarRes.status === "fulfilled") {
        const entries = calendarRes.value.entries || [];
        const upcoming = entries
          .filter((e: any) => !e.is_rest_day && e.sessions?.length > 0)
          .sort((a: any, b: any) => (a.date > b.date ? 1 : -1))[0];
        if (upcoming && upcoming.sessions?.length > 0) {
          setNextSession({ ...upcoming.sessions[0], date: upcoming.date });
        }
      }
    } catch (error) {
      console.error("Failed to fetch overview data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionForDate = async (dateStr: string, targetSessionId?: string) => {
    try {
      const res = await fitnessApi.getCalendarEntry(dateStr, selectedClient || undefined);
      if (res.entry && res.entry.sessions?.length > 0) {
        const matchedSession = targetSessionId
          ? res.entry.sessions.find((s: any) => String(s.id) === String(targetSessionId))
          : res.entry.sessions[0];
        const fallbackSession = matchedSession || res.entry.sessions[0];
        setNeedsSessionSetup(false);
        setSelectedSession({ ...fallbackSession, date: dateStr, calendar_entry_id: res.entry.id });
        return;
      }
      setSelectedSession(null);
      setNeedsSessionSetup(true);
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status !== 404) {
        console.error("Failed to fetch session:", error);
        return;
      }
      setSelectedSession(null);
      setNeedsSessionSetup(true);
    }
  };

  const createSessionFromTemplate = async (dateStr: string, templateId?: string) => {
    try {
      let resolvedTemplateId = templateId || calendarTemplateId;
      if (!resolvedTemplateId) {
        const templatesRes = await fitnessApi.getWeekTemplates(selectedClient || undefined);
        const latestTemplate = templatesRes.templates?.[0];
        resolvedTemplateId = latestTemplate?.id || "";
      }
      if (!resolvedTemplateId) return;

      const templateRes = await fitnessApi.getWeekTemplate(resolvedTemplateId);
      const template = templateRes.template;
      if (!template?.days?.length) return;

      const dateObj = new Date(dateStr);
      const dayOfWeek = (dateObj.getDay() + 6) % 7; // 0=Mon ... 6=Sun
      const day = template.days.find((d: any) => d.day_of_week === dayOfWeek);
      if (!day || !day.sessions || day.sessions.length === 0) return;

      const payload = {
        date: dateStr,
        week_template_id: template.id,
        template_day_id: day.id,
        sessions: day.sessions.map((session: any) => ({
          session_name: session.session_name,
          session_order: session.session_order,
          notes: session.notes || null,
          exercises: (session.exercises || []).map((exercise: any) => {
            const hasSet3 = exercise.set_03_rep || exercise.weight_03;
            const hasSet2 = exercise.set_02_rep || exercise.weight_02;
            const hasSet1 = exercise.set_01_rep || exercise.weight_01;
            const computedSets = hasSet3 ? 3 : hasSet2 ? 2 : hasSet1 ? 1 : null;
            return {
              exercise_template_id: exercise.exercise_template_id || null,
              exercise_name: exercise.exercise_name,
              exercise_order: exercise.exercise_order || 0,
              sets: exercise.sets || computedSets,
              reps: exercise.reps || exercise.set_01_rep || null,
              duration: exercise.duration || null,
              weight: exercise.weight || exercise.weight_01 || null,
              weight_unit: exercise.weight_unit || null,
              set_01_rep: exercise.set_01_rep || null,
              weight_01: exercise.weight_01 || null,
              set_02_rep: exercise.set_02_rep || null,
              weight_02: exercise.weight_02 || null,
              set_03_rep: exercise.set_03_rep || null,
              weight_03: exercise.weight_03 || null,
              rest_seconds: exercise.rest_seconds || null,
              notes: exercise.notes || null,
            };
          }),
        })),
        client_id: selectedClient || undefined,
      };

      const created = await fitnessApi.createCalendarEntry(payload);
      if (created.entry?.sessions?.length > 0) {
        setNeedsSessionSetup(false);
        setSelectedSession({
          ...created.entry.sessions[0],
          date: dateStr,
          calendar_entry_id: created.entry.id,
        });
      }
    } catch (fallbackError) {
      console.error("Failed to build session from template:", fallbackError);
    }
  };

  const handleAddSessionAdhoc = async () => {
    if (!date) return;
    const sessionName = prompt("Session name (e.g., Morning, Evening):");
    if (!sessionName) return;
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
      const payload = {
        date,
        week_template_id: entry?.week_template_id || null,
        template_day_id: entry?.template_day_id || null,
        is_override: true,
        sessions: [...existingSessions, newSession],
        client_id: selectedClient || undefined,
      };
      const created = await fitnessApi.createCalendarEntry(payload);
      const createdSessions = created.entry?.sessions || [];
      const createdSession = createdSessions.find((s: any) =>
        s.session_name === sessionName && s.session_order === newSession.session_order
      ) || createdSessions[createdSessions.length - 1];
      if (createdSession) {
        setSelectedSession({ ...createdSession, date, calendar_entry_id: created.entry?.id });
        setNeedsSessionSetup(false);
      }
    } catch (error) {
      console.error("Failed to add session:", error);
    }
  };

  const weekStats = {
    completed: progress?.stats?.completed_count || 0,
    partial: progress?.stats?.partial_count || 0,
    skipped: progress?.stats?.skipped_count || 0,
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = selectedClient
    ? [{ id: "overview", label: "Overview", icon: <Target className="h-4 w-4" /> }]
    : [
        { id: "overview", label: "Overview", icon: <Target className="h-4 w-4" /> },
        { id: "weekly", label: "Template", icon: <Layout className="h-4 w-4" /> },
        { id: "calendar", label: "Calendar", icon: <Calendar className="h-4 w-4" /> },
        { id: "library", label: "Library", icon: <BookOpen className="h-4 w-4" /> },
      ];

  // If we have a date param, show session detail
  if (date && selectedSession) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            onClick={() => {
              setSelectedSession(null);
              setActiveTab("calendar");
              navigate("/app/fitness");
            }}
            className="btn-secondary w-full flex items-center justify-center h-9 truncate"
            title="Back to Calendar"
          >
            ← Back to Calendar
          </button>
          <button
            onClick={handleAddSessionAdhoc}
            className="btn-secondary text-xs flex items-center justify-center gap-1 w-full h-9 truncate"
            title="Add session"
          >
            + Session
          </button>
        </div>
        <SessionDetail
          date={date}
          session={selectedSession}
          selectedClient={selectedClient}
          onComplete={fetchOverviewData}
        />
      </div>
    );
  }

  if (date && !selectedSession) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            onClick={() => {
              setSelectedSession(null);
              setActiveTab("calendar");
              navigate("/app/fitness");
            }}
            className="btn-secondary w-full flex items-center justify-center h-9 truncate"
            title="Back to Calendar"
          >
            ← Back to Calendar
          </button>
          <button
            onClick={handleAddSessionAdhoc}
            className="btn-secondary text-xs flex items-center justify-center gap-1 w-full h-9 truncate"
            title="Add session"
          >
            + Session
          </button>
        </div>
        {needsSessionSetup && (
          <div className="card p-4">
            <h3 className="font-semibold mb-2">Set up this day</h3>
            <p className="text-xs text-gray-400 mb-4">
              Choose a weekly template to track planned sessions or add sessions/exercises ad-hoc.
            </p>
            <div className="space-y-3">
              <SelectDropdown
                value={calendarTemplateId}
                options={templateOptions}
                onChange={(value) => {
                  setCalendarTemplateId(value);
                  if (value) {
                    localStorage.setItem("calendar-template-id", value);
                  } else {
                    localStorage.removeItem("calendar-template-id");
                  }
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn-primary w-full"
                  onClick={() => createSessionFromTemplate(date)}
                >
                  Use weekly template
                </button>
                <button
                  className="btn-secondary w-full"
                  onClick={handleAddSessionAdhoc}
                >
                  Add ad-hoc session
                </button>
              </div>
            </div>
          </div>
        )}
        {!needsSessionSetup && (
          <div className="card p-4">
            <p className="text-sm text-gray-400">No session selected.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--foreground)]">{selectedClient ? "Fitness" : "My Fitness"}</h2>
        <p className="text-sm text-gray-400">Workouts, templates, and progress</p>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
      <div className="card p-2 fitness-page-tabs-card">
        <div className="grid grid-cols-4 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`fitness-page-tab flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition ${
                activeTab === tab.id
                  ? "fitness-page-tab--active bg-blue-500/20 text-blue-200 border border-blue-400/30"
                  : "text-gray-300 hover:text-gray-100 hover:bg-white/5"
              }`}
            >
              {tab.icon}
              <span className="w-full text-center text-[11px] truncate px-1">
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Tab Content */}
      {activeTab === "overview" && (
        <>
          <FitnessOverview
            progress={progress}
            streak={streak}
            nextSession={selectedClient ? undefined : nextSession}
            weekStats={weekStats}
          />
          {hasResourceRole && !selectedClient && (
            <MyPatientAppointments sectionTitle="My Patient Appointments" />
          )}
          {hasAssistantRole && !selectedClient && trainerEmployers.map(emp => (
            <MyPatientAppointments
              key={emp.id}
              sectionTitle={`${emp.name}'s Client Appointments`}
              forDoctorId={emp.id}
            />
          ))}
        </>
      )}

      {activeTab === "weekly" && (
        <WeeklyPlanBuilder
          selectedClient={selectedClient}
          onRefresh={fetchOverviewData}
        />
      )}

      {activeTab === "calendar" && (
        <div className="space-y-3">
          <div className="card p-3 flex flex-col md:flex-row gap-3 md:items-center flex-wrap">
            <div className="text-sm text-gray-400 shrink-0">Weekly Template</div>
            <div className="md:w-80 w-full">
              <SelectDropdown
                value={calendarTemplateId}
                options={templateOptions}
                onChange={(value) => {
                  setCalendarTemplateId(value);
                  if (value) {
                    localStorage.setItem("calendar-template-id", value);
                  } else {
                    localStorage.removeItem("calendar-template-id");
                  }
                }}
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={!calendarTemplateId || applyingTemplate || !!selectedClient}
                onClick={async () => {
                  if (!calendarTemplateId || !calendarWeekStart || !calendarWeekEnd) return;
                  try {
                    const { entries } = await fitnessApi.getCalendarEntries(
                      selectedClient || undefined,
                      calendarWeekStart,
                      calendarWeekEnd
                    );
                    const alreadyAdded = (entries || []).some(
                      (e: any) =>
                        e.sessions?.some(
                          (s: any) => s.week_template_id === calendarTemplateId
                        )
                    );
                    if (alreadyAdded) {
                      alert("This template is already added to the visible week.");
                      return;
                    }
                  } catch (e) {
                    console.error("Check existing entries failed:", e);
                  }
                  setApplyingTemplate(true);
                  try {
                    await fitnessApi.applyWeekTemplate(
                      calendarWeekStart,
                      calendarWeekEnd,
                      calendarTemplateId,
                      selectedClient || undefined
                    );
                    setCalendarRefreshKey((k) => k + 1);
                  } catch (e) {
                    console.error("Apply template to week failed:", e);
                  } finally {
                    setApplyingTemplate(false);
                  }
                }}
              >
                {applyingTemplate ? "Adding…" : "Add Template to the Week"}
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={!calendarTemplateId || removingTemplate || !!selectedClient}
                onClick={async () => {
                  if (!calendarTemplateId || !calendarWeekStart || !calendarWeekEnd) return;
                  setRemovingTemplate(true);
                  try {
                    await fitnessApi.removeWeekTemplate(
                      calendarWeekStart,
                      calendarWeekEnd,
                      calendarTemplateId,
                      selectedClient || undefined
                    );
                    setCalendarRefreshKey((k) => k + 1);
                  } catch (e) {
                    console.error("Remove template from week failed:", e);
                  } finally {
                    setRemovingTemplate(false);
                  }
                }}
              >
                {removingTemplate ? "Removing…" : "Remove Template from Week"}
              </button>
            </div>
          </div>
          <CalendarView
            selectedClient={selectedClient}
            viewMode="week"
            initialDate={date}
            readOnly={!!selectedClient}
            onWeekChange={(start, end) => {
              setCalendarWeekStart(start);
              setCalendarWeekEnd(end);
            }}
            refreshKey={calendarRefreshKey}
          />
        </div>
      )}

      {activeTab === "library" && (
        <ExerciseLibrary selectedClient={selectedClient} />
      )}
    </div>
  );
};

export default FitnessPage;
