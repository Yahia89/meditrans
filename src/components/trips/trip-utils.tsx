import { useMemo } from "react";
import { cn } from "@/lib/utils";

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
  const { hour, minute, period } = useMemo(() => parseTime(value), [value]);

  const updateTime = (
    newHour: string,
    newMinute: string,
    newPeriod: string,
  ) => {
    onChange(formatTime(newHour, newMinute, newPeriod));
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <select
        disabled={disabled}
        value={hour}
        onChange={(e) => updateTime(e.target.value, minute, period)}
        className={cn(
          "flex-1 rounded-md border-slate-200 bg-white h-10 px-2 text-sm focus:ring-2 focus:ring-blue-500/20",
          disabled && "bg-slate-100 text-slate-400 cursor-not-allowed",
        )}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h.toString().padStart(2, "0")}>
            {h.toString().padStart(2, "0")}
          </option>
        ))}
      </select>
      <span className="text-slate-400 font-bold">:</span>
      <select
        disabled={disabled}
        value={minute}
        onChange={(e) => updateTime(hour, e.target.value, period)}
        className={cn(
          "flex-1 rounded-md border-slate-200 bg-white h-10 px-2 text-sm focus:ring-2 focus:ring-blue-500/20",
          disabled && "bg-slate-100 text-slate-400 cursor-not-allowed",
        )}
      >
        {/* 5 minute steps */}
        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
          <option key={m} value={m.toString().padStart(2, "0")}>
            {m.toString().padStart(2, "0")}
          </option>
        ))}
      </select>
      <select
        disabled={disabled}
        value={period}
        onChange={(e) => updateTime(hour, minute, e.target.value)}
        className={cn(
          "w-20 rounded-md border-slate-200 bg-white h-10 px-2 text-sm focus:ring-2 focus:ring-blue-500/20",
          disabled && "bg-slate-100 text-slate-400 cursor-not-allowed",
        )}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

// Vehicle type compatibility matrix
export const canDriverServePatient = (
  driverVehicleType: string | null,
  patientNeed: string | null,
): boolean => {
  if (!patientNeed || patientNeed === "COMMON CARRIER") return true;
  if (!driverVehicleType) return false;

  const compatibility: Record<string, string[]> = {
    "COMMON CARRIER": ["COMMON CARRIER"],
    "FOLDED WHEELCHAIR": ["COMMON CARRIER", "FOLDED WHEELCHAIR"],
    WHEELCHAIR: ["COMMON CARRIER", "FOLDED WHEELCHAIR", "WHEELCHAIR"],
    VAN: ["COMMON CARRIER", "FOLDED WHEELCHAIR", "WHEELCHAIR", "VAN"],
  };

  return compatibility[driverVehicleType]?.includes(patientNeed) || false;
};
