import React, { useState, useRef } from 'react';
import { Scan, Upload, X, Loader, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { medicalHistoryApi } from '../../services/api';
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

interface ReceiptScanSectionProps {
  onDataExtracted: (extractedData: any) => void;
}

const ReceiptScanSection: React.FC<ReceiptScanSectionProps> = ({ onDataExtracted }) => {
  const [scanning, setScanning] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [detectedType, setDetectedType] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewBase64, setPreviewBase64] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileBase64, setFileBase64] = useState<string>('');

  const renderPdfFirstPage = async (pdfFile: File): Promise<Blob> => {
    const buffer = await pdfFile.arrayBuffer();
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.8)
    );
    return blob;
  };

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setExtractedData(null);
      setDetectedType("");
      setPreviewUrl("");
      setPreviewBase64("");
      
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
        setError('Failed to read file. Please try again.');
      };
      reader.readAsDataURL(selectedFile);

      if (selectedFile.type === 'application/pdf') {
        renderPdfFirstPage(selectedFile)
          .then((blob) => blobToBase64(blob))
          .then((base64) => {
            setPreviewBase64(base64);
            setPreviewUrl(`data:image/jpeg;base64,${base64}`);
          })
          .catch(() => {
            setError('Failed to render PDF preview.');
          });
      } else if (selectedFile.type.startsWith('image/')) {
        const imageReader = new FileReader();
        imageReader.onload = () => {
          const result = imageReader.result as string;
          setPreviewUrl(result);
          setPreviewBase64(result.split(',')[1] || "");
        };
        imageReader.readAsDataURL(selectedFile);
      }
    }
  };

  const handleScan = async () => {
    if (!file) {
      setError('Please select a receipt file');
      return;
    }

    if (!fileBase64) {
      setError('Failed to read file. Please try again.');
      return;
    }

    setScanning(true);
    setError(null);

    try {
      // Send file as base64 data directly (without data URL prefix)
      let extractionBase64 = previewBase64 || fileBase64;
      let extractionType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      if (extractionType === 'application/pdf') {
        const previewBlob = await renderPdfFirstPage(file);
        extractionBase64 = await blobToBase64(previewBlob);
        extractionType = 'image/jpeg';
      }

      const receiptData = {
        file_base64: extractionBase64, // Pure base64 without data:image/jpeg;base64, prefix
        file_name: file.name,
        file_type: extractionType,
        use_ai_extraction: true
      };

      console.log('📤 Extracting receipt data...', { 
        fileName: file.name, 
        fileType: receiptData.file_type,
        fileSize: file.size,
        base64Length: fileBase64.length
      });
      
      const response = await medicalHistoryApi.extractDocumentData(receiptData);
      
      console.log('✅ Extraction response:', response);

      if (response.extracted_data) {
        const docType = response.document_type || response.detection?.document_type || '';
        const receiptType = response.receipt_type || response.detection?.receipt_type || '';
        setDetectedType([docType, receiptType].filter(Boolean).join(" / "));
        setExtractedData(response.extracted_data);
        onDataExtracted(response.extracted_data);
      } else {
        setError(response.message || 'No data extracted from receipt. Please try again or enter manually.');
      }
    } catch (error: any) {
      console.error('❌ Error extracting receipt:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to extract receipt data. Please try again.';
      setError(errorMessage);
    } finally {
      setScanning(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setFileUrl('');
    setExtractedData(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center gap-2 mb-3">
        <Scan className="w-5 h-5 text-purple-600" />
        <h3 className="font-medium text-gray-900">Scan Receipt (Optional)</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Upload a consultation receipt to automatically extract doctor name, clinic, date, address, and fee.
      </p>

      {/* File Upload */}
      <div className="mb-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          {file ? (
            <div className="space-y-2">
              <FileText className="w-8 h-8 text-blue-600 mx-auto" />
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <button
                type="button"
                onClick={handleClear}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Click to upload receipt
              </button>
              <p className="text-xs text-gray-500 mt-1">PNG, JPG, PDF up to 10MB</p>
            </div>
          )}
        </div>
      </div>

      {/* Scan Button */}
      {file && !extractedData && (
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scanning ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Scanning with Gemini AI...
            </>
          ) : (
            <>
              <Scan className="w-4 h-4" />
              Extract Data from Receipt
            </>
          )}
        </button>
      )}

      {previewUrl && !extractedData && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Preview</p>
          <img src={previewUrl} alt="Document preview" className="w-full border border-gray-200 rounded-lg" />
        </div>
      )}

      {extractedData && (
        <div className="mt-4 text-xs text-gray-600">
          {detectedType && (
            <p className="mb-2">Detected: {detectedType}</p>
          )}
          <pre className="bg-white border border-gray-200 rounded-md p-3 overflow-x-auto">
            {JSON.stringify(extractedData, null, 2)}
          </pre>
        </div>
      )}

      {/* Extracted Data Preview */}
      {extractedData && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h4 className="font-medium text-green-900">Data Extracted Successfully</h4>
            {extractedData.confidence && (
              <span className="text-xs text-green-700 ml-auto">
                Confidence: {(extractedData.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="text-xs text-green-800 space-y-1">
            {extractedData.doctor_name && (
              <p><strong>Doctor:</strong> {extractedData.doctor_name}</p>
            )}
            {extractedData.clinic_name && (
              <p><strong>Clinic:</strong> {extractedData.clinic_name}</p>
            )}
            {extractedData.receipt_date && (
              <p><strong>Date:</strong> {extractedData.receipt_date}</p>
            )}
            {extractedData.city && (
              <p><strong>City:</strong> {extractedData.city}</p>
            )}
            {extractedData.consultation_fee && (
              <p><strong>Fee:</strong> ₹{extractedData.consultation_fee}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="mt-2 text-xs text-green-700 hover:text-green-800"
          >
            Clear and rescan
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptScanSection;

