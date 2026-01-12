import React, { useEffect, useState } from "react";
import { Salad, CheckCircle2, NotebookPen } from "lucide-react";

const cardBase = "card";

const DietPage: React.FC = () => {
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

  const meals = [
    { name: "Breakfast", items: "Oats + berries", status: "planned" },
    { name: "Lunch", items: "Grilled chicken + salad", status: "planned" },
    { name: "Dinner", items: "Dal + rice + veggies", status: "planned" },
  ];

  return (
    <div className="space-y-4">
      <section className={`${cardBase} p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <Salad className="h-5 w-5 text-rose-200" />
          <h2 className="text-lg font-semibold">Diet Overview</h2>
        </div>
        <p className="text-sm text-gray-300/80">Weekly meal templates, daily logs, and adherence.</p>
      </section>

      <section className={`${cardBase} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-rose-200" />
            <h3 className="text-md font-semibold">Today’s meals</h3>
          </div>
          {!selectedClient && (
            <button className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-sm">
              Log meal
            </button>
          )}
        </div>
        <div className="space-y-2">
          {meals.map((m) => (
            <div key={m.name} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{m.name}</p>
                <span className="text-xs text-emerald-300/80 capitalize">{m.status}</span>
              </div>
              <p className="text-xs text-gray-400">{m.items}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${cardBase} p-4`}>
        <p className="text-sm text-gray-400">Macros summary, adherence, and media uploads coming next.</p>
        <div className="flex items-center gap-2 text-emerald-300/80 text-sm mt-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>Ad-hoc entries won’t overwrite your weekly templates.</span>
        </div>
      </section>
    </div>
  );
};

export default DietPage;
