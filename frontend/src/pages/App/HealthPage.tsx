import React, { useEffect, useState } from "react";
import { healthApi } from "../../services/api";
import { motion } from "framer-motion";
import { Stethoscope, Activity, Upload, CheckCircle2 } from "lucide-react";

const cardBase = "card";

const HealthPage: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(() => localStorage.getItem("client-context-id"));

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
    const fetchData = async () => {
      try {
        const [a, v] = await Promise.allSettled([healthApi.getAppointments(), healthApi.getVitals()]);
        if (a.status === "fulfilled") setAppointments(a.value.appointments || []);
        if (v.status === "fulfilled") setVitals(v.value.vitals || []);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddVital = async () => {
    if (adding) return;
    setAdding(true);
    try {
      const sample = { parameter: "Blood Pressure", value: "120/80", unit: "mmHg", measured_at: new Date().toISOString() };
      const res = await healthApi.addVital(sample);
      setVitals((prev) => [res.vital || sample, ...prev]);
    } finally {
      setAdding(false);
    }
  };

  const handleExtractionStub = async () => {
    const uploaded = await healthApi.uploadReport({ file_url: "https://example.com/report.pdf" });
    const extracted = await healthApi.extractReport(uploaded.report.id);
    if (extracted?.extraction?.vitals) {
      await healthApi.confirmVitals(extracted.extraction.vitals);
      setVitals((prev) => [...extracted.extraction.vitals, ...prev]);
    }
  };

  return (
    <div className="space-y-4">
      <section className={`${cardBase} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope className="h-5 w-5 text-rose-200" />
          <h2 className="text-lg font-semibold">Health Overview</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-rose-500/20 border border-rose-400/30 p-3">
            <p className="text-xs text-rose-100/80">Upcoming</p>
            <p className="text-2xl font-semibold">{appointments.length}</p>
            <p className="text-xs text-rose-100/70">appointments</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-xs text-gray-300/80">Vitals tracked</p>
            <p className="text-2xl font-semibold">{vitals.length}</p>
            <p className="text-xs text-gray-300/70">entries</p>
          </div>
        </div>
      </section>

      <section className={`${cardBase} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-rose-200" />
            <h3 className="text-md font-semibold">Vitals</h3>
          </div>
          {!selectedClient && (
            <button
              onClick={handleAddVital}
              className="px-3 py-2 rounded-xl bg-rose-500/80 text-sm font-medium shadow-lg shadow-rose-900/40"
              disabled={adding}
            >
              {adding ? "Adding..." : "Add sample"}
            </button>
          )}
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {vitals.length === 0 && <p className="text-sm text-gray-400 col-span-2">No vitals yet.</p>}
            {vitals.map((v) => (
              <div key={v.id || v.parameter} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-xs text-gray-400">{v.parameter}</p>
                <p className="text-xl font-semibold">
                  {v.value}
                  {v.unit && <span className="text-sm text-gray-300 ml-1">{v.unit}</span>}
                </p>
                {v.measured_at && <p className="text-[11px] text-gray-500">{v.measured_at}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={`${cardBase} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-rose-200" />
            <h3 className="text-md font-semibold">Diagnostics</h3>
          </div>
          {!selectedClient && (
            <button
              onClick={handleExtractionStub}
              className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-sm"
            >
              Upload & Extract (stub)
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400">
          Upload a report and we’ll propose vitals for review. Low confidence values will require confirmation.
        </p>
        <div className="flex items-center gap-2 text-emerald-300/80 text-sm mt-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>Review & confirm flow is enabled.</span>
        </div>
      </section>
    </div>
  );
};

export default HealthPage;
