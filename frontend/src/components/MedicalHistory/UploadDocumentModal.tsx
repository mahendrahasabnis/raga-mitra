import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Image as ImageIcon, Download, Save } from 'lucide-react';
import { medicalHistoryApi } from '../../services/api';
import SelectDropdown from '../UI/SelectDropdown';

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointmentId: string;
  documentType: 'prescription' | 'receipt' | 'test-result';
}

const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  appointmentId,
  documentType
}) => {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [fileBase64, setFileBase64] = useState<string>('');
  const [useAiExtraction, setUseAiExtraction] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessages, setStatusMessages] = useState<Array<{ id: number; message: string; timestamp: Date; type: 'info' | 'success' | 'error' | 'warning' }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const addStatusMessage = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setStatusMessages(prev => {
      const newMessages = [...prev, { 
        id: Date.now() + Math.random(), 
        message, 
        timestamp: new Date(),
        type 
      }];
      // Store in localStorage for persistence
      try {
        localStorage.setItem('upload_status_messages', JSON.stringify(newMessages));
      } catch (e) {
        console.warn('Could not save messages to localStorage:', e);
      }
      return newMessages;
    });
  };

  // Load messages from localStorage on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('upload_status_messages');
      if (saved) {
        const messages = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        const parsedMessages = messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        setStatusMessages(parsedMessages);
      }
    } catch (e) {
      console.warn('Could not load messages from localStorage:', e);
    }
  }, []);

  const downloadMessages = () => {
    const content = statusMessages.map((msg, idx) => 
      `${idx + 1}. [${msg.timestamp.toLocaleString()}] [${msg.type.toUpperCase()}] ${msg.message}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upload-status-${new Date().toISOString().split('T')[0]}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Additional fields based on document type
  const [receiptType, setReceiptType] = useState<'consultation' | 'medicine' | 'test' | 'other'>('consultation');
  const [manualData, setManualData] = useState<any>({});

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // Read file as base64 for sending to backend
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setFileUrl(result); // Store data URL for preview
        // Extract base64 part (remove data:image/jpeg;base64, prefix)
        const base64Data = result.split(',')[1] || result;
        setFileBase64(base64Data);
      };
      reader.onerror = () => {
        alert('Failed to read file. Please try again.');
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file && !fileUrl) {
      alert('Please select a file or provide a file URL');
      return;
    }

    setLoading(true);
    setStatusMessages([]); // Clear previous messages
    addStatusMessage('🚀 Starting upload process...', 'info');

    try {
      // Send base64 if file is selected, otherwise use fileUrl
      const documentData: any = {
        file_name: file?.name || 'document.pdf',
        file_type: file?.type || 'application/pdf',
        file_size: file?.size || 0,
        use_ai_extraction: useAiExtraction
      };

      // Use base64 if file is selected, otherwise use fileUrl
      if (fileBase64) {
        documentData.file_base64 = fileBase64;
      } else if (fileUrl && fileUrl.startsWith('http')) {
        documentData.file_url = fileUrl;
      } else {
        alert('Please select a file or provide a valid file URL');
        setLoading(false);
        addStatusMessage('❌ Please select a file or provide a valid file URL', 'error');
        return;
      }

      if (documentType === 'receipt') {
        documentData.receipt_type = receiptType;
      }

      // Add manual data if provided
      if (Object.keys(manualData).length > 0) {
        documentData.manual_data = manualData;
      }

      addStatusMessage('💾 Preparing document for upload...', 'info');
      
      let response;
      addStatusMessage('📤 Sending document to server...', 'info');
      
      if (documentType === 'prescription') {
        response = await medicalHistoryApi.uploadPrescription(appointmentId, documentData);
        addStatusMessage('✅ Prescription uploaded successfully!', 'success');
      } else if (documentType === 'receipt') {
        response = await medicalHistoryApi.uploadReceipt(appointmentId, documentData);
        addStatusMessage('✅ Receipt uploaded successfully!', 'success');
      } else {
        // Test result upload
        addStatusMessage('📋 Test result document uploaded to server', 'success');
        
        if (useAiExtraction) {
          addStatusMessage('🤖 AI in Action - Extracting data from test report...', 'info');
        }
        
        response = await medicalHistoryApi.uploadTestResult(appointmentId, documentData);
        
        addStatusMessage('✅ Test result uploaded successfully!', 'success');
        console.log('📋 [FRONTEND] Document uploaded response:', response);

        if (documentType === 'test-result') {
          if (useAiExtraction && response.data?.ai_extraction?.success) {
            addStatusMessage(`✅ Data extracted successfully! Confidence: ${(response.data.ai_extraction.confidence * 100).toFixed(0)}%`, 'success');
          }
          
          addStatusMessage('📊 Processing test parameters...', 'info');
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Show vitals saved info if available
          if (response.data?.vitals_saved) {
            const { saved_count, total_parameters, parameter_names, test_date, test_time } = response.data.vitals_saved;
            
            addStatusMessage(`📈 Found ${total_parameters} parameter${total_parameters > 1 ? 's' : ''} in test result`, 'info');
            
            if (test_date) {
              addStatusMessage(`📅 Test date: ${test_date}${test_time ? `, Time: ${test_time}` : ''}`, 'info');
            }
            
            if (saved_count > 0) {
              addStatusMessage(`💾 Saving ${saved_count} parameter${saved_count > 1 ? 's' : ''} to vitals database...`, 'info');
              
              if (parameter_names && parameter_names.length > 0) {
                parameter_names.forEach((paramName: string, idx: number) => {
                  setTimeout(() => {
                    addStatusMessage(`  ✓ Saved: ${paramName}`, 'success');
                  }, (idx + 1) * 200);
                });
              }
              
              await new Promise(resolve => setTimeout(resolve, 1000));
              addStatusMessage(`✅ Successfully saved ${saved_count} of ${total_parameters} parameter${saved_count > 1 ? 's' : ''} to vitals database!`, 'success');
            } else {
              addStatusMessage(`⚠️ No parameters could be saved (${total_parameters - saved_count} skipped - values may not be numeric or missing)`, 'warning');
            }
            
            if (saved_count < total_parameters) {
              const skipped = total_parameters - saved_count;
              addStatusMessage(`⚠️ ${skipped} parameter${skipped > 1 ? 's' : ''} skipped (non-numeric values or missing data)`, 'warning');
            }
          } else {
            addStatusMessage('⚠️ Could not determine saved parameter count from response', 'warning');
            console.warn('⚠️ [FRONTEND] Response data:', response.data);
          }
          
          addStatusMessage('🔄 Triggering Vital Trends Dashboard refresh...', 'info');
        }
      }

      addStatusMessage('✅ Operation completed successfully!', 'success');
      setLoading(false);
      
      // Wait a moment to show all messages - but DON'T auto-close
      // Let user see all messages and manually close or click OK
      addStatusMessage('💡 Review all messages above. Click "Download Messages" to save, then "Close" when done.', 'info');
      
      // Call onSuccess to refresh parent component data (but DON'T close modal)
      onSuccess();
      
      // DON'T auto-close - let user close manually after reviewing messages
      // Keep all messages visible for review
    } catch (error: any) {
      console.error('❌ [FRONTEND] Error uploading document:', error);
      addStatusMessage(`❌ Error: ${error.response?.data?.message || error.message || 'Failed to upload document'}`, 'error');
      
      if (error.response?.data) {
        console.error('❌ [FRONTEND] Error response data:', error.response.data);
        addStatusMessage(`Details: ${JSON.stringify(error.response.data)}`, 'error');
      }
      
      setLoading(false);
    }
  };


  if (!isOpen) return null;

  // Prevent closing modal by clicking outside during upload
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      // Only allow closing by clicking backdrop if not loading
      if (statusMessages.length === 0 || window.confirm('Close dialog? Status messages will be lost.')) {
        try {
          localStorage.removeItem('upload_status_messages');
        } catch (e) {}
        setStatusMessages([]);
        onClose();
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg max-w-2xl w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Upload {documentType === 'prescription' ? 'Prescription' : documentType === 'receipt' ? 'Receipt' : 'Test Result'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Receipt Type Selector */}
          {documentType === 'receipt' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Receipt Type
              </label>
              <SelectDropdown
                value={receiptType}
                options={[
                  { value: 'consultation', label: 'Consultation' },
                  { value: 'medicine', label: 'Medicine Purchase' },
                  { value: 'test', label: 'Test/Diagnostics' },
                  { value: 'other', label: 'Other' },
                ]}
                onChange={(value) => setReceiptType(value as any)}
              />
            </div>
          )}

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload File <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div className="space-y-2">
                  <FileText className="w-12 h-12 text-blue-600 mx-auto" />
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button
                    onClick={() => {
                      setFile(null);
                      setFileUrl('');
                      setFileBase64('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
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
                    Click to upload
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
              placeholder="https://example.com/document.pdf"
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
              Use AI to extract data from document (Gemini AI)
            </label>
          </div>

          {/* Status Messages - Show All */}
          {statusMessages.length > 0 && (
            <div className="max-h-96 overflow-y-auto border-2 border-gray-300 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2 sticky top-0 bg-gray-50 pb-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">
                  📋 Upload Progress ({statusMessages.length} message{statusMessages.length > 1 ? 's' : ''}):
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={downloadMessages}
                    className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 flex items-center gap-1"
                    title="Download messages to file"
                  >
                    <Download className="w-3 h-3" />
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setStatusMessages([]);
                      try {
                        localStorage.removeItem('upload_status_messages');
                      } catch (e) {}
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="space-y-1 mt-2">
                {statusMessages.map((status, index) => (
                  <div
                    key={status.id}
                    className={`p-2.5 rounded text-xs flex items-start gap-2 border ${
                      status.type === 'error'
                        ? 'bg-red-50 border-red-300 text-red-800'
                        : status.type === 'success'
                        ? 'bg-green-50 border-green-300 text-green-800'
                        : status.type === 'warning'
                        ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                        : 'bg-blue-50 border-blue-300 text-blue-800'
                    }`}
                  >
                    {loading && status.type === 'info' && index === statusMessages.length - 1 && (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mt-0.5 flex-shrink-0"></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium break-words">{status.message}</p>
                      <p className="text-xs opacity-70 mt-0.5">
                        {status.timestamp.toLocaleTimeString()} • Step {index + 1}/{statusMessages.length}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                if (loading) {
                  // Cancel upload
                  addStatusMessage('⚠️ Upload cancelled by user', 'warning');
                  setLoading(false);
                  return;
                }
                // Reset form on close
                setFile(null);
                setFileUrl('');
                setFileBase64('');
                setManualData({});
                setStatusMessages([]);
                try {
                  localStorage.removeItem('upload_status_messages');
                } catch (e) {}
                onClose();
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {loading ? 'Cancel Upload' : 'Close'}
            </button>
            {!loading && (
              <button
                onClick={handleUpload}
                disabled={!file && !fileUrl}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload Document
              </button>
            )}
            {loading && (
              <div className="px-6 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadDocumentModal;

