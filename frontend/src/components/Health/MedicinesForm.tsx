import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Pill } from "lucide-react";
import { healthApi } from "../../services/api";

interface MedicinesFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  medicine?: any;
  clientId?: string;
}

const MedicinesForm: React.FC<MedicinesFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  medicine,
  clientId,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    medicine_name: medicine?.medicine_name || "",
    dosage: medicine?.dosage || "",
    frequency: medicine?.frequency || "",
    start_date: medicine?.start_date
      ? new Date(medicine.start_date).toISOString().split("T")[0]
      : "",
    end_date: medicine?.end_date
      ? new Date(medicine.end_date).toISOString().split("T")[0]
      : "",
    timing: medicine?.timing || "",
    instructions: medicine?.instructions || "",
    appointment_id: medicine?.appointment_id || "",
    prescription_id: medicine?.prescription_id || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        client_id: clientId,
      };

      if (medicine) {
        await healthApi.updateMedicine(medicine.id, payload);
      } else {
        await healthApi.addMedicine(payload);
      }

      onSuccess();
    } catch (error: any) {
      console.error("Failed to save medicine:", error);
      alert(error.response?.data?.message || "Failed to save medicine");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--panel)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {medicine ? "Edit Medicine" : "Add Medicine Schedule"}
          </h2>
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
              Medicine Name *
            </label>
            <input
              type="text"
              value={formData.medicine_name}
              onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
              className="input-field w-full"
              required
              placeholder="e.g., Paracetamol, Metformin"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Dosage</label>
              <input
                type="text"
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                className="input-field w-full"
                placeholder="e.g., 500mg, 10ml"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Frequency *
              </label>
              <input
                type="text"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="input-field w-full"
                required
                placeholder="e.g., Twice daily, 1-0-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Timing</label>
            <input
              type="text"
              value={formData.timing}
              onChange={(e) => setFormData({ ...formData, timing: e.target.value })}
              className="input-field w-full"
              placeholder="e.g., Before meals, After meals, Morning, Evening"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="input-field w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Instructions</label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="input-field w-full"
              rows={3}
              placeholder="Additional instructions, side effects to watch, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Appointment ID</label>
              <input
                type="text"
                value={formData.appointment_id}
                onChange={(e) => setFormData({ ...formData, appointment_id: e.target.value })}
                className="input-field w-full"
                placeholder="Optional: Link to appointment"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Prescription ID</label>
              <input
                type="text"
                value={formData.prescription_id}
                onChange={(e) => setFormData({ ...formData, prescription_id: e.target.value })}
                className="input-field w-full"
                placeholder="Optional: Link to prescription"
              />
            </div>
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
              {loading ? "Saving..." : medicine ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default MedicinesForm;
