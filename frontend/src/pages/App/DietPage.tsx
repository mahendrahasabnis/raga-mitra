import React, { useEffect, useMemo, useState } from "react";
import { useSelectedClient } from "../../contexts/ClientContext";
import { useAuth } from "../../contexts/AuthContext";
import { dietApi, resourcesApi } from "../../services/api";
import { Salad, Calendar, Target, BookOpen, Layout } from "lucide-react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import DietOverview from "../../components/Diet/DietOverview";
import WeeklyMealPlanBuilder from "../../components/Diet/WeeklyMealPlanBuilder";
import CalendarView from "../../components/Diet/CalendarView";
import SessionDetail from "../../components/Diet/SessionDetail";
import MealLibrary from "../../components/Diet/MealLibrary";
import SelectDropdown from "../../components/UI/SelectDropdown";
import MyPatientAppointments from "../../components/Shared/MyPatientAppointments";

type TabType = "overview" | "weekly" | "calendar" | "library";

const DietPage: React.FC = () => {
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

  const dietitianEmployers = useMemo(() =>
    employers.filter(e => e.employerRoles.some(r => ['dietitian', 'dietition', 'nutritionist'].includes(r))),
    [employers]
  );
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [weekTemplates, setWeekTemplates] = useState<any[]>([]);
  const [calendarTemplateId, setCalendarTemplateId] = useState<string>(
    () => localStorage.getItem("diet-calendar-template-id") || ""
  );
  const [calendarWeekStart, setCalendarWeekStart] = useState<string>("");
  const [calendarWeekEnd, setCalendarWeekEnd] = useState<string>("");
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [removingTemplate, setRemovingTemplate] = useState(false);
  const [needsSessionSetup, setNeedsSessionSetup] = useState(false);

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
      const res = await dietApi.getWeekTemplates(selectedClient || undefined);
      const activeTemplates = (res.templates || []).filter((t: any) => t.is_active !== false);
      setWeekTemplates(activeTemplates);
      if (calendarTemplateId && !activeTemplates.find((t: any) => t.id === calendarTemplateId)) {
        setCalendarTemplateId("");
        localStorage.removeItem("diet-calendar-template-id");
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
        dietApi.getProgress(
          selectedClient || undefined,
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        ),
        dietApi.getCalendarEntries(
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
      const res = await dietApi.getCalendarEntry(dateStr, selectedClient || undefined);
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
        const templatesRes = await dietApi.getWeekTemplates(selectedClient || undefined);
        const latestTemplate = templatesRes.templates?.[0];
        resolvedTemplateId = latestTemplate?.id || "";
      }
      if (!resolvedTemplateId) return;

      const templateRes = await dietApi.getWeekTemplate(resolvedTemplateId);
      const template = templateRes.template;
      if (!template?.days?.length) return;

      const dateObj = new Date(dateStr);
      const dayOfWeek = (dateObj.getDay() + 6) % 7;
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
          items: (session.items || []).map((item: any) => ({
            meal_template_id: item.meal_template_id || null,
            food_name: item.food_name,
            item_order: item.item_order || 0,
            quantity: item.quantity || null,
            calories: item.calories || null,
            protein: item.protein || null,
            carbs: item.carbs || null,
            fats: item.fats || null,
            fiber: item.fiber || null,
            sugar: item.sugar || null,
            sodium: item.sodium || null,
          })),
        })),
        client_id: selectedClient || undefined,
      };

      const created = await dietApi.createCalendarEntry(payload);
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
    const sessionName = prompt("Session name (e.g., Breakfast, Lunch):");
    if (!sessionName) return;
    try {
      const entryRes = await dietApi.getCalendarEntry(date, selectedClient || undefined);
      const entry = entryRes.entry;
      const existingSessions = entry?.sessions || [];
      const maxOrder = existingSessions.reduce((max: number, s: any) => Math.max(max, s.session_order || 0), -1);
      const newSession = {
        session_name: sessionName,
        session_order: maxOrder + 1,
        notes: null,
        items: [],
      };
      const payload = {
        date,
        week_template_id: entry?.week_template_id || null,
        template_day_id: entry?.template_day_id || null,
        is_override: true,
        sessions: [...existingSessions, newSession],
        client_id: selectedClient || undefined,
      };
      const created = await dietApi.createCalendarEntry(payload);
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

  if (date && selectedSession) {
    return (
      <div className="space-y-4 overflow-x-hidden">
        <div className="flex flex-col md:flex-row gap-2 items-start md:items-center justify-between">
          <button
            onClick={() => {
              setActiveTab("calendar");
              navigate("/app/diet");
            }}
            className="btn-secondary"
          >
            ← Back to Calendar
          </button>
          {!selectedClient && (
            <button onClick={handleAddSessionAdhoc} className="btn-primary">
              + Session
            </button>
          )}
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

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--foreground)]">{selectedClient ? "Diet" : "My Diet"}</h2>
        <p className="text-sm text-gray-400">Meal plans, calendar, and nutrition</p>
      </div>

      {tabs.length > 1 && (
      <div className="card p-2 diet-page-tabs-card">
        <div className="grid grid-cols-4 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`diet-page-tab flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition ${
                activeTab === tab.id
                  ? "diet-page-tab--active bg-blue-500/20 text-blue-200 border border-blue-400/30"
                  : "text-gray-300 hover:text-gray-100 hover:bg-white/5"
              }`}
            >
              {tab.icon}
              <span className="w-full text-center text-[11px] truncate px-1">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      )}

      {activeTab === "overview" && (
        <>
          <DietOverview
            progress={progress}
            streak={streak}
            nextSession={nextSession}
            weekStats={weekStats}
          />
          {hasResourceRole && !selectedClient && (
            <MyPatientAppointments sectionTitle="My Patient Appointments" />
          )}
          {hasAssistantRole && !selectedClient && dietitianEmployers.map(emp => (
            <MyPatientAppointments
              key={emp.id}
              sectionTitle={`${emp.name}'s Patient Appointments`}
              forDoctorId={emp.id}
            />
          ))}
        </>
      )}

      {activeTab === "weekly" && (
        <WeeklyMealPlanBuilder
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
                    localStorage.setItem("diet-calendar-template-id", value);
                  } else {
                    localStorage.removeItem("diet-calendar-template-id");
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
                    const { entries } = await dietApi.getCalendarEntries(
                      selectedClient || undefined,
                      calendarWeekStart,
                      calendarWeekEnd
                    );
                    const alreadyAdded = (entries || []).some(
                      (e: any) => e.week_template_id === calendarTemplateId
                    );
                    if (alreadyAdded) {
                      alert("This template is already applied to the visible week.");
                      return;
                    }
                  } catch (e) {
                    console.error("Check existing entries failed:", e);
                  }
                  setApplyingTemplate(true);
                  try {
                    await dietApi.applyWeekTemplate(
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
                    await dietApi.removeWeekTemplate(
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
          {needsSessionSetup && date && (
            <div className="card p-4 space-y-3">
              <h3 className="font-semibold">No sessions for this day yet.</h3>
              <div className="flex flex-col md:flex-row gap-2">
                <SelectDropdown
                  value={calendarTemplateId}
                  options={templateOptions}
                  onChange={(value) => {
                    setCalendarTemplateId(value);
                    if (value) {
                      localStorage.setItem("diet-calendar-template-id", value);
                    } else {
                      localStorage.removeItem("diet-calendar-template-id");
                    }
                  }}
                />
                <button
                  onClick={() => createSessionFromTemplate(date, calendarTemplateId || undefined)}
                  className="btn-primary"
                >
                  Use Template
                </button>
                {!selectedClient && (
                  <button onClick={handleAddSessionAdhoc} className="btn-secondary">
                    Add Ad-hoc Session
                  </button>
                )}
              </div>
            </div>
          )}
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
        <MealLibrary selectedClient={selectedClient} />
      )}
    </div>
  );
};

export default DietPage;
