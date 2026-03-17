import { X } from "@phosphor-icons/react";
import type { ActiveFilter } from "./types";

interface FilterChipsProps {
  filters: ActiveFilter[];
  onRemove: (key: string, value: string) => void;
  onClearAll: () => void;
}

export function FilterChips({ filters, onRemove, onClearAll }: FilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
      <span className="text-xs font-medium text-slate-400 mr-1">
        Active filters:
      </span>
      {filters.map((f) => (
        <span
          key={`${f.key}-${f.value}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#3D5A3D]/5 border border-[#3D5A3D]/10 text-xs font-medium text-[#3D5A3D]"
        >
          <span className="text-[10px] uppercase text-[#3D5A3D]/60 font-semibold">
            {f.label}:
          </span>
          {f.value}
          <button
            onClick={() => onRemove(f.key, f.value)}
            className="ml-0.5 w-3.5 h-3.5 rounded-full hover:bg-[#3D5A3D]/10 flex items-center justify-center"
          >
            <X size={8} weight="bold" />
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-slate-400 hover:text-red-500 font-medium ml-auto transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}
