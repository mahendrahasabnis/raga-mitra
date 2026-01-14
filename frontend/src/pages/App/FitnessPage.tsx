import React, { useEffect, useState } from "react";
import { fitnessApi } from "../../services/api";
import { Dumbbell, Calendar, Target, BookOpen, Layout } from "lucide-react";
import { useParams } from "react-router-dom";
import FitnessOverview from "../../components/Fitness/FitnessOverview";
import WeeklyPlanBuilder from "../../components/Fitness/WeeklyPlanBuilder";
import CalendarView from "../../components/Fitness/CalendarView";
import SessionDetail from "../../components/Fitness/SessionDetail";
import ExerciseLibrary from "../../components/Fitness/ExerciseLibrary";

type TabType = "overview" | "weekly" | "calendar" | "library";

const FitnessPage: React.FC = () => {
  const { date } = useParams<{ date?: string }>();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [progress, setProgress] = useState<any>({});
  const [streak, setStreak] = useState(0);
  const [nextSession, setNextSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string | null>(
    () => localStorage.getItem("client-context-id")
  );
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [weekTemplates, setWeekTemplates] = useState<any[]>([]);
  const [calendarTemplateId, setCalendarTemplateId] = useState<string>(
    () => localStorage.getItem("calendar-template-id") || ""
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "client-context-id") {
        setSelectedClient(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    fetchOverviewData();
  }, [selectedClient]);

  useEffect(() => {
    if (date) {
      setActiveTab("calendar");
      fetchSessionForDate(date);
    }
  }, [date]);

  useEffect(() => {
    if (activeTab === "calendar" || date) {
      fetchWeekTemplates();
    }
  }, [activeTab, date, selectedClient]);

  const fetchWeekTemplates = async () => {
    try {
      const res = await fitnessApi.getWeekTemplates(selectedClient || undefined);
      setWeekTemplates(res.templates || []);
      if (!calendarTemplateId && res.templates && res.templates.length > 0) {
        setCalendarTemplateId(res.templates[0].id);
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

  const fetchSessionForDate = async (dateStr: string) => {
    try {
      const res = await fitnessApi.getCalendarEntry(dateStr, selectedClient || undefined);
      if (res.entry && res.entry.sessions?.length > 0) {
        setSelectedSession({ ...res.entry.sessions[0], date: dateStr, calendar_entry_id: res.entry.id });
      }
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status !== 404) {
        console.error("Failed to fetch session:", error);
        return;
      }

      try {
        let templateId = calendarTemplateId;
        if (!templateId) {
          const templatesRes = await fitnessApi.getWeekTemplates(selectedClient || undefined);
          const latestTemplate = templatesRes.templates?.[0];
          templateId = latestTemplate?.id || "";
        }
        if (!templateId) return;

        const templateRes = await fitnessApi.getWeekTemplate(templateId);
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
          setSelectedSession({
            ...created.entry.sessions[0],
            date: dateStr,
            calendar_entry_id: created.entry.id,
          });
        }
      } catch (fallbackError) {
        console.error("Failed to build session from template:", fallbackError);
      }
    }
  };

  const weekStats = {
    completed: progress?.stats?.completed_count || 0,
    partial: progress?.stats?.partial_count || 0,
    skipped: progress?.stats?.skipped_count || 0,
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Target className="h-4 w-4" /> },
    { id: "weekly", label: "Weekly Plan", icon: <Layout className="h-4 w-4" /> },
    { id: "calendar", label: "Calendar", icon: <Calendar className="h-4 w-4" /> },
    { id: "library", label: "Exercise Library", icon: <BookOpen className="h-4 w-4" /> },
  ];

  // If we have a date param, show session detail
  if (date && selectedSession) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setSelectedSession(null);
            setActiveTab("calendar");
            window.history.pushState({}, "", "/app/fitness");
          }}
          className="btn-secondary"
        >
          ← Back to Calendar
        </button>
        <SessionDetail
          date={date}
          session={selectedSession}
          selectedClient={selectedClient}
          onComplete={fetchOverviewData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Tabs */}
      <div className="card p-2">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition ${
                activeTab === tab.id
                  ? "bg-blue-500/20 text-blue-200 border border-blue-400/30"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <FitnessOverview
          progress={progress}
          streak={streak}
          nextSession={nextSession}
          weekStats={weekStats}
        />
      )}

      {activeTab === "weekly" && (
        <WeeklyPlanBuilder
          selectedClient={selectedClient}
          onRefresh={fetchOverviewData}
        />
      )}

      {activeTab === "calendar" && (
        <div className="space-y-3">
          <div className="card p-3 flex flex-col md:flex-row gap-3 md:items-center">
            <div className="text-sm text-gray-400">Weekly Template</div>
            <select
              value={calendarTemplateId}
              onChange={(e) => {
                const value = e.target.value;
                setCalendarTemplateId(value);
                if (value) {
                  localStorage.setItem("calendar-template-id", value);
                } else {
                  localStorage.removeItem("calendar-template-id");
                }
              }}
              className="input-field md:w-96"
            >
              <option value="">Latest template</option>
              {weekTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          <CalendarView selectedClient={selectedClient} viewMode="week" initialDate={date} readOnly={!!selectedClient} />
        </div>
      )}

      {activeTab === "library" && (
        <ExerciseLibrary selectedClient={selectedClient} />
      )}
    </div>
  );
};

export default FitnessPage;
