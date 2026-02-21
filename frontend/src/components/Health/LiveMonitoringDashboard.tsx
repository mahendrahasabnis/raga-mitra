import React, { useEffect, useState } from "react";
import { Activity, Plus, Building2, Edit, Trash2 } from "lucide-react";
import { healthApi } from "../../services/api";
import AdmissionForm from "./AdmissionForm";
import AdmissionMonitorView from "./AdmissionMonitorView";

interface LiveMonitoringDashboardProps {
  selectedClient?: string | null;
  onRefresh: () => void;
}

const LiveMonitoringDashboard: React.FC<LiveMonitoringDashboardProps> = ({
  selectedClient,
  onRefresh,
}) => {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAdmission, setEditingAdmission] = useState<any | null>(null);
  const [selectedAdmission, setSelectedAdmission] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadAdmissions = async () => {
    setLoading(true);
    try {
      const res = await healthApi.getAdmissions(selectedClient || undefined);
      setAdmissions(Array.isArray(res?.admissions) ? res.admissions : []);
    } catch (err) {
      console.error("Failed to load admissions:", err);
      // Keep previous list on error so navigation/refetch glitches don't hide data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedAdmission(null);
    loadAdmissions();
  }, [selectedClient]);

  const handleEdit = (e: React.MouseEvent, admission: any) => {
    e.stopPropagation();
    setEditingAdmission(admission);
    setShowForm(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this admission? All monitoring data will be removed.")) return;
    setDeleting(id);
    try {
      await healthApi.deleteAdmission(id, selectedClient || undefined);
      if (selectedAdmission?.id === id) setSelectedAdmission(null);
      loadAdmissions();
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete.");
    } finally {
      setDeleting(null);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingAdmission(null);
  };

  const handleFormSuccess = async (createdOrUpdated?: any) => {
    handleFormClose();
    if (createdOrUpdated?.id) {
      setAdmissions((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const idx = list.findIndex((a) => a.id === createdOrUpdated.id);
        if (idx >= 0) return list.map((a, i) => (i === idx ? createdOrUpdated : a));
        return [createdOrUpdated, ...list];
      });
    }
    // Refetch in background without clearing the list; merge so new admission stays visible
    try {
      const res = await healthApi.getAdmissions(selectedClient || undefined);
      const serverList = Array.isArray(res?.admissions) ? res.admissions : [];
      const createdId = createdOrUpdated?.id;
      const inServer = createdId && serverList.some((a: any) => a.id === createdId);
      setAdmissions(inServer ? serverList : createdId ? [createdOrUpdated, ...serverList.filter((a: any) => a.id !== createdId)] : serverList);
    } catch {
      // Keep optimistic update on refetch failure
    }
    onRefresh();
  };

  if (selectedAdmission) {
    return (
      <AdmissionMonitorView
        admission={selectedAdmission}
        onBack={() => setSelectedAdmission(null)}
        selectedClient={selectedClient}
        onRefresh={() => {
          loadAdmissions();
          onRefresh();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading admissions...</p>
      </div>
    );
  }

  const list = Array.isArray(admissions) ? admissions : [];

  return (
    <>
      <div className="space-y-4 overflow-x-hidden">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Track institution admissions for critically ill patients with monitoring parameters (Heart Rate, SpO2, BP, etc.).
          </p>
          <button
            onClick={() => {
              setEditingAdmission(null);
              setShowForm(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Admission
          </button>
        </div>

        {list.length === 0 ? (
          <div className="card p-8 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No institution admissions yet</p>
            <p className="text-sm text-gray-500 mt-2">Add a hospital or care home admission to start monitoring.</p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary mt-4 flex items-center gap-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              Add first admission
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((adm) => (
              <div
                key={adm.id}
                onClick={() => setSelectedAdmission(adm)}
                className="card p-4 cursor-pointer hover:border-rose-500/30 hover:bg-white/5 transition-colors border border-transparent"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-rose-400" />
                    <h4 className="font-semibold">{adm.institution_name}</h4>
                  </div>
                  {!selectedClient && (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleEdit(e, adm)}
                        className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, adm.id)}
                        disabled={deleting === adm.id}
                        className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-400 space-y-1">
                  {adm.mrn_number && <p>MRN: {adm.mrn_number}</p>}
                  {adm.bed_number && <p>Bed: {adm.bed_number}</p>}
                  <p>Admitted: {adm.admission_date ? new Date(adm.admission_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</p>
                  {adm.consulting_doctor && <p>Dr. {adm.consulting_doctor}</p>}
                </div>
                <p className="text-xs text-rose-400/80 mt-2">Click to view monitoring & graphs</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <AdmissionForm
          isOpen={showForm}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          admission={editingAdmission}
          selectedClient={selectedClient}
        />
      )}
    </>
  );
};

export default LiveMonitoringDashboard;
