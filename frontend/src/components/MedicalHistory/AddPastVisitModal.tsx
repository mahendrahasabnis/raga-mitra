import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Plus, User, Calendar, MapPin, FileText, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { medicalHistoryApi } from '../../services/api';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import ReceiptScanSection from './ReceiptScanSection';

interface AddPastVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId?: string;
  patientName?: string;
}

const AddPastVisitModal: React.FC<AddPastVisitModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  patientId,
  patientName
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorSearchResults, setDoctorSearchResults] = useState<any[]>([]);
  const [showDoctorSearch, setShowDoctorSearch] = useState(false);
  const [clinicSearch, setClinicSearch] = useState('');
  const [clinicSearchResults, setClinicSearchResults] = useState<any[]>([]);
  const [showClinicSearch, setShowClinicSearch] = useState(false);
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [showSpecialtySearch, setShowSpecialtySearch] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<any>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [formData, setFormData] = useState({
    visit_date: '',
    doctor_type: 'platform', // 'platform' or 'custom'
    doctor_id: '',
    unverified_doctor_id: '',
    doctor_name: '',
    doctor_specialty: '',
    doctor_registration_number: '',
    clinic_name: '',
    hcp_name: '',
    area: '',
    city: '',
    pincode: '',
    chief_complaint: '',
    diagnosis: '',
    notes: '',
    follow_up_date: '',
    consultation_fee: '',
    patient_id: '',
    patient_name: '',
    patient_phone: ''
  });

  // Fetch patient profile when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchOrCreatePatient();
    }
  }, [isOpen, user]);

  const fetchOrCreatePatient = async () => {
    if (!user?.phone) return;

    setLoadingPatient(true);
    try {
      // Try to get existing patient profile
      const response = await api.get('/patients/profile');
      const patient = response.data.patient;

      if (patient) {
        // Use existing patient
        setCurrentPatient(patient);
        setFormData(prev => ({
          ...prev,
          patient_id: patient.id,
          patient_name: patient.name || user?.name || '',
          patient_phone: patient.phone || user?.phone || ''
        }));
      } else {
        // No patient record exists - create one automatically
        const newPatientData = {
          name: user?.name || 'Patient',
          phone: user?.phone || '',
          sex: 'male',
          age: 30,
          year_of_birth: new Date().getFullYear() - 30
        };

        try {
          const createResponse = await api.post('/patients/register', newPatientData);
          const newPatient = createResponse.data.patient;
          setCurrentPatient(newPatient);
          setFormData(prev => ({
            ...prev,
            patient_id: newPatient.id,
            patient_name: newPatient.name || user?.name || '',
            patient_phone: newPatient.phone || user?.phone || ''
          }));
        } catch (createError: any) {
          console.error('Error creating patient:', createError);
          // If creation fails, still use user info (backend will handle it)
          setFormData(prev => ({
            ...prev,
            patient_id: '', // Let backend create or use null
            patient_name: user?.name || 'Patient',
            patient_phone: user?.phone || ''
          }));
        }
      }
    } catch (error: any) {
      console.error('Error fetching patient profile:', error);
      // Use user info as fallback
      setFormData(prev => ({
        ...prev,
        patient_id: patientId || '',
        patient_name: patientName || user?.name || 'Patient',
        patient_phone: user?.phone || ''
      }));
    } finally {
      setLoadingPatient(false);
    }
  };

  useEffect(() => {
    if (doctorSearch.length > 2) {
      searchDoctors();
    } else {
      setDoctorSearchResults([]);
    }
  }, [doctorSearch]);

  const searchDoctors = async () => {
    try {
      const results = await medicalHistoryApi.searchUnverifiedDoctors(doctorSearch);
      setDoctorSearchResults(results.doctors || []);
    } catch (error) {
      console.error('Error searching doctors:', error);
    }
  };

  // Common specialties list for searchable dropdown
  const COMMON_SPECIALTIES = [
    'General Medicine', 'Cardiology', 'Orthopedics', 'Neurology', 'Dermatology',
    'Gastroenterology', 'Urology', 'Gynecology', 'Pediatrics', 'Psychiatry',
    'Endocrinology', 'Nephrology', 'Oncology', 'Ophthalmology', 'ENT',
    'Pulmonology', 'Rheumatology', 'Anesthesiology', 'Radiology', 'Pathology',
    'Emergency Medicine', 'Geriatrics', 'Family Medicine', 'Internal Medicine',
    'Sports Medicine', 'Plastic Surgery', 'Cardiac Surgery', 'Neurosurgery'
  ];

  // Handler for receipt data extraction
  const handleReceiptDataExtracted = (extracted: any) => {
    console.log('📋 Receipt data extracted:', extracted);
    setExtractedData(extracted);
    
    // Auto-populate form fields from extracted data
    setFormData(prev => ({
      ...prev,
      visit_date: extracted.receipt_date ? extracted.receipt_date.split('T')[0] : prev.visit_date,
      doctor_name: extracted.doctor_name || prev.doctor_name,
      doctor_specialty: extracted.doctor_specialty || prev.doctor_specialty,
      clinic_name: extracted.clinic_name || prev.clinic_name,
      area: extracted.area || prev.area,
      city: extracted.city || prev.city,
      pincode: extracted.pincode || prev.pincode,
      consultation_fee: extracted.consultation_fee || extracted.total_amount || prev.consultation_fee,
      doctor_type: extracted.doctor_name ? 'custom' : prev.doctor_type
    }));
  };

  const handleDoctorSelect = (doctor: any) => {
    setFormData({
      ...formData,
      doctor_type: 'custom',
      unverified_doctor_id: doctor.id,
      doctor_name: doctor.doctor_name,
      doctor_specialty: doctor.specialty || '',
      clinic_name: doctor.clinic_name || '',
      area: doctor.area || '',
      city: doctor.city || '',
      pincode: doctor.pincode || ''
    });
    setDoctorSearch('');
    setShowDoctorSearch(false);
  };

  // Search clinics from unverified doctors
  useEffect(() => {
    if (clinicSearch.length > 2) {
      searchClinics();
    } else {
      setClinicSearchResults([]);
    }
  }, [clinicSearch]);

  const searchClinics = async () => {
    try {
      const results = await medicalHistoryApi.searchUnverifiedDoctors(clinicSearch);
      // Extract unique clinic names
      const clinics = Array.from(new Set(
        results.doctors
          ?.filter((d: any) => (d.clinic_name || "").toLowerCase().includes((clinicSearch || "").toLowerCase()))
          .map((d: any) => ({
            clinic_name: d.clinic_name,
            city: d.city,
            area: d.area,
            pincode: d.pincode
          })) || []
      ));
      setClinicSearchResults(clinics);
    } catch (error) {
      console.error('Error searching clinics:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate required fields
    if (!formData.visit_date || !formData.doctor_name) {
      alert('Please fill in all required fields: Visit Date and Doctor Name');
      setLoading(false);
      return;
    }

    // Ensure patient_name is set
    if (!formData.patient_name) {
      alert('Patient name is required. Please ensure you are logged in correctly.');
      setLoading(false);
      return;
    }

    try {
      const submitData = {
        ...formData,
        visit_date: new Date(formData.visit_date).toISOString(),
        follow_up_date: formData.follow_up_date ? new Date(formData.follow_up_date).toISOString() : null,
        consultation_fee: formData.consultation_fee ? parseFloat(formData.consultation_fee) : null,
        doctor_id: formData.doctor_type === 'platform' ? formData.doctor_id : null,
        unverified_doctor_id: formData.doctor_type === 'custom' ? formData.unverified_doctor_id : null,
        // Ensure required fields are present
        patient_id: formData.patient_id || currentPatient?.id || null,
        patient_name: formData.patient_name || user?.name || 'Patient',
        patient_phone: formData.patient_phone || user?.phone || ''
      };

      console.log('📤 Submitting past visit:', submitData);

      await medicalHistoryApi.createPastVisit(submitData);
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        visit_date: '',
        doctor_type: 'platform',
        doctor_id: '',
        unverified_doctor_id: '',
        doctor_name: '',
        doctor_specialty: '',
        doctor_registration_number: '',
        clinic_name: '',
        hcp_name: '',
        area: '',
        city: '',
        pincode: '',
        chief_complaint: '',
        diagnosis: '',
        notes: '',
        follow_up_date: '',
        consultation_fee: '',
        patient_id: patientId || '',
        patient_name: patientName || user?.name || '',
        patient_phone: user?.phone || ''
      });
    } catch (error: any) {
      console.error('Error creating past visit:', error);
      alert(error.response?.data?.message || 'Failed to add past visit');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Add Past Doctor Visit</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Loading Patient Info */}
          {loadingPatient && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              Loading your patient information...
            </div>
          )}

          {/* Patient Info Display (read-only) */}
          {!loadingPatient && formData.patient_name && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-gray-600" />
                <h3 className="font-medium text-gray-900">Patient Information</h3>
              </div>
              <div className="text-sm text-gray-700">
                <p><strong>Name:</strong> {formData.patient_name}</p>
                <p><strong>Phone:</strong> {formData.patient_phone}</p>
              </div>
            </div>
          )}

          {/* Receipt Scanning Section */}
          <ReceiptScanSection onDataExtracted={handleReceiptDataExtracted} />

          {/* Visit Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visit Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.visit_date}
              onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Doctor Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Doctor <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="platform"
                    checked={formData.doctor_type === 'platform'}
                    onChange={(e) => setFormData({ ...formData, doctor_type: e.target.value, doctor_name: '' })}
                    className="mr-2"
                  />
                  From Platform
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="custom"
                    checked={formData.doctor_type === 'custom'}
                    onChange={(e) => {
                      setFormData({ ...formData, doctor_type: e.target.value, doctor_id: '' });
                      setShowDoctorSearch(true);
                    }}
                    className="mr-2"
                  />
                  Custom/Unverified Doctor
                </label>
              </div>

              {formData.doctor_type === 'custom' && (
                <div className="space-y-4">
                  {/* Doctor Name - Searchable with direct typing */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Doctor Name <span className="text-red-500">*</span>
                    </label>
                    <Search className="absolute left-3 top-10 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      required
                      placeholder="Search for doctor or type name directly..."
                      value={formData.doctor_name || doctorSearch}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDoctorSearch(value);
                        setFormData({ ...formData, doctor_name: value });
                        if (value.length > 2) {
                          setShowDoctorSearch(true);
                        } else {
                          setShowDoctorSearch(false);
                        }
                      }}
                      onFocus={() => {
                        if ((formData.doctor_name || doctorSearch).length > 2) {
                          setShowDoctorSearch(true);
                        }
                      }}
                      onBlur={() => {
                        // Delay to allow clicking on dropdown items
                        setTimeout(() => setShowDoctorSearch(false), 200);
                      }}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {showDoctorSearch && (formData.doctor_name || doctorSearch).length > 2 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {doctorSearchResults.length > 0 ? (
                          doctorSearchResults.map((doctor) => (
                            <button
                              key={doctor.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault(); // Prevent onBlur from firing
                                handleDoctorSelect(doctor);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium">{doctor.doctor_name}</div>
                              <div className="text-sm text-gray-600">
                                {doctor.specialty} • {doctor.clinic_name}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-gray-600">
                            No doctors found. You can continue typing to use this name.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Enhanced Doctor Details with Searchable Dropdowns */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Specialty
                    </label>
                    <Search className="absolute left-3 top-9 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={formData.doctor_specialty}
                      onChange={(e) => {
                        setFormData({ ...formData, doctor_specialty: e.target.value });
                        setSpecialtySearch(e.target.value);
                        setShowSpecialtySearch(true);
                      }}
                      onFocus={() => setShowSpecialtySearch(true)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Search or type specialty"
                    />
                    {showSpecialtySearch && specialtySearch && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {COMMON_SPECIALTIES.filter(spec => 
                          (spec || "").toLowerCase().includes((specialtySearch || "").toLowerCase())
                        ).map((specialty) => (
                          <button
                            key={specialty}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, doctor_specialty: specialty });
                              setSpecialtySearch('');
                              setShowSpecialtySearch(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm"
                          >
                            {specialty}
                          </button>
                        ))}
                        {COMMON_SPECIALTIES.filter(spec => 
                          (spec || "").toLowerCase().includes((specialtySearch || "").toLowerCase())
                        ).length === 0 && (
                          <div className="px-4 py-2 text-sm text-gray-500">
                            No matches. You can type your own specialty.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Clinic Name
                    </label>
                    <Search className="absolute left-3 top-9 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={formData.clinic_name}
                      onChange={(e) => {
                        setFormData({ ...formData, clinic_name: e.target.value });
                        setClinicSearch(e.target.value);
                        setShowClinicSearch(true);
                      }}
                      onFocus={() => setShowClinicSearch(true)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Search or type clinic name"
                    />
                    {showClinicSearch && clinicSearch && clinicSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {clinicSearchResults.map((clinic: any, index: number) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                clinic_name: clinic.clinic_name,
                                city: clinic.city || formData.city,
                                area: clinic.area || formData.area,
                                pincode: clinic.pincode || formData.pincode
                              });
                              setClinicSearch('');
                              setShowClinicSearch(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm"
                          >
                            <div className="font-medium">{clinic.clinic_name}</div>
                            {clinic.city && (
                              <div className="text-xs text-gray-500">{clinic.city}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={formData.doctor_registration_number}
                      onChange={(e) => setFormData({ ...formData, doctor_registration_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Optional"
                    />
                  </div>
                  </div>
                </div>
              )}

              {/* Selected Doctor Display */}
              {formData.doctor_name && formData.unverified_doctor_id && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{formData.doctor_name}</div>
                      {formData.doctor_specialty && (
                        <div className="text-sm text-gray-600">{formData.doctor_specialty}</div>
                      )}
                      {formData.clinic_name && (
                        <div className="text-sm text-gray-600">{formData.clinic_name}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          unverified_doctor_id: '',
                          doctor_name: '',
                          doctor_specialty: '',
                          clinic_name: ''
                        });
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Clinic/Address Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Area
              </label>
              <input
                type="text"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Area/Locality"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="City"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pincode
              </label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Pincode"
              />
            </div>
          </div>

          {/* Medical Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chief Complaint
            </label>
            <textarea
              value={formData.chief_complaint}
              onChange={(e) => setFormData({ ...formData, chief_complaint: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="What was the main reason for visit?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Diagnosis
            </label>
            <textarea
              value={formData.diagnosis}
              onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="Doctor's diagnosis"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              rows={3}
              placeholder="Additional notes about the visit"
            />
          </div>

          {/* Additional Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Follow-up Date
              </label>
              <input
                type="date"
                value={formData.follow_up_date}
                onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Consultation Fee (₹)
              </label>
              <input
                type="number"
                value={formData.consultation_fee}
                onChange={(e) => setFormData({ ...formData, consultation_fee: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPastVisitModal;

