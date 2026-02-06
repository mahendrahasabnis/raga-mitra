import React, { useState, useEffect } from "react";
import { Activity, Plus, Filter, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { healthApi } from "../../services/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import VitalsForm from "./VitalsForm";
import SelectDropdown from "../UI/SelectDropdown";

interface VitalsDashboardProps {
  vitals: any[];
  loading: boolean;
  selectedClient?: string | null;
  onRefresh: () => void;
}

const VitalsDashboard: React.FC<VitalsDashboardProps> = ({
  vitals,
  loading,
  selectedClient,
  onRefresh,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedParameter, setSelectedParameter] = useState<string>("");
  const [graphData, setGraphData] = useState<any[]>([]);
  const [trends, setTrends] = useState<any>({});
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loadingGraph, setLoadingGraph] = useState(false);

  const uniqueParameters = Array.from(new Set(vitals.map((v) => v.parameter_name || v.parameter)));

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
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field w-full"
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-2 text-sm font-medium">Parameter</th>
                    <th className="text-left p-2 text-sm font-medium">Value</th>
                    <th className="text-left p-2 text-sm font-medium">Date</th>
                    <th className="text-left p-2 text-sm font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map((vital) => (
                    <tr key={vital.id} className="border-b border-white/5">
                      <td className="p-2 text-sm">{vital.parameter_name || vital.parameter}</td>
                      <td className="p-2 text-sm font-semibold">
                        {vital.value} {vital.unit || ""}
                      </td>
                      <td className="p-2 text-sm text-gray-400">
                        {formatDate(vital.recorded_date || vital.measured_at || vital.created_at)}
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
