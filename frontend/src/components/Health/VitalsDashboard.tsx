import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Activity, Plus, Filter, TrendingUp, TrendingDown, Minus, Calendar, FileText, ExternalLink, Trash2, BarChart3, X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Pencil, Check } from "lucide-react";
import { healthApi } from "../../services/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import VitalsForm from "./VitalsForm";
import SelectDropdown from "../UI/SelectDropdown";
import DocumentViewerModal from "../UI/DocumentViewerModal";

const PARAM_TO_CATEGORY: Record<string, string> = {
  "blood pressure": "Heart",
  "heart rate": "Heart",
  "cholesterol": "Heart",
  "hdl": "Heart",
  "ldl": "Heart",
  "triglycerides": "Heart",
  "hba1c": "Diabetes",
  "fasting glucose": "Diabetes",
  "blood sugar": "Diabetes",
  "glucose": "Diabetes",
  "creatinine": "Kidney",
  "egfr": "Kidney",
  "urea": "Kidney",
  "weight": "General",
  "height": "General",
  "bmi": "General",
  "temperature": "General",
  "hemoglobin": "Blood",
  "rbc": "Blood",
  "wbc": "Blood",
  "visual acuity": "Eyes",
  "iop": "Eyes",
  "intraocular": "Eyes",
};

function getCategory(param: string): string {
  const key = (param || "").toLowerCase().trim();
  for (const [k, cat] of Object.entries(PARAM_TO_CATEGORY)) {
    if (key.includes(k)) return cat;
  }
  return "Other";
}

/** Split timestamp into date and time for two-row x-axis (matches live monitoring) */
function formatXAxisDateAndTime(ts: number): { date: string; time: string } {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "—" };
  const day = d.getDate().toString().padStart(2, "0");
  const month = d.toLocaleString("en", { month: "short" });
  const year = d.getFullYear();
  const date = `${day}${month}${year}`;
  const time = d.toLocaleTimeString("en", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return { date, time };
}

function niceDomain(min: number, max: number, paddingPercent = 0.1): [number, number] {
  const span = Math.max(max - min, 1);
  const pad = span * paddingPercent;
  let lo = min - pad;
  let hi = max + pad;
  const step = (hi - lo) / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
  const norm = step / magnitude;
  const niceStep = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * magnitude;
  lo = Math.floor(lo / niceStep) * niceStep;
  hi = Math.ceil(hi / niceStep) * niceStep;
  return [lo, hi];
}

const GRAPH_TIME_RANGE_PRESETS = [
  { id: "1D", label: "1D", days: 1 },
  { id: "1W", label: "1W", days: 7 },
  { id: "1M", label: "1M", days: 30 },
  { id: "3M", label: "3M", days: 90 },
  { id: "1Y", label: "1Y", days: 365 },
  { id: "All", label: "All", days: 0 },
] as const;

/** Default limits for reference lines (high, low) per parameter keyword */
const VITAL_LIMITS: Record<string, [number, number]> = {
  "heart rate": [100, 60],
  "blood pressure": [140, 90],
  "systolic": [140, 90],
  "diastolic": [90, 60],
  "temperature": [99, 97],
  "glucose": [140, 70],
  "fasting glucose": [126, 70],
  "blood sugar": [140, 70],
  "spo2": [100, 95],
  "hemoglobin": [17, 12],
};

function getLimitsForParam(param: string): { high: number; low: number } | null {
  const key = (param || "").toLowerCase().trim();
  for (const [k, [high, low]] of Object.entries(VITAL_LIMITS)) {
    if (key.includes(k)) return { high, low };
  }
  return null;
}

/** Format normal range for display. */
function formatNormalRange(vital: { reference_range?: string | null; normal_range_min?: number | string | null; normal_range_max?: number | string | null }): string {
  const min = vital.normal_range_min != null ? parseFloat(String(vital.normal_range_min)) : null;
  const max = vital.normal_range_max != null ? parseFloat(String(vital.normal_range_max)) : null;
  if (min != null && max != null && !Number.isNaN(min) && !Number.isNaN(max)) return `${min}–${max}`;
  if (min != null && !Number.isNaN(min)) return `≥${min}`;
  if (max != null && !Number.isNaN(max)) return `≤${max}`;
  if (vital.reference_range && String(vital.reference_range).trim()) return String(vital.reference_range).trim();
  return "—";
}

/** Color for value based on normal range: green=within, yellow=near limit, red=outside. "Near" = within 10% of range from limit. */
function getValueColor(vital: { value?: number | string; normal_range_min?: number | string | null; normal_range_max?: number | string | null }): "green" | "yellow" | "red" | null {
  const val = vital.value != null ? parseFloat(String(vital.value)) : NaN;
  const min = vital.normal_range_min != null ? parseFloat(String(vital.normal_range_min)) : null;
  const max = vital.normal_range_max != null ? parseFloat(String(vital.normal_range_max)) : null;
  if (Number.isNaN(val) || (min == null && max == null)) return null;
  if (min != null && val < min) return "red";
  if (max != null && val > max) return "red";
  const lo = min ?? val - 1;
  const hi = max ?? val + 1;
  const span = Math.max(hi - lo, 0.001);
  const margin = span * 0.1; // 10% of range
  const nearLow = min != null && val - min < margin;
  const nearHigh = max != null && hi - val < margin;
  if (nearLow || nearHigh) return "yellow";
  return "green";
}

const MAX_POINTS_GRAPH = 300;

interface VitalsGraphPopupProps {
  param: string;
  data: Array<{ value: number; timestamp: number; date?: string }>;
  loading: boolean;
  rangePreset: string;
  onRangePresetChange: (preset: string) => void;
  chartRange: { start: number; end: number };
  onChartRangeChange: (start: number, end: number) => void;
  onClose: () => void;
  /** Normal range from vitals (used for reference lines instead of hardcoded limits) */
  normalRangeMin?: number | null;
  normalRangeMax?: number | null;
}

const VitalsGraphPopup: React.FC<VitalsGraphPopupProps> = ({
  param,
  data,
  loading,
  rangePreset,
  onRangePresetChange,
  chartRange,
  onChartRangeChange,
  onClose,
  normalRangeMin,
  normalRangeMax,
}) => {
  const sortedData = useMemo(() => [...data].sort((a, b) => a.timestamp - b.timestamp), [data]);
  const presetInfo = GRAPH_TIME_RANGE_PRESETS.find((p) => p.id === rangePreset) ?? GRAPH_TIME_RANGE_PRESETS[GRAPH_TIME_RANGE_PRESETS.length - 1];
  const filteredData = useMemo(() => {
    if (presetInfo.days === 0) return sortedData;
    const cutoff = Date.now() - presetInfo.days * 24 * 60 * 60 * 1000;
    return sortedData.filter((d) => d.timestamp >= cutoff);
  }, [sortedData, presetInfo.days]);
  const nData = filteredData.length;
  const startIdx = Math.max(0, Math.floor((chartRange.start / 100) * nData));
  const endIdx = Math.min(nData, Math.ceil((chartRange.end / 100) * nData));
  const visibleFull = nData > 0 ? filteredData.slice(startIdx, endIdx) : filteredData;
  const visibleData = useMemo(() => {
    if (visibleFull.length <= MAX_POINTS_GRAPH) return visibleFull;
    const step = visibleFull.length / MAX_POINTS_GRAPH;
    const out: typeof visibleFull = [];
    for (let i = 0; i < MAX_POINTS_GRAPH; i++) {
      out.push(visibleFull[Math.min(Math.floor(i * step), visibleFull.length - 1)]);
    }
    return out;
  }, [visibleFull]);
  const limits = (normalRangeMin != null || normalRangeMax != null)
    ? { high: normalRangeMax ?? undefined, low: normalRangeMin ?? undefined }
    : getLimitsForParam(param);
  const values = filteredData.map((d) => d.value).filter((v) => v != null && !Number.isNaN(Number(v)));
  const dataMin = values.length ? Math.min(...values) : null;
  const dataMax = values.length ? Math.max(...values) : null;
  let yDomain: [number, number];
  if (limits && (limits.low != null || limits.high != null)) {
    let min = dataMin;
    let max = dataMax;
    if (limits.low != null) min = min == null ? limits.low : Math.min(min, limits.low);
    if (limits.high != null) max = max == null ? limits.high : Math.max(max, limits.high);
    yDomain = niceDomain(min ?? limits.low ?? 0, max ?? limits.high ?? 100, 0.15);
  } else {
    yDomain = dataMin != null && dataMax != null ? niceDomain(dataMin, dataMax, 0.15) : [0, 100];
  }
  const handleZoomIn = useCallback(() => {
    const center = (chartRange.start + chartRange.end) / 2;
    const span = chartRange.end - chartRange.start;
    const newSpan = Math.max(5, span - 8);
    const half = newSpan / 2;
    onChartRangeChange(Math.max(0, center - half), Math.min(100, center + half));
  }, [chartRange, onChartRangeChange]);
  const handleZoomOut = useCallback(() => {
    const center = (chartRange.start + chartRange.end) / 2;
    const span = chartRange.end - chartRange.start;
    const newSpan = Math.min(100, span + 8);
    const half = newSpan / 2;
    onChartRangeChange(Math.max(0, center - half), Math.min(100, center + half));
  }, [chartRange, onChartRangeChange]);
  const handlePanLeft = useCallback(() => {
    const span = chartRange.end - chartRange.start;
    const step = Math.min(10, span * 0.2);
    onChartRangeChange(Math.max(0, chartRange.start - step), Math.min(100, chartRange.end - step));
  }, [chartRange, onChartRangeChange]);
  const handlePanRight = useCallback(() => {
    const span = chartRange.end - chartRange.start;
    const step = Math.min(10, span * 0.2);
    onChartRangeChange(Math.max(0, chartRange.start + step), Math.min(100, chartRange.end + step));
  }, [chartRange, onChartRangeChange]);
  const handleReset = useCallback(() => {
    onChartRangeChange(0, 100);
  }, [onChartRangeChange]);
  const hasZoomed = chartRange.start > 0 || chartRange.end < 100;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4">
      <div className="card max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col bg-slate-900/95 border border-white/10">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-semibold text-gray-100">{param} — Trend</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 flex-1 min-h-[360px] overflow-auto">
          {loading ? (
            <p className="text-sm text-gray-400 py-8">Loading trend...</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-gray-400 py-8">No data for this parameter</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2" role="group" aria-label="Time range">
                  {GRAPH_TIME_RANGE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onRangePresetChange(p.id);
                        onChartRangeChange(0, 100);
                      }}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium border transition ${
                        rangePreset === p.id ? "bg-rose-500/30 text-rose-200 border-rose-400/60" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 border-transparent"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1" role="group" aria-label="Zoom and pan">
                  {hasZoomed && (
                    <button type="button" onClick={handleReset} className="rounded-md bg-white/5 px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-gray-200" title="Reset zoom" aria-label="Reset zoom">
                      Reset
                    </button>
                  )}
                  <span className="text-gray-500 mx-0.5">|</span>
                  <button type="button" onClick={handleZoomIn} className="rounded-md bg-white/5 p-1.5 text-gray-400 hover:bg-white/10 hover:text-gray-200" title="Zoom in" aria-label="Zoom in">
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={handleZoomOut} className="rounded-md bg-white/5 p-1.5 text-gray-400 hover:bg-white/10 hover:text-gray-200" title="Zoom out" aria-label="Zoom out">
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={handlePanLeft} className="rounded-md bg-white/5 p-1.5 text-gray-400 hover:bg-white/10 hover:text-gray-200" title="Pan left" aria-label="Pan left">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={handlePanRight} className="rounded-md bg-white/5 p-1.5 text-gray-400 hover:bg-white/10 hover:text-gray-200" title="Pan right" aria-label="Pan right">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="w-full overflow-x-auto" style={{ minHeight: 300 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={visibleData} margin={{ top: 12, right: 56, left: 48, bottom: 56 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={["dataMin", "dataMax"]}
                      stroke="rgba(255,255,255,0.6)"
                      tick={({ x, y, payload }) => {
                        const { date, time } = formatXAxisDateAndTime(Number(payload.value));
                        return (
                          <g transform={`translate(${x},${y + 6})`}>
                            <text textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={11}>
                              <tspan x={0} dy={0}>{date}</tspan>
                              <tspan x={0} dy={14}>{time}</tspan>
                            </text>
                          </g>
                        );
                      }}
                      interval="preserveStartEnd"
                      tickCount={Math.min(10, Math.max(5, Math.floor(visibleData.length / 3)))}
                    />
                    <YAxis
                      width={48}
                      stroke="rgba(255,255,255,0.7)"
                      tick={{ fill: "rgba(255,255,255,0.95)", fontSize: 12 }}
                      domain={yDomain}
                      tickCount={6}
                      allowDataOverflow={false}
                      tickFormatter={(v) => (Number.isInteger(v) ? String(v) : String(Number(v).toFixed(1)))}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", color: "#f1f5f9" }}
                      formatter={(val: number) => [val, param]}
                      labelFormatter={(ts) => {
                        const { date, time } = formatXAxisDateAndTime(Number(ts));
                        return `${date} ${time}`;
                      }}
                    />
                    {limits?.high != null && (
                      <ReferenceLine y={limits.high} stroke="#22c55e" strokeWidth={1.5} strokeDasharray="6 4" label={{ value: `High ${limits.high}`, position: "right", offset: 24, fill: "#22c55e", fontSize: 10 }} />
                    )}
                    {limits?.low != null && (
                      <ReferenceLine y={limits.low} stroke="#22c55e" strokeWidth={1.5} strokeDasharray="6 4" label={{ value: `Low ${limits.low}`, position: "right", offset: 24, fill: "#22c55e", fontSize: 10 }} />
                    )}
                    <Line type="monotone" dataKey="value" stroke="#e63946" strokeWidth={2.5} dot={{ fill: "#e63946", r: 3 }} activeDot={{ r: 6 }} name={param} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {visibleFull.length > MAX_POINTS_GRAPH ? `Showing ${MAX_POINTS_GRAPH} of ${visibleFull.length} points — ` : ""}
                Use +/− to zoom; arrows to pan; drag to select area and zoom.
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

interface ReportRow {
  id: string;
  file_name?: string;
  file_url?: string;
  uploaded_at?: string;
  status?: string;
}

interface VitalsDashboardProps {
  vitals: any[];
  reports?: ReportRow[];
  loading: boolean;
  selectedClient?: string | null;
  onRefresh: () => void;
}

const VitalsDashboard: React.FC<VitalsDashboardProps> = ({
  vitals,
  reports: reportsProp,
  loading,
  selectedClient,
  onRefresh,
}) => {
  const reports: ReportRow[] = Array.isArray(reportsProp)
    ? reportsProp
    : Array.isArray((reportsProp as { reports?: ReportRow[] } | undefined)?.reports)
      ? (reportsProp as { reports: ReportRow[] }).reports
      : [];
  const [openingReportId, setOpeningReportId] = useState<string | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedParameter, setSelectedParameter] = useState<string>("");
  const [graphData, setGraphData] = useState<any[]>([]);
  const [trends, setTrends] = useState<any>({});
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loadingGraph, setLoadingGraph] = useState(false);
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);
  const [pageSize, setPageSize] = useState<10 | 50 | 100 | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [graphPopupParam, setGraphPopupParam] = useState<string | null>(null);
  const [graphPopupData, setGraphPopupData] = useState<any[]>([]);
  const [graphPopupLoading, setGraphPopupLoading] = useState(false);
  const [graphPopupRangePreset, setGraphPopupRangePreset] = useState<string>("All");
  const [graphPopupChartRange, setGraphPopupChartRange] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
  const [editingNormalRangeId, setEditingNormalRangeId] = useState<string | null>(null);
  const [editingMin, setEditingMin] = useState<string>("");
  const [editingMax, setEditingMax] = useState<string>("");
  const [reportViewer, setReportViewer] = useState<{ url: string; contentType: string; fileName: string } | null>(null);

  const sortedVitals = useMemo(() => {
    const list = [...(vitals || [])];
    return list.sort((a, b) => {
      const ta = new Date(a.recorded_date ?? a.measured_at ?? a.created_at ?? 0).getTime();
      const tb = new Date(b.recorded_date ?? b.measured_at ?? b.created_at ?? 0).getTime();
      if (tb !== ta) return tb - ta; // date: latest first
      const catA = getCategory(a.parameter_name ?? a.parameter ?? a.name ?? "");
      const catB = getCategory(b.parameter_name ?? b.parameter ?? b.name ?? "");
      if (catA !== catB) return catA.localeCompare(catB); // category: A–Z
      const paramA = (a.parameter_name ?? a.parameter ?? a.name ?? "").trim();
      const paramB = (b.parameter_name ?? b.parameter ?? b.name ?? "").trim();
      return paramA.localeCompare(paramB); // parameter: A–Z
    });
  }, [vitals]);

  const filteredVitals = useMemo(() => {
    if (!selectedParameter) return sortedVitals;
    return sortedVitals.filter(
      (v) => (v.parameter_name ?? v.parameter ?? v.name ?? "").trim() === selectedParameter
    );
  }, [sortedVitals, selectedParameter]);

  const paginatedVitals = useMemo(() => {
    const list = filteredVitals;
    const size = pageSize === "all" ? list.length : Math.max(1, pageSize);
    const total = list.length;
    const totalPages = size > 0 ? Math.ceil(total / size) : 1;
    const page = Math.max(1, Math.min(currentPage, totalPages));
    const start = (page - 1) * size;
    return { slice: list.slice(start, start + size), total, totalPages, page };
  }, [filteredVitals, pageSize, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, filteredVitals.length]);

  const uniqueParameters = Array.from(
    new Set(vitals.map((v) => (v.parameter_name ?? v.parameter ?? v.name ?? "").trim()).filter(Boolean))
  );

  const graphPopupNormalRange = useMemo(() => {
    if (!graphPopupParam) return { min: null as number | null, max: null as number | null };
    const match = vitals.find(
      (v) => (v.parameter_name ?? v.parameter ?? v.name ?? "").trim() === graphPopupParam &&
        (v.normal_range_min != null || v.normal_range_max != null)
    );
    if (!match) return { min: null, max: null };
    const min = match.normal_range_min != null ? parseFloat(String(match.normal_range_min)) : null;
    const max = match.normal_range_max != null ? parseFloat(String(match.normal_range_max)) : null;
    return { min: min != null && !Number.isNaN(min) ? min : null, max: max != null && !Number.isNaN(max) ? max : null };
  }, [vitals, graphPopupParam]);

  useEffect(() => {
    if (selectedParameter) {
      loadGraphData();
      loadTrends();
    }
  }, [selectedParameter, startDate, endDate, selectedClient]);

  const loadGraphData = async () => {
    if (!selectedParameter) return;
    setLoadingGraph(true);
    try {
      const res = await healthApi.getVitalsGraph(
        selectedParameter,
        selectedClient || undefined,
        startDate || undefined,
        endDate || undefined
      );
      setGraphData(res.data || []);
    } catch (error) {
      console.error("Failed to load graph data:", error);
      setGraphData([]);
    } finally {
      setLoadingGraph(false);
    }
  };

  const loadTrends = async () => {
    if (!selectedParameter) return;
    try {
      const res = await healthApi.getVitalsTrends(selectedParameter, selectedClient || undefined);
      setTrends(res);
    } catch (error) {
      console.error("Failed to load trends:", error);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    onRefresh();
    if (selectedParameter) {
      loadGraphData();
      loadTrends();
    }
  };

  const handleStartEditNormalRange = (vital: any) => {
    if (!vital.id) return;
    setEditingNormalRangeId(vital.id);
    setEditingMin(vital.normal_range_min != null ? String(vital.normal_range_min) : "");
    setEditingMax(vital.normal_range_max != null ? String(vital.normal_range_max) : "");
  };

  const handleCancelEditNormalRange = () => {
    setEditingNormalRangeId(null);
  };

  const handleSaveNormalRange = async () => {
    const id = editingNormalRangeId;
    if (!id) return;
    const nrMin = editingMin.trim() === "" ? null : parseFloat(editingMin);
    const nrMax = editingMax.trim() === "" ? null : parseFloat(editingMax);
    if (nrMin != null && Number.isNaN(nrMin)) return;
    if (nrMax != null && Number.isNaN(nrMax)) return;
    setEditingNormalRangeId(null);
    try {
      await healthApi.updateVital(id, {
        normal_range_min: editingMin.trim() === "" ? null : nrMin ?? undefined,
        normal_range_max: editingMax.trim() === "" ? null : nrMax ?? undefined,
      }, selectedClient || undefined);
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update normal range.");
      setEditingNormalRangeId(id);
      setEditingMin(nrMin != null ? String(nrMin) : "");
      setEditingMax(nrMax != null ? String(nrMax) : "");
    }
  };

  const handleDeleteOne = async (id: string) => {
    if (!confirm("Delete this record?")) return;
    setDeleting(true);
    try {
      await healthApi.deleteVitals({ id }, selectedClient || undefined);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      alert("No records selected.");
      return;
    }
    if (!confirm(`Delete ${ids.length} selected record(s)?`)) return;
    setDeleting(true);
    try {
      await healthApi.deleteVitals({ ids }, selectedClient || undefined);
      setSelectedIds(new Set());
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Delete all ${vitals.length} vitals records? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await healthApi.deleteVitals({ deleteAll: true }, selectedClient || undefined);
      setSelectedIds(new Set());
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenGraphPopup = async (param: string) => {
    const p = (param || "").trim();
    if (!p) return;
    setGraphPopupParam(p);
    setGraphPopupLoading(true);
    setGraphPopupData([]);
    setGraphPopupRangePreset("All");
    setGraphPopupChartRange({ start: 0, end: 100 });
    try {
      const res = await healthApi.getVitalsGraph(p, selectedClient || undefined);
      const raw = res?.data || [];
      const transformed = raw.map((d: any) => {
        const ts = d.date ? new Date(d.date).getTime() : 0;
        return {
          ...d,
          value: Number(d.value),
          timestamp: ts,
          dateLabel: d.date ? new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "",
        };
      }).filter((d: any) => d.timestamp > 0);
      setGraphPopupData(transformed);
    } catch {
      setGraphPopupData([]);
    } finally {
      setGraphPopupLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const { slice } = paginatedVitals;
    const allSelected = slice.length > 0 && slice.every((v) => v.id && selectedIds.has(v.id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        slice.forEach((v) => v.id && next.delete(v.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        slice.forEach((v) => v.id && next.add(v.id));
        return next;
      });
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const datePart = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timePart = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      return `${datePart} - ${timePart}`;
    } catch {
      return dateStr || "—";
    }
  };

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return "Select date";
    try {
      return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleOpenReport = async (reportId: string, fileName?: string) => {
    setOpeningReportId(reportId);
    try {
      const { url, contentType } = await healthApi.getReportFileUrl(reportId, selectedClient || undefined);
      setReportViewer({ url, contentType, fileName: fileName || "Report" });
    } catch (err) {
      console.error("Failed to open report:", err);
      alert("Failed to open report. Please try again.");
    } finally {
      setOpeningReportId(null);
    }
  };

  const handleCloseReportViewer = () => {
    if (reportViewer?.url) URL.revokeObjectURL(reportViewer.url);
    setReportViewer(null);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Delete this report? This cannot be undone.")) return;
    setDeletingReportId(reportId);
    try {
      await healthApi.deleteReport(reportId, selectedClient || undefined);
      onRefresh();
    } catch (err: any) {
      console.error("Failed to delete report:", err);
      alert(err?.response?.data?.message || "Failed to delete report.");
    } finally {
      setDeletingReportId(null);
    }
  };

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading vitals...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 overflow-x-hidden">
        {!selectedClient && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Vital
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <h3 className="font-semibold">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Parameter</label>
              <SelectDropdown
                value={selectedParameter}
                options={[
                  { value: "", label: "All Parameters" },
                  ...uniqueParameters.map((param) => ({ value: param, label: param })),
                ]}
                onChange={(value) => setSelectedParameter(value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  const el = startDateInputRef.current;
                  if (el) {
                    (el as HTMLInputElement).showPicker?.();
                    el.focus();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    startDateInputRef.current?.focus();
                    (startDateInputRef.current as HTMLInputElement)?.showPicker?.();
                  }
                }}
                className="input-field w-full flex items-center gap-2 cursor-pointer hover:bg-white/10 min-h-[2.5rem]"
              >
                <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                <span className={startDate ? "text-gray-200" : "text-gray-500"}>
                  {formatDateForDisplay(startDate)}
                </span>
              </div>
              <input
                ref={startDateInputRef}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="sr-only"
                aria-label="Start date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  const el = endDateInputRef.current;
                  if (el) {
                    (el as HTMLInputElement).showPicker?.();
                    el.focus();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    endDateInputRef.current?.focus();
                    (endDateInputRef.current as HTMLInputElement)?.showPicker?.();
                  }
                }}
                className="input-field w-full flex items-center gap-2 cursor-pointer hover:bg-white/10 min-h-[2.5rem]"
              >
                <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                <span className={endDate ? "text-gray-200" : "text-gray-500"}>
                  {formatDateForDisplay(endDate)}
                </span>
              </div>
              <input
                ref={endDateInputRef}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="sr-only"
                aria-label="End date"
              />
            </div>
          </div>
        </div>

        {/* Trends */}
        {selectedParameter && trends.trend && (
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Trend for {selectedParameter}</p>
                <div className="flex items-center gap-2">
                  {trends.trend === "up" && <TrendingUp className="h-5 w-5 text-red-400" />}
                  {trends.trend === "down" && <TrendingDown className="h-5 w-5 text-green-400" />}
                  {trends.trend === "neutral" && <Minus className="h-5 w-5 text-gray-400" />}
                  <span className="font-semibold">
                    {trends.latest !== undefined && trends.previous !== undefined && (
                      <>
                        {trends.latest} {trends.change !== null && `(${trends.change > 0 ? "+" : ""}${trends.change})`}
                        {trends.percentage && ` (${trends.percentage}%)`}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Graph */}
        {selectedParameter && graphData.length > 0 && (
          <div className="card p-4">
            <h3 className="font-semibold mb-4">{selectedParameter} Over Time</h3>
            {loadingGraph ? (
              <p className="text-sm text-gray-400">Loading graph...</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={graphData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.8)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#e63946"
                    strokeWidth={2}
                    dot={{ fill: "#e63946", r: 4 }}
                    name={selectedParameter}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Vitals Table */}
        <div className="card p-4">
          <h3 className="font-semibold mb-4">Vitals History</h3>
          {vitals.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No vitals recorded yet</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as 10 | 50 | 100 | "all")}
                    className="input-field text-sm py-1.5 px-2 w-auto"
                  >
                    <option value={10}>10</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value="all">All</option>
                  </select>
                </div>
                {!selectedClient && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={deleting || selectedIds.size === 0}
                    className="btn-secondary flex items-center gap-1.5 text-sm py-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete selected ({selectedIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAll}
                    disabled={deleting}
                    className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete all
                  </button>
                </div>
                )}
              </div>
              {/* Desktop table view */}
              <div className="hidden landscape:block overflow-auto max-h-[400px] border border-white/10 rounded-lg">
                <table className="vitals-table w-full">
                  <thead className="sticky top-0 bg-gray-900 z-10">
                    <tr className="border-b border-white/10">
                      {!selectedClient && (
                      <th className="text-left p-2 w-8">
                        <input
                          type="checkbox"
                          checked={
                            paginatedVitals.slice.length > 0 &&
                            paginatedVitals.slice.every((v) => v.id && selectedIds.has(v.id))
                          }
                          onChange={toggleSelectAll}
                          aria-label="Select all"
                          className="rounded"
                        />
                      </th>
                      )}
                      <th className="text-left p-2 text-sm font-medium">Date</th>
                      <th className="text-left p-2 text-sm font-medium">Category</th>
                      <th className="text-left p-2 text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>Parameter</span>
                          <select
                            value={selectedParameter}
                            onChange={(e) => setSelectedParameter(e.target.value)}
                            className="bg-gray-800 border border-white/20 rounded text-xs py-1 px-2 min-w-[100px] focus:outline-none focus:ring-1 focus:ring-rose-500"
                            title="Filter by parameter"
                          >
                            <option value="">All</option>
                            {uniqueParameters.map((param) => (
                              <option key={param} value={param}>
                                {param}
                              </option>
                            ))}
                          </select>
                        </div>
                      </th>
                      <th className="text-left p-2 text-sm font-medium">Value</th>
                      <th className="text-left p-2 text-sm font-medium">Normal Range</th>
                      <th className="text-left p-2 text-sm font-medium">Source</th>
                      <th className="text-left p-2 w-12 font-medium">Graph</th>
                      {!selectedClient && <th className="text-left p-2 w-12 font-medium">Del</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVitals.slice.map((vital) => (
                      <tr key={vital.id || `${vital.parameter_name ?? vital.parameter}-${vital.recorded_date ?? vital.measured_at}-${vital.value}`} className="border-b border-white/5 hover:bg-white/5">
                        {!selectedClient && (
                        <td className="p-2">
                          {vital.id && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(vital.id)}
                              onChange={() => toggleSelect(vital.id)}
                              aria-label="Select row"
                              className="rounded"
                            />
                          )}
                        </td>
                        )}
                        <td className="p-2 text-sm text-gray-400 whitespace-nowrap">
                          {formatDateTime(vital.recorded_date ?? vital.measured_at ?? vital.created_at ?? "")}
                        </td>
                        <td className="p-2 text-sm">{getCategory(vital.parameter_name ?? vital.parameter ?? vital.name ?? "")}</td>
                        <td className="p-2 text-sm">{vital.parameter_name ?? vital.parameter ?? vital.name ?? "—"}</td>
                        <td className="p-2 text-sm font-semibold">
                          {(() => {
                            const c = getValueColor(vital);
                            const cls = c === "green" ? "text-emerald-400" : c === "yellow" ? "text-amber-400" : c === "red" ? "text-red-400" : "";
                            return <span className={cls}>{vital.value} {vital.unit || ""}</span>;
                          })()}
                        </td>
                        <td className="p-2 text-sm text-gray-400">
                          {editingNormalRangeId === vital.id ? (
                            <div className="flex items-center gap-1.5">
                              <input type="number" step="any" className="w-16 input-field text-xs py-1" placeholder="Low" value={editingMin} onChange={(e) => setEditingMin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSaveNormalRange()} />
                              <span className="text-gray-500">–</span>
                              <input type="number" step="any" className="w-16 input-field text-xs py-1" placeholder="High" value={editingMax} onChange={(e) => setEditingMax(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSaveNormalRange()} />
                              <button type="button" onClick={handleSaveNormalRange} className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20" title="Save" aria-label="Save"><Check className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={handleCancelEditNormalRange} className="p-1 rounded text-gray-400 hover:bg-white/10" title="Cancel" aria-label="Cancel"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => handleStartEditNormalRange(vital)} className="flex items-center gap-1.5 group hover:bg-white/5 rounded px-1 -mx-1 py-0.5" title="Edit normal range">
                              <span>{formatNormalRange(vital)}</span>
                              {vital.id && <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-70" />}
                            </button>
                          )}
                        </td>
                        <td className="p-2 text-sm text-gray-400">
                          {vital.source ?? (vital.source_report_id ? "Report scan" : "Manually entered")}
                        </td>
                        <td className="p-2">
                          <button type="button" onClick={() => handleOpenGraphPopup(vital.parameter_name ?? vital.parameter ?? vital.name ?? "")} className="p-1 rounded text-rose-400 hover:bg-rose-500/20" title="Show trend" aria-label="Show trend graph"><BarChart3 className="h-4 w-4" /></button>
                        </td>
                        {!selectedClient && (
                        <td className="p-2">
                          {vital.id && (
                            <button type="button" onClick={() => handleDeleteOne(vital.id)} disabled={deleting} className="p-1 rounded text-red-400 hover:bg-red-500/20 disabled:opacity-50" title="Delete" aria-label="Delete record"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
                        </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Portrait card view */}
              <div className="landscape:hidden space-y-2 max-h-[500px] overflow-y-auto">
                <div className="flex items-center gap-2 mb-2">
                  {!selectedClient && (
                  <>
                  <input
                    type="checkbox"
                    checked={paginatedVitals.slice.length > 0 && paginatedVitals.slice.every((v) => v.id && selectedIds.has(v.id))}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                    className="rounded"
                  />
                  <span className="text-xs text-gray-400">Select all</span>
                  </>
                  )}
                  <div className="ml-auto">
                    <select
                      value={selectedParameter}
                      onChange={(e) => setSelectedParameter(e.target.value)}
                      className="bg-gray-800 border border-white/20 rounded text-xs py-1 px-2 min-w-[100px] focus:outline-none focus:ring-1 focus:ring-rose-500 vitals-table"
                      title="Filter by parameter"
                    >
                      <option value="">All parameters</option>
                      {uniqueParameters.map((param) => (
                        <option key={param} value={param}>{param}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {paginatedVitals.slice.map((vital) => {
                  const c = getValueColor(vital);
                  const valCls = c === "green" ? "text-emerald-400" : c === "yellow" ? "text-amber-400" : c === "red" ? "text-red-400" : "";
                  return (
                    <div
                      key={vital.id || `${vital.parameter_name ?? vital.parameter}-${vital.recorded_date ?? vital.measured_at}-${vital.value}`}
                      className="rounded-lg border border-white/10 bg-white/5 p-3 today-list-item"
                    >
                      <div className="flex items-start gap-2">
                        {!selectedClient && vital.id && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(vital.id)}
                            onChange={() => toggleSelect(vital.id)}
                            aria-label="Select"
                            className="rounded mt-0.5"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm">{vital.parameter_name ?? vital.parameter ?? vital.name ?? "—"}</p>
                            <span className={`text-base font-bold ${valCls}`}>{vital.value} {vital.unit || ""}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span>{formatDateTime(vital.recorded_date ?? vital.measured_at ?? vital.created_at ?? "")}</span>
                            <span>{getCategory(vital.parameter_name ?? vital.parameter ?? vital.name ?? "")}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span>Range: {formatNormalRange(vital)}</span>
                            <span>{vital.source ?? (vital.source_report_id ? "Report scan" : "Manual")}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button type="button" onClick={() => handleOpenGraphPopup(vital.parameter_name ?? vital.parameter ?? vital.name ?? "")} className="p-1.5 rounded text-rose-400 hover:bg-rose-500/20" title="Trend"><BarChart3 className="h-4 w-4" /></button>
                          {!selectedClient && vital.id && (
                            <button type="button" onClick={() => handleDeleteOne(vital.id)} disabled={deleting} className="p-1.5 rounded text-red-400 hover:bg-red-500/20 disabled:opacity-50" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {pageSize !== "all" && paginatedVitals.totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 mt-3">
                  <p className="text-xs text-gray-400">
                    Showing {(paginatedVitals.page - 1) * (pageSize as number) + 1}–{Math.min(paginatedVitals.page * (pageSize as number), paginatedVitals.total)} of {paginatedVitals.total}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={paginatedVitals.page <= 1}
                      className="btn-secondary text-sm py-1 px-2 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-400 px-2">
                      Page {paginatedVitals.page} / {paginatedVitals.totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(paginatedVitals.totalPages, p + 1))}
                      disabled={paginatedVitals.page >= paginatedVitals.totalPages}
                      className="btn-secondary text-sm py-1 px-2 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Stored diagnostic files – all reports for selected client or current user */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Stored diagnostic files
            </h3>
            {reports.length === 0 ? (
              <p className="text-sm text-gray-400">No stored diagnostic files yet. Upload a report via Scan Document to save to the cloud and see it here.</p>
            ) : (
              <>
              <div className="hidden landscape:block overflow-x-auto">
                <table className="vitals-table w-full min-w-[320px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-2 text-sm font-medium">Date</th>
                      <th className="text-left p-2 text-sm font-medium">Report title</th>
                      <th className="text-left p-2 text-sm font-medium">Link</th>
                      {!selectedClient && <th className="text-left p-2 w-12 text-sm font-medium">Del</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-2 text-sm text-gray-400">
                          {r.uploaded_at ? formatDate(r.uploaded_at) : "—"}
                        </td>
                        <td className="p-2 text-sm">{r.file_name ?? "Report"}</td>
                        <td className="p-2">
                          <button type="button" onClick={() => handleOpenReport(r.id, r.file_name ?? undefined)} disabled={openingReportId === r.id} className="inline-flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 disabled:opacity-50">
                            <ExternalLink className="h-3.5 w-3.5" />
                            {openingReportId === r.id ? "Opening…" : "Open"}
                          </button>
                        </td>
                        {!selectedClient && (
                        <td className="p-2">
                          <button type="button" onClick={() => handleDeleteReport(r.id)} disabled={deletingReportId === r.id} className="p-1 rounded text-red-400 hover:bg-red-500/20 disabled:opacity-50" title="Delete report" aria-label="Delete report">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Portrait card view */}
              <div className="landscape:hidden space-y-2">
                {reports.map((r) => (
                  <div key={r.id} className="rounded-lg border border-white/10 bg-white/5 p-3 today-list-item">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{r.file_name ?? "Report"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.uploaded_at ? formatDate(r.uploaded_at) : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => handleOpenReport(r.id, r.file_name ?? undefined)} disabled={openingReportId === r.id} className="inline-flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 disabled:opacity-50 px-2 py-1 rounded hover:bg-rose-500/10">
                          <ExternalLink className="h-3.5 w-3.5" />
                          {openingReportId === r.id ? "…" : "Open"}
                        </button>
                        {!selectedClient && (
                        <button type="button" onClick={() => handleDeleteReport(r.id)} disabled={deletingReportId === r.id} className="p-1.5 rounded text-red-400 hover:bg-red-500/20 disabled:opacity-50" title="Delete" aria-label="Delete report">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <VitalsForm
          isOpen={showForm}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          clientId={selectedClient || undefined}
        />
      )}

      {reportViewer && (
        <DocumentViewerModal
          isOpen={!!reportViewer}
          onClose={handleCloseReportViewer}
          url={reportViewer.url}
          contentType={reportViewer.contentType}
          fileName={reportViewer.fileName}
        />
      )}

      {graphPopupParam && (
        <VitalsGraphPopup
          param={graphPopupParam}
          data={graphPopupData}
          loading={graphPopupLoading}
          rangePreset={graphPopupRangePreset}
          onRangePresetChange={setGraphPopupRangePreset}
          chartRange={graphPopupChartRange}
          onChartRangeChange={(start, end) => setGraphPopupChartRange({ start, end })}
          onClose={() => setGraphPopupParam(null)}
          normalRangeMin={graphPopupNormalRange.min}
          normalRangeMax={graphPopupNormalRange.max}
        />
      )}
    </>
  );
};

export default VitalsDashboard;
