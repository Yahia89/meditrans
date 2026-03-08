"use client";

import {
  Warning,
  ArrowRight,
  Car,
  Shield,
  Certificate,
  IdentificationBadge,
  FirstAid,
  Trash,
  CheckCircle,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useNotificationStates } from "@/hooks/useNotificationStates";
import { Loader2 } from "lucide-react";

export interface DriverAlert {
  id: string;
  driverId: string;
  driverName: string;
  type:
    | "dot_medical"
    | "insurance"
    | "driver_record"
    | "inspection"
    | "license";
  label: string;
  expirationDate: string;
  daysUntilExpiration: number;
  severity: "expired" | "critical" | "warning";
}

function getAlertIcon(type: DriverAlert["type"]) {
  switch (type) {
    case "dot_medical":
      return <FirstAid size={14} weight="duotone" />;
    case "insurance":
      return <Shield size={14} weight="duotone" />;
    case "driver_record":
      return <Certificate size={14} weight="duotone" />;
    case "inspection":
      return <Car size={14} weight="duotone" />;
    case "license":
      return <IdentificationBadge size={14} weight="duotone" />;
  }
}

function formatExpirationText(days: number): string {
  if (days < 0)
    return `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

// The warning threshold: how many days before expiration to start warning
const WARNING_DAYS = 30;
const CRITICAL_DAYS = 7;

export function useDriverAlerts() {
  const { currentOrganization } = useOrganization();

  return useQuery<DriverAlert[]>({
    queryKey: ["driver-expiration-alerts", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      const { data: drivers, error } = await supabase
        .from("drivers")
        .select(
          "id, full_name, dot_medical_expiration, insurance_expiration_date, driver_record_expiration, inspection_date, license_number",
        )
        .eq("org_id", currentOrganization.id)
        .eq("active", true);

      if (error) throw error;
      if (!drivers?.length) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const alerts: DriverAlert[] = [];

      drivers.forEach((driver) => {
        const fields: {
          key: keyof typeof driver;
          type: DriverAlert["type"];
          label: string;
        }[] = [
          {
            key: "dot_medical_expiration",
            type: "dot_medical",
            label: "DOT Medical",
          },
          {
            key: "insurance_expiration_date",
            type: "insurance",
            label: "Insurance",
          },
          {
            key: "driver_record_expiration",
            type: "driver_record",
            label: "Driver Record",
          },
          {
            key: "inspection_date",
            type: "inspection",
            label: "Inspection",
          },
        ];

        fields.forEach(({ key, type, label }) => {
          const dateValue = driver[key] as string | null;
          if (!dateValue) return;

          const expDate = new Date(dateValue);
          expDate.setHours(0, 0, 0, 0);
          const diffMs = expDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          // Only show if expired or within warning threshold
          if (diffDays <= WARNING_DAYS) {
            let severity: DriverAlert["severity"] = "warning";
            if (diffDays < 0) severity = "expired";
            else if (diffDays <= CRITICAL_DAYS) severity = "critical";

            alerts.push({
              id: `${driver.id}-${type}`,
              driverId: driver.id,
              driverName: driver.full_name,
              type,
              label,
              expirationDate: dateValue,
              daysUntilExpiration: diffDays,
              severity,
            });
          }
        });
      });

      // Sort: expired first, then by days ascending
      return alerts.sort(
        (a, b) => a.daysUntilExpiration - b.daysUntilExpiration,
      );
    },
    enabled: !!currentOrganization?.id,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

interface DriverExpirationAlertsProps {
  onNavigateToDriver?: (driverId: string) => void;
}

export function DriverExpirationAlerts({
  onNavigateToDriver,
}: DriverExpirationAlertsProps) {
  const { data: allAlerts = [], isLoading } = useDriverAlerts();
  const {
    readIds,
    dismissedIds,
    markRead,
    dismiss: dismissAlert,
  } = useNotificationStates();

  // Filter out dismissed alerts
  const alerts = allAlerts.filter((a) => !dismissedIds.has(a.id));

  if (isLoading) {
    return (
      <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-slate-900 text-sm">Loading...</h4>
          <p className="text-xs text-slate-500 mt-1">
            Checking driver compliance
          </p>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 transition-all">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
          <Shield size={20} weight="duotone" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-slate-900 text-sm">
            All Drivers Compliant
          </h4>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            No upcoming expirations within the next 30 days.
          </p>
        </div>
      </div>
    );
  }

  const expiredCount = alerts.filter((a) => a.severity === "expired").length;
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const hasExpired = expiredCount > 0;
  const hasCritical = criticalCount > 0;

  const bgColor = hasExpired
    ? "bg-red-50 border-red-100"
    : hasCritical
      ? "bg-amber-50 border-amber-100"
      : "bg-amber-50/50 border-amber-100/50";

  const iconBgColor = hasExpired
    ? "bg-red-100 text-red-700"
    : "bg-amber-100 text-amber-700";

  return (
    <div className={cn("rounded-xl border transition-all", bgColor)}>
      {/* Header */}
      <div className="flex items-start gap-4 p-4">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            iconBgColor,
          )}
        >
          <Warning size={20} weight="fill" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-slate-900 text-sm">
              Driver Compliance Alerts
            </h4>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                hasExpired
                  ? "bg-red-200 text-red-800"
                  : "bg-amber-200 text-amber-800",
              )}
            >
              {alerts.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {expiredCount > 0 && (
              <span className="text-red-600 font-semibold">
                {expiredCount} expired
              </span>
            )}
            {expiredCount > 0 &&
              (criticalCount > 0 ||
                alerts.length - expiredCount - criticalCount > 0) &&
              " · "}
            {criticalCount > 0 && (
              <span className="text-amber-600 font-semibold">
                {criticalCount} critical
              </span>
            )}
            {criticalCount > 0 &&
              alerts.length - expiredCount - criticalCount > 0 &&
              " · "}
            {alerts.length - expiredCount - criticalCount > 0 && (
              <span>
                {alerts.length - expiredCount - criticalCount} upcoming
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Alert items */}
      <div className="px-4 pb-4 space-y-2 max-h-[280px] overflow-y-auto">
        {alerts.slice(0, 8).map((alert) => {
          const isRead = readIds.has(alert.id);
          return (
            <div
              key={alert.id}
              className={cn(
                "relative w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all group",
                isRead
                  ? "bg-slate-50/50 border-slate-200 opacity-55"
                  : alert.severity === "expired"
                    ? "bg-red-50/80 border-red-200 hover:bg-red-100"
                    : alert.severity === "critical"
                      ? "bg-amber-50/80 border-amber-200 hover:bg-amber-100"
                      : "bg-white border-slate-200 hover:bg-slate-50",
              )}
            >
              {/* Click area for navigation */}
              <button
                className="absolute inset-0 z-0 rounded-lg cursor-pointer"
                onClick={() => {
                  markRead(alert.id);
                  onNavigateToDriver?.(alert.driverId);
                }}
                aria-label={`View ${alert.driverName}`}
              />

              {/* Icon */}
              <div
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 relative z-10",
                  isRead
                    ? "bg-slate-100 text-slate-400"
                    : alert.severity === "expired"
                      ? "bg-red-100 text-red-600"
                      : alert.severity === "critical"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-slate-100 text-slate-500",
                )}
              >
                {isRead ? (
                  <CheckCircle size={14} weight="duotone" />
                ) : (
                  getAlertIcon(alert.type)
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 relative z-10 pointer-events-none">
                <p
                  className={cn(
                    "text-xs font-semibold truncate",
                    isRead ? "text-slate-400" : "text-slate-900",
                  )}
                >
                  {alert.driverName}
                </p>
                <p
                  className={cn(
                    "text-[11px] mt-0.5",
                    isRead
                      ? "text-slate-400"
                      : alert.severity === "expired"
                        ? "text-red-600 font-semibold"
                        : alert.severity === "critical"
                          ? "text-amber-600 font-semibold"
                          : "text-slate-500",
                  )}
                >
                  {alert.label} —{" "}
                  {formatExpirationText(alert.daysUntilExpiration)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 relative z-10 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissAlert(alert.id);
                  }}
                  className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-lg transition-all",
                    "text-slate-300 hover:text-red-500 hover:bg-red-50",
                    "opacity-0 group-hover:opacity-100",
                  )}
                  title="Dismiss"
                >
                  <Trash
                    size={13}
                    weight="bold"
                    className="w-[13px] h-[13px] min-w-[13px] min-h-[13px]"
                  />
                </button>
                <ArrowRight
                  size={12}
                  weight="bold"
                  className="text-slate-400 group-hover:translate-x-0.5 group-hover:text-slate-600 transition-all pointer-events-none"
                />
              </div>
            </div>
          );
        })}
        {alerts.length > 8 && (
          <p className="text-center text-xs text-slate-400 pt-1">
            +{alerts.length - 8} more alerts
          </p>
        )}
      </div>
    </div>
  );
}
