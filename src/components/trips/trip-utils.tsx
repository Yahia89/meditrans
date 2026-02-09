import * as React from "react";
import { cn } from "@/lib/utils";
import { Clock } from "@phosphor-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Helper to parse "HH:mm" -> { hour, minute, period }
export const parseTime = (timeStr: string) => {
  if (!timeStr) return { hour: "12", minute: "00", period: "AM" };
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return {
    hour: hour.toString().padStart(2, "0"),
    minute: m.toString().padStart(2, "0"),
    period,
  };
};

// Helper to format { hour, minute, period } -> "HH:mm"
export const formatTime = (hour: string, minute: string, period: string) => {
  let h = parseInt(hour, 10);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${minute}`;
};

export const TRIP_TYPES = [
  { value: "WORK", label: "Work" },
  { value: "SCHOOL", label: "School" },
  { value: "PLEASURE", label: "Pleasure" },
  { value: "DENTIST", label: "Dentist" },
  { value: "MEDICAL APPOINTMENT", label: "Medical Appointment" },
  { value: "CLINICS", label: "Clinics" },
  { value: "METHADONE CLINICS", label: "Methadone Clinics" },
  { value: "DIALYSIS", label: "Dialysis" },
  { value: "REGULAR TRANSPORTATION", label: "Regular Transportation" },
  { value: "WILL CALL", label: "Will Call" },
  { value: "OTHER", label: "Other" },
] as const;

export const TimePicker = ({
  value,
  onChange,
  className,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  disabled?: boolean;
}) => {
  const { hour, minute, period } = React.useMemo(
    () => parseTime(value),
    [value],
  );

  const updateTime = (
    newHour: string,
    newMinute: string,
    newPeriod: string,
  ) => {
    onChange(formatTime(newHour, newMinute, newPeriod));
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 h-11 px-3 bg-white border border-slate-200 rounded-xl w-fit focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <div className="flex items-center gap-0.5">
        {/* Hour Section */}
        <Select
          disabled={disabled}
          value={hour}
          onValueChange={(val) => updateTime(val, minute, period)}
        >
          <SelectTrigger className="w-10 !border-none !shadow-none bg-transparent !p-0 h-auto focus:ring-0 [&>svg]:hidden text-slate-700">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent align="center" className="min-w-[4rem]">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <SelectItem key={h} value={h.toString().padStart(2, "0")}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-blue-400/50 text-base mx-0.5">:</span>

        {/* Minute Section */}
        <Select
          disabled={disabled}
          value={minute}
          onValueChange={(val) => updateTime(hour, val, period)}
        >
          <SelectTrigger className="w-10 !border-none !shadow-none bg-transparent !p-0 h-auto focus:ring-0 [&>svg]:hidden text-slate-700 text-left">
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent align="center" className="min-w-[4rem]">
            {Array.from({ length: 60 }, (_, i) => i).map((m) => (
              <SelectItem key={m} value={m.toString().padStart(2, "0")}>
                {m.toString().padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* AM/PM Box */}
        <Select
          disabled={disabled}
          value={period}
          onValueChange={(val) => updateTime(hour, minute, val)}
        >
          <SelectTrigger className="w-10 !border-none !shadow-none bg-transparent !p-0 h-auto focus:ring-0 [&>svg]:hidden ml-1 text-slate-700 text-xs text-left">
            <SelectValue placeholder="AM/PM" />
          </SelectTrigger>
          <SelectContent align="center" className="min-w-[4rem]">
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
    </div>
  );
};
