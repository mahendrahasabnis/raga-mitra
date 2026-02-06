import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Option = {
  value: string;
  label: string;
};

type SelectDropdownProps = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

const SelectDropdown: React.FC<SelectDropdownProps> = ({
  value,
  options,
  onChange,
  placeholder = "Select...",
  className = "",
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const selected = options.find((opt) => opt.value === value);
  const label = selected?.label || placeholder;

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPanelStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div className="relative z-40" ref={wrapperRef}>
      <button
        type="button"
        className={`input-field w-full flex items-center justify-between gap-2 ${className}`}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        ref={buttonRef}
        disabled={disabled}
      >
        <span className={`truncate ${selected ? "" : "text-gray-400"}`}>{label}</span>
        <span className="text-xs text-gray-400">▾</span>
      </button>
      {open &&
        createPortal(
          <div
            className="fixed z-[9999] rounded-xl border border-white/10 bg-[var(--panel)] shadow-lg backdrop-blur max-h-64 overflow-y-auto"
            style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 ${
                  index < options.length - 1 ? "border-b border-white/10" : ""
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

export default SelectDropdown;
