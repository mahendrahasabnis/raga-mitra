import React from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Pill, TestTube, Receipt, Edit, Trash2, Calendar } from 'lucide-react';

interface Medication {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing?: string;
  instructions?: string;
  quantity?: number;
}

interface Prescription {
  prescription_id: string;
  prescription_date: string;
  diagnosis?: string;
  medications: Medication[];
  lab_tests?: string[];
  advice?: string;
  follow_up_date?: string;
  file_url?: string;
  file_name?: string;
  is_ai_extracted?: boolean;
}

interface TestResult {
  test_result_id: string;
  test_name: string;
  test_category?: string;
  test_date: string;
  parameters?: Array<{
    parameter_name: string;
    value: number | string;
    unit: string;
    normal_range_min?: number;
    normal_range_max?: number;
    is_abnormal?: boolean;
  }>;
  interpretation?: string;
  notes?: string;
  file_url?: string;
  file_name?: string;
}

interface ReceiptData {
  receipt_id: string;
  receipt_type: string;
  receipt_date?: string;
  amount?: number;
  payment_method?: string;
  file_url?: string;
  file_name?: string;
}

interface ViewDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'prescription' | 'test-result' | 'receipt';
  document: Prescription | TestResult | ReceiptData;
  onEdit?: () => void;
  onDelete?: () => void;
}

const ViewDocumentModal: React.FC<ViewDocumentModalProps> = ({
  isOpen,
  onClose,
  documentType,
  document,
  onEdit,
  onDelete
}) => {
  if (!isOpen) return null;

  const renderPrescription = (prescription: Prescription) => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b">
          <Pill className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Prescription</h3>
            <p className="text-sm text-gray-600">
              {new Date(prescription.prescription_date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>

        {/* Diagnosis */}
        {prescription.diagnosis && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Diagnosis</h4>
            <p className="text-sm text-gray-900">{prescription.diagnosis}</p>
          </div>
        )}

        {/* Medications */}
        {prescription.medications && prescription.medications.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Medications ({prescription.medications.length})</h4>
            <div className="space-y-3">
              {prescription.medications.map((med: Medication, idx: number) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-medium text-gray-900">{med.medicine_name}</h5>
                    {med.quantity && (
                      <span className="text-xs text-gray-500">Qty: {med.quantity}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Dosage:</span> {med.dosage}
                    </div>
                    <div>
                      <span className="font-medium">Frequency:</span> {med.frequency}
                    </div>
                    {med.duration && (
                      <div>
                        <span className="font-medium">Duration:</span> {med.duration}
                      </div>
                    )}
                    {med.timing && (
                      <div>
                        <span className="font-medium">Timing:</span> {med.timing}
                      </div>
                    )}
                  </div>
                  {med.instructions && (
                    <p className="text-xs text-gray-600 mt-2 italic">{med.instructions}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lab Tests */}
        {prescription.lab_tests && prescription.lab_tests.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Recommended Lab Tests</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {prescription.lab_tests.map((test: string, idx: number) => (
                <li key={idx}>{test}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Advice */}
        {prescription.advice && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Advice</h4>
            <p className="text-sm text-gray-900">{prescription.advice}</p>
          </div>
        )}

        {/* Follow Up */}
        {prescription.follow_up_date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Follow-up: </span>
            <span className="font-medium text-gray-900">
              {new Date(prescription.follow_up_date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </span>
          </div>
        )}

        {/* Document File */}
        {prescription.file_url && (
          <div className="pt-3 border-t">
            <a
              href={prescription.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              <FileText className="w-4 h-4" />
              View Prescription Document
              {prescription.file_name && (
                <span className="text-gray-500">({prescription.file_name})</span>
              )}
            </a>
          </div>
        )}
      </div>
    );
  };

  const renderTestResult = (testResult: TestResult) => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b">
          <TestTube className="w-5 h-5 text-purple-600" />
          <div>
            <h3 className="font-semibold text-gray-900">{testResult.test_name}</h3>
            {testResult.test_category && (
              <p className="text-sm text-gray-600">{testResult.test_category}</p>
            )}
            <p className="text-sm text-gray-600">
              {new Date(testResult.test_date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>

        {/* Parameters */}
        {testResult.parameters && testResult.parameters.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Test Parameters</h4>
            <div className="space-y-2">
              {testResult.parameters.map((param: any, idx: number) => (
                <div
                  key={idx}
                  className={`bg-gray-50 rounded-lg p-3 border ${
                    param.is_abnormal ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">{param.parameter_name}</h5>
                      <div className="flex items-center gap-3 mt-1 text-sm">
                        <span className="font-semibold text-gray-900">
                          {param.value} {param.unit}
                        </span>
                        {(param.normal_range_min !== undefined || param.normal_range_max !== undefined) && (
                          <span className="text-gray-500">
                            (Normal: {param.normal_range_min ?? 'N/A'} - {param.normal_range_max ?? 'N/A'} {param.unit})
                          </span>
                        )}
                      </div>
                    </div>
                    {param.is_abnormal && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                        Abnormal
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interpretation */}
        {testResult.interpretation && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Interpretation</h4>
            <p className="text-sm text-gray-900">{testResult.interpretation}</p>
          </div>
        )}

        {/* Notes */}
        {testResult.notes && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Notes</h4>
            <p className="text-sm text-gray-900">{testResult.notes}</p>
          </div>
        )}

        {/* Document File */}
        {testResult.file_url && (
          <div className="pt-3 border-t">
            <a
              href={testResult.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              <FileText className="w-4 h-4" />
              View Test Result Document
              {testResult.file_name && (
                <span className="text-gray-500">({testResult.file_name})</span>
              )}
            </a>
          </div>
        )}
      </div>
    );
  };

  const renderReceipt = (receipt: ReceiptData) => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b">
          <Receipt className="w-5 h-5 text-green-600" />
          <div>
            <h3 className="font-semibold text-gray-900 capitalize">{receipt.receipt_type} Receipt</h3>
            {receipt.receipt_date && (
              <p className="text-sm text-gray-600">
                {new Date(receipt.receipt_date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            )}
          </div>
        </div>

        {/* Amount */}
        {receipt.amount && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Amount</h4>
            <p className="text-lg font-semibold text-gray-900">₹{receipt.amount.toFixed(2)}</p>
          </div>
        )}

        {/* Payment Method */}
        {receipt.payment_method && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Payment Method</h4>
            <p className="text-sm text-gray-900 capitalize">{receipt.payment_method}</p>
          </div>
        )}

        {/* Document File */}
        {receipt.file_url && (
          <div className="pt-3 border-t">
            <a
              href={receipt.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              <FileText className="w-4 h-4" />
              View Receipt Document
              {receipt.file_name && (
                <span className="text-gray-500">({receipt.file_name})</span>
              )}
            </a>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            View {documentType === 'prescription' ? 'Prescription' : documentType === 'test-result' ? 'Test Result' : 'Receipt'}
          </h2>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {documentType === 'prescription' && renderPrescription(document as Prescription)}
          {documentType === 'test-result' && renderTestResult(document as TestResult)}
          {documentType === 'receipt' && renderReceipt(document as ReceiptData)}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ViewDocumentModal;

