import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Plus,
  PhoneCall,
  MessageCircle,
  MessageSquare,
  AlertTriangle,
  Pill,
  Dumbbell,
  Salad,
  Monitor,
  UserPlus,
  X,
  Trophy,
} from "lucide-react";
import { resourcesApi } from "../../services/api";

interface DashPatient {
  id: string;
  name: string;
  phone: string;
  mrn_number: string;
  bed_number: string;
  access_health: boolean;
  access_fitness: boolean;
  access_diet: boolean;
  has_access: boolean;
  vital_alert: boolean | null;
  compliance_medicine: number | null;
  compliance_fitness: number | null;
  compliance_meals: number | null;
}

const DashPage: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<DashPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPhone, setAddPhone] = useState("");
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await resourcesApi.getDashPatients();
      setPatients(Array.isArray(res?.patients) ? res.patients : []);
    } catch (err: any) {
      console.error("Failed to fetch dash patients:", err);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = addPhone.trim();
    if (!phone) {
      setError("Phone number is required");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await resourcesApi.addPatientByDoctor({ phone, name: addName.trim() || undefined });
      setShowAddForm(false);
      setAddPhone("");
      setAddName("");
      fetchPatients();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to add patient");
    } finally {
      setAdding(false);
    }
  };

  const openPatientMonitoring = (patient: DashPatient) => {
    localStorage.setItem("client-context-id", patient.id);
    navigate(`/app/health?tab=live-monitoring&client=${patient.id}`, {
      state: { patientFromDash: { id: patient.id, name: patient.name, phone: patient.phone } },
    });
  };

  const phoneDigits = (phone: string) => (phone || "").replace(/[^0-9+]/g, "");
  const waPhone = (phone: string) => phoneDigits(phone).replace(/^\+/, "");

  const sortedPatients = [...patients].sort((a, b) => {
    // Sort by vital alert first, then by overall compliance
    if (a.vital_alert && !b.vital_alert) return -1;
    if (!a.vital_alert && b.vital_alert) return 1;
    const scoreA = a.has_access ? ((a.compliance_fitness ?? 0) + (a.compliance_meals ?? 0)) / 2 : 0;
    const scoreB = b.has_access ? ((b.compliance_fitness ?? 0) + (b.compliance_meals ?? 0)) / 2 : 0;
    return scoreB - scoreA;
  });

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Patient Dashboard</h2>
          <p className="text-sm text-gray-500">Leaderboard, vitals, compliance & monitoring</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add Patient
        </button>
      </div>

      {showAddForm && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add Patient by Phone
            </h3>
            <button
              onClick={() => {
                setShowAddForm(false);
                setError(null);
              }}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Creates a patient resource entry. The patient can enable access in their app and will be able to disable it at any time.
          </p>
          <form onSubmit={handleAddPatient} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Phone Number</label>
              <input
                type="tel"
                value={addPhone}
                onChange={(e) => {
                  let v = e.target.value;
                  if (!v.startsWith("+")) v = "+91" + v.replace(/^\+?91?/, "");
                  setAddPhone(v);
                }}
                placeholder="+919876543210"
                className="input-field w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Name (optional)</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Patient name"
                className="input-field w-full"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button type="submit" disabled={adding} className="btn-primary flex-1">
                {adding ? "Adding…" : "Add Patient"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-400">Loading patients…</p>
        </div>
      ) : sortedPatients.length === 0 ? (
        <div className="card p-8 text-center">
          <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">No patients yet</p>
          <p className="text-sm text-gray-500 mt-2">Add patient phone numbers to build your dashboard.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary mt-4 flex items-center gap-2 mx-auto"
          >
            <Plus className="h-4 w-4" />
            Add first patient
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            {sortedPatients.length} patient{sortedPatients.length !== 1 ? "s" : ""} • Click row to open monitoring
          </p>
          <div className="space-y-2">
            {sortedPatients.map((p, idx) => {
              const isDisabled = !p.has_access;
              return (
                <div
                  key={p.id}
                  onClick={() => !isDisabled && openPatientMonitoring(p)}
                  className={`card p-4 transition-colors ${
                    isDisabled
                      ? "opacity-75 cursor-default"
                      : "cursor-pointer hover:border-rose-500/30 hover:bg-white/5"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-3 min-w-0 flex-1">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`font-semibold truncate ${
                            isDisabled ? "text-gray-500" : "text-foreground"
                          }`}
                        >
                          {p.name || "Unknown"}
                        </div>
                        <div
                          className={`text-sm truncate ${
                            isDisabled ? "text-gray-500" : "text-gray-400"
                          }`}
                        >
                          {p.phone}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                          {p.mrn_number && <span>MRN: {p.mrn_number}</span>}
                          {p.bed_number && <span>BEX: {p.bed_number}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={`tel:${p.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg hover:bg-white/10 transition"
                        title="Call"
                      >
                        <PhoneCall className="h-4 w-4" />
                      </a>
                      <a
                        href={`sms:${p.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg hover:bg-white/10 transition"
                        title="SMS"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                      <a
                        href={`https://wa.me/${waPhone(p.phone)}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg hover:bg-white/10 transition"
                        title="WhatsApp"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </a>
                      {!isDisabled && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPatientMonitoring(p);
                          }}
                          className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400 transition"
                          title="Open monitoring"
                        >
                          <Monitor className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isDisabled && (
                    <p className="text-xs text-gray-500 mt-2">Access disabled by patient</p>
                  )}

                  {!isDisabled && (
                    <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-white/10">
                      {p.vital_alert && (
                        <span className="flex items-center gap-1 text-amber-400 text-sm">
                          <AlertTriangle className="h-4 w-4" />
                          Vital alert
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-sm text-gray-400">
                        <Pill className="h-3.5 w-3.5" />
                        Med: {p.compliance_medicine != null ? `${p.compliance_medicine}%` : "—"}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-gray-400">
                        <Dumbbell className="h-3.5 w-3.5" />
                        Fitness: {p.compliance_fitness != null ? `${p.compliance_fitness}%` : "—"}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-gray-400">
                        <Salad className="h-3.5 w-3.5" />
                        Meals: {p.compliance_meals != null ? `${p.compliance_meals}%` : "—"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashPage;
