import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, CaretDown, Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { MultiSelectOption } from "./types";

interface MultiSelectProps {
  label: string;
  icon: React.ElementType;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  loading?: boolean;
}

export function MultiSelect({
  label,
  icon: Icon,
  options,
  selected,
  onChange,
  placeholder,
  loading,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // Recalculate position when dropdown opens
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close on scroll (parent containers)
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 6,
          left: rect.left,
          width: rect.width,
        });
      }
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen]);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = () => onChange([]);

  const displayText =
    selected.length === 0
      ? placeholder || `All ${label}`
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label || selected[0]
        : `${selected.length} selected`;

  return (
    <div className="relative">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <Icon size={14} weight="bold" className="text-slate-400" />
        {label}
        {loading && (
          <span className="ml-auto text-[10px] text-slate-400 font-normal normal-case animate-pulse">
            loading…
          </span>
        )}
      </label>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between h-10 px-3 rounded-xl border bg-white text-sm transition-all duration-200",
          isOpen
            ? "border-[#3D5A3D] ring-2 ring-[#3D5A3D]/10"
            : "border-slate-200 hover:border-slate-300",
          selected.length > 0 ? "text-slate-900" : "text-slate-400",
        )}
      >
        <span className="truncate">{displayText}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {selected.length > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="w-5 h-5 rounded-full bg-slate-100 hover:bg-red-100 flex items-center justify-center transition-colors cursor-pointer group"
            >
              <X
                size={10}
                weight="bold"
                className="text-slate-400 group-hover:text-red-500"
              />
            </span>
          )}
          <CaretDown
            size={14}
            weight="bold"
            className={cn(
              "text-slate-400 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* Portal-based dropdown to escape overflow:hidden containers */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed bg-white border border-slate-200 rounded-xl overflow-hidden"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
            }}
          >
            <div className="max-h-52 overflow-y-auto p-1.5">
              {options.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400">
                  {loading ? "Loading options…" : "No options available"}
                </div>
              ) : (
                options.map((option) => {
                  const isSelected = selected.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleOption(option.value)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                        isSelected
                          ? "bg-[#3D5A3D]/5 text-[#3D5A3D] font-medium"
                          : "text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0",
                          isSelected
                            ? "bg-[#3D5A3D] border-[#3D5A3D]"
                            : "border-slate-300",
                        )}
                      >
                        {isSelected && (
                          <Check
                            size={10}
                            weight="bold"
                            className="text-white"
                          />
                        )}
                      </div>
                      {option.color ? (
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-md text-xs font-medium border",
                            option.color,
                          )}
                        >
                          {option.label}
                        </span>
                      ) : (
                        <span>{option.label}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {selected.length > 0 && (
              <div className="border-t border-slate-100 p-1.5">
                <button
                  type="button"
                  onClick={clearAll}
                  className="w-full text-xs text-slate-500 hover:text-red-500 py-1.5 transition-colors font-medium"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
