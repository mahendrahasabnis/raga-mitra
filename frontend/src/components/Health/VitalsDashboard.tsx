import React, { useState, useEffect, useRef } from "react";
import { Activity, Plus, Filter, TrendingUp, TrendingDown, Minus, Calendar, FileText, ExternalLink } from "lucide-react";
import { healthApi } from "../../services/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import VitalsForm from "./VitalsForm";
import SelectDropdown from "../UI/SelectDropdown";

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
  const [showForm, setShowForm] = useState(false);
  const [selectedParameter, setSelectedParameter] = useState<string>("");
  const [graphData, setGraphData] = useState<any[]>([]);
  const [trends, setTrends] = useState<any>({});
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loadingGraph, setLoadingGraph] = useState(false);
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  const uniqueParameters = Array.from(
    new Set(vitals.map((v) => (v.parameter_name ?? v.parameter ?? v.name ?? "").trim()).filter(Boolean))
  );

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

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
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

  const handleOpenReport = async (reportId: string) => {
    setOpeningReportId(reportId);
    try {
      const url = await healthApi.getReportFileUrl(reportId, selectedClient || undefined);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("Failed to open report:", err);
    } finally {
      setOpeningReportId(null);
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
            <div className="overflow-auto max-h-[40vh] overflow-x-auto border border-white/10 rounded-lg">
              <table className="w-full">
                <thead className="sticky top-0 bg-[var(--card-bg)] z-10">
                  <tr className="border-b border-white/10">
                    <th className="text-left p-2 text-sm font-medium">Parameter</th>
                    <th className="text-left p-2 text-sm font-medium">Value</th>
                    <th className="text-left p-2 text-sm font-medium">Date</th>
                    <th className="text-left p-2 text-sm font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map((vital) => (
                    <tr key={vital.id || `${vital.parameter_name ?? vital.parameter}-${vital.recorded_date ?? vital.measured_at}-${vital.value}`} className="border-b border-white/5">
                      <td className="p-2 text-sm">{vital.parameter_name ?? vital.parameter ?? vital.name ?? "—"}</td>
                      <td className="p-2 text-sm font-semibold">
                        {vital.value} {vital.unit || ""}
                      </td>
                      <td className="p-2 text-sm text-gray-400">
                        {formatDate(vital.recorded_date ?? vital.measured_at ?? vital.created_at ?? "")}
                      </td>
                      <td className="p-2 text-sm text-gray-400">
                        {vital.source || vital.source_report_id ? "Report" : "Manual"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-2 text-sm font-medium">Date</th>
                      <th className="text-left p-2 text-sm font-medium">Report title</th>
                      <th className="text-left p-2 text-sm font-medium">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="border-b border-white/5">
                        <td className="p-2 text-sm text-gray-400">
                          {r.uploaded_at ? formatDate(r.uploaded_at) : "—"}
                        </td>
                        <td className="p-2 text-sm">{r.file_name ?? "Report"}</td>
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => handleOpenReport(r.id)}
                            disabled={openingReportId === r.id}
                            className="inline-flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 disabled:opacity-50"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {openingReportId === r.id ? "Opening…" : "Open"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
    </>
  );
};

export default VitalsDashboard;
