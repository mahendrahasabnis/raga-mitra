import React, { useState } from 'react';
import { Calendar, MapPin, FileText, Pill, Receipt, TestTube, ChevronDown, ChevronUp, Upload, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { medicalHistoryApi } from '../../services/api';
import UploadDocumentModal from './UploadDocumentModal';
import ViewDocumentModal from './ViewDocumentModal';

interface PastVisit {
  id: string;
  appointment_id: string;
  visit_date: string;
  doctor_name: string;
  doctor_specialty?: string;
  clinic_name?: string;
  area?: string;
  city?: string;
  chief_complaint?: string;
  diagnosis?: string;
  consultation_fee?: number;
  notes?: string;
}

interface PastVisitsListProps {
  visits: any[];
  onRefresh: () => void;
}

const PastVisitsList: React.FC<PastVisitsListProps> = ({ visits, onRefresh }) => {
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [uploadModal, setUploadModal] = useState<{ open: boolean; appointmentId: string; type: 'prescription' | 'receipt' | 'test-result' } | null>(null);
  const [viewModal, setViewModal] = useState<{ open: boolean; type: 'prescription' | 'receipt' | 'test-result'; document: any } | null>(null);
  const [visitDetails, setVisitDetails] = useState<any>({});

  const toggleExpand = async (appointmentId: string) => {
    if (expandedVisit === appointmentId) {
      setExpandedVisit(null);
    } else {
      setExpandedVisit(appointmentId);
      // Fetch detailed visit information
      try {
        const details = await medicalHistoryApi.getPastVisitDetails(appointmentId);
        setVisitDetails({
          ...visitDetails,
          [appointmentId]: details
        });
      } catch (error) {
        console.error('Error fetching visit details:', error);
      }
    }
  };

  const handleUploadSuccess = () => {
    if (uploadModal) {
      const appointmentId = uploadModal.appointmentId;
      // Refresh visit details
      medicalHistoryApi.getPastVisitDetails(appointmentId).then(details => {
        setVisitDetails({
          ...visitDetails,
          [appointmentId]: details
        });
      });
      
      // If test result was uploaded, trigger vital trends refresh
      if (uploadModal.type === 'test-result') {
        // Dispatch custom event to refresh vital trends
        window.dispatchEvent(new CustomEvent('refreshVitalTrends'));
        console.log('🔄 [PAST VISITS] Triggered vital trends refresh after test result upload');
      }
    }
    onRefresh();
  };

  const handleDeleteVisit = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to delete this visit? This action cannot be undone.')) {
      return;
    }
    try {
      await medicalHistoryApi.deletePastVisit(appointmentId);
      alert('Visit deleted successfully');
      onRefresh();
      setExpandedVisit(null);
    } catch (error: any) {
      console.error('Error deleting visit:', error);
      alert(error.response?.data?.message || 'Failed to delete visit');
    }
  };

  const handleDeleteDocument = async (type: 'prescription' | 'receipt' | 'test-result', id: string, appointmentId: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) {
      return;
    }
    try {
      if (type === 'prescription') {
        await medicalHistoryApi.deletePrescription(id);
      } else if (type === 'receipt') {
        await medicalHistoryApi.deleteReceipt(id);
      } else {
        await medicalHistoryApi.deleteTestResult(id);
      }
      alert(`${type} deleted successfully`);
      // Refresh visit details
      const details = await medicalHistoryApi.getPastVisitDetails(appointmentId);
      setVisitDetails({
        ...visitDetails,
        [appointmentId]: details
      });
      onRefresh();
    } catch (error: any) {
      console.error(`Error deleting ${type}:`, error);
      alert(error.response?.data?.message || `Failed to delete ${type}`);
    }
  };

  if (visits.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No past visits found</h3>
        <p className="text-gray-600">Add your past doctor visits to track your medical history</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visits.map((visit) => {
        const details = visitDetails[visit.appointment_id];
        const isExpanded = expandedVisit === visit.appointment_id;

        return (
          <div key={visit.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Visit Header */}
            <div
              className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleExpand(visit.appointment_id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {new Date(visit.visit_date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{visit.doctor_name}</h3>
                  {visit.doctor_specialty && (
                    <p className="text-sm text-gray-600">{visit.doctor_specialty}</p>
                  )}
                  {(visit.clinic_name || visit.area || visit.city) && (
                    <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span>
                        {[visit.clinic_name, visit.area, visit.city].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {visit.diagnosis && (
                    <p className="text-sm text-gray-700 mt-2 font-medium">{visit.diagnosis}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {visit.consultation_fee && (
                    <span className="text-sm font-medium text-gray-700">
                      ₹{visit.consultation_fee}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Implement edit visit modal
                      alert('Edit visit functionality coming soon');
                    }}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit Visit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteVisit(visit.appointment_id);
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete Visit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && details && (
              <div className="border-t border-gray-200 px-6 py-4 space-y-4 bg-gray-50">
                {/* Visit Details */}
                <div>
                  {visit.chief_complaint && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Chief Complaint</h4>
                      <p className="text-sm text-gray-600">{visit.chief_complaint}</p>
                    </div>
                  )}
                  {visit.notes && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Notes</h4>
                      <p className="text-sm text-gray-600">{visit.notes}</p>
                    </div>
                  )}
                </div>

                {/* Documents Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700">Documents</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadModal({ open: true, appointmentId: visit.appointment_id, type: 'prescription' });
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      >
                        <Plus className="w-3 h-3" />
                        Prescription
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadModal({ open: true, appointmentId: visit.appointment_id, type: 'receipt' });
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100"
                      >
                        <Plus className="w-3 h-3" />
                        Receipt
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadModal({ open: true, appointmentId: visit.appointment_id, type: 'test-result' });
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-purple-50 text-purple-600 rounded hover:bg-purple-100"
                      >
                        <Plus className="w-3 h-3" />
                        Test Result
                      </button>
                    </div>
                  </div>

                  {/* Prescriptions */}
                  {details.documents?.prescriptions && details.documents.prescriptions.length > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Pill className="w-4 h-4 text-blue-600" />
                        <h5 className="text-sm font-medium text-gray-900">Prescriptions</h5>
                      </div>
                      {details.documents.prescriptions.map((prescription: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 mb-1">
                          <div className="flex-1">
                            <button
                              onClick={() => setViewModal({ open: true, type: 'prescription', document: prescription })}
                              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                            >
                              <Eye className="w-4 h-4" />
                              Prescription {idx + 1}
                              {prescription.medications && prescription.medications.length > 0 && (
                                <span className="text-gray-500">({prescription.medications.length} medications)</span>
                              )}
                            </button>
                            {prescription.file_url && (
                              <a
                                href={prescription.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-500 hover:text-gray-700 ml-6"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Document
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setViewModal({ open: true, type: 'prescription', document: prescription })}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDocument('prescription', prescription.prescription_id, visit.appointment_id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Receipts */}
                  {details.documents?.receipts && details.documents.receipts.length > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt className="w-4 h-4 text-green-600" />
                        <h5 className="text-sm font-medium text-gray-900">Receipts</h5>
                      </div>
                      {details.documents.receipts.map((receipt: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 mb-1">
                          <div className="flex-1">
                            <button
                              onClick={() => setViewModal({ open: true, type: 'receipt', document: receipt })}
                              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                            >
                              <Eye className="w-4 h-4" />
                              {receipt.receipt_type} Receipt - ₹{receipt.amount || 'N/A'}
                            </button>
                            {receipt.file_url && (
                              <a
                                href={receipt.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-500 hover:text-gray-700 ml-6"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Document
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setViewModal({ open: true, type: 'receipt', document: receipt })}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDocument('receipt', receipt.receipt_id, visit.appointment_id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Test Results */}
                  {details.documents?.test_results && details.documents.test_results.length > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <TestTube className="w-4 h-4 text-purple-600" />
                        <h5 className="text-sm font-medium text-gray-900">Test Results</h5>
                      </div>
                      {details.documents.test_results.map((test: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 mb-1">
                          <div className="flex-1">
                            <button
                              onClick={() => setViewModal({ open: true, type: 'test-result', document: test })}
                              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                            >
                              <Eye className="w-4 h-4" />
                              {test.test_name}
                              {test.parameters && test.parameters.length > 0 && (
                                <span className="text-gray-500">({test.parameters.length} parameters)</span>
                              )}
                            </button>
                            {test.file_url && (
                              <a
                                href={test.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-500 hover:text-gray-700 ml-6"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Document
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setViewModal({ open: true, type: 'test-result', document: test })}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDocument('test-result', test.test_result_id, visit.appointment_id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(!details.documents?.prescriptions?.length && 
                    !details.documents?.receipts?.length && 
                    !details.documents?.test_results?.length) && (
                    <p className="text-sm text-gray-500 text-center py-2">
                      No documents uploaded yet. Click buttons above to add documents.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Upload Document Modal */}
      {uploadModal && (
        <UploadDocumentModal
          isOpen={uploadModal.open}
          onClose={() => setUploadModal(null)}
          onSuccess={handleUploadSuccess}
          appointmentId={uploadModal.appointmentId}
          documentType={uploadModal.type}
        />
      )}

      {/* View Document Modal */}
      {viewModal && (
        <ViewDocumentModal
          isOpen={viewModal.open}
          onClose={() => setViewModal(null)}
          documentType={viewModal.type}
          document={viewModal.document}
          onEdit={() => {
            // TODO: Implement edit functionality
            alert('Edit functionality coming soon');
          }}
          onDelete={() => {
            if (viewModal.document) {
              const id = viewModal.type === 'prescription' 
                ? viewModal.document.prescription_id
                : viewModal.type === 'receipt'
                ? viewModal.document.receipt_id
                : viewModal.document.test_result_id;
              
              const appointmentId = viewModal.document.appointment_id;
              handleDeleteDocument(viewModal.type, id, appointmentId);
              setViewModal(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default PastVisitsList;

