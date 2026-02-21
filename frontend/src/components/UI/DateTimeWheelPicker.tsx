import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "lucide-react";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

type AmPm = "AM" | "PM";

function parseDatetime(value: string): {
  year: number;
  month: number;
  day: number;
  hour12: number;
  minute: number;
  ampm: AmPm;
} {
  if (!value || !value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)) {
    const d = new Date();
    const h24 = d.getHours();
    const h12 = h24 % 12 || 12;
    const ampm: AmPm = h24 < 12 ? "AM" : "PM";
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour12: h12,
      minute: Math.min(55, Math.floor(d.getMinutes() / 5) * 5),
      ampm,
    };
  }
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h24, min] = (timePart || "00:00").split(":").map(Number);
  const hour24 = h24 ?? 0;
  const hour12 = hour24 % 12 || 12;
  const ampm: AmPm = hour24 < 12 ? "AM" : "PM";
  const minute = Math.min(55, Math.floor((min || 0) / 5) * 5);
  return { year: y, month: m, day: d, hour12, minute, ampm };
}

function toDatetime(
  year: number,
  month: number,
  day: number,
  hour12: number,
  minute: number,
  ampm: AmPm
): string {
  const hour24 = ampm === "AM" ? (hour12 === 12 ? 0 : hour12) : (hour12 === 12 ? 12 : hour12 + 12);
  const d = new Date(year, month - 1, day, hour24, minute, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dayStr = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${dayStr}T${h}:${min}`;
}

const ITEM_HEIGHT = 40;
const VISIBLE_COUNT = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT;

interface WheelColumnProps<T> {
  items: T[];
  value: T;
  formatter: (item: T) => string;
  onSelect: (item: T) => void;
  id: string;
}

function WheelColumn<T>({ items, value, formatter, onSelect, id }: WheelColumnProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const index = items.indexOf(value);
  const isControlled = index >= 0;

  useEffect(() => {
    if (!scrollRef.current || !isControlled) return;
    const el = scrollRef.current;
    const targetScroll = index * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - targetScroll) > 1) {
      el.scrollTop = targetScroll;
    }
  }, [index, isControlled]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(i, items.length - 1));
    if (items[clamped] !== value) {
      onSelect(items[clamped]);
    }
  }, [items, value, onSelect]);

  return (
    <div
      ref={scrollRef}
      role="listbox"
      aria-label={id}
      tabIndex={0}
      className="wheel-column overflow-y-auto overflow-x-hidden flex-1 min-w-0"
      style={{
        height: WHEEL_HEIGHT,
        scrollSnapType: "y mandatory",
        scrollBehavior: "auto",
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: ITEM_HEIGHT * 2 }} aria-hidden />
      {items.map((item, i) => (
        <div
          key={String(item)}
          role="option"
          aria-selected={item === value}
          style={{
            height: ITEM_HEIGHT,
            scrollSnapAlign: "center",
            scrollSnapStop: "always",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.05rem",
            color: item === value ? "var(--foreground)" : "var(--muted)",
            fontWeight: item === value ? 600 : 400,
          }}
          className="wheel-item"
        >
          {formatter(item)}
        </div>
      ))}
      <div style={{ height: ITEM_HEIGHT * 2 }} aria-hidden />
    </div>
  );
}

export interface DateTimeWheelPickerProps {
  value: string; // "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function DateTimeWheelPicker({
  value,
  onChange,
  placeholder = "Select date & time",
  disabled,
  className = "",
}: DateTimeWheelPickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseDatetime(value), [value]);
  const [local, setLocal] = useState(parsed);

  useEffect(() => {
    setLocal(parseDatetime(value));
  }, [value, open]);

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => y - 1 + i);
  }, []);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = useMemo(() => {
    const max = getDaysInMonth(local.year, local.month);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [local.year, local.month]);
  const hours12 = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);
  const ampmOptions: AmPm[] = useMemo(() => ["AM", "PM"], []);

  const day = Math.min(local.day, days.length) || 1;
  const dayVal = days.includes(local.day) ? local.day : day;

  const handleDone = useCallback(() => {
    const next = toDatetime(local.year, local.month, dayVal, local.hour12, local.minute, local.ampm);
    onChange(next);
    setOpen(false);
  }, [local, dayVal, onChange]);

  const displayText = value
    ? (() => {
        const { year, month, day: d, hour12, minute } = parseDatetime(value);
        return `${MONTHS[month - 1]} ${d}, ${year} · ${hour12}:${String(minute).padStart(2, "0")} ${parseDatetime(value).ampm}`;
      })()
    : placeholder;

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={`input-field w-full flex items-center gap-2 text-left ${className}`}
      >
        <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
        <span className={value ? "text-[var(--foreground)]" : "text-gray-400"}>{displayText}</span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex flex-col justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="Pick date and time"
          >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="relative bg-[var(--panel)] border-t border-[var(--border)] rounded-t-2xl shadow-lg flex flex-col max-h-[70vh]"
            style={{ background: "var(--panel-strong)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] px-2 py-1"
              >
                Cancel
              </button>
              <span className="font-semibold text-[var(--foreground)]">Date & Time</span>
              <button
                type="button"
                onClick={handleDone}
                className="text-[var(--primary)] font-semibold px-2 py-1"
              >
                Done
              </button>
            </div>

            <div
              className="relative flex gap-1 px-2 py-2 overflow-hidden"
              style={{
                maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
              }}
            >
              <WheelColumn
                id="month"
                items={months}
                value={local.month}
                formatter={(m) => MONTHS[m - 1]}
                onSelect={(m) => setLocal((p) => ({ ...p, month: m }))}
              />
              <WheelColumn
                id="day"
                items={days}
                value={dayVal}
                formatter={(d) => String(d)}
                onSelect={(d) => setLocal((p) => ({ ...p, day: d }))}
              />
              <WheelColumn
                id="year"
                items={years}
                value={local.year}
                formatter={(y) => String(y)}
                onSelect={(y) => setLocal((p) => ({ ...p, year: y }))}
              />
              <WheelColumn
                id="hour"
                items={hours12}
                value={local.hour12}
                formatter={(h) => String(h)}
                onSelect={(h) => setLocal((p) => ({ ...p, hour12: h }))}
              />
              <WheelColumn
                id="minute"
                items={minutes}
                value={local.minute}
                formatter={(m) => String(m).padStart(2, "0")}
                onSelect={(m) => setLocal((p) => ({ ...p, minute: m }))}
              />
              <WheelColumn
                id="ampm"
                items={ampmOptions}
                value={local.ampm}
                formatter={(a) => a}
                onSelect={(a) => setLocal((p) => ({ ...p, ampm: a }))}
              />
            </div>
            <div className="py-2 text-center text-xs text-[var(--muted)]">
              Month · Day · Year · Hour · Min · AM/PM
            </div>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
