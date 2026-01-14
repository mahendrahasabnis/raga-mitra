import React, { useEffect, useState } from "react";
import { healthApi } from "../../services/api";
import { Stethoscope, Calendar, Pill, FileText, Activity } from "lucide-react";
import HealthOverview from "../../components/Health/HealthOverview";
import AppointmentsList from "../../components/Health/AppointmentsList";
import MedicinesList from "../../components/Health/MedicinesList";
import DiagnosticsList from "../../components/Health/DiagnosticsList";
import VitalsDashboard from "../../components/Health/VitalsDashboard";

type TabType = "overview" | "appointments" | "medicines" | "diagnostics" | "vitals";

const HealthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
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
    fetchAllData();
  }, [selectedClient]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const clientId = selectedClient || undefined;
      const [apptRes, medRes, diagRes, vitRes] = await Promise.allSettled([
        healthApi.getAppointments(clientId),
        healthApi.getMedicines(clientId, true),
        healthApi.getDiagnostics(clientId),
        healthApi.getVitals(clientId),
      ]);

      if (apptRes.status === "fulfilled") {
        setAppointments(apptRes.value.appointments || []);
      }
      if (medRes.status === "fulfilled") {
        setMedicines(medRes.value.medicines || []);
      }
      if (diagRes.status === "fulfilled") {
        setDiagnostics(diagRes.value.diagnostics || []);
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
    { id: "medicines", label: "Medicines", icon: <Pill className="h-4 w-4" /> },
    { id: "diagnostics", label: "Diagnostics", icon: <FileText className="h-4 w-4" /> },
    { id: "vitals", label: "Vitals", icon: <Activity className="h-4 w-4" /> },
  ];

  const upcomingAppointment = appointments
    .filter((a) => a.status !== "completed" && a.status !== "cancelled")
    .sort((a, b) => {
      const dateA = a.datetime ? new Date(a.datetime).getTime() : 0;
      const dateB = b.datetime ? new Date(b.datetime).getTime() : 0;
      return dateA - dateB;
    })[0];

  const latestDiagnostic = diagnostics
    .sort((a, b) => {
      const dateA = a.test_date ? new Date(a.test_date).getTime() : 0;
      const dateB = b.test_date ? new Date(b.test_date).getTime() : 0;
      return dateB - dateA;
    })[0];

  const keyVitals = vitals
    .filter((v) => {
      const param = (v.parameter_name || v.parameter || "").toLowerCase();
      return ["blood pressure", "hba1c", "weight", "bmi"].some((k) => param.includes(k));
    })
    .slice(0, 4);

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
          medicinesCount={medicines.length}
          diagnosticsCount={diagnostics.length}
          vitalsCount={vitals.length}
          upcomingAppointment={upcomingAppointment}
          latestDiagnostic={latestDiagnostic}
          keyVitals={keyVitals}
        />
      )}

      {activeTab === "appointments" && (
        <AppointmentsList
          appointments={appointments}
          loading={loading}
          selectedClient={selectedClient}
          onRefresh={fetchAllData}
        />
      )}

      {activeTab === "medicines" && (
        <MedicinesList
          medicines={medicines}
          loading={loading}
          selectedClient={selectedClient}
          onRefresh={fetchAllData}
        />
      )}

      {activeTab === "diagnostics" && (
        <DiagnosticsList
          diagnostics={diagnostics}
          loading={loading}
          selectedClient={selectedClient}
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
    </div>
  );
};

export default HealthPage;
