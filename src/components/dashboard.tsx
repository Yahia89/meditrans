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
import { Warning, GasPump, Trophy } from "@phosphor-icons/react";

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
                    3 Active
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Low Balance Alerts - Dynamic */}
                  <LowBalanceAlerts onNavigate={onNavigateToCredits} />

                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:border-slate-200 cursor-pointer group">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                      <Warning size={20} weight="fill" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-sm">
                        License Expiration
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        2 drivers have licenses expiring within 30 days.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:border-slate-200 cursor-pointer group">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <GasPump size={20} weight="fill" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-sm">
                        Vehicle Maintenance
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Vehicle #TR-2490 is due for routine service.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:border-slate-200 cursor-pointer group">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <Trophy size={20} weight="fill" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-sm">
                        Monthly Target
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        On-time arrival reached 98.4% this month.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
