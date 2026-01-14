import React, { useState } from "react";
import { X, Calendar, MapPin, FileText, Upload } from "lucide-react";
import { healthApi } from "../../services/api";

interface AppointmentsFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointment?: any;
  clientId?: string;
}

const AppointmentsForm: React.FC<AppointmentsFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  appointment,
  clientId,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: appointment?.title || "",
    datetime: appointment?.datetime ? new Date(appointment.datetime).toISOString().slice(0, 16) : "",
    location: appointment?.location || "",
    notes: appointment?.notes || "",
    status: appointment?.status || "planned",
    doctor_user_id: appointment?.doctor_user_id || "",
  });
  const [attachments, setAttachments] = useState<any[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        attachments,
        client_id: clientId,
      };

      if (appointment) {
        await healthApi.updateAppointment(appointment.id, payload);
      } else {
        await healthApi.createAppointment(payload);
      }

      onSuccess();
    } catch (error: any) {
      console.error("Failed to save appointment:", error);
      alert(error.response?.data?.message || "Failed to save appointment");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAttachment = () => {
    setAttachments([
      ...attachments,
      {
        type: "other",
        file_url: "",
        file_name: "",
        file_type: "",
        notes: "",
      },
    ]);
  };

  const handleAttachmentChange = (index: number, field: string, value: any) => {
    const updated = [...attachments];
    updated[index] = { ...updated[index], [field]: value };
    setAttachments(updated);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--panel)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {appointment ? "Edit Appointment" : "New Appointment"}
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
            <label className="block text-sm font-medium mb-2">Title / Purpose *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input-field w-full"
              required
              placeholder="e.g., Annual checkup, Follow-up"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Date & Time *</label>
            <input
              type="datetime-local"
              value={formData.datetime}
              onChange={(e) => setFormData({ ...formData, datetime: e.target.value })}
              className="input-field w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="input-field w-full pl-10"
                placeholder="Clinic name, address, etc."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Doctor User ID</label>
            <input
              type="text"
              value={formData.doctor_user_id}
              onChange={(e) => setFormData({ ...formData, doctor_user_id: e.target.value })}
              className="input-field w-full"
              placeholder="Optional: Doctor's user ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="input-field w-full"
            >
              <option value="planned">Planned</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-field w-full"
              rows={3}
              placeholder="Additional notes, symptoms, etc."
            />
          </div>

          {/* Attachments Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Attachments</label>
              <button
                type="button"
                onClick={handleAddAttachment}
                className="text-sm btn-secondary flex items-center gap-1"
              >
                <Upload className="h-3 w-3" />
                Add
              </button>
            </div>
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((att, index) => (
                  <div key={index} className="flex gap-2 items-start p-2 bg-white/5 rounded-lg">
                    <select
                      value={att.type}
                      onChange={(e) => handleAttachmentChange(index, "type", e.target.value)}
                      className="input-field flex-1 text-sm"
                    >
                      <option value="receipt">Receipt</option>
                      <option value="prescription">Prescription</option>
                      <option value="diagnostic">Diagnostic</option>
                      <option value="invoice">Invoice</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="text"
                      value={att.file_url}
                      onChange={(e) => handleAttachmentChange(index, "file_url", e.target.value)}
                      className="input-field flex-1 text-sm"
                      placeholder="File URL"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              {loading ? "Saving..." : appointment ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AppointmentsForm;
