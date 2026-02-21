import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { useSelectedClient } from "../../contexts/ClientContext";
import { useAuth } from "../../contexts/AuthContext";
import { healthApi, resourcesApi } from "../../services/api";
import { Stethoscope, Calendar, Activity, Scan, Monitor } from "lucide-react";
import HealthOverview from "../../components/Health/HealthOverview";
import AppointmentsList from "../../components/Health/AppointmentsList";
import VitalsDashboard from "../../components/Health/VitalsDashboard";
import LiveMonitoringDashboard from "../../components/Health/LiveMonitoringDashboard";
import ScanDocumentModal from "../../components/Health/ScanDocumentModal";
import MyPatientAppointments from "../../components/Shared/MyPatientAppointments";

type TabType = "overview" | "appointments" | "vitals" | "live-monitoring";

const HealthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const tabParam = searchParams.get("tab") as TabType | null;
  const selectedClient = useSelectedClient();
  const { user } = useAuth();
  const expandAppointmentId = (location.state as any)?.expandAppointmentId || null;
  const [activeTab, setActiveTab] = useState<TabType>(tabParam && ["overview", "appointments", "vitals", "live-monitoring"].includes(tabParam) ? tabParam : "overview");

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

  const [employers, setEmployers] = useState<Array<{ id: string; name: string; phone: string; employerRoles: string[] }>>([]);

  useEffect(() => {
    if (!hasAssistantRole || selectedClient) return;
    resourcesApi.getMyEmployers().then(res => setEmployers(res.employers || [])).catch(() => setEmployers([]));
  }, [hasAssistantRole, selectedClient]);

  const doctorEmployers = useMemo(() =>
    employers.filter(e => e.employerRoles.some(r => ['doctor'].includes(r))),
    [employers]
  );

  const [appointments, setAppointments] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanModal, setShowScanModal] = useState(false);

  useEffect(() => {
    if (tabParam && ["overview", "appointments", "vitals", "live-monitoring"].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [tabParam]);

  useEffect(() => {
    fetchAllData();
  }, [selectedClient]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const clientId = selectedClient || undefined;
      const [apptRes, vitRes, reportsRes] = await Promise.allSettled([
        healthApi.getAppointments(clientId),
        healthApi.getVitals(clientId),
        healthApi.listReports(clientId),
      ]);

      if (apptRes.status === "fulfilled") {
        setAppointments(apptRes.value.appointments || []);
      }
      if (vitRes.status === "fulfilled") {
        const data = vitRes.value;
        const list = Array.isArray(data?.vitals) ? data.vitals : Array.isArray(data?.data?.vitals) ? data.data.vitals : [];
        setVitals(list);
      }
      if (reportsRes.status === "fulfilled") {
        const raw = reportsRes.value;
        const list = Array.isArray(raw) ? raw : (raw?.reports && Array.isArray(raw.reports) ? raw.reports : []);
        setReports(list);
      }
    } catch (error) {
      console.error("Failed to fetch health data:", error);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = selectedClient
    ? [
        { id: "overview", label: "Overview", icon: <Stethoscope className="h-4 w-4" /> },
        { id: "vitals", label: "Vitals", icon: <Activity className="h-4 w-4" /> },
        { id: "live-monitoring", label: "Live Monitoring", icon: <Monitor className="h-4 w-4" /> },
      ]
    : [
        { id: "overview", label: "Overview", icon: <Stethoscope className="h-4 w-4" /> },
        { id: "appointments", label: "Appointments", icon: <Calendar className="h-4 w-4" /> },
        { id: "vitals", label: "Vitals", icon: <Activity className="h-4 w-4" /> },
        { id: "live-monitoring", label: "Live Monitoring", icon: <Monitor className="h-4 w-4" /> },
      ];

  const upcomingAppointment = appointments
    .filter((a) => a.status !== "completed" && a.status !== "cancelled")
    .sort((a, b) => {
      const dateA = a.datetime ? new Date(a.datetime).getTime() : 0;
      const dateB = b.datetime ? new Date(b.datetime).getTime() : 0;
      return dateA - dateB;
    })[0];

  const keyVitals = vitals
    .filter((v) => {
      const param = (v.parameter_name || v.parameter || "").toLowerCase();
      return ["blood pressure", "hba1c", "weight", "bmi"].some((k) => param.includes(k));
    })
    .slice(0, 4);

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--foreground)]">{selectedClient ? "Health" : "My Health"}</h2>
          <p className="text-sm text-gray-400">Overview, appointments, and vitals</p>
        </div>
        {!selectedClient && (
        <button
          onClick={() => setShowScanModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Scan className="h-4 w-4" />
          Scan Document
        </button>
        )}
      </div>

      {/* Tabs */}
      <div className="card p-2 health-page-tabs-card">
        <div className={`grid gap-1 ${selectedClient ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`health-page-tab flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition ${
                activeTab === tab.id
                  ? "health-page-tab--active bg-rose-500/20 text-rose-200 border border-rose-400/30"
                  : "text-gray-300 hover:text-gray-100 hover:bg-white/5"
              }`}
            >
              {tab.icon}
              <span className="w-full text-center text-[11px] truncate px-1">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <>
          <HealthOverview
            appointmentsCount={appointments.length}
            medicinesCount={0}
            diagnosticsCount={0}
            vitalsCount={vitals.length}
            upcomingAppointment={upcomingAppointment}
            latestDiagnostic={undefined}
            keyVitals={keyVitals}
            showOnlyVitals={!!selectedClient}
          />
          {hasResourceRole && !selectedClient && (
            <MyPatientAppointments sectionTitle="My Patient Appointments" />
          )}
          {hasAssistantRole && !selectedClient && doctorEmployers.map(emp => (
            <MyPatientAppointments
              key={emp.id}
              sectionTitle={`${emp.name}'s Patient Appointments`}
              forDoctorId={emp.id}
            />
          ))}
        </>
      )}

      {activeTab === "appointments" && (
        <AppointmentsList
          appointments={appointments}
          loading={loading}
          selectedClient={selectedClient}
          vitals={vitals}
          reports={reports}
          onRefresh={fetchAllData}
          initialExpandId={expandAppointmentId}
        />
      )}

      {activeTab === "vitals" && (
        <VitalsDashboard
          vitals={vitals}
          reports={reports}
          loading={loading}
          selectedClient={selectedClient}
          onRefresh={fetchAllData}
        />
      )}

      {activeTab === "live-monitoring" && (
        <LiveMonitoringDashboard selectedClient={selectedClient} onRefresh={fetchAllData} />
      )}

      {showScanModal && (
        <ScanDocumentModal
          isOpen={showScanModal}
          onClose={() => setShowScanModal(false)}
          appointments={appointments}
          selectedClient={selectedClient}
          onCreated={fetchAllData}
        />
      )}
    </div>
  );
};

export default HealthPage;
