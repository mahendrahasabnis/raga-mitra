/**
 * DualAxisTimeSeriesChart — Production-grade interactive time-series chart.
 *
 * UX decisions:
 * - ECharts chosen for dual Y-axis, datetime scale, dataZoom (zoom/pan + brush), and
 *   performant rendering for 10k–100k points (with client-side downsampling).
 * - Crosshair + shared tooltip with deltas to compare metrics at a point in time.
 * - Range presets (1D, 1W, etc.) + brush for custom range to support both quick nav and fine control.
 * - Reset zoom only shown after user zooms to reduce clutter.
 * - Mobile-first: touch handlers via ECharts dataZoom; card layout stacks on small screens.
 */

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  memo,
} from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Download, RotateCcw, FileSpreadsheet, Image } from "lucide-react";
import { downsampleForChart } from "../../utils/chartDownsample";

export interface DualAxisDataPoint {
  ts: string;
  a: number | null;
  b: number | null;
}

export interface MetricConfig {
  label: string;
  unit: string;
  color?: string;
}

export type RangePreset =
  | "1D"
  | "1W"
  | "1M"
  | "3M"
  | "1Y"
  | "YTD"
  | "All";

export interface DualAxisTimeSeriesChartProps {
  /** Input data: { ts (ISO), a, b }. Supports null and gaps. */
  data: DualAxisDataPoint[];
  metricAConfig: MetricConfig;
  metricBConfig: MetricConfig;
  title?: string;
  /** Initial range preset; does not restrict data fetch. */
  initialRangePreset?: RangePreset;
  /** Called when user changes range (preset or brush). */
  onRangeChange?: (startTs: string, endTs: string) => void;
  /** Optional: show area under Metric A. */
  showAreaA?: boolean;
  /** Loading state: show skeleton. */
  loading?: boolean;
  /** Error message: show error state with retry/reset. */
  error?: string | null;
  /** Last updated label for subtext. */
  lastUpdated?: string;
  className?: string;
}

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "1D", label: "1D" },
  { id: "1W", label: "1W" },
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "1Y", label: "1Y" },
  { id: "YTD", label: "YTD" },
  { id: "All", label: "All" },
];

function parseTs(ts: string): number {
  return new Date(ts).getTime();
}

function getRangeForPreset(
  preset: RangePreset,
  data: DualAxisDataPoint[]
): [number, number] {
  if (data.length === 0) return [Date.now() - 86400000, Date.now()];
  const times = data.map((d) => parseTs(d.ts));
  const maxT = Math.max(...times);
  const minT = Math.min(...times);
  const now = Date.now();
  const oneDay = 86400000;

  let start: number;
  switch (preset) {
    case "1D":
      start = maxT - oneDay;
      break;
    case "1W":
      start = maxT - 7 * oneDay;
      break;
    case "1M":
      start = maxT - 30 * oneDay;
      break;
    case "3M":
      start = maxT - 90 * oneDay;
      break;
    case "1Y":
      start = maxT - 365 * oneDay;
      break;
    case "YTD": {
      const y = new Date(maxT).getFullYear();
      start = new Date(y, 0, 1).getTime();
      break;
    }
    case "All":
    default:
      start = minT;
      break;
  }
  return [start, maxT];
}

/** Adaptive datetime axis label: minutes/hours/days/months by range. */
function formatAxisLabel(ts: number, rangeMs: number): string {
  const d = new Date(ts);
  if (rangeMs <= 6 * 3600000)
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (rangeMs <= 24 * 3600000)
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (rangeMs <= 7 * 86400000)
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (rangeMs <= 90 * 86400000)
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

const COLOR_A = "#e63946";
const COLOR_B = "#64748b";

const DualAxisTimeSeriesChart: React.FC<DualAxisTimeSeriesChartProps> = ({
  data,
  metricAConfig,
  metricBConfig,
  title = "Operations Trend",
  initialRangePreset = "1M",
  onRangeChange,
  showAreaA = false,
  loading = false,
  error = null,
  lastUpdated,
  className = "",
}) => {
  const chartRef = useRef<ReactECharts>(null);
  const [rangePreset, setRangePreset] = useState<RangePreset>(initialRangePreset);
  const [hasZoomed, setHasZoomed] = useState(false);
  const [seriesVisible, setSeriesVisible] = useState({ a: true, b: true });
  const tooltipLiveRef = useRef<HTMLDivElement>(null);

  const sortedData = useMemo(() => {
    return [...data].sort((x, y) => parseTs(x.ts) - parseTs(y.ts));
  }, [data]);

  const displayedData = useMemo(() => {
    return downsampleForChart(
      sortedData,
      (d) => parseTs(d.ts),
      (d) => d.a,
      (d) => d.b
    );
  }, [sortedData]);

  const rangeMs = useMemo(() => {
    if (displayedData.length < 2) return 86400000;
    const t = displayedData.map((d) => parseTs(d.ts));
    return Math.max(...t) - Math.min(...t);
  }, [displayedData]);

  const [viewStart, viewEnd] = useMemo(() => {
    return getRangeForPreset(rangePreset, displayedData);
  }, [rangePreset, displayedData]);

  const dataZoomStartEnd = useMemo(() => {
    if (displayedData.length < 2) return [0, 100];
    const t = displayedData.map((d) => parseTs(d.ts));
    const minT = Math.min(...t);
    const maxT = Math.max(...t);
    const span = maxT - minT || 1;
    const start = ((viewStart - minT) / span) * 100;
    const end = ((viewEnd - minT) / span) * 100;
    return [Math.max(0, start), Math.min(100, end)];
  }, [displayedData, viewStart, viewEnd]);

  const option: EChartsOption = useMemo(() => {
    const times = displayedData.map((d) => parseTs(d.ts));
    const valuesA = displayedData.map((d) => d.a);
    const valuesB = displayedData.map((d) => d.b);

    const series: NonNullable<EChartsOption["series"]> = [];

    if (seriesVisible.a) {
      series.push({
        name: metricAConfig.label,
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: times.map((t, i) => [t, valuesA[i]]),
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: metricAConfig.color ?? COLOR_A, width: 2 },
        itemStyle: { color: metricAConfig.color ?? COLOR_A },
        ...(showAreaA && {
          areaStyle: {
            color: metricAConfig.color ?? COLOR_A,
            opacity: 0.15,
          },
        }),
        connectNulls: true,
      });
    }
    if (seriesVisible.b) {
      series.push({
        name: metricBConfig.label,
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 1,
        data: times.map((t, i) => [t, valuesB[i]]),
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: metricBConfig.color ?? COLOR_B, width: 2 },
        itemStyle: { color: metricBConfig.color ?? COLOR_B },
        connectNulls: true,
      });
    }

    return {
      animation: displayedData.length < 5000,
      grid: {
        left: 56,
        right: 56,
        top: 48,
        bottom: 80,
        containLabel: false,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        backgroundColor: "rgba(15,23,42,0.95)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const ts = params[0].value[0];
          const date = new Date(ts);
          const timeStr = date.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "medium",
          });
          let html = `<div class="font-medium text-gray-200 mb-2">${timeStr}</div>`;
          const idx = displayedData.findIndex(
            (d) => parseTs(d.ts) === ts
          );
          const prev = idx > 0 ? displayedData[idx - 1] : null;
          params.forEach((p: any) => {
            const v = p.value[1];
            const name = p.seriesName;
            const unit =
              name === metricAConfig.label
                ? metricAConfig.unit
                : metricBConfig.unit;
            const valStr =
              v == null ? "—" : `${Number(v).toLocaleString()} ${unit}`;
            let deltaStr = "";
            if (prev != null && v != null) {
              const prevVal =
                name === metricAConfig.label ? prev.a : prev.b;
              if (prevVal != null) {
                const d = (v as number) - prevVal;
                const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "";
                deltaStr = ` <span class="text-gray-400 text-xs">${arrow} ${d >= 0 ? "+" : ""}${d.toLocaleString()}</span>`;
              }
            }
            const color = p.color;
            html += `<div style="color:${color};margin:4px 0">${name}: ${valStr}${deltaStr}</div>`;
          });
          if (tooltipLiveRef.current) {
            tooltipLiveRef.current.textContent = timeStr;
          }
          return html;
        },
      },
      legend: {
        show: false,
      },
      xAxis: {
        type: "time",
        min: "dataMin",
        max: "dataMax",
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
        axisLabel: {
          color: "rgba(255,255,255,0.75)",
          fontSize: 11,
          formatter: (val: number) => formatAxisLabel(val, rangeMs),
          hideOverlap: true,
        },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: `${metricAConfig.label} (${metricAConfig.unit})`,
          nameTextStyle: {
            color: metricAConfig.color ?? COLOR_A,
            fontSize: 11,
          },
          axisLine: { show: true, lineStyle: { color: metricAConfig.color ?? COLOR_A } },
          axisLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
          scale: true,
        },
        {
          type: "value",
          name: `${metricBConfig.label} (${metricBConfig.unit})`,
          position: "right",
          nameTextStyle: {
            color: metricBConfig.color ?? COLOR_B,
            fontSize: 11,
          },
          axisLine: { show: true, lineStyle: { color: metricBConfig.color ?? COLOR_B } },
          axisLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
          splitLine: { show: false },
          scale: true,
        },
      ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          start: dataZoomStartEnd[0],
          end: dataZoomStartEnd[1],
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          preventDefaultMouseMove: true,
        },
        {
          type: "slider",
          xAxisIndex: 0,
          bottom: 8,
          height: 28,
          start: dataZoomStartEnd[0],
          end: dataZoomStartEnd[1],
          borderColor: "rgba(255,255,255,0.1)",
          fillerColor: "rgba(255,255,255,0.08)",
          handleStyle: { color: "rgba(255,255,255,0.4)" },
          textStyle: { color: "rgba(255,255,255,0.5)", fontSize: 10 },
          dataBackground: { lineStyle: { color: "rgba(255,255,255,0.15)" }, areaStyle: { opacity: 0 } },
        },
      ],
      series,
    };
  }, [
    displayedData,
    metricAConfig,
    metricBConfig,
    showAreaA,
    seriesVisible,
    dataZoomStartEnd,
    rangeMs,
  ]);

  const onEvents = useMemo(
    () => ({
      dataZoom: () => setHasZoomed(true),
    }),
    []
  );

  const handleResetZoom = useCallback(() => {
    setHasZoomed(false);
    chartRef.current?.getEchartsInstance()?.dispatchAction({
      type: "dataZoom",
      dataZoomIndex: 0,
      start: 0,
      end: 100,
    });
    chartRef.current?.getEchartsInstance()?.dispatchAction({
      type: "dataZoom",
      dataZoomIndex: 1,
      start: 0,
      end: 100,
    });
  }, []);

  const handleDownloadPNG = useCallback(() => {
    const url = chartRef.current?.getEchartsInstance()?.getDataURL({
      type: "png",
      pixelRatio: 2,
    });
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    }
  }, [title]);

  const handleDownloadCSV = useCallback(() => {
    const headers = ["timestamp", metricAConfig.label, metricBConfig.label];
    const rows = sortedData.map((d) =>
      [d.ts, d.a ?? "", d.b ?? ""].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedData, metricAConfig.label, metricBConfig.label, title]);

  useEffect(() => {
    if (!displayedData.length) return;
    const [start, end] = getRangeForPreset(rangePreset, displayedData);
    onRangeChange?.(new Date(start).toISOString(), new Date(end).toISOString());
  }, [rangePreset, displayedData, onRangeChange]);

  if (error) {
    return (
      <div
        className={`rounded-xl border border-red-500/30 bg-gray-900/80 p-6 ${className}`}
        role="alert"
      >
        <p className="text-red-400 font-medium">Something went wrong</p>
        <p className="text-sm text-gray-400 mt-1">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
        >
          Reload
        </button>
      </div>
    );
  }

  const dateRangeStr =
    displayedData.length >= 2
      ? `${new Date(viewStart).toLocaleDateString()} – ${new Date(viewEnd).toLocaleDateString()}`
      : "—";
  const subtext = [dateRangeStr, lastUpdated].filter(Boolean).join(" · ");

  return (
    <div
      className={`rounded-xl border border-white/10 bg-gray-900/50 overflow-hidden ${className}`}
      role="region"
      aria-label={title}
    >
      {/* Card header: title, subtext, legend chips, quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-white/5">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{subtext}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Legend chips (toggle series) */}
          <div className="flex items-center gap-2" role="group" aria-label="Toggle series">
            <button
              type="button"
              onClick={() => setSeriesVisible((s) => ({ ...s, a: !s.a }))}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                seriesVisible.a
                  ? "bg-rose-500/20 text-rose-300 border border-rose-400/40"
                  : "bg-white/5 text-gray-500 border border-white/10"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: metricAConfig.color ?? COLOR_A }}
              />
              {metricAConfig.label}
            </button>
            <button
              type="button"
              onClick={() => setSeriesVisible((s) => ({ ...s, b: !s.b }))}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                seriesVisible.b
                  ? "bg-slate-500/20 text-slate-300 border border-slate-400/40"
                  : "bg-white/5 text-gray-500 border border-white/10"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: metricBConfig.color ?? COLOR_B }}
              />
              {metricBConfig.label}
            </button>
          </div>
          {/* Range presets */}
          <div className="flex items-center gap-1" role="group" aria-label="Time range">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setRangePreset(p.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                  rangePreset === p.id
                    ? "bg-rose-500/20 text-rose-200"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Quick actions */}
          <div className="flex items-center gap-1">
            {hasZoomed && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-gray-900"
                title="Reset zoom"
                aria-label="Reset zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadPNG}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-gray-900"
              title="Download PNG"
              aria-label="Download chart as PNG"
            >
              <Image className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-gray-900"
              title="Download CSV"
              aria-label="Download data as CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative p-4 pt-2">
        {/* Accessible tooltip live region */}
        <div
          ref={tooltipLiveRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />

        {loading ? (
          <div
            className="h-[360px] rounded-lg bg-white/5 animate-pulse flex items-center justify-center"
            aria-busy="true"
          >
            <span className="text-sm text-gray-500">Loading chart…</span>
          </div>
        ) : displayedData.length === 0 ? (
          <div
            className="h-[360px] rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center gap-2"
            role="status"
          >
            <p className="text-gray-400 font-medium">No data for selected range</p>
            <p className="text-xs text-gray-500">
              Try &quot;All&quot; or adjust the date filter.
            </p>
            <button
              type="button"
              onClick={() => setRangePreset("All")}
              className="mt-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
            >
              Show all data
            </button>
          </div>
        ) : (
          <ReactECharts
            ref={chartRef}
            option={option}
            onEvents={onEvents}
            style={{ height: 360, width: "100%" }}
            opts={{ renderer: "canvas" }}
            notMerge
          />
        )}
      </div>
    </div>
  );
};

export default memo(DualAxisTimeSeriesChart);
