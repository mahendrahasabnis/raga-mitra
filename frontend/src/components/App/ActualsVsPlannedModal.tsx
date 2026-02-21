import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2 } from "lucide-react";

export type SessionItemType = "appointment" | "medicine" | "exercise" | "meal";

interface ActualsVsPlannedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (actual: { done: boolean; notes: string; actual_time?: string }) => void;
  type: SessionItemType;
  planned: {
    title: string;
    subtitle?: string;
    planned_time?: string;
    details?: string;
  };
}

const ActualsVsPlannedModal: React.FC<ActualsVsPlannedModalProps> = ({
  isOpen,
  onClose,
  onSave,
  type,
  planned,
}) => {
  const [done, setDone] = useState(false);
  const [notes, setNotes] = useState("");
  const [actualTime, setActualTime] = useState(
    () => new Date().toISOString().slice(0, 16)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.({ done, notes, actual_time: actualTime });
    onClose();
  };

  if (!isOpen) return null;

  const typeLabel =
    type === "appointment"
      ? "Appointment"
      : type === "medicine"
        ? "Medicine"
        : type === "exercise"
          ? "Exercise session"
          : "Meal";

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4">
      <div className="card max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--panel)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Actuals vs Planned</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
              Planned – {typeLabel}
            </p>
            <p className="font-medium">{planned.title}</p>
            {planned.subtitle && (
              <p className="text-sm text-gray-400 mt-0.5">{planned.subtitle}</p>
            )}
            {planned.planned_time && (
              <p className="text-sm text-rose-200/80 mt-1">
                Planned time: {planned.planned_time}
              </p>
            )}
            {planned.details && (
              <p className="text-sm text-gray-300 mt-1">{planned.details}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={done}
                onChange={(e) => setDone(e.target.checked)}
                className="rounded border-white/20"
              />
              <span className="text-sm">Mark as done</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Actual time (optional)
            </label>
            <input
              type="datetime-local"
              value={actualTime}
              onChange={(e) => setActualTime(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Actual vs planned notes..."
              rows={3}
              className="input w-full resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Save
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ActualsVsPlannedModal;
