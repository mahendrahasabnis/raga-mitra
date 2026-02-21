import React, { useMemo, useState } from "react";
import { Calendar, MapPin, User, FileText, Plus, Edit, Trash2, List, Phone, MessageCircle } from "lucide-react";
import { healthApi } from "../../services/api";
import AppointmentsForm from "./AppointmentsForm";
import AppointmentsCalendarView from "./AppointmentsCalendarView";
import AppointmentDetailsTabs from "./AppointmentDetailsTabs";
import VitalsDashboard from "./VitalsDashboard";
import { QRCodeCanvas } from "qrcode.react";

interface AppointmentsListProps {
  appointments: any[];
  loading: boolean;
  selectedClient?: string | null;
  vitals?: any[];
  reports?: any[];
  onRefresh: () => void;
  initialExpandId?: string | null;
}

const AppointmentsList: React.FC<AppointmentsListProps> = ({
  appointments,
  loading,
  selectedClient,
  vitals = [],
  reports = [],
  onRefresh,
  initialExpandId,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(initialExpandId || null);

  const clinicOptions = useMemo(() => {
    return Array.from(new Set(appointments.map((apt) => apt.location).filter(Boolean)));
  }, [appointments]);

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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("list")}
              className={`sub-tab px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border transition ${
                viewMode === "list"
                  ? "sub-tab--active bg-rose-500/20 text-rose-200 border-rose-400/30"
                  : "text-gray-300 border-transparent hover:bg-white/5"
              }`}
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`sub-tab px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border transition ${
                viewMode === "calendar"
                  ? "sub-tab--active bg-rose-500/20 text-rose-200 border-rose-400/30"
                  : "text-gray-300 border-transparent hover:bg-white/5"
              }`}
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </button>
          </div>

          {!selectedClient && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Appointment
            </button>
          )}
        </div>

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
        ) : viewMode === "calendar" ? (
          <AppointmentsCalendarView appointments={appointments} />
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

                    {(apt.doctor_name || apt.doctor_phone || apt.doctor_user_id) && (
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400 mb-1">
                        <User className="h-4 w-4 shrink-0" />
                        <span>
                          {apt.doctor_name ? `Dr. ${apt.doctor_name}` : "Doctor"}
                          {apt.doctor_phone ? ` · ${apt.doctor_phone}` : apt.doctor_user_id ? " (linked)" : ""}
                        </span>
                        {apt.doctor_phone && (
                          <span className="flex items-center gap-1">
                            <a
                              href={`tel:${String(apt.doctor_phone).replace(/\s/g, "")}`}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/20 text-green-300 hover:bg-green-500/30 transition text-xs"
                              title="Call"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              Call
                            </a>
                            <a
                              href={`sms:${String(apt.doctor_phone).replace(/\s/g, "")}`}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition text-xs"
                              title="Message"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Message
                            </a>
                          </span>
                        )}
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

                  <div className="flex items-start gap-3 ml-4">
                    <div className="flex flex-col items-center">
                      <QRCodeCanvas
                        value={String(apt.id)}
                        size={64}
                        bgColor="#ffffff"
                        fgColor="#111827"
                      />
                      <span className="text-[10px] text-gray-400">Appointment QR</span>
                    </div>
                    {!selectedClient && (
                      <div className="flex gap-2">
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

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => setExpandedAppointment(expandedAppointment === apt.id ? null : apt.id)}
                    className="text-sm text-blue-200 hover:text-blue-100"
                  >
                    {expandedAppointment === apt.id ? "Hide Details" : "View Details"}
                  </button>
                </div>

                {expandedAppointment === apt.id && (
                  <AppointmentDetailsTabs appointment={apt} clientId={selectedClient || undefined} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <VitalsDashboard
        vitals={vitals}
        reports={reports}
        loading={loading}
        selectedClient={selectedClient}
        onRefresh={onRefresh}
      />

      {showForm && (
        <AppointmentsForm
          isOpen={showForm}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          appointment={editingAppointment}
          clientId={selectedClient || undefined}
          existingLocations={clinicOptions}
        />
      )}
    </>
  );
};

export default AppointmentsList;
