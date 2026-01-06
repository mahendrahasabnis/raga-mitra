import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Clock, MapPin, User, QrCode, X, FileText,
  Pill, TestTube, Receipt, ChevronDown, ChevronUp, XCircle, Plus, History, Activity, Scan
} from 'lucide-react';
import QRCode from 'qrcode';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import AppointmentTicket from '../../components/Appointments/AppointmentTicket';
import { useUserName } from '../../hooks/useUserName';
import AddPastVisitModal from '../../components/MedicalHistory/AddPastVisitModal';
import PastVisitsList from '../../components/MedicalHistory/PastVisitsList';
import ScanReceiptModal from '../../components/MedicalHistory/ScanReceiptModal';
import VitalTrendsDashboard from '../../components/VitalTrends/VitalTrendsDashboard';
import { medicalHistoryApi } from '../../services/api';

// Component to trigger refresh when vital trends tab becomes active
const RefreshVitalTrendsOnMount: React.FC = () => {
  const hasRefreshed = useRef(false);
  
  useEffect(() => {
    if (!hasRefreshed.current) {
      // Small delay to ensure component is mounted
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshVitalTrends'));
        console.log('🔄 [PATIENT DASHBOARD] Triggered vital trends refresh on tab activation');
        hasRefreshed.current = true;
      }, 100);
    }
    
    return () => {
      hasRefreshed.current = false;
    };
  }, []);
  
  return null;
};

interface Appointment {
  id: string; // Backend uses 'id' not '_id'
  appointment_id: string; // Backend uses snake_case
  appointment_date: string; // Backend uses snake_case
  appointment_time: string; // Backend uses snake_case
  session: string; // Morning, Afternoon, Evening
  session_start_time?: string; // e.g., "12:00 PM" - Backend uses snake_case
  session_end_time?: string; // e.g., "2:00 PM" - Backend uses snake_case
  sequence_number: number; // Sequence within session - Backend uses snake_case
  status: string;
  workflowStage: string;
  qr_code: string; // Backend uses snake_case
  doctor_name: string; // Backend uses snake_case
  doctor_specialty: string; // Backend uses snake_case
  clinic_name: string; // Backend uses snake_case
  practice_name: string; // Backend uses snake_case
  hcp_name: string; // Backend uses snake_case
  chief_complaint?: string; // Backend uses snake_case
  consultation_fee: number; // Backend uses snake_case
  // Medical details
  complaints?: string;
  diagnosis?: string;
  prescriptions?: any[];
  diagnosticTests?: any[];
  testResults?: any[];
  documents?: any[];
  billingData?: {
    consultationFee: number;
    diagnosticFee?: number;
    medicationFee?: number;
    total: number;
    paid: boolean;
    receipt?: string;
  };
}

interface SessionGroup {
  session: string;
  appointments: Appointment[];
}

interface DoctorGroup {
  doctorName: string;
  doctorSpecialty: string;
  sessions: SessionGroup[];
  totalAppointments: number;
}

const PatientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { userName, loading: userNameLoading } = useUserName();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQR, setSelectedQR] = useState<{ appointmentId: string; qrImage: string } | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [expandedAppointments, setExpandedAppointments] = useState<Set<string>>(new Set());
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  // Medical History State
  const [pastVisits, setPastVisits] = useState<any[]>([]);
  const [loadingPastVisits, setLoadingPastVisits] = useState(false);
  const [showAddPastVisitModal, setShowAddPastVisitModal] = useState(false);
  const [showScanReceiptModal, setShowScanReceiptModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'appointments' | 'medical-history' | 'vital-trends'>('appointments');

  useEffect(() => {
    fetchAppointments();
    if (activeTab === 'medical-history') {
      fetchPastVisits();
    }
  }, [activeTab]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/appointments/patient');
      // Sort by date (newest first)
      const sorted = (response.data.appointments || []).sort((a: Appointment, b: Appointment) => {
        return new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime();
      });
      setAppointments(sorted);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPastVisits = async () => {
    setLoadingPastVisits(true);
    try {
      const response = await medicalHistoryApi.getPastVisits();
      const sorted = (response.visits || []).sort((a: any, b: any) => {
        return new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime();
      });
      setPastVisits(sorted);
    } catch (error) {
      console.error('Error fetching past visits:', error);
    } finally {
      setLoadingPastVisits(false);
    }
  };

  // Sort appointments by status priority
  const getStatusPriority = (status: string): number => {
    const priority: { [key: string]: number } = {
      'checked_in': 1,
      'confirmed': 2,
      'requested': 3,
      'consulting': 4,
      'payment_pending': 5,
      'completed': 6,
      'cancelled': 7,
      'no_show': 8
    };
    return priority[status] || 9;
  };

  const groupByDoctorAndSession = (appointments: Appointment[]): DoctorGroup[] => {
    const sessionOrder = ['Morning', 'Afternoon', 'Evening'];
    const doctorGroups: { [key: string]: Appointment[] } = {};
    
    // Group by doctor
    appointments.forEach(apt => {
      const key = `${apt.doctor_name}|${apt.doctor_specialty}`;
      if (!doctorGroups[key]) {
        doctorGroups[key] = [];
      }
      doctorGroups[key].push(apt);
    });
    
    // For each doctor, group by session and sort
    return Object.entries(doctorGroups).map(([key, apts]) => {
      const [doctorName, doctorSpecialty] = key.split('|');
      
      // Group by session
      const sessionGroups: { [key: string]: Appointment[] } = {};
      apts.forEach(apt => {
        const session = apt.session || 'Afternoon';
        if (!sessionGroups[session]) {
          sessionGroups[session] = [];
        }
        sessionGroups[session].push(apt);
      });
      
      // Sort within each session by status priority, then sequence
      Object.keys(sessionGroups).forEach(session => {
        sessionGroups[session].sort((a, b) => {
          const statusDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
          if (statusDiff !== 0) return statusDiff;
          return (a.sequence_number || 0) - (b.sequence_number || 0);
        });
      });
      
      // Return sessions in order
      const sessions: SessionGroup[] = sessionOrder
        .filter(session => sessionGroups[session])
        .map(session => ({
          session,
          appointments: sessionGroups[session]
        }));
      
      return {
        doctorName,
        doctorSpecialty,
        sessions,
        totalAppointments: apts.length
      };
    });
  };

  const showQRCode = async (appointment: Appointment) => {
    try {
      // Show the appointment ticket instead of just QR code
      setSelectedAppointment(appointment);
      setShowTicket(true);
    } catch (error) {
      console.error('Error showing appointment ticket:', error);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    try {
      await api.put(`/appointments/${appointmentId}/cancel`, {
        reason: cancelReason
      });
      alert('Appointment cancelled successfully');
      setCancellingId(null);
      setCancelReason('');
      fetchAppointments();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment');
    }
  };

  const toggleExpanded = (appointmentId: string) => {
    const newExpanded = new Set(expandedAppointments);
    if (newExpanded.has(appointmentId)) {
      newExpanded.delete(appointmentId);
    } else {
      newExpanded.add(appointmentId);
    }
    setExpandedAppointments(newExpanded);
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'requested': 'bg-yellow-100 text-yellow-800',
      'confirmed': 'bg-blue-100 text-blue-800',
      'checked_in': 'bg-purple-100 text-purple-800',
      'consulting': 'bg-indigo-100 text-indigo-800',
      'payment_pending': 'bg-orange-100 text-orange-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'no_show': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      'requested': 'Requested',
      'confirmed': 'Confirmed',
      'checked_in': 'Checked In',
      'consulting': 'In Consultation',
      'payment_pending': 'Payment Pending',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'no_show': 'No Show'
    };
    return labels[status] || status;
  };

  const canCancel = (appointment: Appointment) => {
    return !['completed', 'cancelled', 'no_show'].includes(appointment.status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading your appointments...</p>
        </div>
      </div>
    );
  }

  const doctorGroups = groupByDoctorAndSession(appointments);

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome <span className="text-blue-600">{userNameLoading ? 'Loading...' : userName || 'Patient'}</span> to Aarogya Mitra
          </h1>
          <p className="text-gray-600 mt-1 text-lg">The one and only health destination</p>
          <p className="text-sm text-gray-500 mt-2">View your medical history and upcoming appointments</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'medical-history' && (
            <>
              <button
                onClick={() => setShowScanReceiptModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Scan className="w-5 h-5" />
                Scan Receipt
              </button>
              <button
                onClick={() => setShowAddPastVisitModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Past Visit
              </button>
            </>
          )}
          <button
            onClick={() => navigate('/appointments')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Book New Appointment
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('appointments')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'appointments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              My Appointments ({appointments.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('medical-history')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'medical-history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Medical History ({pastVisits.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('vital-trends')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'vital-trends'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Vital Trends
            </div>
          </button>
        </nav>
      </div>

      {/* Stats */}
      {activeTab === 'appointments' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Total Appointments</div>
            <div className="text-2xl font-bold text-gray-900">{appointments.length}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Upcoming</div>
            <div className="text-2xl font-bold text-blue-600">
              {appointments.filter(a => ['requested', 'confirmed', 'checked_in'].includes(a.status)).length}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Completed</div>
            <div className="text-2xl font-bold text-green-600">
              {appointments.filter(a => a.status === 'completed').length}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Cancelled</div>
            <div className="text-2xl font-bold text-red-600">
              {appointments.filter(a => a.status === 'cancelled').length}
            </div>
          </div>
        </div>
      )}

      {/* Medical History Stats */}
      {activeTab === 'medical-history' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Past Visits</div>
            <div className="text-2xl font-bold text-gray-900">{pastVisits.length}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Total Visits</div>
            <div className="text-2xl font-bold text-blue-600">{appointments.length + pastVisits.length}</div>
          </div>
        </div>
      )}

      {/* Medical History Tab */}
      {activeTab === 'medical-history' && (
        <div className="mb-8">
          {loadingPastVisits ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading medical history...</p>
            </div>
          ) : (
            <PastVisitsList visits={pastVisits} onRefresh={fetchPastVisits} />
          )}
        </div>
      )}

      {/* Vital Trends Tab */}
      {activeTab === 'vital-trends' && (
        <>
          <RefreshVitalTrendsOnMount />
          <div className="mb-8">
            <VitalTrendsDashboard key={`vital-trends-${pastVisits.length}`} />
          </div>
        </>
      )}

      {/* Appointments by Doctor */}
      {activeTab === 'appointments' && (
        <>
        {doctorGroups.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments found</h3>
          <p className="text-gray-600 mb-6">You haven't booked any appointments yet</p>
          <button
            onClick={() => navigate('/appointments')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Book Your First Appointment
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {doctorGroups.map((group, idx) => (
            <div key={idx} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Doctor Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{group.doctorName}</h2>
                    <p className="text-sm text-blue-100">{group.doctorSpecialty}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{group.totalAppointments}</div>
                    <div className="text-xs text-blue-100">appointments</div>
                  </div>
                </div>
              </div>

              {/* Sessions */}
              {group.sessions.map((sessionGroup, sesIdx) => (
                <div key={sesIdx} className="border-t border-gray-200">
                  {/* Session Header */}
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <h3 className="text-sm font-semibold text-gray-900">
                          {new Date(sessionGroup.appointments[0].appointment_date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })} | {sessionGroup.session}
                          {sessionGroup.appointments[0]?.session_start_time && sessionGroup.appointments[0]?.session_end_time && (
                            <span className="font-normal">
                              {' '}| {sessionGroup.appointments[0].session_start_time} to {sessionGroup.appointments[0].session_end_time}
                            </span>
                          )}
                        </h3>
                      </div>
                      <span className="text-xs text-gray-600 font-medium">
                        {sessionGroup.appointments.length} appointment{sessionGroup.appointments.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Compact Appointment List */}
                  <div className="divide-y divide-gray-100">
                    {sessionGroup.appointments.map((appointment) => {
                      const isCompleted = appointment.status === 'completed' || appointment.status === 'cancelled';
                      const isToday = new Date(appointment.appointment_date).toDateString() === new Date().toDateString();
                      
                      return (
                        <div key={appointment.id}>
                          {/* Compact One-Line View */}
                          <div 
                            className={`px-6 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors ${
                              isCompleted ? 'opacity-40' : ''
                            }`}
                          >
                            {/* Seq # or Date */}
                            <div className="w-24 flex-shrink-0">
                              {isToday ? (
                                <span className="text-lg font-bold text-blue-600">#{appointment.sequence_number || 1}</span>
                              ) : (
                                <div className="text-xs text-gray-600">
                                  {new Date(appointment.appointment_date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Clinic & Practice */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {appointment.clinic_name} • {appointment.practice_name}
                                </span>
                              </div>
                              {appointment.chief_complaint && (
                                <div className="text-xs text-gray-600 mt-0.5 truncate">{appointment.chief_complaint}</div>
                              )}
                            </div>

                            {/* Status Badge */}
                            <div className="flex-shrink-0">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                                {getStatusLabel(appointment.status)}
                              </span>
                            </div>

                            {/* Actions */}
                            <div className="flex-shrink-0 flex items-center gap-2">
                              <button
                                onClick={() => toggleExpanded(appointment.id)}
                                className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition-colors"
                              >
                                {expandedAppointments.has(appointment.id) ? (
                                  <>
                                    <ChevronUp className="w-3 h-3 inline" /> Hide
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3 inline" /> Details
                                  </>
                                )}
                              </button>

                              {canCancel(appointment) && !cancellingId && (
                                <button
                                  onClick={() => setCancellingId(appointment.id)}
                                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                                >
                                  <XCircle className="w-3 h-3" />
                                </button>
                              )}

                              {appointment.qr_code && !isCompleted && (
                                <button
                                  onClick={() => showQRCode(appointment)}
                                  className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition-colors"
                                >
                                  <QrCode className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Cancel Form */}
                          {cancellingId === appointment.id && (
                            <div className="px-6 py-4 bg-red-50 border-t border-red-200">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Reason for cancellation
                              </label>
                              <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                rows={2}
                                placeholder="Please provide a reason..."
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleCancelAppointment(appointment.appointment_id)}
                                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                  Confirm Cancellation
                                </button>
                                <button
                                  onClick={() => {
                                    setCancellingId(null);
                                    setCancelReason('');
                                  }}
                                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Expanded Details */}
                          {expandedAppointments.has(appointment.id) && (
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 space-y-4">
                        {/* Complaints */}
                        {(appointment.complaints || appointment.chief_complaint) && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-start gap-2 mb-2">
                              <FileText className="w-5 h-5 text-gray-600 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 mb-1">Complaints</h4>
                                <p className="text-sm text-gray-700">
                                  {appointment.complaints || appointment.chief_complaint}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Diagnosis */}
                        {appointment.diagnosis && (
                          <div className="bg-blue-50 rounded-lg p-4">
                            <div className="flex items-start gap-2 mb-2">
                              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 mb-1">Diagnosis</h4>
                                <p className="text-sm text-gray-700">{appointment.diagnosis}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Prescriptions */}
                        {appointment.prescriptions && appointment.prescriptions.length > 0 && (
                          <div className="bg-green-50 rounded-lg p-4">
                            <div className="flex items-start gap-2 mb-2">
                              <Pill className="w-5 h-5 text-green-600 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 mb-2">Prescriptions</h4>
                                <div className="space-y-2">
                                  {appointment.prescriptions.map((rx: any, idx: number) => (
                                    <div key={idx} className="text-sm text-gray-700 bg-white rounded p-2">
                                      <div className="font-medium">{rx.medicine || rx.name}</div>
                                      <div className="text-gray-600">
                                        {rx.dosage} - {rx.frequency} - {rx.duration}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Diagnostic Tests */}
                        {appointment.diagnosticTests && appointment.diagnosticTests.length > 0 && (
                          <div className="bg-purple-50 rounded-lg p-4">
                            <div className="flex items-start gap-2 mb-2">
                              <TestTube className="w-5 h-5 text-purple-600 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 mb-2">Diagnostic Tests Advised</h4>
                                <div className="space-y-1">
                                  {appointment.diagnosticTests.map((test: any, idx: number) => (
                                    <div key={idx} className="text-sm text-gray-700">
                                      • {test.name || test.test}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Test Results */}
                        {appointment.testResults && appointment.testResults.length > 0 && (
                          <div className="bg-indigo-50 rounded-lg p-4">
                            <div className="flex items-start gap-2 mb-2">
                              <TestTube className="w-5 h-5 text-indigo-600 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 mb-2">Test Results</h4>
                                <div className="space-y-2">
                                  {appointment.testResults.map((result: any, idx: number) => (
                                    <div key={idx} className="text-sm text-gray-700 bg-white rounded p-2">
                                      <div className="font-medium">{result.test || result.name}</div>
                                      <div className="text-gray-600">
                                        Result: {result.value} {result.unit}
                                        {result.normalRange && ` (Normal: ${result.normalRange})`}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Billing */}
                        {appointment.billingData && (
                          <div className="bg-yellow-50 rounded-lg p-4">
                            <div className="flex items-start gap-2 mb-2">
                              <Receipt className="w-5 h-5 text-yellow-600 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 mb-2">Billing Details</h4>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span>Consultation Fee:</span>
                                    <span className="font-medium">₹{appointment.billingData.consultationFee}</span>
                                  </div>
                                  {appointment.billingData.diagnosticFee && (
                                    <div className="flex justify-between">
                                      <span>Diagnostic Fee:</span>
                                      <span className="font-medium">₹{appointment.billingData.diagnosticFee}</span>
                                    </div>
                                  )}
                                  {appointment.billingData.medicationFee && (
                                    <div className="flex justify-between">
                                      <span>Medication Fee:</span>
                                      <span className="font-medium">₹{appointment.billingData.medicationFee}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between pt-2 border-t border-yellow-200">
                                    <span className="font-semibold">Total:</span>
                                    <span className="font-semibold">₹{appointment.billingData.total}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Payment Status:</span>
                                    <span className={`font-medium ${appointment.billingData.paid ? 'text-green-600' : 'text-red-600'}`}>
                                      {appointment.billingData.paid ? 'Paid' : 'Pending'}
                                    </span>
                                  </div>
                                  {appointment.billingData.receipt && (
                                    <div className="mt-2">
                                      <a
                                        href={appointment.billingData.receipt}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-700 text-sm"
                                      >
                                        Download Receipt →
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Documents */}
                        {appointment.documents && appointment.documents.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium text-gray-900 mb-2">Documents</h4>
                            <div className="space-y-2">
                              {appointment.documents.map((doc: any, idx: number) => (
                                <a
                                  key={idx}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-sm text-blue-600 hover:text-blue-700"
                                >
                                  📄 {doc.name || `Document ${idx + 1}`}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        )}
        </>
      )}

      {/* Add Past Visit Modal */}
      <AddPastVisitModal
        isOpen={showAddPastVisitModal}
        onClose={() => setShowAddPastVisitModal(false)}
        onSuccess={() => {
          fetchPastVisits();
        }}
      />

      {/* Scan Receipt Modal */}
      <ScanReceiptModal
        isOpen={showScanReceiptModal}
        onClose={() => setShowScanReceiptModal(false)}
        onSuccess={() => {
          fetchPastVisits();
        }}
      />

      {/* Appointment Ticket Modal */}
      {showTicket && selectedAppointment && (
        <AppointmentTicket
          appointment={selectedAppointment}
          onClose={() => {
            setShowTicket(false);
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
};

export default PatientDashboard;
