import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, ScanLine, CheckCircle, AlertTriangle, Clock, UserCheck, Plus, Stethoscope } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { healthApi } from "../../services/api";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckin?: () => void;
}

interface LookupAppt {
  id: string;
  doctorUserId: string;
  doctorName: string;
  status: string;
  waitingNumber: number | null;
  title: string | null;
  datetime: string | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
}

interface LookupResult {
  scannerRole: "doctor" | "receptionist";
  patientUserId: string;
  patientName: string;
  patientPhone: string;
  doctorIds: string[];
  doctorMap: Record<string, { name: string; phone: string }>;
  appointments: LookupAppt[];
}

type ModalStep = "scanning" | "loading" | "appointments" | "processing" | "success" | "error";

const statusColors: Record<string, string> = {
  planned: "bg-sky-500/20 text-sky-300",
  requested: "bg-sky-500/20 text-sky-300",
  confirmed: "bg-indigo-500/20 text-indigo-300",
  waiting: "bg-amber-500/20 text-amber-300",
  consulting: "bg-violet-500/20 text-violet-300",
  completed: "bg-emerald-500/20 text-emerald-300",
  cancelled: "bg-red-500/20 text-red-400",
};

const statusLabel = (s: string, wn: number | null) => {
  if (s === "waiting" && wn != null) return `Waiting #${wn}`;
  return s?.charAt(0).toUpperCase() + s?.slice(1);
};

const formatTime = (appt: LookupAppt) => {
  if (appt.appointmentTime) return appt.appointmentTime;
  if (appt.datetime) {
    const d = new Date(appt.datetime);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return null;
};

const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onCheckin }) => {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [step, setStep] = useState<ModalStep>("scanning");
  const [message, setMessage] = useState("");
  const [scannedOnce, setScannedOnce] = useState(false);
  const [lookup, setLookup] = useState<LookupResult | null>(null);

  const stopScanner = useCallback(() => {
    const inst = scannerRef.current;
    scannerRef.current = null;
    if (inst) {
      const state = inst.getState?.();
      const isRunning = state === 2 || state === 3;
      if (isRunning) {
        inst.stop().then(() => inst.clear()).catch(() => {
          try { inst.clear(); } catch { /* noop */ }
        });
      } else {
        try { inst.clear(); } catch { /* noop */ }
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setStep("scanning");
    setMessage("");
    setScannedOnce(false);
    setLookup(null);

    const readerId = "qr-scanner-region";
    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode(readerId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            if (scannedOnce) return;
            setScannedOnce(true);
            try { await html5QrCode?.pause(true); } catch { /* ignore */ }
            handleQrScanned(decodedText);
          },
          () => {}
        );
      } catch (err: any) {
        console.error("QR scanner start error:", err);
        setStep("error");
        setMessage(err?.message || "Could not start camera. Please grant camera permissions.");
      }
    };

    const timer = setTimeout(startScanner, 100);

    return () => {
      clearTimeout(timer);
      const inst = html5QrCode;
      scannerRef.current = null;
      if (inst) {
        const state = inst.getState?.();
        const isRunning = state === 2 || state === 3;
        if (isRunning) {
          inst.stop().then(() => inst.clear()).catch(() => {
            try { inst.clear(); } catch { /* noop */ }
          });
        } else {
          try { inst.clear(); } catch { /* noop */ }
        }
      }
    };
  }, [isOpen]);

  const handleQrScanned = async (patientUserId: string) => {
    setStep("loading");
    setMessage("Looking up patient...");
    stopScanner();

    try {
      const result: LookupResult = await healthApi.scanLookup(patientUserId);
      setLookup(result);
      setStep("appointments");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Lookup failed";
      setStep("error");
      setMessage(msg);
    }
  };

  const handleSelectAppointment = async (appt: LookupAppt) => {
    if (!lookup) return;
    setStep("processing");
    setMessage(`Updating appointment...`);

    try {
      const result = await healthApi.scanCheckin(
        lookup.patientUserId,
        appt.id,
        appt.doctorUserId
      );
      handleCheckinResult(result);
    } catch (err: any) {
      setStep("error");
      setMessage(err?.response?.data?.message || "Check-in failed");
    }
  };

  const handleCreateNew = async (doctorUserId?: string) => {
    if (!lookup) return;
    const docId = doctorUserId || lookup.doctorIds[0];
    if (!docId) return;

    setStep("processing");
    setMessage("Creating walk-in appointment...");

    try {
      const result = await healthApi.scanCheckin(
        lookup.patientUserId,
        undefined,
        docId
      );
      handleCheckinResult(result);
    } catch (err: any) {
      setStep("error");
      setMessage(err?.response?.data?.message || "Failed to create appointment");
    }
  };

  const handleCheckinResult = (result: any) => {
    onCheckin?.();

    if (result.action === "waiting") {
      setStep("success");
      setMessage(
        `${result.patientName} — Waiting #${result.waitingNumber}` +
        (result.created ? " (Walk-in)" : "")
      );
      setTimeout(onClose, 2500);
    } else if (result.action === "consulting") {
      setStep("success");
      setMessage(`Now consulting ${result.patientName}`);
      setTimeout(() => {
        onClose();
        localStorage.setItem("client-context-id", result.patientUserId);
        navigate(`/app/health?client=${result.patientUserId}`, {
          state: {
            patientFromDash: {
              id: result.patientUserId,
              name: result.patientName,
              phone: result.patientPhone || "",
            },
          },
        });
      }, 1500);
    }
  };

  const handleRetry = () => {
    setStep("scanning");
    setMessage("");
    setScannedOnce(false);
    setLookup(null);
  };

  if (!isOpen) return null;

  const actionLabel = lookup?.scannerRole === "doctor" ? "Start Consulting" : "Add to Queue";
  const ActionIcon = lookup?.scannerRole === "doctor" ? Stethoscope : Clock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="card w-full max-w-sm p-5 space-y-4 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition z-10"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-rose-400" />
          <h3 className="text-lg font-semibold">Scan Patient QR</h3>
        </div>

        {/* SCANNING */}
        {step === "scanning" && (
          <>
            <div
              id="qr-scanner-region"
              className="w-full rounded-lg overflow-hidden border border-white/10"
              style={{ minHeight: 280 }}
            />
            <p className="text-xs text-gray-400 text-center">
              Point camera at patient's User QR code
            </p>
          </>
        )}

        {/* LOADING */}
        {step === "loading" && (
          <div className="py-12 text-center space-y-3">
            <div className="h-10 w-10 mx-auto border-4 border-rose-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-300">{message}</p>
          </div>
        )}

        {/* APPOINTMENTS LIST */}
        {step === "appointments" && lookup && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <UserCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium">{lookup.patientName}</span>
              {lookup.patientPhone && (
                <span className="text-xs text-gray-400 ml-auto">{lookup.patientPhone}</span>
              )}
            </div>

            {lookup.appointments.length > 0 ? (
              <>
                <p className="text-xs text-gray-400 px-1">
                  Today's appointments — tap to {lookup.scannerRole === "doctor" ? "start consulting" : "check in"}:
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {lookup.appointments.map((appt) => {
                    const isActionable = !["consulting", "completed", "cancelled"].includes(appt.status);
                    return (
                      <button
                        key={appt.id}
                        onClick={() => isActionable && handleSelectAppointment(appt)}
                        disabled={!isActionable}
                        className={`w-full text-left p-3 rounded-xl border transition ${
                          isActionable
                            ? "border-white/10 hover:border-rose-400/40 hover:bg-white/5 cursor-pointer"
                            : "border-white/5 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {appt.title || "Appointment"}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">
                                Dr. {appt.doctorName}
                              </span>
                              {formatTime(appt) && (
                                <span className="text-xs text-gray-500">
                                  {formatTime(appt)}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColors[appt.status] || "bg-gray-500/20 text-gray-400"}`}>
                            {statusLabel(appt.status, appt.waitingNumber)}
                          </span>
                        </div>
                        {isActionable && (
                          <div className="flex items-center gap-1 mt-2 text-[11px] text-rose-400">
                            <ActionIcon className="h-3 w-3" />
                            <span>{actionLabel}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                No appointments found for today.
              </p>
            )}

            <div className="border-t border-white/10 pt-3">
              {lookup.doctorIds.length === 1 ? (
                <button
                  onClick={() => handleCreateNew(lookup.doctorIds[0])}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-white/20 hover:border-rose-400/40 hover:bg-white/5 text-sm transition"
                >
                  <Plus className="h-4 w-4 text-rose-400" />
                  <span>Create Walk-in Appointment</span>
                </button>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-2">Create walk-in for:</p>
                  <div className="space-y-1.5">
                    {lookup.doctorIds.map((dId) => (
                      <button
                        key={dId}
                        onClick={() => handleCreateNew(dId)}
                        className="w-full flex items-center gap-2 py-2 px-3 rounded-xl border border-dashed border-white/20 hover:border-rose-400/40 hover:bg-white/5 text-sm transition"
                      >
                        <Plus className="h-3.5 w-3.5 text-rose-400" />
                        <span>Dr. {lookup.doctorMap[dId]?.name || "Doctor"}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* PROCESSING */}
        {step === "processing" && (
          <div className="py-12 text-center space-y-3">
            <div className="h-10 w-10 mx-auto border-4 border-rose-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-300">{message}</p>
          </div>
        )}

        {/* SUCCESS */}
        {step === "success" && (
          <div className="py-10 text-center space-y-3">
            <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto" />
            <p className="text-sm font-medium text-emerald-300">{message}</p>
          </div>
        )}

        {/* ERROR */}
        {step === "error" && (
          <div className="py-10 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
            <p className="text-sm text-amber-300">{message}</p>
            <button
              onClick={handleRetry}
              className="btn-secondary text-sm px-4 py-1.5"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QrScannerModal;
