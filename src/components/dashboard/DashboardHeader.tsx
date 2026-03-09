import { Plus } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/auth-context";
import { useQueryState } from "nuqs";
import { usePermissions } from "@/hooks/usePermissions";
import { NotificationBell } from "./NotificationBell";

interface DashboardHeaderProps {
  onNavigateToDriver?: (driverId: string) => void;
  onNavigateToCredits?: () => void;
}

export function DashboardHeader({
  onNavigateToDriver,
  onNavigateToCredits,
}: DashboardHeaderProps) {
  const { user, profile } = useAuth();
  const [, setModalType] = useQueryState("modal");
  const { isAdmin, isEmployee, isDispatch } = usePermissions();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const userName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";

  // Check if user can create trips (Admin and Employee roles)
  const canCreateTrip = isAdmin || isEmployee;
  const showNotifications = isAdmin || isEmployee || isDispatch;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
          {getGreeting()}, <span className="text-lime-600">{userName}.</span>
        </h1>
        <p className="text-xs md:text-sm font-medium text-slate-500">
          Welcome back to your operations command center.
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {showNotifications && (
          <NotificationBell
            onNavigateToDriver={onNavigateToDriver}
            onNavigateToCredits={onNavigateToCredits}
          />
        )}
        {canCreateTrip && (
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 md:px-6 md:py-3 text-xs md:text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 flex-1 sm:flex-none"
              onClick={() => setModalType("discharge")}
            >
              <Plus size={16} weight="bold" className="shrink-0" />
              <span className="truncate">Discharge Trip</span>
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#3D5A3D] px-4 py-2.5 md:px-6 md:py-3 text-xs md:text-sm font-bold text-white shadow-sm transition-all hover:bg-[#2E4A2E] flex-1 sm:flex-none"
              onClick={() => setModalType("create")}
            >
              <Plus size={16} weight="bold" className="shrink-0" />
              <span className="truncate">New Trip</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
