import React, { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Upload, Plus, Trash2, FileText } from "lucide-react";
import { healthApi } from "../../services/api";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

interface AppointmentDetailsTabsProps {
  appointment: any;
  clientId?: string | null;
}

type TabKey = "history" | "prescription" | "diagnostics" | "bills";

const AppointmentDetailsTabs: React.FC<AppointmentDetailsTabsProps> = ({ appointment, clientId }) => {
  const [activeTab, setActiveTab] = useState<TabKey>("history");
  const [history, setHistory] = useState({
    chiefComplaint: "",
    weight: "",
    height: "",
    bp: "",
    oxygen: "",
    doctorAdvice: "",
    aiSummary: "",
  });
  const [prescription, setPrescription] = useState({
    notes: "",
    followUpDate: "",
    diagnosticsRecommendation: "",
  });
  const [prescriptionItems, setPrescriptionItems] = useState<Array<{ name: string; dosage: string; duration: string }>>([]);
  const [diagnosticsReports, setDiagnosticsReports] = useState<any[]>([]);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [bills, setBills] = useState<Array<{ category: string; description: string; amount: string; gst: string }>>([]);
  const [newBill, setNewBill] = useState({ category: "Consulting", description: "", amount: "", gst: "" });
  const [billScanType, setBillScanType] = useState("Consulting");
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [audioClips, setAudioClips] = useState<any[]>([]);
  const [summarizingAudio, setSummarizingAudio] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadDetails = async () => {
      setLoadingDetails(true);
      try {
        const res = await healthApi.getAppointmentDetails(appointment.id, clientId || undefined);
        if (!active) return;
        const details = res.details || {};
        setHistory({
          chiefComplaint: details.history?.chiefComplaint || "",
          weight: details.history?.weight || "",
          height: details.history?.height || "",
          bp: details.history?.bp || "",
          oxygen: details.history?.oxygen || "",
          doctorAdvice: details.history?.doctorAdvice || "",
          aiSummary: details.history?.aiSummary || "",
        });
        setPrescription({
          notes: details.prescription?.notes || "",
          followUpDate: details.prescription?.followUpDate || "",
          diagnosticsRecommendation: details.prescription?.diagnosticsRecommendation || "",
        });
        setPrescriptionItems(details.prescription?.items || []);
        setBills(details.bills?.items || []);
        setAudioClips(details.audio_clips || []);
      } catch (error) {
        console.error("Failed to load appointment details:", error);
      } finally {
        if (active) setLoadingDetails(false);
      }
    };
    loadDetails();
    return () => {
      active = false;
    };
  }, [appointment.id, clientId]);

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      await healthApi.updateAppointmentDetails(appointment.id, {
        client_id: clientId,
        history,
        prescription: {
          ...prescription,
          items: prescriptionItems,
        },
        bills: {
          items: bills,
        },
        audio_clips: audioClips,
      });
      alert("Appointment details saved.");
    } catch (error) {
      console.error("Failed to save details:", error);
      alert("Failed to save appointment details.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPrescriptionItem = () => {
    setPrescriptionItems((prev) => [...prev, { name: "", dosage: "", duration: "" }]);
  };

  const handleRemovePrescriptionItem = (index: number) => {
    setPrescriptionItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleStartRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrls((prev) => [url, ...prev]);
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = String(reader.result).split(",")[1] || "";
          try {
            const signed = await healthApi.getSignedUploadUrl({
              appointment_id: appointment.id,
              category: "audio",
              file_name: `appointment-audio-${Date.now()}.webm`,
              content_type: "audio/webm",
            });
            await fetch(signed.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": "audio/webm" },
              body: blob,
            });
            const uploadRes = await healthApi.uploadAppointmentFile(appointment.id, {
              category: "audio",
              file_url: signed.fileUrl,
              storage_path: signed.gcsPath,
              file_name: `appointment-audio-${Date.now()}.webm`,
              file_type: "audio/webm",
              client_id: clientId,
            });
            const file = uploadRes.file;
            const clip = {
              file_id: file.id,
              file_url: file.file_url,
              file_name: file.file_name,
              file_type: file.file_type,
              created_at: file.created_at || new Date().toISOString(),
              ai_summary: "",
              ai_categories: [],
            };
            setAudioClips((prev) => [clip, ...prev]);
            setSummarizingAudio(file.id);
            await healthApi.summarizeAppointmentAudio(appointment.id, {
              file_id: file.id,
              client_id: clientId,
            });
            const detailsRes = await healthApi.getAppointmentDetails(appointment.id, clientId || undefined);
            setAudioClips(detailsRes.details?.audio_clips || []);
          } catch (error) {
            console.error("Failed to upload/summarize audio:", error);
          } finally {
            setSummarizingAudio(null);
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Unable to access microphone. Please check permissions.");
    }
  };

  const handleStopRecording = () => {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleDiagnosticsUpload = async (file: File) => {
    setDiagnosticsLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const uploadRes = await healthApi.uploadReport({
        file_base64: base64,
        file_name: file.name,
        file_type: file.type,
        client_id: clientId,
      });
      const reportId = uploadRes.report?.id;
      const extractRes = await healthApi.extractReport(reportId);
      const extraction = extractRes?.extraction || null;
      setDiagnosticsReports((prev) => [
        {
          id: reportId,
          fileName: file.name,
          extraction,
        },
        ...prev,
      ]);
    } catch (error) {
      console.error("Diagnostics extraction failed:", error);
      alert("Failed to extract diagnostics report.");
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const getExtractionPayload = async (file: File) => {
    if (file.type === "application/pdf") {
      const buffer = await file.arrayBuffer();
      const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      return {
        base64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1] || "",
        type: "image/jpeg",
      };
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return { base64, type: file.type || "application/octet-stream" };
  };

  const handlePrescriptionScan = async (file: File) => {
    try {
      const extraction = await getExtractionPayload(file);

      const signed = await healthApi.getSignedUploadUrl({
        appointment_id: appointment.id,
        category: "prescription",
        file_name: file.name,
        content_type: file.type,
      });
      await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const uploadRes = await healthApi.uploadAppointmentFile(appointment.id, {
        category: "prescription",
        file_url: signed.fileUrl,
        storage_path: signed.gcsPath,
        file_name: file.name,
        file_type: file.type,
        client_id: clientId,
      });

      const res = await healthApi.extractPrescriptionData({
        file_base64: extraction.base64,
        file_type: extraction.type,
      });
      const extracted = res.extracted_data || res.extractedData || null;
      if (extracted?.medications) {
        setPrescriptionItems(
          extracted.medications.map((m: any) => ({
            name: m.medicine_name,
            dosage: m.dosage || "",
            duration: m.duration || "",
          }))
        );
      }
      if (extracted?.advice) {
        setPrescription((prev) => ({ ...prev, notes: extracted.advice }));
      }
      if (extracted?.follow_up_date) {
        setPrescription((prev) => ({ ...prev, followUpDate: extracted.follow_up_date }));
      }

      if (uploadRes?.file) {
        setPrescription((prev) => ({
          ...prev,
          files: [
            ...(prev as any).files || [],
            {
              file_id: uploadRes.file.id,
              file_url: uploadRes.file.file_url,
              file_name: uploadRes.file.file_name,
              file_type: uploadRes.file.file_type,
            },
          ],
        }));
      }
    } catch (error) {
      console.error("Prescription scan failed:", error);
      alert("Failed to scan prescription.");
    }
  };

  const handleBillScan = async (file: File) => {
    try {
      const extraction = await getExtractionPayload(file);

      const signed = await healthApi.getSignedUploadUrl({
        appointment_id: appointment.id,
        category: "bill",
        file_name: file.name,
        content_type: file.type,
      });
      await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const uploadRes = await healthApi.uploadAppointmentFile(appointment.id, {
        category: "bill",
        sub_type: billScanType,
        file_url: signed.fileUrl,
        storage_path: signed.gcsPath,
        file_name: file.name,
        file_type: file.type,
        client_id: clientId,
      });

      const receiptType =
        billScanType === "Consulting" ? "consultation" :
        billScanType === "Medicine" ? "medicine" :
        billScanType === "Diagnostics" ? "test" : "other";

      const res = await healthApi.extractReceiptData({
        file_base64: extraction.base64,
        file_type: extraction.type,
        receipt_type: receiptType,
      });
      const extracted = res.extracted_data || res.extractedData || null;
      const items: Array<{ category: string; description: string; amount: string; gst: string }> = [];

      if (receiptType === "medicine" && Array.isArray(extracted?.medicines)) {
        extracted.medicines.forEach((med: any) => {
          items.push({
            category: "Medicine",
            description: med.name,
            amount: String(med.total || med.price || extracted.total_amount || ""),
            gst: String(extracted.tax_amount || ""),
          });
        });
      } else if (receiptType === "test" && Array.isArray(extracted?.tests)) {
        extracted.tests.forEach((test: any) => {
          items.push({
            category: "Diagnostics",
            description: test.name,
            amount: String(test.price || extracted.total_amount || ""),
            gst: String(extracted.tax_amount || ""),
          });
        });
      } else {
        items.push({
          category: billScanType,
          description: extracted?.clinic_name || extracted?.pharmacy_name || extracted?.diagnostics_center_name || "Bill",
          amount: String(extracted?.total_amount || extracted?.amount || ""),
          gst: String(extracted?.tax_amount || ""),
        });
      }

      if (items.length > 0) {
        const fileInfo = uploadRes?.file
          ? {
              file_id: uploadRes.file.id,
              file_url: uploadRes.file.file_url,
              file_name: uploadRes.file.file_name,
              file_type: uploadRes.file.file_type,
            }
          : null;
        setBills((prev) => [
          ...items.map((item) => ({ ...item, ...(fileInfo ? { file: fileInfo } : {}) })),
          ...prev,
        ]);
      }
    } catch (error) {
      console.error("Bill scan failed:", error);
      alert("Failed to scan bill.");
    }
  };

  const categorizedReports = useMemo(() => {
    const categories: Record<string, any[]> = {
      Diabetes: [],
      Heart: [],
      Kidney: [],
      Lungs: [],
      "Blood Work": [],
      Urine: [],
      Other: [],
    };

    diagnosticsReports.forEach((report) => {
      const vitals = report.extraction?.vitals || [];
      vitals.forEach((v: any) => {
        const name = (v.parameter || "").toLowerCase();
        let bucket = "Other";
        if (name.includes("glucose") || name.includes("hba1c") || name.includes("sugar")) bucket = "Diabetes";
        else if (name.includes("bp") || name.includes("heart") || name.includes("cholesterol") || name.includes("ldl")) bucket = "Heart";
        else if (name.includes("creatinine") || name.includes("urea") || name.includes("kidney")) bucket = "Kidney";
        else if (name.includes("oxygen") || name.includes("spo2") || name.includes("lung") || name.includes("resp")) bucket = "Lungs";
        else if (name.includes("hemoglobin") || name.includes("cbc") || name.includes("platelet")) bucket = "Blood Work";
        else if (name.includes("urine") || name.includes("uric")) bucket = "Urine";
        categories[bucket].push({ reportId: report.id, ...v });
      });
    });

    return categories;
  }, [diagnosticsReports]);

  const totals = useMemo(() => {
    const total = bills.reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0);
    const gst = bills.reduce((sum, bill) => sum + (parseFloat(bill.gst) || 0), 0);
    return { total, gst, grandTotal: total + gst };
  }, [bills]);

  return (
    <div className="mt-4 border-t border-white/10 pt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          { key: "history", label: "History" },
          { key: "prescription", label: "Prescription" },
          { key: "diagnostics", label: "Diagnostics" },
          { key: "bills", label: "Bills" },
        ] as Array<{ key: TabKey; label: string }>).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key ? "bg-blue-500/20 text-blue-200" : "bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400">Chief Complaint</label>
              <textarea
                value={history.chiefComplaint}
                onChange={(e) => setHistory({ ...history, chiefComplaint: e.target.value })}
                className="input-field w-full mt-1"
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Doctor Advice</label>
              <textarea
                value={history.doctorAdvice}
                onChange={(e) => setHistory({ ...history, doctorAdvice: e.target.value })}
                className="input-field w-full mt-1"
                rows={2}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Weight (kg)", key: "weight" },
              { label: "Height (cm)", key: "height" },
              { label: "BP", key: "bp" },
              { label: "O2 Saturation", key: "oxygen" },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-sm text-gray-400">{field.label}</label>
                <input
                  value={(history as any)[field.key]}
                  onChange={(e) => setHistory({ ...history, [field.key]: e.target.value })}
                  className="input-field w-full mt-1"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <button
              type="button"
              onClick={recording ? handleStopRecording : handleStartRecording}
              className={`btn-secondary flex items-center gap-2 ${recording ? "bg-red-500/20 text-red-200" : ""}`}
            >
              {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {recording ? "Stop Recording" : "Record Audio"}
            </button>
            <span className="text-xs text-gray-400 self-center">
              {summarizingAudio ? "Summarizing audio..." : "Audio will be stored and summarized after recording."}
            </span>
          </div>

          {audioUrls.length > 0 && (
            <div className="space-y-2">
              {audioUrls.map((url) => (
                <audio key={url} controls className="w-full">
                  <source src={url} type="audio/webm" />
                </audio>
              ))}
            </div>
          )}

          <div>
            <label className="text-sm text-gray-400">AI Extracted Summary (Placeholder)</label>
            <textarea
              value={history.aiSummary}
              onChange={(e) => setHistory({ ...history, aiSummary: e.target.value })}
              className="input-field w-full mt-1"
              rows={3}
              placeholder="AI extracted and categorized information will appear here."
            />
          </div>

          {audioClips.length > 0 && (
            <div className="border border-white/10 rounded-lg p-3">
              <p className="text-sm text-gray-300 mb-2">Audio Summaries</p>
              <div className="space-y-2">
                {audioClips.map((clip: any, idx: number) => (
                  <div key={clip.file_id || idx} className="bg-white/5 rounded p-2 text-xs text-gray-300">
                    <div className="flex items-center justify-between">
                      <span>{clip.file_name || "Audio Clip"}</span>
                      {clip.ai_categories?.length > 0 && (
                        <span className="text-gray-400">{clip.ai_categories.join(", ")}</span>
                      )}
                    </div>
                    <p className="text-gray-400 mt-1">{clip.ai_summary || "Summary pending..."}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleSaveDetails} className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save History"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "prescription" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="btn-secondary flex items-center gap-2 cursor-pointer">
              <Upload className="h-4 w-4" />
              Scan/Upload Prescription
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePrescriptionScan(file);
                }}
              />
            </label>
            <span className="text-xs text-gray-400">Upload will be linked to extraction soon.</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-300">Prescription Items</p>
              <button onClick={handleAddPrescriptionItem} className="btn-secondary flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            </div>
            {prescriptionItems.length === 0 && (
              <p className="text-xs text-gray-500">No items added yet.</p>
            )}
            {prescriptionItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                <input
                  className="input-field"
                  placeholder="Medicine"
                  value={item.name}
                  onChange={(e) => {
                    const next = [...prescriptionItems];
                    next[idx] = { ...next[idx], name: e.target.value };
                    setPrescriptionItems(next);
                  }}
                />
                <input
                  className="input-field"
                  placeholder="Dosage"
                  value={item.dosage}
                  onChange={(e) => {
                    const next = [...prescriptionItems];
                    next[idx] = { ...next[idx], dosage: e.target.value };
                    setPrescriptionItems(next);
                  }}
                />
                <input
                  className="input-field"
                  placeholder="Duration"
                  value={item.duration}
                  onChange={(e) => {
                    const next = [...prescriptionItems];
                    next[idx] = { ...next[idx], duration: e.target.value };
                    setPrescriptionItems(next);
                  }}
                />
                <button
                  className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition"
                  onClick={() => handleRemovePrescriptionItem(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400">General Notes</label>
              <textarea
                value={prescription.notes}
                onChange={(e) => setPrescription({ ...prescription, notes: e.target.value })}
                className="input-field w-full mt-1"
                rows={3}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400">Follow-up Date</label>
                <input
                  type="date"
                  value={prescription.followUpDate}
                  onChange={(e) => setPrescription({ ...prescription, followUpDate: e.target.value })}
                  className="input-field w-full mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Diagnostics Recommendations</label>
                <textarea
                  value={prescription.diagnosticsRecommendation}
                  onChange={(e) => setPrescription({ ...prescription, diagnosticsRecommendation: e.target.value })}
                  className="input-field w-full mt-1"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={handleSaveDetails} className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Prescription"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "diagnostics" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="btn-secondary flex items-center gap-2 cursor-pointer">
              <Upload className="h-4 w-4" />
              Add Diagnostics Report
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDiagnosticsUpload(file);
                }}
              />
            </label>
            {diagnosticsLoading && <span className="text-xs text-gray-400">Extracting...</span>}
          </div>

          {Object.entries(categorizedReports).map(([category, items]) => (
            <div key={category} className="border border-white/10 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-gray-200 mb-2">{category}</h4>
              {items.length === 0 ? (
                <p className="text-xs text-gray-500">No data</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {items.map((item: any, idx: number) => (
                    <div key={`${item.reportId}-${idx}`} className="p-2 rounded-lg bg-white/5">
                      <p className="text-sm text-gray-200">{item.parameter}</p>
                      <p className="text-xs text-gray-400">
                        {item.value} {item.unit || ""} {item.reference_range ? `(Ref: ${item.reference_range})` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-end">
            <button onClick={handleSaveDetails} className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Diagnostics"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "bills" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              className="input-field"
              value={billScanType}
              onChange={(e) => setBillScanType(e.target.value)}
            >
              {["Consulting", "Medicine", "Diagnostics", "Equipment", "Hospital"].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <label className="btn-secondary flex items-center gap-2 cursor-pointer">
              <FileText className="h-4 w-4" />
              Scan Bill
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBillScan(file);
                }}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <select
              className="input-field"
              value={newBill.category}
              onChange={(e) => setNewBill({ ...newBill, category: e.target.value })}
            >
              {["Consulting", "Medicine", "Diagnostics", "Equipment", "Hospital"].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <input
              className="input-field"
              placeholder="Description"
              value={newBill.description}
              onChange={(e) => setNewBill({ ...newBill, description: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="Amount"
              value={newBill.amount}
              onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="GST"
              value={newBill.gst}
              onChange={(e) => setNewBill({ ...newBill, gst: e.target.value })}
            />
            <button
              className="btn-primary"
              onClick={() => {
                if (!newBill.description && !newBill.amount) return;
                setBills((prev) => [...prev, newBill]);
                setNewBill({ category: "Consulting", description: "", amount: "", gst: "" });
              }}
            >
              Add
            </button>
          </div>

          {bills.length > 0 && (
            <div className="space-y-2">
              {bills.map((bill, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                  <span className="text-sm text-gray-300">{bill.category}</span>
                  <span className="text-sm text-gray-300">{bill.description || "-"}</span>
                  <span className="text-sm text-gray-300">₹{bill.amount || 0}</span>
                  <span className="text-sm text-gray-300">₹{bill.gst || 0}</span>
                  <button
                    className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition"
                    onClick={() => setBills((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex justify-end gap-6 text-sm text-gray-200 pt-2 border-t border-white/10">
                <span>Total: ₹{totals.total.toFixed(2)}</span>
                <span>GST: ₹{totals.gst.toFixed(2)}</span>
                <span className="font-semibold">Grand Total: ₹{totals.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleSaveDetails} className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Bills"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentDetailsTabs;
