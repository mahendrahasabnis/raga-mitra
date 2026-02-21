import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Upload, FileText, CheckCircle2 } from "lucide-react";
import { healthApi } from "../../services/api";

interface DiagnosticsUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientId?: string;
}

const DiagnosticsUpload: React.FC<DiagnosticsUploadProps> = ({
  isOpen,
  onClose,
  onSuccess,
  clientId,
}) => {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedVitals, setExtractedVitals] = useState<any[]>([]);
  const [lastReportId, setLastReportId] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState<any>(null);
  const [showReportDetails, setShowReportDetails] = useState(false);
  const [loadingReportDetails, setLoadingReportDetails] = useState(false);
  const [formData, setFormData] = useState({
    test_name: "",
    test_category: "",
    test_date: new Date().toISOString().split("T")[0],
    diagnostics_center_name: "",
    file_url: "",
    file_name: "",
    file_type: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        client_id: clientId,
      };

      await healthApi.addDiagnostic(payload);
      onSuccess();
    } catch (error: any) {
      console.error("Failed to save diagnostic:", error);
      alert(error.response?.data?.message || "Failed to save diagnostic");
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!formData.file_url) {
      alert("Please provide a file URL first");
      return;
    }

    setExtracting(true);
    try {
      // Upload the report
      const uploadRes = await healthApi.uploadReport({
        file_url: formData.file_url,
        file_name: formData.file_name || "report.pdf",
        file_type: formData.file_type || undefined,
        client_id: clientId,
      });
      setLastReportId(uploadRes.report?.id || null);

      // Extract vitals
      const extractRes = await healthApi.extractReport(uploadRes.report.id);

      if (extractRes?.extraction?.vitals) {
        setExtractedVitals(extractRes.extraction.vitals);
      } else {
        alert("No vitals found in the report");
      }
    } catch (error) {
      console.error("Failed to extract:", error);
      alert("Failed to extract vitals from report");
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirmVitals = async () => {
    if (extractedVitals.length === 0) return;

    try {
      await healthApi.confirmVitals(extractedVitals);
      alert("Vitals confirmed and saved!");
      setExtractedVitals([]);
      onSuccess();
    } catch (error) {
      console.error("Failed to confirm vitals:", error);
      alert("Failed to save vitals");
    }
  };

  const handleViewReportDetails = async () => {
    if (!lastReportId) return;
    setLoadingReportDetails(true);
    try {
      const res = await healthApi.getReport(lastReportId, clientId);
      setReportDetails(res.report || null);
      setShowReportDetails(true);
    } catch (error) {
      console.error("Failed to load report details:", error);
      alert("Failed to load report details");
    } finally {
      setLoadingReportDetails(false);
    }
  };

  if (!isOpen) return null;

  const resolvedExtraction =
    reportDetails && typeof reportDetails.extraction === "string"
      ? JSON.parse(reportDetails.extraction)
      : reportDetails?.extraction;
  const reportVitals = resolvedExtraction?.vitals || [];

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--panel)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Add Diagnostic Test</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Test Name *
            </label>
            <input
              type="text"
              value={formData.test_name}
              onChange={(e) => setFormData({ ...formData, test_name: e.target.value })}
              className="input-field w-full"
              required
              placeholder="e.g., Complete Blood Count, Lipid Profile"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Test Category</label>
              <input
                type="text"
                value={formData.test_category}
                onChange={(e) => setFormData({ ...formData, test_category: e.target.value })}
                className="input-field w-full"
                placeholder="e.g., Blood Test, Urine Test"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Test Date *</label>
              <input
                type="date"
                value={formData.test_date}
                onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Diagnostics Center</label>
            <input
              type="text"
              value={formData.diagnostics_center_name}
              onChange={(e) => setFormData({ ...formData, diagnostics_center_name: e.target.value })}
              className="input-field w-full"
              placeholder="Lab/clinic name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Report File URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.file_url}
                onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                className="input-field flex-1"
                placeholder="https://example.com/report.pdf"
              />
              <button
                type="button"
                onClick={handleExtract}
                disabled={extracting || !formData.file_url}
                className="btn-secondary flex items-center gap-2"
              >
                {extracting ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Extract
              </button>
            </div>
          </div>

          {formData.file_url && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">File Name</label>
                <input
                  type="text"
                  value={formData.file_name}
                  onChange={(e) => setFormData({ ...formData, file_name: e.target.value })}
                  className="input-field w-full"
                  placeholder="report.pdf"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">File Type</label>
                <input
                  type="text"
                  value={formData.file_type}
                  onChange={(e) => setFormData({ ...formData, file_type: e.target.value })}
                  className="input-field w-full"
                  placeholder="pdf, jpg, png"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-field w-full"
              rows={3}
              placeholder="Additional notes, doctor's interpretation, etc."
            />
          </div>

          {/* Extracted Vitals Review */}
          {extractedVitals.length > 0 && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <h3 className="font-semibold">Extracted Vitals (Review & Confirm)</h3>
              </div>
              <div className="space-y-2 mb-3">
                {extractedVitals.map((vital, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <div>
                      <span className="font-medium">{vital.parameter}</span>
                      <span className="text-gray-400 ml-2">
                        {vital.value} {vital.unit}
                      </span>
                      {vital.reference_range && (
                        <span className="text-xs text-gray-500 ml-2">
                          (Ref: {vital.reference_range})
                        </span>
                      )}
                    </div>
                    {vital.confidence && (
                      <span className="text-xs text-gray-400">
                        {Math.round(vital.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleConfirmVitals}
                className="btn-primary w-full"
              >
                Confirm & Save Vitals
              </button>
            </div>
          )}

          {lastReportId && (
            <div className="p-3 rounded-lg border border-white/10 bg-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Report ID</p>
                <p className="text-sm text-gray-200">{lastReportId}</p>
              </div>
              <button
                type="button"
                onClick={handleViewReportDetails}
                disabled={loadingReportDetails}
                className="btn-secondary"
              >
                {loadingReportDetails ? "Loading..." : "Report Details"}
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Diagnostic"}
            </button>
          </div>
        </form>

        {showReportDetails && (
          <div className="fixed inset-0 bg-black/60 z-[10001] flex items-center justify-center p-4">
            <div className="card max-w-lg w-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 className="text-lg font-semibold">Report Details</h3>
                <button
                  type="button"
                  onClick={() => setShowReportDetails(false)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <div>
                  <p className="text-gray-400">Report ID</p>
                  <p className="text-gray-200">{reportDetails?.id || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-400">File</p>
                  <p className="text-gray-200">{reportDetails?.file_name || "-"}</p>
                  {reportDetails?.file_url && (
                    <a
                      href={reportDetails.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      View file
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-400">Status</p>
                    <p className="text-gray-200">{reportDetails?.status || "pending"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Vitals Found</p>
                    <p className="text-gray-200">{reportVitals.length}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-400">Uploaded</p>
                    <p className="text-gray-200">
                      {reportDetails?.uploaded_at ? new Date(reportDetails.uploaded_at).toLocaleString() : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Extracted</p>
                    <p className="text-gray-200">
                      {reportDetails?.extracted_at ? new Date(reportDetails.extracted_at).toLocaleString() : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default DiagnosticsUpload;

