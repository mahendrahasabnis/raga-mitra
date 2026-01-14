import React, { useEffect, useState } from "react";
import { dietApi } from "../../services/api";
import { Salad, Calendar, Target, BookOpen, Layout } from "lucide-react";
import { useParams } from "react-router-dom";
import DietOverview from "../../components/Diet/DietOverview";
import WeeklyMealPlanBuilder from "../../components/Diet/WeeklyMealPlanBuilder";
import MealLogging from "../../components/Diet/MealLogging";
import DaySummary from "../../components/Diet/DaySummary";

type TabType = "overview" | "weekly" | "logging" | "summary";

const DietPage: React.FC = () => {
  const { date } = useParams<{ date?: string }>();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [progress, setProgress] = useState<any>({});
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [macros, setMacros] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string | null>(
    () => localStorage.getItem("client-context-id")
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
      setActiveTab("summary");
    }
  }, [date]);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();
      const today = new Date().toISOString().split("T")[0];

      const [progressRes, calendarRes, macrosRes] = await Promise.allSettled([
        dietApi.getProgress(
          selectedClient || undefined,
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        ),
        dietApi.getCalendarEntry(today),
        dietApi.getProgress(
          selectedClient || undefined,
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        ),
      ]);

      if (progressRes.status === "fulfilled") {
        setProgress(progressRes.value);
        setMacros(progressRes.value.macros || {});
      }

      if (calendarRes.status === "fulfilled" && calendarRes.value.entry) {
        setTodayMeals(calendarRes.value.entry.meals || []);
      }
    } catch (error) {
      console.error("Failed to fetch overview data:", error);
    } finally {
      setLoading(false);
    }
  };

  const adherence =
    progress?.stats?.total_count > 0
      ? Math.round((progress?.stats?.completed_count / progress?.stats?.total_count) * 100)
      : 0;

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Target className="h-4 w-4" /> },
    { id: "weekly", label: "Weekly Plan", icon: <Layout className="h-4 w-4" /> },
    { id: "logging", label: "Log Meal", icon: <BookOpen className="h-4 w-4" /> },
    { id: "summary", label: "Day Summary", icon: <Calendar className="h-4 w-4" /> },
  ];

  // If we have a date param, show day summary
  if (date) {
    return (
      <div className="space-y-4 overflow-x-hidden">
        <button
          onClick={() => {
            setActiveTab("overview");
            window.history.pushState({}, "", "/app/diet");
          }}
          className="btn-secondary"
        >
          ← Back to Overview
        </button>
        <DaySummary
          date={date}
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
        <DietOverview
          todayMeals={todayMeals}
          progress={progress}
          adherence={adherence}
          macros={macros}
        />
      )}

      {activeTab === "weekly" && (
        <WeeklyMealPlanBuilder
          selectedClient={selectedClient}
          onRefresh={fetchOverviewData}
        />
      )}

      {activeTab === "logging" && (
        <MealLogging
          selectedClient={selectedClient}
          onSuccess={fetchOverviewData}
        />
      )}

      {activeTab === "summary" && (
        <DaySummary
          date={new Date().toISOString().split("T")[0]}
          selectedClient={selectedClient}
          onComplete={fetchOverviewData}
        />
      )}
    </div>
  );
};

export default DietPage;
