import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { X, Calendar, MapPin, FileText, Upload } from "lucide-react";
import { healthApi, userApi } from "../../services/api";
import SelectDropdown from "../UI/SelectDropdown";

interface AppointmentsFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointment?: any;
  clientId?: string;
  existingLocations?: string[];
}

const AppointmentsForm: React.FC<AppointmentsFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  appointment,
  clientId,
  existingLocations = [],
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
  const [doctorSearch, setDoctorSearch] = useState(appointment?.doctor_name || "");
  const [doctorResults, setDoctorResults] = useState<any[]>([]);
  const [doctorSearching, setDoctorSearching] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(
    appointment?.doctor_user_id
      ? { id: appointment.doctor_user_id, name: appointment.doctor_name || "Doctor", phone: "" }
      : null
  );
  const clinicDatalistId = useId();
  const doctorAbortRef = useRef<AbortController | null>(null);

  const clinicOptions = useMemo(() => {
    return Array.from(new Set(existingLocations.filter(Boolean)));
  }, [existingLocations]);

  const normalizePhoneInput = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return trimmed;
    if (/^\d/.test(trimmed)) {
      const cleaned = trimmed.replace(/[^0-9]/g, "");
      return `+91${cleaned.replace(/^0+/, "")}`;
    }
    return trimmed;
  };

  useEffect(() => {
    if (!doctorSearch) {
      setDoctorResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      if (doctorAbortRef.current) {
        doctorAbortRef.current.abort();
      }
      const controller = new AbortController();
      doctorAbortRef.current = controller;
      setDoctorSearching(true);
      try {
        const searchTerm = normalizePhoneInput(doctorSearch);
        const res = await userApi.searchDoctors(searchTerm, { signal: controller.signal });
        const list = res.users || res.results || res.doctors || [];
        const filtered = list.filter((doc: any) => {
          if (doc?.is_doctor === true) return true;
          const roles = Array.isArray(doc?.platform_roles) ? doc.platform_roles : [];
          if (roles.some((r: string) => String(r).toLowerCase() === "doctor")) return true;
          const role = String(doc?.role || "").toLowerCase();
          return role === "doctor";
        });
        setDoctorResults(filtered);
      } catch (err: any) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
          return;
        }
        console.warn("Failed to search doctors:", err);
        setDoctorResults([]);
      } finally {
        setDoctorSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [doctorSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let doctorUserId = formData.doctor_user_id;
      const normalizedSearch = normalizePhoneInput(doctorSearch);
      const rawDigits = normalizedSearch.replace(/\D/g, "");
      const hasFullIndiaNumber = rawDigits.length >= 12 || (normalizedSearch.startsWith("+") && rawDigits.length >= 10);
      if (!doctorUserId && selectedDoctor?.id) {
        doctorUserId = selectedDoctor.id;
      }
      if (!doctorUserId && hasFullIndiaNumber) {
        const created = await userApi.createDoctor({
          phone: normalizedSearch,
        });
        doctorUserId = created.user?.id;
      }

      const payload = {
        ...formData,
        doctor_user_id: doctorUserId || null,
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
            <label className="block text-sm font-medium mb-2">Clinic Name</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="input-field w-full pl-10"
                placeholder="Search or add clinic name"
                list={clinicDatalistId}
              />
            </div>
            <datalist id={clinicDatalistId}>
              {clinicOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Doctor</label>
            <div className="space-y-2">
              <input
                type="text"
                value={doctorSearch}
                onChange={(e) => {
                  setDoctorSearch(normalizePhoneInput(e.target.value));
                  setSelectedDoctor(null);
                  setFormData((prev) => ({ ...prev, doctor_user_id: "" }));
                }}
                className="input-field w-full"
                placeholder="Search doctor by name or phone"
              />
              {doctorSearching && (
                <p className="text-xs text-gray-400">Searching doctors...</p>
              )}
              {doctorResults.length > 0 && (
                <div className="border border-white/10 rounded-lg bg-white/5">
                  {doctorResults.map((doc: any) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, doctor_user_id: doc.id }));
                        setSelectedDoctor(doc);
                        setDoctorSearch(`${doc.name || "Doctor"}${doc.phone ? ` - ${doc.phone}` : ""}`);
                        setDoctorResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                    >
                      {doc.name || "Doctor"} {doc.phone ? `• ${doc.phone}` : ""}
                    </button>
                  ))}
                </div>
              )}
              {doctorResults.length === 0 && doctorSearch.trim() && !doctorSearching && (
                <p className="text-xs text-gray-400">
                  No doctors found. Enter a phone number to create a doctor.
                </p>
              )}
              {formData.doctor_user_id && (
                <p className="text-xs text-gray-400">
                  Selected: {selectedDoctor?.name || "Doctor"} {selectedDoctor?.phone ? `• ${selectedDoctor.phone}` : ""}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <SelectDropdown
              value={formData.status}
              options={[
                { value: "planned", label: "Planned" },
                { value: "confirmed", label: "Confirmed" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              onChange={(value) => setFormData({ ...formData, status: value })}
            />
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
                    <div className="flex-1 min-w-[140px]">
                      <SelectDropdown
                        value={att.type}
                        options={[
                          { value: "receipt", label: "Receipt" },
                          { value: "prescription", label: "Prescription" },
                          { value: "diagnostic", label: "Diagnostic" },
                          { value: "invoice", label: "Invoice" },
                          { value: "other", label: "Other" },
                        ]}
                        onChange={(value) => handleAttachmentChange(index, "type", value)}
                      />
                    </div>
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
