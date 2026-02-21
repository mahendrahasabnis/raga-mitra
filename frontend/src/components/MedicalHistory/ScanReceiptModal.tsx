import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, Loader, CheckCircle } from 'lucide-react';
import { medicalHistoryApi } from '../../services/api';

interface ScanReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ScanReceiptModal: React.FC<ScanReceiptModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [useAiExtraction, setUseAiExtraction] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = () => {
        setFileUrl(URL.createObjectURL(selectedFile));
      };
      reader.readAsDataURL(selectedFile);
      setExtractedData(null);
    }
  };

  const handleScan = async () => {
    if (!file && !fileUrl) {
      alert('Please select a file or provide a file URL');
      return;
    }

    setScanning(true);
    try {
      // For now, we'll use a placeholder URL or upload to a service
      // In production, you'd upload the file to cloud storage first
      const documentData: any = {
        file_url: fileUrl || (file ? URL.createObjectURL(file) : ''),
        file_name: file?.name || 'receipt.pdf',
        file_type: file?.type || 'application/pdf',
        use_ai_extraction: useAiExtraction
      };

      // Call the scan receipt endpoint
      const response = await medicalHistoryApi.scanReceiptAndCreateVisit(documentData);
      
      if (response.extracted_data) {
        setExtractedData(response.extracted_data);
      }

      if (response.past_visit) {
        alert('Past visit created successfully from receipt!');
        onSuccess();
        onClose();
        resetForm();
      }
    } catch (error: any) {
      console.error('Error scanning receipt:', error);
      
      // If extraction succeeded but visit creation failed, show extracted data
      if (error.response?.data?.extracted_data) {
        setExtractedData(error.response.data.extracted_data);
        alert('Data extracted. Please review and create visit manually or fix missing fields.');
      } else {
        alert(error.response?.data?.message || 'Failed to scan receipt. Please try again or enter data manually.');
      }
    } finally {
      setScanning(false);
    }
  };

  const handleCreateVisit = async () => {
    if (!extractedData) return;

    setLoading(true);
    try {
      // Create visit with extracted data
      const visitData = {
        visit_date: extractedData.receipt_date || new Date().toISOString().split('T')[0],
        doctor_name: extractedData.doctor_name || '',
        clinic_name: extractedData.clinic_name || '',
        area: extractedData.area || '',
        city: extractedData.city || '',
        pincode: extractedData.pincode || '',
        consultation_fee: extractedData.consultation_fee || extractedData.total_amount || null
      };

      await medicalHistoryApi.createPastVisit(visitData);
      alert('Past visit created successfully!');
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Error creating visit:', error);
      alert(error.response?.data?.message || 'Failed to create past visit');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setFileUrl('');
    setExtractedData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Scan Receipt to Create Past Visit</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Receipt <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file || fileUrl ? (
                <div className="space-y-2">
                  <FileText className="w-12 h-12 text-blue-600 mx-auto" />
                  <p className="text-sm font-medium text-gray-900">{file?.name || 'File selected'}</p>
                  {file && (
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  )}
                  <button
                    onClick={() => {
                      setFile(null);
                      setFileUrl('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                      setExtractedData(null);
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Click to upload receipt
                  </button>
                  <p className="text-xs text-gray-500 mt-1">or drag and drop</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, PDF up to 10MB</p>
                </div>
              )}
            </div>
          </div>

          {/* File URL (Alternative) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or Provide File URL
            </label>
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="https://example.com/receipt.pdf"
            />
          </div>

          {/* AI Extraction Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useAi"
              checked={useAiExtraction}
              onChange={(e) => setUseAiExtraction(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="useAi" className="text-sm text-gray-700">
              Use AI to extract data from receipt (Gemini AI)
            </label>
          </div>

          {/* Extracted Data Preview */}
          {extractedData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-medium text-green-900">Data Extracted Successfully</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {extractedData.doctor_name && (
                  <div>
                    <span className="text-gray-600">Doctor:</span>
                    <span className="font-medium ml-2">{extractedData.doctor_name}</span>
                  </div>
                )}
                {extractedData.clinic_name && (
                  <div>
                    <span className="text-gray-600">Clinic:</span>
                    <span className="font-medium ml-2">{extractedData.clinic_name}</span>
                  </div>
                )}
                {extractedData.receipt_date && (
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium ml-2">{extractedData.receipt_date}</span>
                  </div>
                )}
                {extractedData.city && (
                  <div>
                    <span className="text-gray-600">City:</span>
                    <span className="font-medium ml-2">{extractedData.city}</span>
                  </div>
                )}
                {extractedData.pincode && (
                  <div>
                    <span className="text-gray-600">Pincode:</span>
                    <span className="font-medium ml-2">{extractedData.pincode}</span>
                  </div>
                )}
                {extractedData.consultation_fee && (
                  <div>
                    <span className="text-gray-600">Fee:</span>
                    <span className="font-medium ml-2">₹{extractedData.consultation_fee}</span>
                  </div>
                )}
              </div>
              {extractedData.confidence && (
                <p className="text-xs text-gray-500 mt-2">Confidence: {(extractedData.confidence * 100).toFixed(0)}%</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {!extractedData ? (
              <button
                onClick={handleScan}
                disabled={loading || scanning || (!file && !fileUrl)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {scanning ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  'Scan Receipt'
                )}
              </button>
            ) : (
              <button
                onClick={handleCreateVisit}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Past Visit'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ScanReceiptModal;

