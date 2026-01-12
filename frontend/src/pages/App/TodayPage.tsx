import React, { useEffect, useState } from "react";
import { healthApi } from "../../services/api";
import { motion } from "framer-motion";
import { Calendar, PlusCircle, Stethoscope, Activity } from "lucide-react";

const cardBase = "card";

const TodayPage: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [apptRes, vitalsRes] = await Promise.allSettled([
          healthApi.getAppointments(),
          healthApi.getVitals(),
        ]);
        if (apptRes.status === "fulfilled") {
          setAppointments(apptRes.value.appointments || []);
        }
        if (vitalsRes.status === "fulfilled") {
          setVitals(vitalsRes.value.vitals || []);
        }
      } catch {
        // ignore, fallback to demo
      }
    };
    fetchData();
  }, []);

  const timeline = appointments.slice(0, 3);
  const keyVitals = vitals.slice(0, 4);

  return (
    <div className="space-y-4">
      <section className={`${cardBase} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-rose-200/80">Today</p>
            <h2 className="text-xl font-semibold">Quick Actions</h2>
          </div>
          <PlusCircle className="text-rose-200 h-6 w-6" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { label: "Add appointment", icon: Calendar },
            { label: "Log vital", icon: Activity },
            { label: "Upload report", icon: Stethoscope },
            { label: "New note", icon: PlusCircle },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className="rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-left text-sm flex items-center gap-2 hover:border-rose-400/40"
              >
                <Icon className="h-4 w-4 text-rose-200" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`${cardBase} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Upcoming</h3>
          <span className="text-xs text-gray-400">Appointments</span>
        </div>
        <div className="space-y-3">
          {timeline.length === 0 && (
            <p className="text-sm text-gray-400">No upcoming appointments yet.</p>
          )}
          {timeline.map((appt) => (
            <motion.div
              key={appt.id}
              whileHover={{ scale: 1.01 }}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{appt.title || "Checkup"}</p>
                  <p className="text-xs text-gray-400">{appt.location || "Virtual/Clinic"}</p>
                </div>
                <span className="text-xs text-rose-200">
                  {appt.datetime || appt.scheduled_at || "Today"}
                </span>
              </div>
              {appt.notes && <p className="text-xs text-gray-300 mt-1">{appt.notes}</p>}
            </motion.div>
          ))}
        </div>
      </section>

      <section className={`${cardBase} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Vitals snapshot</h3>
          <span className="text-xs text-gray-400">Latest</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {keyVitals.length === 0 && (
            <p className="text-sm text-gray-400 col-span-2">No vitals yet. Add your first vital.</p>
          )}
          {keyVitals.map((vital) => (
            <div key={vital.id || vital.parameter} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-400">{vital.parameter}</p>
              <p className="text-xl font-semibold">
                {vital.value}
                {vital.unit ? <span className="text-sm text-gray-300 ml-1">{vital.unit}</span> : null}
              </p>
              {vital.measured_at && <p className="text-[11px] text-gray-500">{vital.measured_at}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default TodayPage;
