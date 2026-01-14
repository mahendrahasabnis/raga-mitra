import React, { useState } from "react";
import { X, Activity } from "lucide-react";
import { healthApi } from "../../services/api";

interface VitalsFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientId?: string;
}

const VitalsForm: React.FC<VitalsFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  clientId,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    parameter: "",
    value: "",
    unit: "",
    measured_at: new Date().toISOString().slice(0, 16),
    reference_range: "",
    source_report_id: "",
  });

  const commonParameters = [
    "Blood Pressure",
    "Heart Rate",
    "Temperature",
    "Weight",
    "Height",
    "BMI",
    "HbA1c",
    "Fasting Glucose",
    "Cholesterol",
    "Triglycerides",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        value: parseFloat(formData.value),
        client_id: clientId,
      };

      await healthApi.addVital(payload);
      onSuccess();
    } catch (error: any) {
      console.error("Failed to save vital:", error);
      alert(error.response?.data?.message || "Failed to save vital");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="card max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--panel)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Add Vital Parameter</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Parameter Name *
            </label>
            <input
              type="text"
              list="parameters"
              value={formData.parameter}
              onChange={(e) => setFormData({ ...formData, parameter: e.target.value })}
              className="input-field w-full"
              required
              placeholder="e.g., Blood Pressure, HbA1c"
            />
            <datalist id="parameters">
              {commonParameters.map((param) => (
                <option key={param} value={param} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Value *</label>
              <input
                type="number"
                step="any"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="input-field w-full"
                required
                placeholder="120"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Unit</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="input-field w-full"
                placeholder="mmHg, mg/dL, %"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Measured At *</label>
            <input
              type="datetime-local"
              value={formData.measured_at}
              onChange={(e) => setFormData({ ...formData, measured_at: e.target.value })}
              className="input-field w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Reference Range</label>
            <input
              type="text"
              value={formData.reference_range}
              onChange={(e) => setFormData({ ...formData, reference_range: e.target.value })}
              className="input-field w-full"
              placeholder="e.g., 90-120, 4.0-5.6"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Source Report ID</label>
            <input
              type="text"
              value={formData.source_report_id}
              onChange={(e) => setFormData({ ...formData, source_report_id: e.target.value })}
              className="input-field w-full"
              placeholder="Optional: Link to diagnostic report"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? "Saving..." : "Add Vital"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VitalsForm;
