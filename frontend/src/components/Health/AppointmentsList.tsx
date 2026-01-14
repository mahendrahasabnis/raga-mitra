import React, { useState } from "react";
import { Calendar, MapPin, User, FileText, Plus, Edit, Trash2 } from "lucide-react";
import { healthApi } from "../../services/api";
import AppointmentsForm from "./AppointmentsForm";

interface AppointmentsListProps {
  appointments: any[];
  loading: boolean;
  selectedClient?: string | null;
  onRefresh: () => void;
}

const AppointmentsList: React.FC<AppointmentsListProps> = ({
  appointments,
  loading,
  selectedClient,
  onRefresh,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleEdit = (appointment: any) => {
    setEditingAppointment(appointment);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this appointment?")) return;
    setDeleting(id);
    try {
      // Note: Backend doesn't have delete endpoint yet, but we can add it
      // For now, just update status to 'cancelled'
      await healthApi.updateAppointment(id, { status: "cancelled" });
      onRefresh();
    } catch (error) {
      console.error("Failed to delete appointment:", error);
      alert("Failed to delete appointment");
    } finally {
      setDeleting(null);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingAppointment(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    onRefresh();
  };

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading appointments...</p>
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
              Add Appointment
            </button>
          </div>
        )}

        {appointments.length === 0 ? (
          <div className="card p-8 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No appointments yet</p>
            {!selectedClient && (
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary mt-4"
              >
                Create your first appointment
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt) => (
              <div key={apt.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{apt.title || "Appointment"}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        apt.status === "completed" ? "bg-green-500/20 text-green-300" :
                        apt.status === "cancelled" ? "bg-red-500/20 text-red-300" :
                        "bg-blue-500/20 text-blue-300"
                      }`}>
                        {apt.status || "planned"}
                      </span>
                    </div>

                    {apt.datetime && (
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(apt.datetime).toLocaleString()}
                      </div>
                    )}

                    {apt.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                        <MapPin className="h-4 w-4" />
                        {apt.location}
                      </div>
                    )}

                    {apt.doctor_user_id && (
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                        <User className="h-4 w-4" />
                        Doctor ID: {apt.doctor_user_id}
                      </div>
                    )}

                    {apt.notes && (
                      <p className="text-sm text-gray-300 mt-2">{apt.notes}</p>
                    )}

                    {apt.attachment_count > 0 && (
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                        <FileText className="h-3 w-3" />
                        {apt.attachment_count} attachment{apt.attachment_count !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  {!selectedClient && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(apt)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(apt.id)}
                        disabled={deleting === apt.id}
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
        <AppointmentsForm
          isOpen={showForm}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          appointment={editingAppointment}
          clientId={selectedClient || undefined}
        />
      )}
    </>
  );
};

export default AppointmentsList;
