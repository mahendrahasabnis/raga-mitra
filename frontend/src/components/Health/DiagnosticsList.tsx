import React, { useState } from "react";
import { FileText, Plus, Upload, Eye, CheckCircle2 } from "lucide-react";
import { healthApi } from "../../services/api";
import DiagnosticsUpload from "./DiagnosticsUpload";

interface DiagnosticsListProps {
  diagnostics: any[];
  loading: boolean;
  selectedClient?: string | null;
  onRefresh: () => void;
}

const DiagnosticsList: React.FC<DiagnosticsListProps> = ({
  diagnostics,
  loading,
  selectedClient,
  onRefresh,
}) => {
  const [showUpload, setShowUpload] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);

  const handleExtract = async (diagnostic: any) => {
    if (!diagnostic.file_url) {
      alert("No file available for extraction");
      return;
    }

    setExtracting(diagnostic.id);
    try {
      // Upload the file URL as a report
      const uploadRes = await healthApi.uploadReport({
        file_url: diagnostic.file_url,
        file_name: diagnostic.file_name,
      });

      // Extract vitals from the report
      const extractRes = await healthApi.extractReport(uploadRes.report.id);

      if (extractRes?.extraction?.vitals) {
        // Show confirmation dialog
        const confirmed = confirm(
          `Found ${extractRes.extraction.vitals.length} vitals. Confirm to save them?`
        );

        if (confirmed) {
          await healthApi.confirmVitals(extractRes.extraction.vitals);
          alert("Vitals extracted and saved successfully!");
          onRefresh();
        }
      } else {
        alert("No vitals found in the report");
      }
    } catch (error) {
      console.error("Failed to extract:", error);
      alert("Failed to extract vitals from report");
    } finally {
      setExtracting(null);
    }
  };

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading diagnostics...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 overflow-x-hidden">
        {!selectedClient && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowUpload(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Diagnostic
            </button>
          </div>
        )}

        {diagnostics.length === 0 ? (
          <div className="card p-8 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No diagnostics yet</p>
            {!selectedClient && (
              <button
                onClick={() => setShowUpload(true)}
                className="btn-primary mt-4"
              >
                Upload your first diagnostic report
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {diagnostics.map((diag) => (
              <div key={diag.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{diag.test_name}</h3>
                      {diag.test_category && (
                        <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">
                          {diag.test_category}
                        </span>
                      )}
                      {diag.is_ai_extracted && (
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          AI Extracted
                        </span>
                      )}
                    </div>

                    {diag.test_date && (
                      <p className="text-sm text-gray-400 mb-1">
                        {new Date(diag.test_date).toLocaleDateString()}
                      </p>
                    )}

                    {diag.diagnostics_center_name && (
                      <p className="text-sm text-gray-400 mb-1">
                        🏥 {diag.diagnostics_center_name}
                      </p>
                    )}

                    {diag.notes && (
                      <p className="text-sm text-gray-300 mt-2">{diag.notes}</p>
                    )}

                    {diag.parameters && Array.isArray(diag.parameters) && diag.parameters.length > 0 && (
                      <div className="mt-3 p-2 bg-white/5 rounded-lg">
                        <p className="text-xs text-gray-400 mb-1">Parameters:</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {diag.parameters.slice(0, 4).map((param: any, idx: number) => (
                            <div key={idx}>
                              <span className="text-gray-300">{param.parameter_name || param.name}:</span>{" "}
                              <span className="font-semibold">{param.value} {param.unit || ""}</span>
                            </div>
                          ))}
                        </div>
                        {diag.parameters.length > 4 && (
                          <p className="text-xs text-gray-400 mt-1">
                            +{diag.parameters.length - 4} more
                          </p>
                        )}
                      </div>
                    )}

                    {diag.file_url && (
                      <a
                        href={diag.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        View Report
                      </a>
                    )}
                  </div>

                  {!selectedClient && diag.file_url && (
                    <button
                      onClick={() => handleExtract(diag)}
                      disabled={extracting === diag.id}
                      className="ml-4 p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition"
                      title="Extract & Confirm Vitals"
                    >
                      {extracting === diag.id ? (
                        <div className="animate-spin h-4 w-4 border-2 border-emerald-300 border-t-transparent rounded-full" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <DiagnosticsUpload
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            onRefresh();
          }}
          clientId={selectedClient || undefined}
        />
      )}
    </>
  );
};

export default DiagnosticsList;
