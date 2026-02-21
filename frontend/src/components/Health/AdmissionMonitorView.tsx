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
  ChevronLeft,
  ChevronRight,
  Pill,
  RefreshCw,
  Trash2,
  Table2,
  ZoomIn,
  ZoomOut,
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
const TREATMENT_LINE_HIT_WIDTH = 24; // px each side for easier clicking

/** Custom shape for treatment ReferenceLine – adds wide invisible hit area so clicks work (Recharts ReferenceLine does not forward onClick). */
function TreatmentLineShape(props: {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  segment?: Array<{ x?: number; y?: number }>;
  stroke?: string;
  strokeWidth?: number;
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  treatment: any;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { x1, y1, x2, y2, segment, stroke, strokeWidth, viewBox, treatment, isSelected, onSelect } = props;
  let cx: number;
  let top: number;
  let bottom: number;
  if (Array.isArray(segment) && segment.length >= 2) {
    const [p1, p2] = segment;
    cx = (p1.x ?? p2.x) ?? 0;
    const py1 = p1.y ?? 0;
    const py2 = p2.y ?? 0;
    top = Math.min(py1, py2);
    bottom = Math.max(py1, py2);
  } else {
    cx = x1 ?? x2 ?? viewBox?.x ?? 0;
    top = Math.min(y1 ?? 0, y2 ?? 0);
    bottom = Math.max(y1 ?? 0, y2 ?? 0);
  }
  const chartHeight = viewBox?.height ?? 180;
  const h = bottom - top > 0 ? bottom - top : chartHeight;
  const lineTop = bottom - top > 0 ? top : 0;
  const lineBottom = bottom - top > 0 ? bottom : chartHeight;
  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      style={{ cursor: "pointer" }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      aria-label={`Treatment: ${treatment?.treatment_name || "Treatment"} at ${treatment?.recorded_at ? new Date(treatment.recorded_at).toLocaleString() : ""}`}
    >
      <rect
        x={cx - TREATMENT_LINE_HIT_WIDTH / 2}
        y={lineTop}
        width={TREATMENT_LINE_HIT_WIDTH}
        height={h}
        fill="transparent"
      />
      <line
        x1={cx}
        y1={lineTop}
        x2={cx}
        y2={lineBottom}
        stroke={stroke ?? (isSelected ? TREATMENT_LINE_SELECTED : TREATMENT_LINE_UNSELECTED)}
        strokeWidth={strokeWidth ?? 4}
      />
    </g>
  );
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

/** Aggregated treatment text for table (no timestamp) */
function formatTreatmentDetails(t: any): string {
  if (!t) return "";
  const name = t.treatment_name?.trim() || "Treatment";
  const qty = t.quantity?.trim();
  const doctor = t.doctor_name?.trim();
  const notes = t.notes?.trim();
  const qtyPart = qty ? ` ${qty}` : "";
  const byPart = doctor ? ` given by ${doctor}` : "";
  const notesPart = notes ? ` — ${notes}` : "";
  return `${name}${qtyPart}${byPart}${notesPart}`;
}

const TIME_RANGE_PRESETS = [
  { id: "1D", label: "1D", days: 1 },
  { id: "1W", label: "1W", days: 7 },
  { id: "1M", label: "1M", days: 30 },
  { id: "3M", label: "3M", days: 90 },
  { id: "1Y", label: "1Y", days: 365 },
] as const;

const MAX_POINTS_PER_CHART = 300;

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
    d.setDate(d.getDate() - 90);
    return toDatetimeLocal(d);
  });
  const [endDateTime, setEndDateTime] = useState(() => toDatetimeLocal(new Date()));
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
  const [chartSelectedPreset, setChartSelectedPreset] = useState<Record<string, string>>({});
  const [chartDataOverride, setChartDataOverride] = useState<Record<string, { data: any[]; treatments: any[] }>>({});
  const [chartLoading, setChartLoading] = useState<Record<string, boolean>>({});
  const [boxSelect, setBoxSelect] = useState<{ paramKey: string; startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const boxSelectPendingRef = useRef<{ paramKey: string; startX: number; startY: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "previewing" | "processing">("idle");
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [usedTemplateFormat, setUsedTemplateFormat] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number; total: number; summary: string } | null>(null);
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
  const [pageSize, setPageSize] = useState<10 | 50 | 100 | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [selectedTreatmentForScroll, setSelectedTreatmentForScroll] = useState<string | null>(null);
  const rawDataScrollRef = useRef<HTMLDivElement>(null);
  const rawDataHeaderRef = useRef<HTMLTableSectionElement>(null);

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
    setChartDataOverride({});
    const spanDays = (new Date(end).getTime() - new Date(start).getTime()) / (24 * 60 * 60 * 1000);
    const match = TIME_RANGE_PRESETS.find((p) => Math.abs(spanDays - p.days) < 2);
    if (match) {
      const preset: Record<string, string> = {};
      PARAM_KEYS.filter((k) => k !== "movement").forEach((k) => {
        preset[k] = match.id;
      });
      setChartSelectedPreset(preset);
    } else {
      setChartSelectedPreset({});
    }
  }, [startDateTime, endDateTime, admission?.id, selectedClient]);

  useEffect(() => {
    setReadings([]);
    setTreatments([]);
    setSelectedTreatment(null);
    setSelectedIds(new Set());
    setChartDataOverride({});
    setChartSelectedPreset({});
  }, [admission?.id, selectedClient]);

  useEffect(() => {
    if (!admission?.id) return;
    const start = toStartIso(startDateTime);
    const end = toEndIso(endDateTime);
    if (!start || !end) return;
    loadReadings(start, end);
    loadTreatments(start, end);
    setChartViewRanges({});
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
    const match = TIME_RANGE_PRESETS.find((p) => Math.abs(spanDays - p.days) < 2);
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

  const applyPresetForChart = useCallback(
    async (paramKey: string, days: number, presetId?: string) => {
      const id = presetId ?? TIME_RANGE_PRESETS.find((p) => p.days === days)?.id;
      if (id) setChartSelectedPreset((prev) => ({ ...prev, [paramKey]: id }));
      setChartLoading((prev) => ({ ...prev, [paramKey]: true }));
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startIso = startDate.toISOString();
        const endIso = endDate.toISOString();
        const [readingsRes, treatmentsRes] = await Promise.all([
          healthApi.getMonitoringReadings(admission.id, selectedClient || undefined, startIso, endIso),
          healthApi.getAdmissionTreatments(admission.id, selectedClient || undefined, startIso, endIso),
        ]);
        const rList = Array.isArray(readingsRes?.readings) ? readingsRes.readings : [];
        const tList = Array.isArray(treatmentsRes?.treatments) ? treatmentsRes.treatments : [];
        setChartDataOverride((prev) => ({
          ...prev,
          [paramKey]: { data: rList, treatments: tList },
        }));
        setChartRange(paramKey, 0, 100);
      } catch (err) {
        console.error("Failed to load chart data:", err);
      } finally {
        setChartLoading((prev) => ({ ...prev, [paramKey]: false }));
      }
    },
    [admission.id, selectedClient]
  );


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
    setImportSummary(null);
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
    setImportSummary(null);
    try {
      const res = await healthApi.importMonitoringReadings(
        admission.id,
        importFile,
        selectedClient || undefined,
        importAbortRef.current.signal
      );
      setImportSummary({
        imported: res?.imported ?? 0,
        skipped: res?.skipped ?? 0,
        total: res?.total ?? importPreview.length,
        summary: res?.summary ?? `Imported ${res?.imported ?? 0} record(s).`,
      });
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
    setImportSummary(null);
  };

  const handleCancelImport = () => {
    if (importing) handleCancelImportOperation();
    else {
      setImportPreview(null);
      setImportFile(null);
      setUsedTemplateFormat(false);
      setImportSummary(null);
    }
  };

  const sortedTreatmentsForDropdown = useMemo(() => {
    return [...(treatments || [])].sort((a, b) => {
      const ta = new Date(a.recorded_at).getTime();
      const tb = new Date(b.recorded_at).getTime();
      return tb - ta;
    });
  }, [treatments]);

  useEffect(() => {
    if (!selectedTreatmentForScroll || !rawDataScrollRef.current) return;
    const container = rawDataScrollRef.current;
    const row = container.querySelector(`[data-treatment-id="t-${selectedTreatmentForScroll}"]`);
    if (row) {
      const rowRect = row.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const headerHeight = rawDataHeaderRef.current?.clientHeight ?? 44;
      const targetTop = containerRect.top + headerHeight;
      const scrollDelta = rowRect.top - targetTop;
      container.scrollTop += scrollDelta;
    }
  }, [selectedTreatmentForScroll]);

  const rawDataItems = useMemo(() => {
    const rList = (readings || []).map((r) => ({ type: "reading" as const, ...r }));
    const tList = (treatments || []).map((t) => ({ type: "treatment" as const, ...t }));
    const combined = [...rList, ...tList].sort((a, b) => {
      const ta = new Date(a.recorded_at).getTime();
      const tb = new Date(b.recorded_at).getTime();
      return ta - tb;
    });
    return combined;
  }, [readings, treatments]);

  const paginatedReadings = useMemo(() => {
    const list = rawDataItems;
    const size = pageSize === "all" ? list.length : Math.max(1, pageSize);
    const total = list.length;
    const totalPages = size > 0 ? Math.ceil(total / size) : 1;
    const page = Math.max(1, Math.min(currentPage, totalPages));
    const start = (page - 1) * size;
    const slice = list.slice(start, start + size);
    return { slice, total, totalPages, page };
  }, [rawDataItems, pageSize, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, rawDataItems.length]);

  const toggleSelectAll = () => {
    const { slice } = paginatedReadings;
    const readingRows = slice.filter((r) => r.type === "reading" && r.id);
    const allSelected = readingRows.length > 0 && readingRows.every((r) => selectedIds.has(String(r.id)));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        readingRows.forEach((r) => next.delete(String(r.id)));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        readingRows.forEach((r) => next.add(String(r.id)));
        return next;
      });
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

  const handleDeleteOne = async (id: string) => {
    if (!confirm("Delete this record?")) return;
    setDeleting(true);
    try {
      await healthApi.deleteMonitoringReadings(admission.id, { ids: [id] }, selectedClient || undefined);
      setReadings((prev) => prev.filter((r) => String(r.id) !== id));
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
      await healthApi.deleteMonitoringReadings(admission.id, { ids }, selectedClient || undefined);
      setReadings((prev) => prev.filter((r) => !ids.includes(String(r.id))));
      setSelectedIds(new Set());
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    const start = toStartIso(startDateTime);
    const end = toEndIso(endDateTime);
    if (!confirm(`Delete all ${readings.length} records in the current date range? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await healthApi.deleteMonitoringReadings(
        admission.id,
        { deleteAll: true, start_date: start, end_date: end },
        selectedClient || undefined
      );
      setReadings([]);
      setSelectedIds(new Set());
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete.");
    } finally {
      setDeleting(false);
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
      <div className="flex items-start gap-3">
        <button
          onClick={onBack}
          className="shrink-0 flex items-center gap-1.5 text-gray-400 hover:text-gray-200 mt-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back</span>
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate">{admission.institution_name}</h3>
          <p className="text-xs text-gray-400">
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
          className="flex items-center gap-2 w-full text-left mb-0 cursor-pointer"
        >
          <h4 className="font-semibold flex items-center gap-2 flex-1 min-w-0">
            <Activity className="h-4 w-4 shrink-0" />
            <span className="truncate">Add monitoring data</span>
            {addDataExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
          </h4>
          <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="btn-secondary flex items-center gap-1.5 text-xs"
              title="Download CSV template. Fill in Excel, save as CSV, then import. Dates stay correct."
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{downloadingTemplate ? "Downloading…" : "Download Template"}</span>
              <span className="sm:hidden">{downloadingTemplate ? "…" : "Template"}</span>
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
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{importing ? (importStatus === "processing" ? "Importing…" : "Extracting…") : "Import Excel/CSV"}</span>
              <span className="sm:hidden">{importing ? "…" : "Import"}</span>
            </button>
          </div>
        </div>
        {addDataExpanded && (
        <div className="mt-4">
        {importSummary != null && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-400/30 import-summary-box">
            <h5 className="font-medium text-emerald-200 mb-2">Import complete</h5>
            <p className="text-sm mb-2">{importSummary.summary}</p>
            <p className="text-xs text-gray-400">
              Imported: {importSummary.imported} · Skipped (duplicates): {importSummary.skipped} · Total in file: {importSummary.total}
            </p>
          </div>
        )}
        {importPreview != null && (
          <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
            <h5 className="font-medium mb-2">
              Import preview — {importPreview.length} record{importPreview.length !== 1 ? "s" : ""} to import
            </h5>
            {usedTemplateFormat && (
              <p className="text-xs text-emerald-400/90 mb-2">Template format detected — dates preserved</p>
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
                {importing ? `Importing ${importPreview.length} records…` : `Import ${importPreview.length} records`}
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
          Excel/CSV: Supports Timestamp, HeartRate (BPM), BreathRate (RR), SpO2 (%), Temperature (°F), Systolic/Diastolic BP (mmHg), Movement (0 or 1). Use &quot;--&quot; for missing values. Duplicate records (same datetime) are skipped.
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
        <form onSubmit={handleTreatmentSubmit} className="grid grid-cols-1 landscape:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Date & Time</label>
            <input
              type="datetime-local"
              value={treatmentForm.recorded_at}
              onChange={(e) => setTreatmentForm((p) => ({ ...p, recorded_at: e.target.value }))}
              className="input-field w-full text-sm"
            />
          </div>
          <div className="landscape:col-span-2">
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
          <div>
            <label className="block text-xs font-medium mb-1">Quantity</label>
            <input
              type="text"
              value={treatmentForm.quantity}
              onChange={(e) => setTreatmentForm((p) => ({ ...p, quantity: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="e.g. 2 tabs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Notes</label>
            <input
              type="text"
              value={treatmentForm.notes}
              onChange={(e) => setTreatmentForm((p) => ({ ...p, notes: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="Optional"
            />
          </div>
          <div>
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
          <div className="flex items-end">
            <button type="submit" disabled={savingTreatment || !treatmentForm.treatment_name?.trim()} className="btn-primary flex items-center gap-2 w-full justify-center">
              <Plus className="h-4 w-4" />
              {savingTreatment ? "Saving…" : "Add Treatment"}
            </button>
          </div>
        </form>
      </div>

      {/* Minimal From/To in one row (applies to all graphs) */}
      <div className="card p-4 ring-2 ring-rose-400/60 border-rose-400/50 bg-rose-500/10">
        <div className="space-y-2 mb-2">
          <div className="flex flex-col gap-2 portrait:w-full">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-rose-400 shrink-0" aria-hidden />
              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="input-field text-xs py-1.5 px-2 flex-1 min-w-0"
                aria-label="From"
              />
              <span className="text-gray-500 text-xs shrink-0">–</span>
              <input
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                className="input-field text-xs py-1.5 px-2 flex-1 min-w-0"
                aria-label="To"
              />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {TIME_RANGE_PRESETS.map((p) => {
                const isActive = activePresetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyTimePreset(p.days)}
                    className={`sub-tab rounded-md px-2 py-1 text-xs border transition ${isActive ? "sub-tab--active bg-rose-500/25 text-rose-200 border-rose-400/50" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 border-transparent"}`}
                    title={`Last ${p.label}`}
                  >
                    {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleLoadChartData}
                disabled={loading}
                className="rounded-md bg-rose-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-60 flex items-center gap-1.5 ml-auto"
                title="Load chart data for the selected date range"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Load chart data
              </button>
            </div>
          </div>
          {/* Layout toggle – only in landscape */}
          <div className="hidden landscape:flex items-center gap-1">
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
        <div className="text-xs font-mono mt-1" style={{ color: 'var(--foreground-secondary)' }}>
          From: {formatDateRangeDisplay(toStartIso(startDateTime) || startDateTime)} — To: {formatDateRangeDisplay(toEndIso(endDateTime) || endDateTime)}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-8">Loading graph...</p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No monitoring data yet. Add readings manually or import from Excel.</p>
        ) : (
          <div className={`grid gap-4 grid-cols-1 ${chartsPerRow === 2 ? "landscape:md:grid-cols-2" : ""}`}>
            {PARAM_KEYS.filter((paramKey) => paramKey !== "movement").map((paramKey) => {
              const dataKey = paramKey === "movement" ? "movement" : paramKey;
              const highVal = highLimits[paramKey] != null && !Number.isNaN(Number(highLimits[paramKey])) ? Number(highLimits[paramKey]) : null;
              const lowVal = lowLimits[paramKey] != null && !Number.isNaN(Number(lowLimits[paramKey])) ? Number(lowLimits[paramKey]) : null;
              const isMovement = paramKey === "movement";

              const chartDataForParam =
                chartDataOverride[paramKey] != null
                  ? (chartDataOverride[paramKey].data || []).map((r: any) => ({
                      ...r,
                      time: formatTime(r.recorded_at),
                      timestamp: new Date(r.recorded_at).getTime(),
                    }))
                  : chartData;
              const treatmentsForParam = chartDataOverride[paramKey]?.treatments ?? treatments;
              const nDataForParam = chartDataForParam.length;

              const range = getChartRange(paramKey);
              const startIdx = Math.max(0, Math.floor((range.start / 100) * nDataForParam));
              const endIdx = Math.min(nDataForParam, Math.ceil((range.end / 100) * nDataForParam));
              const visibleFull = nDataForParam > 0 ? chartDataForParam.slice(startIdx, endIdx) : chartDataForParam;
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

              const values = (chartDataForParam as any[])
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

              const handleZoomIn = () => {
                const center = (range.start + range.end) / 2;
                const span = range.end - range.start;
                const newSpan = Math.max(5, span - 8);
                const half = newSpan / 2;
                setChartRange(paramKey, Math.max(0, center - half), Math.min(100, center + half));
              };

              const handleZoomOut = () => {
                const center = (range.start + range.end) / 2;
                const span = range.end - range.start;
                const newSpan = Math.min(100, span + 8);
                const half = newSpan / 2;
                setChartRange(paramKey, Math.max(0, center - half), Math.min(100, center + half));
              };

              const handlePanLeft = () => {
                const span = range.end - range.start;
                const step = Math.min(10, span * 0.2);
                const newStart = Math.max(0, range.start - step);
                const newEnd = Math.min(100, range.end - step);
                setChartRange(paramKey, newStart, newEnd);
              };

              const handlePanRight = () => {
                const span = range.end - range.start;
                const step = Math.min(10, span * 0.2);
                const newStart = Math.max(0, range.start + step);
                const newEnd = Math.min(100, range.end + step);
                setChartRange(paramKey, newStart, newEnd);
              };

              const MARGIN_LEFT = 44;
              const MARGIN_RIGHT = 64;
              const MARGIN_TOP = 12;
              const MARGIN_BOTTOM = 40;

              const handleBoxSelectStart = (e: React.PointerEvent) => {
                if (chartLoading[paramKey]) return;
                const el = e.currentTarget as HTMLElement;
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                boxSelectPendingRef.current = { paramKey, startX: x, startY: y };
                // Do NOT setPointerCapture here – it would steal pointer events from treatment line clicks.
                // Capture only when user actually drags (see handleBoxSelectMove).
              };

              const handleBoxSelectMove = (e: React.PointerEvent) => {
                const pending = boxSelectPendingRef.current;
                if (pending?.paramKey !== paramKey) return;
                const el = e.currentTarget as HTMLElement;
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const dx = Math.abs(x - pending.startX);
                if (dx >= 5 && !boxSelect) {
                  (el as any).setPointerCapture?.(e.pointerId);
                  setBoxSelect({
                    paramKey: pending.paramKey,
                    startX: pending.startX,
                    startY: pending.startY,
                    currentX: x,
                    currentY: y,
                  });
                } else if (boxSelect?.paramKey === paramKey) {
                  setBoxSelect((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null));
                }
              };

              const handleBoxSelectEnd = (e: React.PointerEvent) => {
                const pending = boxSelectPendingRef.current?.paramKey === paramKey ? boxSelectPendingRef.current : null;
                const sel = boxSelect?.paramKey === paramKey ? boxSelect : null;
                boxSelectPendingRef.current = null;
                if (!sel && !pending) return;
                const el = e.currentTarget as HTMLElement;
                const rect = el.getBoundingClientRect();
                (el as any).releasePointerCapture?.(e.pointerId);
                const endX = e.clientX - rect.left;
                const startX = sel ? sel.startX : (pending?.startX ?? endX);
                const plotWidth = rect.width - MARGIN_LEFT - MARGIN_RIGHT;
                const minSelWidth = 30;
                const x1 = Math.min(startX, endX);
                const x2 = Math.max(startX, endX);
                if (x2 - x1 < minSelWidth) {
                  setBoxSelect(null);
                  return;
                }
                const relStart = Math.max(0, Math.min(1, (x1 - MARGIN_LEFT) / plotWidth));
                const relEnd = Math.max(0, Math.min(1, (x2 - MARGIN_LEFT) / plotWidth));
                const span = relEnd - relStart;
                if (span < 0.02) {
                  setBoxSelect(null);
                  return;
                }
                const visSpan = range.end - range.start;
                const newStart = range.start + relStart * visSpan;
                const newEnd = range.start + relEnd * visSpan;
                setChartRange(paramKey, newStart, newEnd);
                setBoxSelect(null);
              };

              const effectiveWidth = chartContainerWidth > 0 ? chartContainerWidth : "100%";

              const visibleMinT = visibleFull.length > 0 ? Math.min(...visibleFull.map((d: any) => d.timestamp)) : (toStartIso(startDateTime) ? new Date(toStartIso(startDateTime)!).getTime() : null);
              const visibleMaxT = visibleFull.length > 0 ? Math.max(...visibleFull.map((d: any) => d.timestamp)) : (toEndIso(endDateTime) ? new Date(toEndIso(endDateTime)!).getTime() : null);
              const treatmentsInRange = (visibleMinT != null && visibleMaxT != null)
                ? treatmentsForParam.filter((t: any) => {
                    const ts = new Date(t.recorded_at).getTime();
                    return ts >= visibleMinT && ts <= visibleMaxT;
                  })
                : treatments;

              return (
                <div key={paramKey} className="rounded-lg border border-white/10 bg-gray-900/50 p-3 sm:p-4 monitor-chart-card">
                  {/* Portrait: rotate hint */}
                  <div className="portrait:block hidden text-center text-xs text-gray-400 mb-2 py-1 rounded bg-white/5 border border-white/10">
                    Rotate phone to landscape for better graph visualization
                  </div>
                  <div className="mb-2 flex flex-col landscape:flex-row landscape:items-center landscape:justify-between gap-1">
                    <div className="flex flex-col landscape:flex-row landscape:items-center gap-1 landscape:gap-3">
                      <h5 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {paramKey === "movement" ? "Movement" : `${PARAM_LABELS[paramKey] || paramKey} vs Movement`}
                      </h5>
                      {treatmentsInRange.length > 0 && (
                        <span className="text-xs text-emerald-400/90 flex items-center gap-1">
                          <Pill className="w-3.5 h-3.5" /> {treatmentsInRange.length} treatment{treatmentsInRange.length !== 1 ? "s" : ""} — tap lines for details
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap" role="group" aria-label={`Time range and zoom for ${paramKey}`}>
                      {TIME_RANGE_PRESETS.map((p) => {
                        const isChartPresetActive = chartSelectedPreset[paramKey] === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => applyPresetForChart(paramKey, p.days, p.id)}
                            disabled={chartLoading[paramKey]}
                            className={`rounded-md px-2.5 py-1.5 text-xs font-medium border transition ${
                              isChartPresetActive
                                ? "bg-rose-500/30 text-rose-200 border-rose-400/60"
                                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 border-transparent hover:border-white/10"
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                      {chartDataOverride[paramKey] != null && (
                        <button
                          type="button"
                          onClick={() => {
                            setChartDataOverride((prev) => {
                              const next = { ...prev };
                              delete next[paramKey];
                              return next;
                            });
                            setChartRange(paramKey, 0, 100);
                          }}
                          className="rounded-md bg-white/5 px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-gray-200"
                          title="Reset to global range"
                          aria-label="Reset to global"
                        >
                          Reset
                        </button>
                      )}
                      <span className="text-gray-500 mx-0.5">|</span>
                      <button
                        type="button"
                        onClick={handleZoomIn}
                        className="rounded-md bg-white/5 p-1.5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                        title="Zoom in"
                        aria-label="Zoom in"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomOut}
                        className="rounded-md bg-white/5 p-1.5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                        title="Zoom out"
                        aria-label="Zoom out"
                      >
                        <ZoomOut className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handlePanLeft}
                        className="rounded-md bg-white/5 p-1.5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                        title="Pan left"
                        aria-label="Pan left"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handlePanRight}
                        className="rounded-md bg-white/5 p-1.5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                        title="Pan right"
                        aria-label="Pan right"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div
                    ref={paramKey === PARAM_KEYS.filter((k) => k !== "movement")[0] ? chartContainerRef : undefined}
                    className="overflow-x-auto overflow-y-hidden w-full relative select-none"
                    style={{ minHeight: 180 }}
                    onPointerDown={handleBoxSelectStart}
                    onPointerMove={handleBoxSelectMove}
                    onPointerUp={handleBoxSelectEnd}
                    onPointerLeave={handleBoxSelectEnd}
                  >
                  {boxSelect?.paramKey === paramKey && (
                    <div
                      className="absolute pointer-events-none border-2 border-dashed border-rose-400 bg-rose-500/20 z-[5]"
                      style={{
                        left: Math.min(boxSelect.startX, boxSelect.currentX),
                        top: 0,
                        width: Math.abs(boxSelect.currentX - boxSelect.startX),
                        height: 180,
                      }}
                    />
                  )}
                  {chartLoading[paramKey] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 z-10 rounded">
                      <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
                    </div>
                  )}
                  <div className="w-full" style={{ minWidth: 320 }}>
                    {typeof effectiveWidth === "number" ? (
                      <LineChart
                        width={effectiveWidth}
                        height={180}
                        data={visibleData}
                        margin={{ top: 12, right: 64, left: 44, bottom: 40 }}
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
                            shape={(props: any) => (
                              <TreatmentLineShape
                                {...props}
                                treatment={t}
                                isSelected={!!isSelected}
                                onSelect={() => setSelectedTreatment((prev: any) => (prev?.id === t.id ? null : t))}
                              />
                            )}
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
                        connectNulls={false}
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
                          connectNulls={false}
                        />
                      )}
                    </LineChart>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart
                          data={visibleData}
                          margin={{ top: 12, right: 64, left: 44, bottom: 40 }}
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
                            shape={(props: any) => (
                              <TreatmentLineShape
                                {...props}
                                treatment={t}
                                isSelected={!!isSelected}
                                onSelect={() => setSelectedTreatment((prev: any) => (prev?.id === t.id ? null : t))}
                              />
                            )}
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
                        connectNulls={false}
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
                          connectNulls={false}
                        />
                      )}
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  </div>
                  {/* Selected treatment one-line summary: below graph, when a vertical line is clicked */}
                  {selectedTreatment && (
                    <p className="mt-1 text-sm font-medium" style={{ color: TREATMENT_LINE_SELECTED }}>
                      {formatTreatmentSummary(selectedTreatment)}
                    </p>
                  )}
                  <p className={`text-xs ${selectedTreatment ? "mt-0.5" : "mt-1.5"}`} style={{ color: 'var(--muted)' }}>
                    {visibleCount > MAX_POINTS_PER_CHART ? `Showing ${MAX_POINTS_PER_CHART} of ${visibleCount} points — scroll to see more. ` : ""}
                    Use +/− to zoom; arrows to pan; drag to select area and zoom.
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Raw data table */}
      <div className="card p-4">
        <h4 className="font-semibold flex items-center gap-2 mb-4">
          <Table2 className="h-4 w-4" />
          Raw data
        </h4>
        {rawDataItems.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No records. Load chart data or add readings.</p>
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
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Treatment:</span>
                <select
                  value={selectedTreatmentForScroll || ""}
                  onChange={(e) => setSelectedTreatmentForScroll(e.target.value || null)}
                  className="input-field text-sm py-1.5 px-2 min-w-[200px] max-w-[320px]"
                >
                  <option value="">— Select to scroll —</option>
                  {sortedTreatmentsForDropdown.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatTime(t.recorded_at)} — {formatTreatmentDetails(t)}
                    </option>
                  ))}
                </select>
              </div>
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
                  className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete all
                </button>
              </div>
            </div>
            {/* Landscape: table view */}
            <div className="hidden landscape:block rounded-lg border border-white/10 overflow-hidden">
              <div ref={rawDataScrollRef} className="overflow-auto max-h-[400px]">
                <table className="vitals-table w-full text-sm">
                  <thead ref={rawDataHeaderRef} className="sticky top-0 bg-gray-900/95 z-10 border-b border-white/10">
                    <tr>
                      <th className="text-left p-2 w-8">
                        <input
                          type="checkbox"
                          checked={
                            paginatedReadings.slice.filter((r) => r.type === "reading").length > 0 &&
                            paginatedReadings.slice
                              .filter((r) => r.type === "reading" && r.id)
                              .every((r) => selectedIds.has(String(r.id)))
                          }
                          onChange={toggleSelectAll}
                          aria-label="Select all readings on page"
                          className="rounded"
                        />
                      </th>
                      <th className="text-left p-2 font-medium">Date / Time</th>
                      <th className="text-left p-2 font-medium">HR</th>
                      <th className="text-left p-2 font-medium">RR</th>
                      <th className="text-left p-2 font-medium">SpO2</th>
                      <th className="text-left p-2 font-medium">Temp</th>
                      <th className="text-left p-2 font-medium">Syst</th>
                      <th className="text-left p-2 font-medium">Diast</th>
                      <th className="text-left p-2 font-medium">Mov</th>
                      <th className="text-left p-2 font-medium min-w-[180px]">Treatment</th>
                      <th className="text-left p-2 w-12 font-medium">Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedReadings.slice.map((row) => {
                      const isTreatment = row.type === "treatment";
                      const key = isTreatment ? `t-${row.id}` : `r-${row.id}`;
                      return (
                        <tr
                          key={key}
                          data-treatment-id={isTreatment ? `t-${row.id}` : undefined}
                          className={`border-b border-white/5 hover:bg-white/5 ${isTreatment ? "bg-emerald-500/5" : ""}`}
                        >
                          <td className="p-2">
                            {!isTreatment && row.id && (
                              <input type="checkbox" checked={selectedIds.has(String(row.id))} onChange={() => toggleSelect(String(row.id))} aria-label={`Select row ${row.id}`} className="rounded" />
                            )}
                          </td>
                          <td className="p-2 text-gray-400 whitespace-nowrap">{formatTime(row.recorded_at)}</td>
                          <td className="p-2">{isTreatment ? "—" : (row.heart_rate ?? "—")}</td>
                          <td className="p-2">{isTreatment ? "—" : (row.breath_rate ?? "—")}</td>
                          <td className="p-2">{isTreatment ? "—" : (row.spo2 ?? "—")}</td>
                          <td className="p-2">{isTreatment ? "—" : (row.temperature ?? "—")}</td>
                          <td className="p-2">{isTreatment ? "—" : (row.systolic_bp ?? "—")}</td>
                          <td className="p-2">{isTreatment ? "—" : (row.diastolic_bp ?? "—")}</td>
                          <td className="p-2">{isTreatment ? "—" : (row.movement ?? "—")}</td>
                          <td className="p-2 text-emerald-200/90">{isTreatment ? formatTreatmentDetails(row) : "—"}</td>
                          <td className="p-2">
                            {!isTreatment && row.id && (
                              <button type="button" onClick={() => handleDeleteOne(String(row.id))} disabled={deleting} className="p-1 rounded text-red-400 hover:bg-red-500/20 disabled:opacity-50" title="Delete this record" aria-label="Delete record"><Trash2 className="h-3.5 w-3.5" /></button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Portrait: card view */}
            <div className="landscape:hidden space-y-2 max-h-[500px] overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={
                    paginatedReadings.slice.filter((r) => r.type === "reading").length > 0 &&
                    paginatedReadings.slice.filter((r) => r.type === "reading" && r.id).every((r) => selectedIds.has(String(r.id)))
                  }
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                  className="rounded"
                />
                <span className="text-xs text-gray-400">Select all</span>
              </div>
              {paginatedReadings.slice.map((row) => {
                const isTreatment = row.type === "treatment";
                const key = isTreatment ? `t-${row.id}` : `r-${row.id}`;
                return (
                  <div
                    key={key}
                    data-treatment-id={isTreatment ? `t-${row.id}` : undefined}
                    className={`rounded-lg border p-3 today-list-item ${isTreatment ? "border-emerald-400/30 bg-emerald-500/5" : "border-white/10 bg-white/5"}`}
                  >
                    <div className="flex items-start gap-2">
                      {!isTreatment && row.id && (
                        <input type="checkbox" checked={selectedIds.has(String(row.id))} onChange={() => toggleSelect(String(row.id))} className="rounded mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs text-gray-400">{formatTime(row.recorded_at)}</span>
                          {!isTreatment && row.id && (
                            <button type="button" onClick={() => handleDeleteOne(String(row.id))} disabled={deleting} className="p-1 rounded text-red-400 hover:bg-red-500/20 disabled:opacity-50 shrink-0" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
                        </div>
                        {isTreatment ? (
                          <p className="text-sm text-emerald-300 font-medium">{formatTreatmentDetails(row)}</p>
                        ) : (
                          <div className="grid grid-cols-4 gap-x-3 gap-y-1 text-xs">
                            <div><span className="text-gray-400">HR</span> <span className="font-medium">{row.heart_rate ?? "—"}</span></div>
                            <div><span className="text-gray-400">RR</span> <span className="font-medium">{row.breath_rate ?? "—"}</span></div>
                            <div><span className="text-gray-400">SpO2</span> <span className="font-medium">{row.spo2 ?? "—"}</span></div>
                            <div><span className="text-gray-400">Temp</span> <span className="font-medium">{row.temperature ?? "—"}</span></div>
                            <div><span className="text-gray-400">Syst</span> <span className="font-medium">{row.systolic_bp ?? "—"}</span></div>
                            <div><span className="text-gray-400">Diast</span> <span className="font-medium">{row.diastolic_bp ?? "—"}</span></div>
                            <div><span className="text-gray-400">Mov</span> <span className="font-medium">{row.movement ?? "—"}</span></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {pageSize !== "all" && paginatedReadings.totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 mt-3">
                <p className="text-xs text-gray-400">
                  Showing {(paginatedReadings.page - 1) * (pageSize as number) + 1}–
                  {Math.min(paginatedReadings.page * (pageSize as number), paginatedReadings.total)} of {paginatedReadings.total}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={paginatedReadings.page <= 1}
                    className="btn-secondary text-sm py-1 px-2 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-400 px-2">
                    Page {paginatedReadings.page} / {paginatedReadings.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(paginatedReadings.totalPages, p + 1))}
                    disabled={paginatedReadings.page >= paginatedReadings.totalPages}
                    className="btn-secondary text-sm py-1 px-2 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {importing &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
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
