import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { healthApi } from "../../services/api";

export const DEFAULT_HIGH_LIMITS: Record<string, number> = {
  heart_rate: 100,
  breath_rate: 20,
  spo2: 100,
  temperature: 99,
  systolic_bp: 140,
  diastolic_bp: 90,
};
export const DEFAULT_LOW_LIMITS: Record<string, number> = {
  heart_rate: 60,
  breath_rate: 12,
  spo2: 95,
  temperature: 97,
  systolic_bp: 90,
  diastolic_bp: 60,
};

interface AdmissionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdOrUpdated?: any) => void;
  admission?: any | null;
  selectedClient?: string | null;
}

const AdmissionForm: React.FC<AdmissionFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  admission,
  selectedClient,
}) => {
  const [institutionName, setInstitutionName] = useState("");
  const [mrnNumber, setMrnNumber] = useState("");
  const [bedNumber, setBedNumber] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [condition, setCondition] = useState("");
  const [consultingDoctor, setConsultingDoctor] = useState("");
  const [highLimits, setHighLimits] = useState<Record<string, number>>(DEFAULT_HIGH_LIMITS);
  const [lowLimits, setLowLimits] = useState<Record<string, number>>(DEFAULT_LOW_LIMITS);
  const [saving, setSaving] = useState(false);
  const [showLimits, setShowLimits] = useState(false);

  useEffect(() => {
    if (admission) {
      setInstitutionName(admission.institution_name || "");
      setMrnNumber(admission.mrn_number || "");
      setBedNumber(admission.bed_number || "");
      setAdmissionDate(admission.admission_date ? String(admission.admission_date).slice(0, 10) : "");
      setCondition(admission.condition || "");
      setConsultingDoctor(admission.consulting_doctor || "");
      setHighLimits(admission.high_limits || DEFAULT_HIGH_LIMITS);
      setLowLimits(admission.low_limits || DEFAULT_LOW_LIMITS);
    } else {
      setInstitutionName("");
      setMrnNumber("");
      setBedNumber("");
      setAdmissionDate(new Date().toISOString().slice(0, 10));
      setCondition("");
      setConsultingDoctor("");
      setHighLimits(DEFAULT_HIGH_LIMITS);
      setLowLimits(DEFAULT_LOW_LIMITS);
    }
  }, [admission, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!institutionName.trim() || !admissionDate) {
      alert("Hospital/Care Home Name and Admission Date are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        institution_name: institutionName.trim(),
        mrn_number: mrnNumber.trim() || undefined,
        bed_number: bedNumber.trim() || undefined,
        admission_date: admissionDate,
        condition: condition.trim() || undefined,
        consulting_doctor: consultingDoctor.trim() || undefined,
        high_limits: showLimits ? highLimits : undefined,
        low_limits: showLimits ? lowLimits : undefined,
        client_id: selectedClient || undefined,
      };
      let result: any;
      if (admission?.id) {
        result = await healthApi.updateAdmission(admission.id, payload);
      } else {
        result = await healthApi.createAdmission(payload);
      }
      console.log("[AdmissionForm] Save response:", result);
      const createdOrUpdated = result?.admission ?? result;
      if (!createdOrUpdated?.id && !admission?.id) {
        console.warn("[AdmissionForm] Create succeeded but no admission in response:", result);
      }
      onSuccess(createdOrUpdated);
      onClose();
    } catch (err: any) {
      console.error("[AdmissionForm] Failed to save admission:", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (err?.code === "ERR_NETWORK" ? "Cannot reach server. Check that the backend is running." : err?.message) ||
        "Failed to save admission.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-semibold text-lg">
            {admission ? "Edit Admission" : "Add Institution Admission"}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Hospital / Care Home Name *</label>
            <input
              type="text"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              className="input-field w-full"
              placeholder="e.g. Apollo Hospital"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">MRN Number</label>
              <input
                type="text"
                value={mrnNumber}
                onChange={(e) => setMrnNumber(e.target.value)}
                className="input-field w-full"
                placeholder="Medical Record No."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bed Number</label>
              <input
                type="text"
                value={bedNumber}
                onChange={(e) => setBedNumber(e.target.value)}
                className="input-field w-full"
                placeholder="e.g. 101"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Admission Date *</label>
            <input
              type="date"
              value={admissionDate}
              onChange={(e) => setAdmissionDate(e.target.value)}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Condition</label>
            <input
              type="text"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="input-field w-full"
              placeholder="e.g. Post-surgery recovery"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Consulting Doctor</label>
            <input
              type="text"
              value={consultingDoctor}
              onChange={(e) => setConsultingDoctor(e.target.value)}
              className="input-field w-full"
              placeholder="Dr. Name"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowLimits(!showLimits)}
              className="text-sm text-rose-400 hover:text-rose-300"
            >
              {showLimits ? "− Hide" : "+ Set"} High/Low limits for alerts
            </button>
            {showLimits && (
              <div className="mt-6 p-4 rounded-lg bg-white/5 space-y-4">
                <p className="text-xs text-gray-400">Values outside these ranges will trigger alerts on the graph.</p>
                <div className="grid grid-cols-2 gap-4">
                  {Object.keys(DEFAULT_HIGH_LIMITS).map((key) => (
                    <div key={key} className="space-y-2">
                      <label className="block text-xs font-medium capitalize">{key.replace(/_/g, " ")}</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={lowLimits[key] ?? ""}
                          onChange={(e) =>
                            setLowLimits((prev) => ({
                              ...prev,
                              [key]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="input-field w-20 text-sm"
                          placeholder="Min"
                        />
                        <input
                          type="number"
                          value={highLimits[key] ?? ""}
                          onChange={(e) =>
                            setHighLimits((prev) => ({
                              ...prev,
                              [key]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="input-field w-20 text-sm"
                          placeholder="Max"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Saving…" : admission ? "Update" : "Add Admission"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default AdmissionForm;
