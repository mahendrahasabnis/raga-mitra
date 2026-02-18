import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Plus,
  Calendar,
  Activity,
  FileSpreadsheet,
  Download,
  X,
  Loader2,
  LayoutGrid,
  LayoutList,
  ChevronDown,
  ChevronUp,
  Pill,
  RefreshCw,
} from "lucide-react";
import { healthApi } from "../../services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const PARAM_LABELS: Record<string, string> = {
  heart_rate: "Heart Rate (BPM)",
  breath_rate: "Breath Rate (RR)",
  spo2: "SpO2 (%)",
  temperature: "Temperature (°F)",
  systolic_bp: "Systolic BP (mmHg)",
  diastolic_bp: "Diastolic BP (mmHg)",
  movement: "Movement",
};

const DEFAULT_Y_DOMAIN: Record<string, [number, number]> = {
  heart_rate: [40, 180],
  breath_rate: [0, 40],
  spo2: [80, 102],
  temperature: [95, 105],
  systolic_bp: [80, 180],
  diastolic_bp: [50, 120],
  movement: [-1, 2],
};

const TREATMENT_LINE_UNSELECTED = "#10b981";
const TREATMENT_LINE_SELECTED = "#fbbf24";

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

/** Format as ddMMMyyyy hh:mm:ss am (e.g. 18Feb2026 10:30:45 AM) */
function formatDateRangeDisplay(ts: number | string | Date): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getDate().toString().padStart(2, "0");
  const month = d.toLocaleString("en", { month: "short" });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString("en", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `${day}${month}${year} ${time}`;
}

function formatXAxisTime(ts: number): string {
  return formatDateRangeDisplay(ts);
}

/** Split timestamp into date and time for two-row x-axis labels (Date above, Time below) */
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

/** One-line summary: "Treatment/Medicine qty given by Dr at date and time" */
function formatTreatmentSummary(t: any): string {
  if (!t) return "";
  const name = t.treatment_name?.trim() || "Treatment";
  const qty = t.quantity?.trim();
  const doctor = t.doctor_name?.trim();
  const at = formatDateRangeDisplay(t.recorded_at);
  const qtyPart = qty ? ` ${qty}` : "";
  const byPart = doctor ? ` given by ${doctor}` : "";
  return `${name}${qtyPart}${byPart} at ${at}`;
}

const TIME_RANGE_PRESETS = [
  { id: "1D", label: "1D", days: 1 },
  { id: "1W", label: "1W", days: 7 },
  { id: "1M", label: "1M", days: 30 },
  { id: "3M", label: "3M", days: 90 },
  { id: "1Y", label: "1Y", days: 365 },
] as const;

const MAX_POINTS_PER_CHART = 300;

/** Wrapper that attaches wheel listener with { passive: false } so preventDefault works for zoom. */
function ChartWheelZoom({
  children,
  onWheelZoom,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { onWheelZoom: (e: WheelEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      onWheelZoom(e);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [onWheelZoom]);
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
}

function toDatetimeLocal(d: Date): string {
  return d.toISOString().slice(0, 16);
}

interface AdmissionMonitorViewProps {
  admission: any;
  onBack: () => void;
  selectedClient?: string | null;
  onRefresh: () => void;
}

const AdmissionMonitorView: React.FC<AdmissionMonitorViewProps> = ({
  admission,
  onBack,
  selectedClient,
  onRefresh,
}) => {
  const [readings, setReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDateTime, setStartDateTime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDatetimeLocal(d);
  });
  const [endDateTime, setEndDateTime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toDatetimeLocal(d);
  });
  const lastEnteredRef = useRef<Record<string, string>>({
    heart_rate: "", breath_rate: "", spo2: "", temperature: "", systolic_bp: "", diastolic_bp: "", movement: "0",
  });
  const nowDatetime = () => toDatetimeLocal(new Date());
  const [manualForm, setManualForm] = useState(() => ({
    recorded_at: nowDatetime(),
    heart_rate: "",
    breath_rate: "",
    spo2: "",
    temperature: "",
    systolic_bp: "",
    diastolic_bp: "",
    movement: "0",
  }));
  const [saving, setSaving] = useState(false);
  const [chartsPerRow, setChartsPerRow] = useState<1 | 2>(1);
  const [chartViewRanges, setChartViewRanges] = useState<Record<string, { start: number; end: number }>>({});
  const panRef = useRef<{ paramKey: string; startX: number; startStart: number; startEnd: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "previewing" | "processing">("idle");
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [usedTemplateFormat, setUsedTemplateFormat] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartContainerWidth, setChartContainerWidth] = useState(0);
  const [addDataExpanded, setAddDataExpanded] = useState(false);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [treatmentForm, setTreatmentForm] = useState(() => ({
    recorded_at: nowDatetime(),
    treatment_name: "",
    quantity: "",
    notes: "",
    doctor_name: "",
  }));
  const [savingTreatment, setSavingTreatment] = useState(false);
  const [selectedTreatment, setSelectedTreatment] = useState<any | null>(null);
  const [medicineOptions, setMedicineOptions] = useState<string[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<string[]>([]);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await healthApi.getMonitoringTemplate(admission.id, selectedClient || undefined);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "monitoring_template.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to download template.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const highLimits = admission?.high_limits || {};
  const lowLimits = admission?.low_limits || {};

  const toStartIso = (v: string) => {
    if (!v) return undefined;
    if (v.includes("T")) return v.length === 16 ? `${v}:00.000Z` : v;
    return `${v}T00:00:00.000Z`;
  };
  const toEndIso = (v: string) => {
    if (!v) return undefined;
    if (v.includes("T")) return v.length === 16 ? `${v}:59.999Z` : v;
    return `${v}T23:59:59.999Z`;
  };

  const loadReadings = async (startIso?: string, endIso?: string) => {
    const start = startIso ?? toStartIso(startDateTime);
    const end = endIso ?? toEndIso(endDateTime);
    if (!start || !end) return;
    setLoading(true);
    try {
      const res = await healthApi.getMonitoringReadings(
        admission.id,
        selectedClient || undefined,
        start,
        end
      );
      const list = res?.readings;
      setReadings(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load readings:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTreatments = async (startIso?: string, endIso?: string) => {
    const start = startIso ?? toStartIso(startDateTime);
    const end = endIso ?? toEndIso(endDateTime);
    if (!start || !end) return;
    try {
      const res = await healthApi.getAdmissionTreatments(
        admission.id,
        selectedClient || undefined,
        start,
        end
      );
      setTreatments(Array.isArray(res?.treatments) ? res.treatments : []);
    } catch (err) {
      console.error("Failed to load treatments:", err);
    }
  };

  const handleLoadChartData = useCallback(async () => {
    const start = toStartIso(startDateTime);
    const end = toEndIso(endDateTime);
    if (!start || !end) return;
    await loadReadings(start, end);
    await loadTreatments(start, end);
    setChartViewRanges({});
  }, [startDateTime, endDateTime, admission?.id, selectedClient]);

  useEffect(() => {
    setReadings([]);
    setTreatments([]);
    setSelectedTreatment(null);
  }, [admission?.id, selectedClient]);

  useEffect(() => {
    const loadOptions = async () => {
      const meds = new Set<string>();
      const docs = new Set<string>();
      if (admission?.consulting_doctor) docs.add(admission.consulting_doctor);
      treatments.forEach((t) => {
        if (t.treatment_name) meds.add(t.treatment_name);
        if (t.doctor_name) docs.add(t.doctor_name);
      });
      try {
        const medRes = await healthApi.getMedicines(selectedClient || undefined, false);
        const list = medRes?.medicines || medRes || [];
        (Array.isArray(list) ? list : []).forEach((m: any) => {
          const name = m.medicine_name || m.name;
          if (name) meds.add(name);
        });
        const apptRes = await healthApi.getAppointments(selectedClient || undefined);
        const appts = apptRes?.appointments || [];
        (Array.isArray(appts) ? appts : []).forEach((a: any) => {
          if (a.doctor_name) docs.add(a.doctor_name);
        });
      } catch {
        // ignore
      }
      setMedicineOptions(Array.from(meds).sort());
      setDoctorOptions(Array.from(docs).sort());
    };
    loadOptions();
  }, [admission?.id, selectedClient, treatments]);



  useEffect(() => {
    if (importPreview != null) setAddDataExpanded(true);
  }, [importPreview]);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (w > 0) setChartContainerWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [readings.length]);

  const applyTimePreset = useCallback((days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDateTime(toDatetimeLocal(start));
    setEndDateTime(toDatetimeLocal(end));
  }, []);

  const activePresetId = useMemo(() => {
    const startIso = toStartIso(startDateTime);
    const endIso = toEndIso(endDateTime);
    if (!startIso || !endIso) return null;
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    const spanDays = (endMs - startMs) / (24 * 60 * 60 * 1000);
    const match = TIME_RANGE_PRESETS.find((p) => Math.abs(spanDays - p.days) < 0.5);
    return match?.id ?? null;
  }, [startDateTime, endDateTime]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const chartData = (Array.isArray(readings) ? readings : []).map((r) => ({
    ...r,
    time: formatTime(r.recorded_at),
    timestamp: new Date(r.recorded_at).getTime(),
  }));

  const nData = chartData.length;
  const PARAM_KEYS = Object.keys(PARAM_LABELS);

  const getChartRange = useCallback((paramKey: string) => {
    return chartViewRanges[paramKey] ?? { start: 0, end: 100 };
  }, [chartViewRanges]);

  const setChartRange = useCallback((paramKey: string, start: number, end: number) => {
    setChartViewRanges((prev) => ({ ...prev, [paramKey]: { start, end } }));
  }, []);

  const applyPresetForChart = useCallback((paramKey: string, days: number) => {
    if (nData === 0) return;
    const times = (chartData as any[]).map((d) => d.timestamp);
    const maxT = Math.max(...times);
    const minT = Math.min(...times);
    const windowMs = days * 24 * 60 * 60 * 1000;
    const startT = maxT - windowMs;
    const rangeStartT = Math.max(minT, startT);
    const span = maxT - minT;
    if (span <= 0) return;
    const start = ((rangeStartT - minT) / span) * 100;
    const end = 100;
    setChartRange(paramKey, start, end);
  }, [nData, chartData, setChartRange]);


  const handleTreatmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatmentForm.treatment_name?.trim()) return;
    setSavingTreatment(true);
    try {
      const recordedAt = new Date(treatmentForm.recorded_at).toISOString();
      await healthApi.addAdmissionTreatment(
        admission.id,
        {
          recorded_at: recordedAt,
          treatment_name: treatmentForm.treatment_name.trim(),
          quantity: treatmentForm.quantity.trim() || undefined,
          notes: treatmentForm.notes.trim() || undefined,
          doctor_name: treatmentForm.doctor_name.trim() || undefined,
        },
        selectedClient || undefined
      );
      setTreatmentForm((prev) => ({
        ...prev,
        recorded_at: nowDatetime(),
        treatment_name: "",
        quantity: "",
        notes: "",
      }));
      loadTreatments();
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to save treatment.");
    } finally {
      setSavingTreatment(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        recorded_at: new Date(manualForm.recorded_at).toISOString(),
        heart_rate: manualForm.heart_rate ? parseFloat(manualForm.heart_rate) : null,
        breath_rate: manualForm.breath_rate ? parseFloat(manualForm.breath_rate) : null,
        spo2: manualForm.spo2 ? parseFloat(manualForm.spo2) : null,
        temperature: manualForm.temperature ? parseFloat(manualForm.temperature) : null,
        systolic_bp: manualForm.systolic_bp ? parseFloat(manualForm.systolic_bp) : null,
        diastolic_bp: manualForm.diastolic_bp ? parseFloat(manualForm.diastolic_bp) : null,
        movement: manualForm.movement === "1" ? 1 : 0,
      };
      await healthApi.addMonitoringReadings(admission.id, [payload], selectedClient || undefined);
      const toStr = (v: number | null) => (v != null ? String(v) : "");
      lastEnteredRef.current = {
        heart_rate: toStr(payload.heart_rate),
        breath_rate: toStr(payload.breath_rate),
        spo2: toStr(payload.spo2),
        temperature: toStr(payload.temperature),
        systolic_bp: toStr(payload.systolic_bp),
        diastolic_bp: toStr(payload.diastolic_bp),
        movement: payload.movement === 1 ? "1" : "0",
      };
      setManualForm((prev) => ({
        ...prev,
        recorded_at: nowDatetime(),
        ...lastEnteredRef.current,
      }));
      loadReadings();
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to save reading.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importAbortRef.current?.abort();
    importAbortRef.current = new AbortController();
    setImporting(true);
    setImportStatus("previewing");
    setImportPreview(null);
    setImportFile(null);
    setUsedTemplateFormat(false);
    try {
      const res = await healthApi.previewMonitoringImport(admission.id, file, importAbortRef.current.signal);
      setImportPreview(res.rows || []);
      setImportFile(file);
      setUsedTemplateFormat(res.usedTemplate === true);
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") return;
      alert(err?.response?.data?.message || "Failed to parse file.");
    } finally {
      setImporting(false);
      setImportStatus("idle");
      e.target.value = "";
    }
  };

  const handleProcessImport = async () => {
    if (!importFile || !importPreview?.length) return;
    importAbortRef.current?.abort();
    importAbortRef.current = new AbortController();
    setImporting(true);
    setImportStatus("processing");
    try {
      await healthApi.importMonitoringReadings(
        admission.id,
        importFile,
        selectedClient || undefined,
        importAbortRef.current.signal
      );
      setImportPreview(null);
      setImportFile(null);
      setUsedTemplateFormat(false);
      loadReadings();
      onRefresh();
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") return;
      alert(err?.response?.data?.message || "Failed to import file.");
    } finally {
      setImporting(false);
      setImportStatus("idle");
    }
  };

  const handleCancelImportOperation = () => {
    importAbortRef.current?.abort();
    setImporting(false);
    setImportStatus("idle");
    setImportPreview(null);
    setImportFile(null);
    setUsedTemplateFormat(false);
  };

  const handleCancelImport = () => {
    if (importing) handleCancelImportOperation();
    else {
      setImportPreview(null);
      setImportFile(null);
      setUsedTemplateFormat(false);
    }
  };

  const formatTooltipDate = (val: number | string | undefined) => {
    if (val == null) return "—";
    const ts = typeof val === "number" ? val : new Date(val).getTime();
    if (Number.isNaN(ts)) return String(val);
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const makeTooltip =
    (paramKey: string) =>
    ({ active, payload, label }: any) => {
      if (!active || !payload?.length) return null;
      const p = payload[0]?.payload;
      const dataKey = paramKey === "movement" ? "movement" : paramKey;
      const highVal = typeof highLimits[paramKey] === "number" ? highLimits[paramKey] : null;
      const lowVal = typeof lowLimits[paramKey] === "number" ? lowLimits[paramKey] : null;
      const displayDate = formatTooltipDate(p?.timestamp ?? label);
      const valueLine = payload.map((entry: any) => `${PARAM_LABELS[entry.dataKey] || entry.dataKey}: ${entry.value}`).join(" · ");
      const isOver = highVal != null && p[dataKey] != null && Number(p[dataKey]) > highVal;
      const isUnder = lowVal != null && p[dataKey] != null && Number(p[dataKey]) < lowVal;
      const alertStr = isOver || isUnder ? (isOver ? ` ↑>${highVal}` : "") + (isUnder ? ` ↓<${lowVal}` : "") : "";
      return (
        <div className="text-[10px] text-gray-300 whitespace-nowrap px-2 py-1 -translate-y-1 pointer-events-none bg-gray-900/95 rounded border border-white/10">
          {displayDate} · {valueLine}{alertStr}
        </div>
      );
    };

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex-1">
          <h3 className="font-semibold">{admission.institution_name}</h3>
          <p className="text-sm text-gray-400">
            MRN: {admission.mrn_number || "—"} | Bed: {admission.bed_number || "—"} | Admitted:{" "}
            {admission.admission_date ? String(admission.admission_date).slice(0, 10) : "—"}
          </p>
        </div>
      </div>

      {/* Manual entry + Excel import */}
      <div className="card p-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setAddDataExpanded((e) => !e)}
          onKeyDown={(e) => e.key === "Enter" && setAddDataExpanded((prev) => !prev)}
          className="flex flex-wrap items-center justify-between gap-4 w-full text-left mb-0 cursor-pointer"
        >
          <h4 className="font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Add monitoring data
            {addDataExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </h4>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="btn-secondary flex items-center gap-2"
              title="Download CSV template. Fill in Excel, save as CSV, then import. Dates stay correct."
            >
              <Download className="h-4 w-4" />
              {downloadingTemplate ? "Downloading…" : "Download Template"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="btn-secondary flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {importing ? "Extracting…" : "Import Excel/CSV"}
            </button>
          </div>
        </div>
        {addDataExpanded && (
        <div className="mt-4">
        {importPreview != null && (
          <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
            <h5 className="font-medium mb-2">Imported data preview ({importPreview.length} rows)</h5>
            {usedTemplateFormat && (
              <p className="text-xs text-emerald-400/90 mb-2">Template format detected — dates preserved (no AI parsing)</p>
            )}
            <div className="overflow-auto max-h-48 mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-2">Time</th>
                    <th className="text-left p-2">HR</th>
                    <th className="text-left p-2">RR</th>
                    <th className="text-left p-2">SpO2</th>
                    <th className="text-left p-2">Temp</th>
                    <th className="text-left p-2">Syst</th>
                    <th className="text-left p-2">Diast</th>
                    <th className="text-left p-2">Mov</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="p-2 text-gray-400">{r.recorded_at ? new Date(r.recorded_at).toLocaleString() : "—"}</td>
                      <td className="p-2">{r.heart_rate ?? "—"}</td>
                      <td className="p-2">{r.breath_rate ?? "—"}</td>
                      <td className="p-2">{r.spo2 ?? "—"}</td>
                      <td className="p-2">{r.temperature ?? "—"}</td>
                      <td className="p-2">{r.systolic_bp ?? "—"}</td>
                      <td className="p-2">{r.diastolic_bp ?? "—"}</td>
                      <td className="p-2">{r.movement ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importPreview.length > 50 && <p className="text-xs text-gray-400 mb-2">Showing first 50 of {importPreview.length} rows</p>}
            <div className="flex gap-2">
              <button type="button" onClick={handleProcessImport} disabled={importing} className="btn-primary">
                {importing ? "Processing…" : "Process Import"}
              </button>
              <button type="button" onClick={handleCancelImport} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        )}
        <form onSubmit={handleManualSubmit} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium mb-1">Date & Time</label>
            <input
              type="datetime-local"
              value={manualForm.recorded_at}
              onChange={(e) => setManualForm((p) => ({ ...p, recorded_at: e.target.value }))}
              className="input-field w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Heart Rate (BPM)</label>
            <input
              type="number"
              step="0.1"
              value={manualForm.heart_rate}
              onChange={(e) => setManualForm((p) => ({ ...p, heart_rate: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="—"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Breath Rate (RR)</label>
            <input
              type="number"
              step="0.1"
              value={manualForm.breath_rate}
              onChange={(e) => setManualForm((p) => ({ ...p, breath_rate: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="—"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">SpO2 (%)</label>
            <input
              type="number"
              step="0.1"
              value={manualForm.spo2}
              onChange={(e) => setManualForm((p) => ({ ...p, spo2: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="—"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Temp (°F)</label>
            <input
              type="number"
              step="0.1"
              value={manualForm.temperature}
              onChange={(e) => setManualForm((p) => ({ ...p, temperature: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="—"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Systolic BP</label>
            <input
              type="number"
              step="0.1"
              value={manualForm.systolic_bp}
              onChange={(e) => setManualForm((p) => ({ ...p, systolic_bp: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="—"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Diastolic BP</label>
            <input
              type="number"
              step="0.1"
              value={manualForm.diastolic_bp}
              onChange={(e) => setManualForm((p) => ({ ...p, diastolic_bp: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="—"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Movement</label>
            <select
              value={manualForm.movement}
              onChange={(e) => setManualForm((p) => ({ ...p, movement: e.target.value }))}
              className="input-field w-full text-sm"
            >
              <option value="0">0 - No Movement</option>
              <option value="1">1 - Movement</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-4 lg:col-span-8">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {saving ? "Saving…" : "Add Reading"}
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-400 mt-2">
          Excel/CSV: AI extracts monitoring data. Supports Timestamp, HeartRate (BPM), BreathRate (RR), SpO2 (%), Temperature (°F), Systolic/Diastolic BP (mmHg), Movement (0 or 1). Use &quot;--&quot; for missing values.
        </p>
        </div>
        )}
      </div>

      {/* Treatment data - single row */}
      <div className="card p-4">
        <h4 className="font-semibold flex items-center gap-2 mb-3">
          <Pill className="h-4 w-4" />
          Add treatment data
        </h4>
        <form onSubmit={handleTreatmentSubmit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium mb-1">Date & Time</label>
            <input
              type="datetime-local"
              value={treatmentForm.recorded_at}
              onChange={(e) => setTreatmentForm((p) => ({ ...p, recorded_at: e.target.value }))}
              className="input-field w-full text-sm"
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs font-medium mb-1">Treatment / Medicine</label>
            <input
              type="text"
              list="treatment-options"
              value={treatmentForm.treatment_name}
              onChange={(e) => setTreatmentForm((p) => ({ ...p, treatment_name: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="Search or type..."
            />
            <datalist id="treatment-options">
              {medicineOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs font-medium mb-1">Quantity</label>
            <input
              type="text"
              value={treatmentForm.quantity}
              onChange={(e) => setTreatmentForm((p) => ({ ...p, quantity: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="e.g. 2 tabs"
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="block text-xs font-medium mb-1">Notes</label>
            <input
              type="text"
              value={treatmentForm.notes}
              onChange={(e) => setTreatmentForm((p) => ({ ...p, notes: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="Optional"
            />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium mb-1">Doctor Name</label>
            <input
              type="text"
              list="doctor-options"
              value={treatmentForm.doctor_name}
              onChange={(e) => setTreatmentForm((p) => ({ ...p, doctor_name: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="Search or type..."
            />
            <datalist id="doctor-options">
              {doctorOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>
          <button type="submit" disabled={savingTreatment || !treatmentForm.treatment_name?.trim()} className="btn-primary flex items-center gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            {savingTreatment ? "Saving…" : "Add Treatment"}
          </button>
        </form>
      </div>

      {/* Minimal From/To in one row (applies to all graphs) */}
      <div className="card p-4 ring-2 ring-rose-400/60 border-rose-400/50 bg-rose-500/10">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 shrink-0">
              <Calendar className="h-3.5 w-3.5 text-rose-400" aria-hidden />
              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="input-field text-xs py-1.5 px-2 w-[220px] min-w-[200px]"
                aria-label="From"
              />
              <span className="text-gray-500 text-xs">–</span>
              <input
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                className="input-field text-xs py-1.5 px-2 w-[220px] min-w-[200px]"
                aria-label="To"
              />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {TIME_RANGE_PRESETS.map((p) => {
                const isActive = activePresetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyTimePreset(p.days)}
                    className={`rounded-md px-2 py-1 text-xs border transition ${isActive ? "bg-rose-500/25 text-rose-200 border-rose-400/50" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 border-transparent"}`}
                    title={`Last ${p.label}`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleLoadChartData}
              disabled={loading}
              className="rounded-md bg-rose-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-60 flex items-center gap-1.5"
              title="Load chart data for the selected date range"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Load chart data
            </button>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => setChartsPerRow(1)}
              className={`p-1.5 rounded ${chartsPerRow === 1 ? "bg-rose-500/20 text-rose-300" : "text-gray-400 hover:bg-white/5"}`}
              title="1 per row"
              aria-label="One chart per row"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setChartsPerRow(2)}
              className={`p-1.5 rounded ${chartsPerRow === 2 ? "bg-rose-500/20 text-rose-300" : "text-gray-400 hover:bg-white/5"}`}
              title="2 per row"
              aria-label="Two charts per row"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="text-xs text-rose-200/90 font-mono mt-1">
          From: {formatDateRangeDisplay(toStartIso(startDateTime) || startDateTime)} — To: {formatDateRangeDisplay(toEndIso(endDateTime) || endDateTime)}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-8">Loading graph...</p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No monitoring data yet. Add readings manually or import from Excel.</p>
        ) : (
          <div className={`grid gap-4 ${chartsPerRow === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
            {PARAM_KEYS.filter((paramKey) => paramKey !== "movement").map((paramKey) => {
              const dataKey = paramKey === "movement" ? "movement" : paramKey;
              const highVal = highLimits[paramKey] != null && !Number.isNaN(Number(highLimits[paramKey])) ? Number(highLimits[paramKey]) : null;
              const lowVal = lowLimits[paramKey] != null && !Number.isNaN(Number(lowLimits[paramKey])) ? Number(lowLimits[paramKey]) : null;
              const isMovement = paramKey === "movement";

              const range = getChartRange(paramKey);
              const startIdx = Math.max(0, Math.floor((range.start / 100) * nData));
              const endIdx = Math.min(nData, Math.ceil((range.end / 100) * nData));
              const visibleFull = nData > 0 ? chartData.slice(startIdx, endIdx) : chartData;
              const visibleCount = visibleFull.length;
              const visibleData =
                visibleCount <= MAX_POINTS_PER_CHART
                  ? visibleFull
                  : (() => {
                      const step = visibleCount / MAX_POINTS_PER_CHART;
                      const out: typeof visibleFull = [];
                      for (let i = 0; i < MAX_POINTS_PER_CHART; i++) {
                        out.push(visibleFull[Math.min(Math.floor(i * step), visibleCount - 1)]);
                      }
                      return out;
                    })();

              const values = (chartData as any[])
                .map((d) => d[dataKey])
                .filter((v) => v != null && !Number.isNaN(Number(v)))
                .map(Number);
              const dataMin = values.length ? Math.min(...values) : null;
              const dataMax = values.length ? Math.max(...values) : null;

              let yDomain: [number, number];
              if (isMovement) {
                yDomain = [-1, 2];
              } else {
                let min = dataMin;
                let max = dataMax;
                if (lowVal != null) min = min == null ? lowVal : Math.min(min, lowVal);
                if (highVal != null) max = max == null ? highVal : Math.max(max, highVal);
                const defaultDom = DEFAULT_Y_DOMAIN[paramKey];
                if (min != null && max != null) {
                  yDomain = niceDomain(min, max, 0.15);
                } else {
                  yDomain = defaultDom ?? [0, 100];
                }
              }

              const handleChartWheel = (e: WheelEvent) => {
                e.stopPropagation();
                const delta = e.deltaY > 0 ? 5 : -5;
                const center = (range.start + range.end) / 2;
                const span = range.end - range.start;
                const newSpan = Math.max(5, Math.min(100, span + delta));
                const half = newSpan / 2;
                setChartRange(paramKey, Math.max(0, center - half), Math.min(100, center + half));
              };

              const handlePointerDown = (e: React.PointerEvent) => {
                // Don't capture when clicking treatment vertical lines so their onClick fires
                const t = e.target as SVGElement;
                const stroke = t?.getAttribute?.("stroke");
                const isTreatmentLine = (t?.tagName === "path" || t?.tagName === "line") && (stroke === TREATMENT_LINE_UNSELECTED || stroke === TREATMENT_LINE_SELECTED);
                if (isTreatmentLine) return;
                panRef.current = { paramKey, startX: e.clientX, startStart: range.start, startEnd: range.end };
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              };
              const handlePointerMove = (e: React.PointerEvent) => {
                if (!panRef.current || panRef.current.paramKey !== paramKey) return;
                const span = panRef.current.startEnd - panRef.current.startStart;
                const deltaPx = e.clientX - panRef.current.startX;
                const deltaPercent = (deltaPx / (typeof window !== "undefined" ? window.innerWidth : 400)) * 100;
                const newStart = Math.max(0, Math.min(100 - span, panRef.current.startStart + deltaPercent));
                setChartRange(paramKey, newStart, newStart + span);
                panRef.current = { ...panRef.current, startX: e.clientX, startStart: newStart, startEnd: newStart + span };
              };
              const handlePointerUp = (e: React.PointerEvent) => {
                if (panRef.current?.paramKey === paramKey) panRef.current = null;
                (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
              };

              const effectiveWidth = chartContainerWidth > 0 ? chartContainerWidth : "100%";

              const visibleMinT = visibleFull.length > 0 ? Math.min(...visibleFull.map((d: any) => d.timestamp)) : (toStartIso(startDateTime) ? new Date(toStartIso(startDateTime)!).getTime() : null);
              const visibleMaxT = visibleFull.length > 0 ? Math.max(...visibleFull.map((d: any) => d.timestamp)) : (toEndIso(endDateTime) ? new Date(toEndIso(endDateTime)!).getTime() : null);
              const treatmentsInRange = (visibleMinT != null && visibleMaxT != null)
                ? treatments.filter((t) => {
                    const ts = new Date(t.recorded_at).getTime();
                    return ts >= visibleMinT && ts <= visibleMaxT;
                  })
                : treatments;

              return (
                <div key={paramKey} className="rounded-lg border border-white/10 bg-gray-900/50 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <h5 className="text-sm font-semibold text-gray-100">
                        {paramKey === "movement" ? "Movement" : `${PARAM_LABELS[paramKey] || paramKey} vs Movement`}
                      </h5>
                      {treatmentsInRange.length > 0 && (
                        <span className="text-xs text-emerald-400/90 flex items-center gap-1">
                          <Pill className="w-4 h-4" /> {treatmentsInRange.length} treatment event{treatmentsInRange.length !== 1 ? "s" : ""} — vertical lines on graph (click for details)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-label={`Time range for ${paramKey}`}>
                      {TIME_RANGE_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyPresetForChart(paramKey, p.days)}
                          className="rounded-md bg-white/5 px-2.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/10 hover:text-gray-200 border border-transparent hover:border-white/10 transition"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div
                    ref={paramKey === PARAM_KEYS.filter((k) => k !== "movement")[0] ? chartContainerRef : undefined}
                    className="overflow-x-auto overflow-y-hidden w-full"
                    style={{ minHeight: 180 }}
                  >
                  <ChartWheelZoom
                    className="touch-none select-none w-full"
                    style={{ touchAction: "none", cursor: "grab", minWidth: 320 }}
                    onWheelZoom={handleChartWheel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  >
                    {typeof effectiveWidth === "number" ? (
                      <LineChart
                        width={effectiveWidth}
                        height={180}
                        data={visibleData}
                        margin={{ top: 12, right: 64, left: 44, bottom: 56 }}
                      >
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
                      {!isMovement && (
                        <YAxis
                          yAxisId="left"
                          width={48}
                          stroke="rgba(255,255,255,0.7)"
                          tick={{ fill: "rgba(255,255,255,0.95)", fontSize: 12 }}
                          domain={yDomain}
                          tickCount={6}
                          allowDataOverflow={false}
                          tickFormatter={(v) => (Number.isInteger(v) ? String(v) : String(Number(v).toFixed(1)))}
                        />
                      )}
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        width={48}
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                        domain={[-1, 2]}
                        tickCount={4}
                      />
                      <Tooltip
                        content={makeTooltip(paramKey)}
                        cursor={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: 1 }}
                        contentStyle={{ background: "transparent", border: "none", padding: 0, boxShadow: "none" }}
                        wrapperStyle={{ outline: "none" }}
                      />
                      {highVal != null && (
                        <ReferenceLine y={highVal} yAxisId={isMovement ? "right" : "left"} stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" label={{ value: `Limit 1 ${highVal}`, position: "right", offset: 24, fill: "#94a3b8", fontSize: 10 }} />
                      )}
                      {lowVal != null && (
                        <ReferenceLine y={lowVal} yAxisId={isMovement ? "right" : "left"} stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" label={{ value: `Limit 2 ${lowVal}`, position: "right", offset: 24, fill: "#94a3b8", fontSize: 10 }} />
                      )}
                      {treatmentsInRange.map((t) => {
                        const ts = new Date(t.recorded_at).getTime();
                        if (Number.isNaN(ts)) return null;
                        const isSelected = selectedTreatment?.id === t.id;
                        return (
                          <ReferenceLine
                            key={t.id ?? ts}
                            x={ts}
                            yAxisId={isMovement ? "right" : "left"}
                            stroke={isSelected ? TREATMENT_LINE_SELECTED : TREATMENT_LINE_UNSELECTED}
                            strokeWidth={4}
                            cursor="pointer"
                            onClick={() => setSelectedTreatment((prev: any) => (prev?.id === t.id ? null : t))}
                          />
                        );
                      })}
                      <Line
                        type="stepAfter"
                        dataKey="movement"
                        yAxisId="right"
                        stroke="#64748b"
                        strokeWidth={1}
                        dot={{ fill: "#64748b", r: 0.5 }}
                        name="Movement"
                        connectNulls
                      />
                      {!isMovement && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey={dataKey}
                          stroke="#e63946"
                          strokeWidth={2.5}
                          dot={{ fill: "#e63946", r: 0.5 }}
                          activeDot={{ r: 2 }}
                          name={PARAM_LABELS[paramKey] || paramKey}
                          connectNulls
                        />
                      )}
                    </LineChart>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart
                          data={visibleData}
                          margin={{ top: 12, right: 64, left: 44, bottom: 56 }}
                        >
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
                      {!isMovement && (
                        <YAxis
                          yAxisId="left"
                          width={48}
                          stroke="rgba(255,255,255,0.7)"
                          tick={{ fill: "rgba(255,255,255,0.95)", fontSize: 12 }}
                          domain={yDomain}
                          tickCount={6}
                          allowDataOverflow={false}
                          tickFormatter={(v) => (Number.isInteger(v) ? String(v) : String(Number(v).toFixed(1)))}
                        />
                      )}
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        width={48}
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                        domain={[-1, 2]}
                        tickCount={4}
                      />
                      <Tooltip
                        content={makeTooltip(paramKey)}
                        cursor={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: 1 }}
                        contentStyle={{ background: "transparent", border: "none", padding: 0, boxShadow: "none" }}
                        wrapperStyle={{ outline: "none" }}
                      />
                      {highVal != null && (
                        <ReferenceLine y={highVal} yAxisId={isMovement ? "right" : "left"} stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" label={{ value: `Limit 1 ${highVal}`, position: "right", offset: 24, fill: "#94a3b8", fontSize: 10 }} />
                      )}
                      {lowVal != null && (
                        <ReferenceLine y={lowVal} yAxisId={isMovement ? "right" : "left"} stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" label={{ value: `Limit 2 ${lowVal}`, position: "right", offset: 24, fill: "#94a3b8", fontSize: 10 }} />
                      )}
                      {treatmentsInRange.map((t) => {
                        const ts = new Date(t.recorded_at).getTime();
                        if (Number.isNaN(ts)) return null;
                        const isSelected = selectedTreatment?.id === t.id;
                        return (
                          <ReferenceLine
                            key={t.id ?? ts}
                            x={ts}
                            yAxisId={isMovement ? "right" : "left"}
                            stroke={isSelected ? TREATMENT_LINE_SELECTED : TREATMENT_LINE_UNSELECTED}
                            strokeWidth={4}
                            cursor="pointer"
                            onClick={() => setSelectedTreatment((prev: any) => (prev?.id === t.id ? null : t))}
                          />
                        );
                      })}
                      <Line
                        type="stepAfter"
                        dataKey="movement"
                        yAxisId="right"
                        stroke="#64748b"
                        strokeWidth={1}
                        dot={{ fill: "#64748b", r: 0.5 }}
                        name="Movement"
                        connectNulls
                      />
                      {!isMovement && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey={dataKey}
                          stroke="#e63946"
                          strokeWidth={2.5}
                          dot={{ fill: "#e63946", r: 0.5 }}
                          activeDot={{ r: 2 }}
                          name={PARAM_LABELS[paramKey] || paramKey}
                          connectNulls
                        />
                      )}
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </ChartWheelZoom>
                  </div>
                  {/* Selected treatment one-line summary: below graph, when a vertical line is clicked */}
                  {selectedTreatment && (
                    <p className="mt-2 text-sm font-medium" style={{ color: TREATMENT_LINE_SELECTED }}>
                      {formatTreatmentSummary(selectedTreatment)}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-gray-500">
                    {visibleCount > MAX_POINTS_PER_CHART ? `Showing ${MAX_POINTS_PER_CHART} of ${visibleCount} points — scroll to see more. ` : ""}
                    Wheel to zoom; drag to pan.
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {importing &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-gray-900/95 border border-white/10">
              <Loader2 className="h-12 w-12 text-rose-400 animate-spin" />
              <p className="text-lg font-medium text-white">
                {importStatus === "previewing" ? "Parsing file…" : "Importing data…"}
              </p>
              <p className="text-sm text-gray-400">
                {importStatus === "previewing"
                  ? "Template format uses direct parsing; other files use AI extraction"
                  : "Saving readings to database"}
              </p>
              <button
                onClick={handleCancelImportOperation}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default AdmissionMonitorView;
