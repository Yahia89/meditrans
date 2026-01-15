import { cn } from "@/lib/utils";

type PresenceStatus = "online" | "away" | "offline";

interface PresenceIndicatorProps {
  status: PresenceStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<
  PresenceStatus,
  { color: string; pulseColor: string; label: string; bgColor: string }
> = {
  online: {
    color: "bg-emerald-500",
    pulseColor: "bg-emerald-400",
    bgColor: "bg-emerald-50",
    label: "Online",
  },
  away: {
    color: "bg-amber-500",
    pulseColor: "bg-amber-400",
    bgColor: "bg-amber-50",
    label: "Away",
  },
  offline: {
    color: "bg-slate-400",
    pulseColor: "bg-slate-300",
    bgColor: "bg-slate-100",
    label: "Offline",
  },
};

const sizeConfig = {
  sm: {
    dot: "h-2 w-2",
    pulse: "h-2 w-2",
    text: "text-[10px]",
    padding: "px-1.5 py-0.5",
    gap: "gap-1",
  },
  md: {
    dot: "h-2.5 w-2.5",
    pulse: "h-2.5 w-2.5",
    text: "text-xs",
    padding: "px-2 py-0.5",
    gap: "gap-1.5",
  },
  lg: {
    dot: "h-3 w-3",
    pulse: "h-3 w-3",
    text: "text-sm",
    padding: "px-2.5 py-1",
    gap: "gap-2",
  },
};

/**
 * Presence indicator component showing user's online status
 * - Online: pulsing green dot
 * - Away: static amber dot
 * - Offline: static gray dot
 */
export function PresenceIndicator({
  status,
  size = "md",
  showLabel = false,
  className,
}: PresenceIndicatorProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];

  return (
    <div
      className={cn(
        "inline-flex items-center",
        sizes.gap,
        showLabel && cn(sizes.padding, "rounded-full", config.bgColor),
        className
      )}
      title={config.label}
    >
      <span className="relative flex">
        {/* Pulse animation for online status */}
        {status === "online" && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              config.pulseColor,
              sizes.pulse
            )}
          />
        )}
        {/* Main dot */}
        <span
          className={cn(
            "relative inline-flex rounded-full",
            config.color,
            sizes.dot
          )}
        />
      </span>
      {showLabel && (
        <span
          className={cn(
            "font-medium",
            sizes.text,
            status === "online" && "text-emerald-700",
            status === "away" && "text-amber-700",
            status === "offline" && "text-slate-600"
          )}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}

/**
 * Positioned presence indicator for avatars/cards
 * Absolutely positioned in bottom-right corner by default
 */
export function PresenceBadge({
  status,
  size = "sm",
  className,
}: Omit<PresenceIndicatorProps, "showLabel">) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];

  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 block rounded-full ring-2 ring-white",
        config.color,
        sizes.dot,
        className
      )}
      title={config.label}
    >
      {status === "online" && (
        <span
          className={cn(
            "absolute inset-0 rounded-full animate-ping opacity-75",
            config.pulseColor
          )}
        />
      )}
    </span>
  );
}
