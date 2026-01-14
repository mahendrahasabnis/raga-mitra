import React, { useState } from "react";
import { Pill, Plus, Edit, Trash2, Calendar, Clock } from "lucide-react";
import { healthApi } from "../../services/api";
import MedicinesForm from "./MedicinesForm";

interface MedicinesListProps {
  medicines: any[];
  loading: boolean;
  selectedClient?: string | null;
  onRefresh: () => void;
}

const MedicinesList: React.FC<MedicinesListProps> = ({
  medicines,
  loading,
  selectedClient,
  onRefresh,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<any>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  const handleEdit = (medicine: any) => {
    setEditingMedicine(medicine);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this medicine schedule?")) return;
    try {
      await healthApi.deleteMedicine(id);
      onRefresh();
    } catch (error) {
      console.error("Failed to delete medicine:", error);
      alert("Failed to delete medicine");
    }
  };

  const handleToggleActive = async (medicine: any) => {
    try {
      await healthApi.updateMedicine(medicine.id, { is_active: !medicine.is_active });
      onRefresh();
    } catch (error) {
      console.error("Failed to update medicine:", error);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingMedicine(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    onRefresh();
  };

  const filteredMedicines = activeOnly
    ? medicines.filter((m) => m.is_active)
    : medicines;

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading medicines...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 overflow-x-hidden">
        <div className="flex items-center justify-between">
          {!selectedClient && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Medicine
            </button>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded"
            />
            Show active only
          </label>
        </div>

        {filteredMedicines.length === 0 ? (
          <div className="card p-8 text-center">
            <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No medicines {activeOnly ? "active" : ""} yet</p>
            {!selectedClient && (
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary mt-4"
              >
                Add your first medicine
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMedicines.map((med) => (
              <div
                key={med.id}
                className={`card p-4 ${!med.is_active ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{med.medicine_name}</h3>
                      {med.dosage && (
                        <span className="text-xs text-gray-400">({med.dosage})</span>
                      )}
                      {!med.is_active && (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-500/20 text-gray-400">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{med.frequency}</span>
                        {med.timing && <span>• {med.timing}</span>}
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(med.start_date).toLocaleDateString()}
                          {med.end_date && ` - ${new Date(med.end_date).toLocaleDateString()}`}
                        </span>
                      </div>

                      {med.instructions && (
                        <p className="text-gray-300 mt-2">{med.instructions}</p>
                      )}
                    </div>
                  </div>

                  {!selectedClient && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(med)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
                        title={med.is_active ? "Deactivate" : "Activate"}
                      >
                        {med.is_active ? "✓" : "○"}
                      </button>
                      <button
                        onClick={() => handleEdit(med)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(med.id)}
                        className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <MedicinesForm
          isOpen={showForm}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          medicine={editingMedicine}
          clientId={selectedClient || undefined}
        />
      )}
    </>
  );
};

export default MedicinesList;
