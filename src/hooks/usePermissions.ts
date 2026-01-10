import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/auth-context";

export function usePermissions() {
  const { userRole } = useOrganization();
  const { profile, user } = useAuth();

  const can = (action: string): boolean => {
    // Super admins can do everything
    const isFOUNDER = user?.email === import.meta.env.VITE_FOUNDER_EMAIL;
    if (profile?.is_super_admin || isFOUNDER) return true;

    if (!userRole) return false;

    // Owners can do everything
    if (userRole === "owner") return true;

    // Admins can do almost everything
    if (userRole === "admin") {
      const restrictedActions = ["delete_owner", "change_organization_name"];
      return !restrictedActions.includes(action);
    }

    if (userRole === "driver") {
      const allowedActions = ["view_assigned_trips"];
      return allowedActions.includes(action);
    }

    if (userRole === "employee") {
      const allowedActions = [
        "view_dashboard",
        "view_patients",
        "view_drivers",
        "view_employees",
        "upload_files",
      ];
      return allowedActions.includes(action);
    }

    return false;
  };

  const isSuperAdmin = !!(
    profile?.is_super_admin ||
    user?.email === import.meta.env.VITE_FOUNDER_EMAIL
  );
  const isOwner = userRole === "owner" || isSuperAdmin;
  const isAdmin = userRole === "admin" || isOwner;
  const isEmployee = userRole === "employee" || isAdmin;
  const isDriver = userRole === "driver";

  return {
    can,
    userRole,
    isSuperAdmin,
    isOwner,
    isAdmin,
    isEmployee,
    isDriver,
  };
}
