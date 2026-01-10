import { useOnboarding } from "@/contexts/OnboardingContext";
import { DemoModeBanner } from "./demo-mode-banner";
import { SetupChecklist } from "./setup-checklist";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { PerformanceChart } from "./dashboard/PerformanceChart";
import { UpcomingSchedule } from "./dashboard/UpcomingSchedule";
import { RecentActivity } from "./dashboard/RecentActivity";
import { QuickActions } from "./dashboard/QuickActions";
import { LowBalanceAlerts } from "./credits/LowBalanceAlerts";
import { usePermissions } from "@/hooks/usePermissions";

import { useEffect } from "react";
import { useQueryState } from "nuqs";

interface DashboardProps {
  onNavigateToCredits?: () => void;
}

export function Dashboard({ onNavigateToCredits }: DashboardProps) {
  const { dataState, isDemoMode } = useOnboarding();
  const { isAdmin, isEmployee } = usePermissions();
  const [section] = useQueryState("section");

  useEffect(() => {
    if (section) {
      // Small delay to ensure children are rendered
      const timer = setTimeout(() => {
        const el = document.getElementById(`dashboard-${section}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Highlight effect? Maybe later.
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [section]);

  const isInitialState =
    (dataState === "empty" || dataState === "onboarding") && !isDemoMode;

  const showAdminSections = isAdmin || isEmployee;

  return (
    <div className="space-y-10 pb-10 max-w-[1600px] mx-auto">
      {/* 1. Header & Greeting */}
      <DashboardHeader />

      {/* 2. Important Banners */}
      {isInitialState && (
        <div className="space-y-8">
          <DemoModeBanner />
          <SetupChecklist />
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
              Onboarding Progress
            </h2>
            <QuickActions />
          </div>
        </div>
      )}

      {/* 3. Operational Overview */}
      <div className="space-y-10">
        {/* Stats row - Only for admins/employees */}
        {showAdminSections}

        {/* Analytics row - Only for admins/employees */}
        {showAdminSections && (
          <div
            id="dashboard-activity"
            className="grid grid-cols-1 lg:grid-cols-5 gap-8"
          >
            <PerformanceChart />
            <RecentActivity />
          </div>
        )}

        {/* Schedule & Alerts row */}
        <div
          id="dashboard-schedule"
          className="grid grid-cols-1 lg:grid-cols-5 gap-8"
        >
          <div
            className={showAdminSections ? "lg:col-span-3" : "lg:col-span-5"}
          >
            <UpcomingSchedule />
          </div>

          {/* Alerts / System Health - Only for admins/employees */}
          {showAdminSections && (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm h-full">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      System Alerts
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5 uppercase tracking-wider">
                      Operational Health
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-wider border border-red-100">
                    Active Alerts
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Low Balance Alerts - Dynamic - Only for Owners/Admins */}
                  {isAdmin && (
                    <LowBalanceAlerts onNavigate={onNavigateToCredits} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
