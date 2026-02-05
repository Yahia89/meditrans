import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, Desktop } from "@phosphor-icons/react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Mountain Time (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
];

interface TimezoneSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function TimezoneSelector({
  value,
  onValueChange,
  className,
  placeholder = "Select Timezone",
  side = "bottom",
}: TimezoneSelectorProps) {
  const browserTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      return null;
    }
  }, []);

  const browserTimezoneLabel = useMemo(() => {
    if (!browserTimezone) return null;
    return `My Computer (${browserTimezone})`;
  }, [browserTimezone]);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "h-11 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white transition-all",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <Globe weight="duotone" className="w-4 h-4 text-[#3D5A3D]" />
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent
        side={side}
        sideOffset={8}
        className="rounded-2xl border-slate-200 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] p-1 min-w-[280px] max-h-[400px]"
      >
        {browserTimezone && (
          <SelectGroup>
            <SelectLabel className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/30 rounded-lg mb-1">
              Local Timezone
            </SelectLabel>
            <SelectItem
              value={browserTimezone}
              className="rounded-xl focus:bg-slate-50 focus:text-slate-900 cursor-pointer py-2.5"
            >
              <div className="flex items-center gap-2">
                <Desktop
                  weight="duotone"
                  className="w-4 h-4 text-emerald-500"
                />
                <span className="font-medium text-slate-700">
                  {browserTimezoneLabel}
                </span>
              </div>
            </SelectItem>
            <div className="h-px bg-slate-100 my-1 mx-1" />
          </SelectGroup>
        )}

        {US_TIMEZONES.map((tz) => (
          <SelectItem
            key={tz.value}
            value={tz.value}
            className="rounded-xl focus:bg-slate-50 focus:text-slate-900 cursor-pointer py-2.5"
          >
            <span className="font-medium text-slate-600">{tz.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
