/**
 * Demo page for DualAxisTimeSeriesChart with sample data:
 * - Dense intraday (e.g. 1-min points over a day)
 * - Long range (e.g. daily over a year)
 * - Gaps and nulls to test robustness
 */

import React, { useMemo, useState } from "react";
import DualAxisTimeSeriesChart from "../../components/Charts/DualAxisTimeSeriesChart";
import { ChartErrorBoundary } from "../../components/Charts/ChartErrorBoundary";
import type { DualAxisDataPoint } from "../../components/Charts/DualAxisTimeSeriesChart";

function generateIntradayData(): DualAxisDataPoint[] {
  const out: DualAxisDataPoint[] = [];
  const base = new Date("2026-02-16T00:00:00+05:30").getTime();
  const oneMin = 60 * 1000;
  for (let i = 0; i < 24 * 60; i += 2) {
    const ts = new Date(base + i * oneMin).toISOString();
    const t = i / 60;
    const a = 70 + 30 * Math.sin((t / 60) * Math.PI) + (Math.random() - 0.5) * 10;
    const b = Math.random() > 0.7 ? null : (i % 20 === 0 ? 1 : 0);
    out.push({ ts, a: Math.round(a * 10) / 10, b });
  }
  return out;
}

function generateLongRangeData(): DualAxisDataPoint[] {
  const out: DualAxisDataPoint[] = [];
  const base = new Date("2025-01-01T12:00:00Z").getTime();
  const oneDay = 86400000;
  for (let i = 0; i < 400; i++) {
    const ts = new Date(base + i * oneDay).toISOString();
    const trend = 100 + (i / 400) * 50;
    const season = 20 * Math.sin((i / 30) * Math.PI * 2);
    const noise = (Math.random() - 0.5) * 15;
    const a = Math.max(0, Math.round(trend + season + noise));
    const b = i % 7 === 0 ? 1 : 0;
    out.push({ ts, a, b });
  }
  return out;
}

function generateLargeDataSet(): DualAxisDataPoint[] {
  const out: DualAxisDataPoint[] = [];
  const base = new Date("2026-01-01T00:00:00Z").getTime();
  const step = 60 * 1000;
  const count = 50000;
  for (let i = 0; i < count; i++) {
    const ts = new Date(base + i * step).toISOString();
    const a = 80 + 20 * Math.sin((i / 5000) * Math.PI * 2) + (Math.random() - 0.5) * 5;
    const b = i % 100 < 10 ? 1 : 0;
    out.push({
      ts,
      a: i % 17 === 0 ? null : Math.round(a * 10) / 10,
      b,
    });
  }
  return out;
}

const DEMOS = [
  {
    id: "intraday",
    title: "Intraday (1 day, ~720 points)",
    subtext: "2-minute resolution; Metric B has gaps",
    data: generateIntradayData(),
    metricA: { label: "Heart Rate", unit: "BPM" },
    metricB: { label: "Movement", unit: "" },
    showArea: true,
  },
  {
    id: "long",
    title: "Long range (400 days)",
    subtext: "Daily data with trend + seasonality",
    data: generateLongRangeData(),
    metricA: { label: "Daily Active Users", unit: "users" },
    metricB: { label: "Weekly Event", unit: "count" },
    showArea: true,
  },
  {
    id: "large",
    title: "Large dataset (50k points)",
    subtext: "Downsampled for performance; nulls in Metric A",
    data: generateLargeDataSet(),
    metricA: { label: "Sensor A", unit: "°C" },
    metricB: { label: "Alert", unit: "" },
    showArea: false,
  },
];

const DualAxisChartDemoPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState("intraday");
  const demo = useMemo(
    () => DEMOS.find((d) => d.id === selectedId) ?? DEMOS[0],
    [selectedId]
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-white">
            Dual-Axis Time Series Chart
          </h1>
          <p className="text-gray-400 mt-1">
            ECharts-based, mobile-first, with zoom/pan, range presets, and
            downsampling for large data.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {DEMOS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedId(d.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedId === d.id
                  ? "bg-rose-500/20 text-rose-200 border border-rose-400/40"
                  : "bg-white/5 text-gray-400 hover:text-gray-200 border border-white/10"
              }`}
            >
              {d.title}
            </button>
          ))}
        </div>

        <ChartErrorBoundary>
          <DualAxisTimeSeriesChart
            data={demo.data}
            metricAConfig={demo.metricA}
            metricBConfig={demo.metricB}
            title={demo.title}
            initialRangePreset="1M"
            showAreaA={demo.showArea}
            lastUpdated={`Last updated: ${new Date().toLocaleTimeString()}`}
            onRangeChange={(start, end) => {
              console.log("Range changed:", start, end);
            }}
          />
        </ChartErrorBoundary>
      </div>
    </div>
  );
};

export default DualAxisChartDemoPage;
