import React, { useEffect, useState } from "react";
import { healthApi } from "../../services/api";
import { Stethoscope, Calendar, Activity, Scan } from "lucide-react";
import HealthOverview from "../../components/Health/HealthOverview";
import AppointmentsList from "../../components/Health/AppointmentsList";
import VitalsDashboard from "../../components/Health/VitalsDashboard";
import ScanDocumentModal from "../../components/Health/ScanDocumentModal";

type TabType = "overview" | "appointments" | "vitals";

const HealthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanModal, setShowScanModal] = useState(false);
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
    fetchAllData();
  }, [selectedClient]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const clientId = selectedClient || undefined;
      const [apptRes, vitRes] = await Promise.allSettled([
        healthApi.getAppointments(clientId),
        healthApi.getVitals(clientId),
      ]);

      if (apptRes.status === "fulfilled") {
        setAppointments(apptRes.value.appointments || []);
      }
      if (vitRes.status === "fulfilled") {
        setVitals(vitRes.value.vitals || []);
      }
    } catch (error) {
      console.error("Failed to fetch health data:", error);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Stethoscope className="h-4 w-4" /> },
    { id: "appointments", label: "Appointments", icon: <Calendar className="h-4 w-4" /> },
    { id: "vitals", label: "Vitals", icon: <Activity className="h-4 w-4" /> },
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
          <h2 className="text-2xl font-bold text-gray-900">Health</h2>
          <p className="text-sm text-gray-500">Overview, appointments, and vitals</p>
        </div>
        <button
          onClick={() => setShowScanModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Scan className="h-4 w-4" />
          Scan Document
        </button>
      </div>

      {/* Tabs */}
      <div className="card p-2">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition ${
                activeTab === tab.id
                  ? "bg-rose-500/20 text-rose-200 border border-rose-400/30"
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
        <HealthOverview
          appointmentsCount={appointments.length}
          medicinesCount={0}
          diagnosticsCount={0}
          vitalsCount={vitals.length}
          upcomingAppointment={upcomingAppointment}
          latestDiagnostic={undefined}
          keyVitals={keyVitals}
        />
      )}

      {activeTab === "appointments" && (
        <AppointmentsList
          appointments={appointments}
          loading={loading}
          selectedClient={selectedClient}
          vitals={vitals}
          onRefresh={fetchAllData}
        />
      )}

      {activeTab === "vitals" && (
        <VitalsDashboard
          vitals={vitals}
          loading={loading}
          selectedClient={selectedClient}
          onRefresh={fetchAllData}
        />
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
