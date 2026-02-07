import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, Camera, FileText } from "lucide-react";
import { healthApi } from "../../services/api";
import { jsPDF } from "jspdf";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

interface ScanDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: any[];
  selectedClient?: string | null;
  onCreated: () => void;
}

type DocumentType = "prescription" | "bill";

const ScanDocumentModal: React.FC<ScanDocumentModalProps> = ({
  isOpen,
  onClose,
  appointments,
  selectedClient,
  onCreated,
}) => {
  const [documentType, setDocumentType] = useState<DocumentType>("prescription");
  const [billType, setBillType] = useState("Consulting");
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [extracted, setExtracted] = useState<any>(null);
  const [appointmentChoice, setAppointmentChoice] = useState<string | "new" | null>(null);
  const [appointmentCandidates, setAppointmentCandidates] = useState<any[]>([]);
  const [overrideDate, setOverrideDate] = useState<string>("");
  const [overrideTime, setOverrideTime] = useState<string>("");
  const [showJson, setShowJson] = useState(false);
  const [detectedTypeLabel, setDetectedTypeLabel] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewBase64, setPreviewBase64] = useState<string>("");
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = () => {
    setDocumentType("prescription");
    setBillType("Consulting");
    setFiles([]);
    setProcessing(false);
    setExtracted(null);
    setAppointmentChoice(null);
    setAppointmentCandidates([]);
    setOverrideDate("");
    setOverrideTime("");
    setShowJson(false);
    setDetectedTypeLabel("");
    setPreviewUrl("");
    setPreviewBase64("");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const resizeImage = async (input: File): Promise<HTMLCanvasElement> => {
    const image = document.createElement("img");
    const url = URL.createObjectURL(input);
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = url;
    });
    const maxSize = 1600;
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas;
  };

  const toBase64 = async (input: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(input);
    });

  const convertCanvasesToPdf = async (canvases: HTMLCanvasElement[]): Promise<Blob> => {
    const pdf = new jsPDF("p", "pt", "a4");
    canvases.forEach((canvas, index) => {
      if (index > 0) pdf.addPage();
      const imgData = canvas.toDataURL("image/jpeg", 0.8);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
      const renderWidth = imgWidth * scale;
      const renderHeight = imgHeight * scale;
      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;
      pdf.addImage(imgData, "JPEG", x, y, renderWidth, renderHeight);
    });
    return pdf.output("blob");
  };

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
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.85)
    );
    return blob;
  };

  const canvasToBase64 = (canvas: HTMLCanvasElement) =>
    canvas.toDataURL("image/jpeg", 0.85).split(",")[1] || "";
  useEffect(() => {
    if (files.length === 0) {
      setPreviewUrl("");
      setPreviewBase64("");
      return;
    }
    const first = files[0];
    if (first.type === "application/pdf") {
      renderPdfFirstPage(first)
        .then((blob) => toBase64(blob))
        .then((base64) => {
          setPreviewBase64(base64);
          setPreviewUrl(`data:image/jpeg;base64,${base64}`);
        })
        .catch(() => {
          setPreviewUrl("");
          setPreviewBase64("");
        });
      return;
    }
    if (first.type.startsWith("image/")) {
      resizeImage(first)
        .then((canvas) => {
          const base64 = canvasToBase64(canvas);
          setPreviewBase64(base64);
          setPreviewUrl(`data:image/jpeg;base64,${base64}`);
        })
        .catch(() => {
          setPreviewUrl("");
          setPreviewBase64("");
        });
    }
  }, [files]);

  const extractData = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    try {
      let processed: Blob = files[0];
      let contentType = files[0].type || "application/octet-stream";
      let fileName = files[0].name;
      let extractionBase64 = previewBase64 || "";
      let extractionType = contentType;

      if (files.length > 1) {
        const allImages = files.every((f) => f.type.startsWith("image/"));
        if (!allImages) {
          alert("Multiple files are supported only for images.");
          setProcessing(false);
          return;
        }
        const canvases = await Promise.all(files.map((f) => resizeImage(f)));
        extractionBase64 = canvasToBase64(canvases[0]);
        extractionType = "image/jpeg";
        processed = await convertCanvasesToPdf(canvases);
        contentType = "application/pdf";
        fileName = "scanned-documents.pdf";
      } else if (files[0].type.startsWith("image/")) {
        const canvas = await resizeImage(files[0]);
        extractionBase64 = canvasToBase64(canvas);
        extractionType = "image/jpeg";
        processed = await convertCanvasesToPdf([canvas]);
        contentType = "application/pdf";
        fileName = files[0].name.replace(/\.\w+$/, ".pdf");
      } else if (files[0].type === "application/pdf") {
        const preview = await renderPdfFirstPage(files[0]);
        extractionBase64 = await toBase64(preview);
        extractionType = "image/jpeg";
      }

      if (!extractionBase64) {
        extractionBase64 = await toBase64(processed);
        extractionType = contentType;
      }

      const res = await healthApi.extractDocumentData({
        file_base64: extractionBase64,
        file_type: extractionType,
      });
      const docType = res.document_type || res.detection?.document_type || "receipt";
      const receiptType = res.receipt_type || res.detection?.receipt_type || "other";
      const label = [docType, receiptType !== "other" ? receiptType : ""].filter(Boolean).join(" / ");
      setDetectedTypeLabel(label);
      setDocumentType(docType === "prescription" ? "prescription" : "bill");
      if (docType !== "prescription") {
        const mappedBillType =
          receiptType === "consultation" ? "Consulting" :
          receiptType === "medicine" ? "Medicine" :
          receiptType === "test" ? "Diagnostics" : "Other";
        setBillType(mappedBillType);
      }
      setExtracted({
        ...(res.extracted_data || {}),
        receipt_type: receiptType,
        _file: { blob: processed, contentType, fileName },
      });
    } catch (error) {
      console.error("Extraction failed:", error);
      alert("Failed to extract data from the document.");
    } finally {
      setProcessing(false);
    }
  };

  const extractedDate = useMemo(() => {
    if (!extracted) return null;
    return extracted.prescription_date || extracted.receipt_date || extracted.follow_up_date || null;
  }, [extracted]);

  const extractedTime = useMemo(() => {
    if (!extracted) return null;
    return (
      extracted.appointment_time ||
      extracted.visit_time ||
      extracted.receipt_time ||
      extracted.test_time ||
      extracted.follow_up_time ||
      null
    );
  }, [extracted]);

  const extractedDoctor = useMemo(() => {
    if (!extracted) return null;
    return extracted.doctor_name || extracted.clinic_name || extracted.pharmacy_name || null;
  }, [extracted]);

  const candidates = useMemo(() => {
    const baseDate = overrideDate || extractedDate;
    if (!baseDate) return appointments;
    const targetDate = new Date(baseDate);
    return appointments.filter((apt) => {
      const aptDate = apt.datetime ? new Date(apt.datetime) : null;
      if (!aptDate) return false;
      const sameDay = aptDate.toDateString() === targetDate.toDateString();
      if (!sameDay) return false;
      if (extractedDoctor) {
        const name = (apt.doctor_name || apt.doctor_user_id || "").toLowerCase();
        return name.includes(String(extractedDoctor).toLowerCase());
      }
      return true;
    });
  }, [appointments, extractedDate, extractedDoctor, overrideDate]);
  useEffect(() => {
    if (!extracted) return;
    setOverrideDate(extractedDate ? String(extractedDate).slice(0, 10) : "");
    if (extractedTime) {
      const timeMatch = String(extractedTime).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const meridiem = timeMatch[3]?.toLowerCase();
        if (meridiem === "pm" && hours < 12) hours += 12;
        if (meridiem === "am" && hours === 12) hours = 0;
        setOverrideTime(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
      }
    }
  }, [extracted, extractedDate, extractedTime]);

  const prepareCandidates = () => {
    setAppointmentCandidates(candidates);
    setAppointmentChoice(candidates.length > 0 ? candidates[0].id : "new");
  };

  const createOrAttachAppointment = async () => {
    if (!extracted || !extracted._file) return;
    setProcessing(true);
    try {
      let appointmentId = appointmentChoice && appointmentChoice !== "new" ? appointmentChoice : null;
      let appointmentDetails = null;

      if (!appointmentId) {
        const date = overrideDate ? new Date(overrideDate) : extractedDate ? new Date(extractedDate) : new Date();
        const datetime = new Date(date);
        if (overrideTime) {
          const [hours, minutes] = overrideTime.split(":").map((t) => parseInt(t, 10));
          datetime.setHours(hours || 10, minutes || 0, 0, 0);
        } else if (extractedTime) {
          const timeMatch = String(extractedTime).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            const meridiem = timeMatch[3]?.toLowerCase();
            if (meridiem === "pm" && hours < 12) hours += 12;
            if (meridiem === "am" && hours === 12) hours = 0;
            datetime.setHours(hours, minutes, 0, 0);
          } else {
            datetime.setHours(10, 0, 0, 0);
          }
        } else {
          datetime.setHours(10, 0, 0, 0);
        }
        const title = documentType === "prescription" ? "Prescription" : `${billType} Bill`;
        const notes = extractedDoctor ? `Doctor/Clinic: ${extractedDoctor}` : "";
        const location = extracted.clinic_name || extracted.pharmacy_name || extracted.diagnostics_center_name || "";
        const createRes = await healthApi.createAppointment({
          title,
          datetime: datetime.toISOString(),
          location,
          notes,
          status: "completed",
          client_id: selectedClient,
        });
        appointmentId = createRes.appointment?.id;
      }

      if (!appointmentId) {
        alert("Failed to create appointment.");
        setProcessing(false);
        return;
      }

      const { blob, contentType, fileName } = extracted._file;
      const signed = await healthApi.getSignedUploadUrl({
        appointment_id: appointmentId,
        category: documentType === "prescription" ? "prescription" : "bill",
        file_name: fileName,
        content_type: contentType,
      });
      await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      });
      const uploadRes = await healthApi.uploadAppointmentFile(appointmentId, {
        category: documentType === "prescription" ? "prescription" : "bill",
        sub_type: documentType === "prescription" ? null : billType,
        file_url: signed.fileUrl,
        storage_path: signed.gcsPath,
        file_name: fileName,
        file_type: contentType,
        client_id: selectedClient,
      });

      const detailsRes = await healthApi.getAppointmentDetails(appointmentId, selectedClient || undefined);
      appointmentDetails = detailsRes.details || {};

      if (documentType === "prescription") {
        const items = (extracted.medications || []).map((m: any) => ({
          name: m.medicine_name,
          dosage: m.dosage || "",
          duration: m.duration || "",
        }));
        const diagnosticsRecommendation = Array.isArray(extracted.lab_tests) ? extracted.lab_tests.join(", ") : "";
        await healthApi.updateAppointmentDetails(appointmentId, {
          client_id: selectedClient,
          history: appointmentDetails.history || null,
          prescription: {
            notes: extracted.advice || appointmentDetails.prescription?.notes || "",
            followUpDate: extracted.follow_up_date || appointmentDetails.prescription?.followUpDate || "",
            diagnosticsRecommendation: diagnosticsRecommendation || appointmentDetails.prescription?.diagnosticsRecommendation || "",
            items: items.length > 0 ? items : appointmentDetails.prescription?.items || [],
            files: [
              ...(appointmentDetails.prescription?.files || []),
              {
                file_id: uploadRes.file?.id,
                file_url: uploadRes.file?.file_url,
                file_name: uploadRes.file?.file_name,
                file_type: uploadRes.file?.file_type,
              },
            ],
          },
          bills: appointmentDetails.bills || null,
          audio_clips: appointmentDetails.audio_clips || [],
        });
      } else {
        const billItems: any[] = [];
        if (extracted.receipt_type === "medicine" && Array.isArray(extracted.medicines)) {
          extracted.medicines.forEach((med: any) => {
            billItems.push({
              category: "Medicine",
              description: med.name,
              amount: String(med.total || med.price || extracted.total_amount || ""),
              gst: String(extracted.tax_amount || ""),
              file: {
                file_id: uploadRes.file?.id,
                file_url: uploadRes.file?.file_url,
                file_name: uploadRes.file?.file_name,
                file_type: uploadRes.file?.file_type,
              },
            });
          });
        } else if (extracted.receipt_type === "test" && Array.isArray(extracted.tests)) {
          extracted.tests.forEach((test: any) => {
            billItems.push({
              category: "Diagnostics",
              description: test.name,
              amount: String(test.price || extracted.total_amount || ""),
              gst: String(extracted.tax_amount || ""),
              file: {
                file_id: uploadRes.file?.id,
                file_url: uploadRes.file?.file_url,
                file_name: uploadRes.file?.file_name,
                file_type: uploadRes.file?.file_type,
              },
            });
          });
        } else {
          billItems.push({
            category: billType,
            description: extracted.clinic_name || extracted.pharmacy_name || extracted.diagnostics_center_name || "Bill",
            amount: String(extracted.total_amount || extracted.amount || ""),
            gst: String(extracted.tax_amount || ""),
            file: {
              file_id: uploadRes.file?.id,
              file_url: uploadRes.file?.file_url,
              file_name: uploadRes.file?.file_name,
              file_type: uploadRes.file?.file_type,
            },
          });
        }

        await healthApi.updateAppointmentDetails(appointmentId, {
          client_id: selectedClient,
          history: appointmentDetails.history || null,
          prescription: appointmentDetails.prescription || null,
          bills: {
            items: [...(appointmentDetails.bills?.items || []), ...billItems],
          },
          audio_clips: appointmentDetails.audio_clips || [],
        });
      }

      onCreated();
      handleClose();
    } catch (error) {
      console.error("Failed to process appointment:", error);
      alert("Failed to create or update appointment.");
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--panel)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Scan Document</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {detectedTypeLabel ? (
            <p className="text-sm text-gray-300">Detected: {detectedTypeLabel}</p>
          ) : (
            <p className="text-sm text-gray-400">
              AI will detect document type automatically.
            </p>
          )}

          <div className="flex flex-col md:flex-row gap-3">
            <label className="btn-secondary flex items-center gap-2 cursor-pointer">
              <Upload className="h-4 w-4" />
              Upload File
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                multiple
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  setFiles(selected);
                  setExtracted(null);
                  setAppointmentCandidates([]);
                  setAppointmentChoice(null);
                }}
              />
            </label>
            <button
              type="button"
              className="btn-secondary flex items-center gap-2"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              {files.length > 0 ? "Add Photo" : "Take Picture"}
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                if (selected.length === 0) return;
                setFiles((prev) => [...prev, ...selected]);
                setExtracted(null);
                setAppointmentCandidates([]);
                setAppointmentChoice(null);
                e.currentTarget.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-300">
                {files.length === 1 ? files[0].name : `${files.length} images selected`}
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setFiles([]);
                  setExtracted(null);
                  setAppointmentCandidates([]);
                  setAppointmentChoice(null);
                }}
              >
                Clear
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  await extractData();
                  prepareCandidates();
                }}
                disabled={processing}
              >
                {processing ? "Processing..." : "Extract & Continue"}
              </button>
            </div>
          )}

          {previewUrl && (
            <div className="border border-white/10 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-2">Preview</p>
              <img src={previewUrl} alt="Document preview" className="w-full rounded-lg" />
            </div>
          )}

          {extracted && (
            <div className="border border-white/10 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-300">Extracted Summary</span>
              </div>
              <div className="text-xs text-gray-400 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-gray-400">Date</span>
                    <input
                      type="date"
                      className="input-field"
                      value={overrideDate}
                      onChange={(e) => setOverrideDate(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-gray-400">Time</span>
                    <input
                      type="time"
                      className="input-field"
                      value={overrideTime}
                      onChange={(e) => setOverrideTime(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-gray-400">Doctor/Clinic</span>
                    <input
                      type="text"
                      className="input-field"
                      value={extractedDoctor || ""}
                      readOnly
                    />
                  </label>
                </div>
              </div>

              {documentType === "prescription" && (
                <div className="text-xs text-gray-300 space-y-1">
                  {extracted.chief_complaints && (
                    <p>Complaints: {extracted.chief_complaints}</p>
                  )}
                  {Array.isArray(extracted.medications) && extracted.medications.length > 0 && (
                    <div>
                      <p className="text-gray-400">Medications:</p>
                      <ul className="list-disc list-inside text-gray-300">
                        {extracted.medications.slice(0, 5).map((med: any, idx: number) => (
                          <li key={`${med.medicine_name || "med"}-${idx}`}>
                            {med.medicine_name} {med.dosage ? `• ${med.dosage}` : ""} {med.duration ? `• ${med.duration}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(extracted.lab_tests) && extracted.lab_tests.length > 0 && (
                    <p>Tests: {extracted.lab_tests.join(", ")}</p>
                  )}
                </div>
              )}

              {documentType === "bill" && (
                <div className="text-xs text-gray-300 space-y-1">
                  {extracted.total_amount && <p>Total: {extracted.total_amount}</p>}
                  {extracted.tax_amount && <p>Tax: {extracted.tax_amount}</p>}
                  {Array.isArray(extracted.medicines) && extracted.medicines.length > 0 && (
                    <div>
                      <p className="text-gray-400">Items:</p>
                      <ul className="list-disc list-inside text-gray-300">
                        {extracted.medicines.slice(0, 5).map((med: any, idx: number) => (
                          <li key={`${med.name || "item"}-${idx}`}>
                            {med.name} {med.total ? `• ${med.total}` : med.price ? `• ${med.price}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(extracted.tests) && extracted.tests.length > 0 && (
                    <div>
                      <p className="text-gray-400">Tests:</p>
                      <ul className="list-disc list-inside text-gray-300">
                        {extracted.tests.slice(0, 5).map((test: any, idx: number) => (
                          <li key={`${test.name || "test"}-${idx}`}>
                            {test.name} {test.price ? `• ${test.price}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <button
                className="btn-secondary"
                onClick={() => setShowJson((prev) => !prev)}
              >
                {showJson ? "Hide JSON" : "Show JSON"}
              </button>
              {showJson && (
                <pre className="text-xs text-gray-300 bg-black/30 rounded-lg p-3 max-h-48 overflow-auto">
                  {JSON.stringify({ ...extracted, _file: undefined }, null, 2)}
                </pre>
              )}

              {appointmentCandidates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-300">Select appointment for this document</p>
                  <div className="space-y-2">
                    {appointmentCandidates.map((apt) => (
                      <label key={apt.id} className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="radio"
                          checked={appointmentChoice === apt.id}
                          onChange={() => setAppointmentChoice(apt.id)}
                        />
                        {new Date(apt.datetime || apt.created_at).toLocaleString()} • {apt.doctor_name || apt.doctor_user_id || "Doctor"} • {apt.title || "Appointment"}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="radio"
                  checked={appointmentChoice === "new"}
                  onChange={() => setAppointmentChoice("new")}
                />
                Create new appointment
              </label>

              <div className="flex justify-end">
                <button
                  className="btn-primary"
                  onClick={createOrAttachAppointment}
                  disabled={processing || !appointmentChoice}
                >
                  {processing ? "Saving..." : "Save Appointment"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanDocumentModal;
