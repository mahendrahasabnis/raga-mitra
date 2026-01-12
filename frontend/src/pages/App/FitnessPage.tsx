import React from "react";
import { Dumbbell, ListChecks, PlayCircle, CheckCircle2 } from "lucide-react";

const cardBase = "card";

const FitnessPage: React.FC = () => {
  const sessions = [
    { title: "Morning Mobility", status: "planned", time: "7:00 AM" },
    { title: "Evening Strength", status: "planned", time: "6:00 PM" },
  ];

  return (
    <div className="space-y-4">
      <section className={`${cardBase} p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <Dumbbell className="h-5 w-5 text-rose-200" />
          <h2 className="text-lg font-semibold">Fitness Overview</h2>
        </div>
        <p className="text-sm text-gray-300/80">Weekly plan, sessions, and exercise library.</p>
      </section>

      <section className={`${cardBase} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-rose-200" />
            <h3 className="text-md font-semibold">Today’s sessions</h3>
          </div>
          <button className="px-3 py-2 rounded-xl bg-rose-500/80 text-sm font-medium shadow-lg shadow-rose-900/40">
            Add session
          </button>
        </div>
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.title} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-gray-400">{s.time}</p>
              </div>
              <span className="text-xs text-emerald-300/80 capitalize">{s.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`${cardBase} p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <PlayCircle className="h-5 w-5 text-rose-200" />
          <h3 className="text-md font-semibold">Exercise library</h3>
        </div>
        <p className="text-sm text-gray-400">Add videos, docs, and templates. (Coming soon)</p>
        <div className="flex items-center gap-2 text-emerald-300/80 text-sm mt-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>Template changes won’t overwrite past sessions.</span>
        </div>
      </section>
    </div>
  );
};

export default FitnessPage;
