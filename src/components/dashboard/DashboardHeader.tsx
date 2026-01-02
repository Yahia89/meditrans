import { Plus } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/auth-context";
import { useQueryState } from "nuqs";
import { usePermissions } from "@/hooks/usePermissions";

export function DashboardHeader() {
  const { user, profile } = useAuth();
  const [, setModalType] = useQueryState("modal");
  const { isAdmin, isEmployee } = usePermissions();

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

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          {getGreeting()}, <span className="text-lime-600">{userName}.</span>
        </h1>
        <p className="text-sm font-medium text-slate-500">
          Welcome back to your operations command center.
        </p>
      </div>

      {canCreateTrip && (
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-[#3D5A3D] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#2E4A2E]"
          onClick={() => setModalType("create")}
        >
          <Plus size={18} weight="bold" />
          Create New Trip
        </button>
      )}
    </div>
  );
}
