"use client";

import { useRef, useState, useEffect } from "react";
import {
  Bell,
  ArrowRight,
  X,
  Shield,
  FirstAid,
  Car,
  Certificate,
  IdentificationBadge,
  CreditCard,
  Trash,
  CheckCircle,
  ClipboardText,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useDriverAlerts, type DriverAlert } from "./DriverExpirationAlerts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useNotificationStates } from "@/hooks/useNotificationStates";
import {
  calculateCreditStatus,
  calculateTripCost,
  type OrganizationFees,
} from "@/lib/credit-utils";

/* ─── Icon helper ─── */
function alertIcon(type: DriverAlert["type"]) {
  const props = { size: 16, weight: "duotone" as const };
  switch (type) {
    case "dot_medical":
      return <FirstAid {...props} />;
    case "insurance":
      return <Shield {...props} />;
    case "driver_record":
      return <Certificate {...props} />;
    case "inspection":
      return <Car {...props} />;
    case "license":
      return <IdentificationBadge {...props} />;
  }
}

function formatExpirationText(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Tomorrow";
  return `${days}d left`;
}

/* ─── Types ─── */
interface NotificationBellProps {
  onNavigateToDriver?: (driverId: string) => void;
  onNavigateToCredits?: () => void;
  onNavigateToPatient?: (patientId: string) => void;
}

interface CreditAlert {
  id: string;
  patientName: string;
  percentRemaining: number;
  severity: "expired" | "critical" | "warning";
}

interface SalAlert {
  id: string;
  patientName: string;
  salStatus: "pending" | "expired";
  salPendingReason: string | null;
  severity: "expired" | "warning";
}

/* ─── Component ─── */
export function NotificationBell({
  onNavigateToDriver,
  onNavigateToCredits,
  onNavigateToPatient,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // ─ Backend notification state ─
  const {
    readIds,
    dismissedIds,
    markRead,
    dismiss: dismissAlert,
    clearAllRead,
  } = useNotificationStates();

  // ─ Driver expiration alerts ─
  const { data: driverAlertsRaw = [] } = useDriverAlerts();

  // ─ Credit alerts (slim version) ─
  const { currentOrganization } = useOrganization();

  const { data: fees } = useQuery({
    queryKey: ["organization_fees", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;
      const { data, error } = await supabase
        .from("organization_fees")
        .select("*")
        .eq("org_id", currentOrganization.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as OrganizationFees;
    },
    enabled: !!currentOrganization?.id,
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
  );

  const { data: creditAlertsRaw = [] } = useQuery<CreditAlert[]>({
    queryKey: ["bell-credit-alerts", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data: patients, error: pe } = await supabase
        .from("patients")
        .select("id, full_name, monthly_credit")
        .eq("org_id", currentOrganization.id)
        .not("monthly_credit", "is", null);
      if (pe) throw pe;
      if (!patients?.length) return [];

      const { data: trips, error: te } = await supabase
        .from("trips")
        .select(
          "id, patient_id, status, trip_type, actual_distance_miles, distance_miles, total_waiting_minutes",
        )
        .eq("org_id", currentOrganization.id)
        .eq("status", "completed")
        .gte("pickup_time", startOfMonth.toISOString())
        .lte("pickup_time", endOfMonth.toISOString());
      if (te) throw te;

      const results: CreditAlert[] = [];
      patients.forEach((p) => {
        const pTrips = trips?.filter((t) => t.patient_id === p.id) || [];
        const spent = pTrips.reduce(
          (s, t) => s + calculateTripCost(t, fees || null),
          0,
        );
        const credit = p.monthly_credit || 0;
        const info = calculateCreditStatus(credit, spent);
        if (info.status !== "good" && info.status !== "none") {
          const pct = info.percentage / 100;
          results.push({
            id: p.id,
            patientName: p.full_name,
            percentRemaining: pct,
            severity:
              pct <= 0.05 ? "expired" : pct <= 0.25 ? "critical" : "warning",
          });
        }
      });
      return results.sort((a, b) => a.percentRemaining - b.percentRemaining);
    },
    enabled: !!currentOrganization?.id && fees !== undefined,
    refetchInterval: 60000,
  });

  // ─ SAL status alerts ─
  const { data: salAlertsRaw = [] } = useQuery<SalAlert[]>({
    queryKey: ["bell-sal-alerts", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data: patients, error } = await supabase
        .from("patients")
        .select("id, full_name, sal_status, sal_pending_reason")
        .eq("org_id", currentOrganization.id)
        .in("sal_status", ["pending", "expired"]);
      if (error) throw error;
      if (!patients?.length) return [];

      return patients.map((p) => ({
        id: p.id,
        patientName: p.full_name,
        salStatus: p.sal_status as "pending" | "expired",
        salPendingReason: p.sal_pending_reason,
        severity: p.sal_status === "expired" ? "expired" as const : "warning" as const,
      }));
    },
    enabled: !!currentOrganization?.id,
    refetchInterval: 60000,
  });

  // ─ Filter out dismissed ─
  const driverAlerts = driverAlertsRaw.filter((a) => !dismissedIds.has(a.id));
  const creditAlerts = creditAlertsRaw.filter(
    (a) => !dismissedIds.has(`credit-${a.id}`),
  );
  const salAlerts = salAlertsRaw.filter(
    (a) => !dismissedIds.has(`sal-${a.id}`),
  );

  // ─ Clear all read (dismiss all that are marked read) ─
  const handleClearAllRead = () => {
    const readAlertIds = [
      ...driverAlerts.filter((a) => readIds.has(a.id)).map((a) => a.id),
      ...creditAlerts
        .filter((a) => readIds.has(`credit-${a.id}`))
        .map((a) => `credit-${a.id}`),
      ...salAlerts
        .filter((a) => readIds.has(`sal-${a.id}`))
        .map((a) => `sal-${a.id}`),
    ];
    clearAllRead(readAlertIds);
  };

  // ─ Counts ─
  const totalAlerts = driverAlerts.length + creditAlerts.length + salAlerts.length;
  const unreadCount =
    driverAlerts.filter((a) => !readIds.has(a.id)).length +
    creditAlerts.filter((a) => !readIds.has(`credit-${a.id}`)).length +
    salAlerts.filter((a) => !readIds.has(`sal-${a.id}`)).length;

  const hasExpired =
    driverAlerts.some((a) => a.severity === "expired") ||
    creditAlerts.some((a) => a.severity === "expired") ||
    salAlerts.some((a) => a.severity === "expired");
  const hasCritical =
    driverAlerts.some((a) => a.severity === "critical") ||
    creditAlerts.some((a) => a.severity === "critical");

  const hasReadNotifications =
    driverAlerts.some((a) => readIds.has(a.id)) ||
    creditAlerts.some((a) => readIds.has(`credit-${a.id}`)) ||
    salAlerts.some((a) => readIds.has(`sal-${a.id}`));

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Don't render anything if no alerts
  if (totalAlerts === 0) return null;

  const bellColor = hasExpired
    ? "text-red-600"
    : hasCritical
      ? "text-amber-500"
      : "text-amber-400";

  const badgeColor = hasExpired
    ? "bg-red-500"
    : hasCritical
      ? "bg-amber-500"
      : "bg-amber-400";

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl border-2 transition-all",
          open
            ? "bg-slate-100 border-slate-300 shadow-inner"
            : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm hover:shadow-md",
        )}
        aria-label={`${unreadCount} unread notifications`}
      >
        <Bell
          size={20}
          weight={open ? "fill" : "duotone"}
          className={cn(
            bellColor,
            "transition-colors w-5 h-5 md:w-6 md:h-6 min-w-[20px] min-h-[20px] md:min-w-[24px] md:min-h-[24px]",
          )}
        />

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-1.5 -right-1.5 md:-top-2 md:-right-2 min-w-[18px] h-[18px] md:min-w-[22px] md:h-[22px] px-1 md:px-1.5 flex items-center justify-center rounded-full text-[9px] md:text-[11px] font-bold text-white shadow-lg ring-2 ring-white",
              badgeColor,
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}

        {/* Pulse ring for expired */}
        {hasExpired && unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 md:-top-2 md:-right-2 w-[18px] h-[18px] md:w-[22px] md:h-[22px] rounded-full bg-red-400 animate-ping opacity-30 pointer-events-none" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className={cn(
            "absolute right-0 top-[calc(100%+10px)] z-50 w-[400px] max-h-[540px]",
            "bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/15",
            "animate-in slide-in-from-top-2 fade-in-0 zoom-in-95 duration-200",
            "flex flex-col overflow-hidden",
          )}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center",
                  hasExpired
                    ? "bg-red-100 text-red-600"
                    : "bg-amber-100 text-amber-600",
                )}
              >
                <Bell size={18} weight="fill" className="w-[18px] h-[18px]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Notifications
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  {unreadCount} unread · {totalAlerts} total
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {hasReadNotifications && (
                <button
                  onClick={handleClearAllRead}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors uppercase tracking-wider"
                  title="Dismiss all read notifications"
                >
                  Clear read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto">
            {/* Driver alerts section */}
            {driverAlerts.length > 0 && (
              <div className="p-4 pb-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Shield size={12} weight="duotone" />
                  Driver Compliance
                </h4>
                <div className="space-y-1.5">
                  {driverAlerts.slice(0, 10).map((alert) => {
                    const isRead = readIds.has(alert.id);
                    return (
                      <div
                        key={alert.id}
                        className={cn(
                          "relative flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-xl text-left transition-all group",
                          isRead
                            ? "bg-slate-50/50 opacity-55"
                            : alert.severity === "expired"
                              ? "bg-red-50 hover:bg-red-100"
                              : alert.severity === "critical"
                                ? "bg-amber-50 hover:bg-amber-100"
                                : "hover:bg-slate-50",
                        )}
                      >
                        {/* Click area for navigation */}
                        <button
                          className="absolute inset-0 z-0 rounded-xl"
                          onClick={() => {
                            markRead(alert.id);
                            onNavigateToDriver?.(alert.driverId);
                            setOpen(false);
                          }}
                          aria-label={`View ${alert.driverName}`}
                        />

                        {/* Icon */}
                        <div
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10",
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
                            <CheckCircle size={16} weight="duotone" />
                          ) : (
                            alertIcon(alert.type)
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

                        {/* Actions — properly spaced dismiss + arrow */}
                        <div className="flex items-center gap-0.5 relative z-10 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissAlert(alert.id);
                            }}
                            className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-xl transition-all",
                              "text-slate-300 hover:text-red-500 hover:bg-red-50",
                              "opacity-0 group-hover:opacity-100",
                            )}
                            title="Dismiss"
                          >
                            <Trash
                              size={14}
                              weight="bold"
                              className="w-3.5 h-3.5 min-w-[14px] min-h-[14px]"
                            />
                          </button>
                          <ArrowRight
                            size={12}
                            weight="bold"
                            className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all pointer-events-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Credit alerts section */}
            {creditAlerts.length > 0 && (
              <div className="p-4 pt-2">
                {driverAlerts.length > 0 && (
                  <div className="h-px bg-slate-100 mb-3" />
                )}
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <CreditCard size={12} weight="duotone" />
                  Patient Credits
                </h4>
                <div className="space-y-1.5">
                  {creditAlerts.slice(0, 6).map((alert) => {
                    const alertId = `credit-${alert.id}`;
                    const isRead = readIds.has(alertId);
                    return (
                      <div
                        key={alertId}
                        className={cn(
                          "relative flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-xl text-left transition-all group",
                          isRead
                            ? "bg-slate-50/50 opacity-55"
                            : alert.severity === "expired"
                              ? "bg-red-50 hover:bg-red-100"
                              : alert.severity === "critical"
                                ? "bg-amber-50 hover:bg-amber-100"
                                : "hover:bg-slate-50",
                        )}
                      >
                        {/* Click area */}
                        <button
                          className="absolute inset-0 z-0 rounded-xl"
                          onClick={() => {
                            markRead(alertId);
                            onNavigateToCredits?.();
                            setOpen(false);
                          }}
                          aria-label={`View ${alert.patientName}`}
                        />

                        {/* Icon */}
                        <div
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10",
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
                            <CheckCircle size={16} weight="duotone" />
                          ) : (
                            <CreditCard size={16} weight="duotone" />
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
                            {alert.patientName}
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
                            {(alert.percentRemaining * 100).toFixed(0)}% credit
                            remaining
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 relative z-10 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissAlert(alertId);
                            }}
                            className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-xl transition-all",
                              "text-slate-300 hover:text-red-500 hover:bg-red-50",
                              "opacity-0 group-hover:opacity-100",
                            )}
                            title="Dismiss"
                          >
                            <Trash
                              size={14}
                              weight="bold"
                              className="w-3.5 h-3.5 min-w-[14px] min-h-[14px]"
                            />
                          </button>
                          <ArrowRight
                            size={12}
                            weight="bold"
                            className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all pointer-events-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SAL alerts section */}
            {salAlerts.length > 0 && (
              <div className="p-4 pt-2">
                {(driverAlerts.length > 0 || creditAlerts.length > 0) && (
                  <div className="h-px bg-slate-100 mb-3" />
                )}
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <ClipboardText size={12} weight="duotone" />
                  SAL Status
                </h4>
                <div className="space-y-1.5">
                  {salAlerts.slice(0, 6).map((alert) => {
                    const alertId = `sal-${alert.id}`;
                    const isRead = readIds.has(alertId);
                    return (
                      <div
                        key={alertId}
                        className={cn(
                          "relative flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-xl text-left transition-all group",
                          isRead
                            ? "bg-slate-50/50 opacity-55"
                            : alert.severity === "expired"
                              ? "bg-red-50 hover:bg-red-100"
                              : "bg-amber-50 hover:bg-amber-100",
                        )}
                      >
                        {/* Click area */}
                        <button
                          className="absolute inset-0 z-0 rounded-xl"
                          onClick={() => {
                            markRead(alertId);
                            onNavigateToPatient?.(alert.id);
                            setOpen(false);
                          }}
                          aria-label={`View ${alert.patientName}`}
                        />

                        {/* Icon */}
                        <div
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10",
                            isRead
                              ? "bg-slate-100 text-slate-400"
                              : alert.severity === "expired"
                                ? "bg-red-100 text-red-600"
                                : "bg-amber-100 text-amber-600",
                          )}
                        >
                          {isRead ? (
                            <CheckCircle size={16} weight="duotone" />
                          ) : (
                            <ClipboardText size={16} weight="duotone" />
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
                            {alert.patientName}
                          </p>
                          <p
                            className={cn(
                              "text-[11px] mt-0.5 truncate",
                              isRead
                                ? "text-slate-400"
                                : alert.severity === "expired"
                                  ? "text-red-600 font-semibold"
                                  : "text-amber-600 font-semibold",
                            )}
                          >
                            {alert.salStatus === "expired"
                              ? "SAL expired — needs recertification"
                              : `SAL pending${alert.salPendingReason ? ` — ${alert.salPendingReason}` : ""}`}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 relative z-10 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissAlert(alertId);
                            }}
                            className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-xl transition-all",
                              "text-slate-300 hover:text-red-500 hover:bg-red-50",
                              "opacity-0 group-hover:opacity-100",
                            )}
                            title="Dismiss"
                          >
                            <Trash
                              size={14}
                              weight="bold"
                              className="w-3.5 h-3.5 min-w-[14px] min-h-[14px]"
                            />
                          </button>
                          <ArrowRight
                            size={12}
                            weight="bold"
                            className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all pointer-events-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state after all dismissed */}
            {driverAlerts.length === 0 && creditAlerts.length === 0 && salAlerts.length === 0 && (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={24} weight="duotone" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  All clear!
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  No active notifications
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
