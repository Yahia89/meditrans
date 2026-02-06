import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CaretUp, CaretDown } from "@phosphor-icons/react";

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
    <div
      className={cn(
        "flex items-center gap-1.5 h-11 px-3 bg-white border border-slate-200 rounded-xl w-fit focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {/* Hour Section */}
      <div className="flex items-center">
        <select
          disabled={disabled}
          value={hour}
          onChange={(e) => updateTime(e.target.value, minute, period)}
          className={cn(
            "w-10 bg-transparent text-base font-bold text-slate-700 focus:outline-none cursor-pointer appearance-none text-right",
            disabled && "text-slate-300 cursor-not-allowed",
          )}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h.toString().padStart(2, "0")}>
              {h}
            </option>
          ))}
        </select>
        <div className="flex flex-col -space-y-2.5 ml-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const currentH = parseInt(hour, 10);
              const nextH = currentH === 12 ? 1 : currentH + 1;
              updateTime(nextH.toString().padStart(2, "0"), minute, period);
            }}
            className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30"
          >
            <CaretUp size={10} weight="bold" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const currentH = parseInt(hour, 10);
              const prevH = currentH === 1 ? 12 : currentH - 1;
              updateTime(prevH.toString().padStart(2, "0"), minute, period);
            }}
            className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30"
          >
            <CaretDown size={10} weight="bold" />
          </button>
        </div>
      </div>

      <span className="text-blue-400/50 font-black text-base mx-0.5">:</span>

      {/* Minute Section */}
      <div className="flex items-center">
        <select
          disabled={disabled}
          value={minute}
          onChange={(e) => updateTime(hour, e.target.value, period)}
          className={cn(
            "w-10 bg-transparent text-base font-bold text-slate-700 focus:outline-none cursor-pointer appearance-none text-left",
            disabled && "text-slate-300 cursor-not-allowed",
          )}
        >
          {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
            <option key={m} value={m.toString().padStart(2, "0")}>
              {m.toString().padStart(2, "0")}
            </option>
          ))}
        </select>
        <div className="flex flex-col -space-y-2.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const currentM = parseInt(minute, 10);
              const nextM = (currentM + 5) % 60;
              updateTime(hour, nextM.toString().padStart(2, "0"), period);
            }}
            className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30"
          >
            <CaretUp size={10} weight="bold" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const currentM = parseInt(minute, 10);
              const prevM = (currentM - 5 + 60) % 60;
              updateTime(hour, prevM.toString().padStart(2, "0"), period);
            }}
            className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30"
          >
            <CaretDown size={10} weight="bold" />
          </button>
        </div>
      </div>

      {/* AM/PM Box */}
      <div className="ml-2 flex items-center gap-1">
        <select
          disabled={disabled}
          value={period}
          onChange={(e) => updateTime(hour, minute, e.target.value)}
          className={cn(
            "bg-transparent text-xs font-black text-slate-700 focus:outline-none cursor-pointer appearance-none",
            disabled && "text-slate-300 cursor-not-allowed",
          )}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
        <div className="flex flex-col -space-y-2.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              updateTime(hour, minute, period === "AM" ? "PM" : "AM")
            }
            className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30"
          >
            <CaretUp size={10} weight="bold" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              updateTime(hour, minute, period === "AM" ? "PM" : "AM")
            }
            className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30"
          >
            <CaretDown size={10} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
};
