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

    // Admins can do almost everything except delete owner and change org name
    if (userRole === "admin") {
      const restrictedActions = ["delete_owner", "change_organization_name"];
      return !restrictedActions.includes(action);
    }

    // Dispatch: can view drivers, patients, create/manage trips, but not manage employees or billing
    if (userRole === "dispatch") {
      const allowedActions = [
        "view_dashboard",
        "view_patients",
        "view_drivers",
        "view_trips",
        "create_trips",
        "assign_trips",
        "edit_trips",
        "upload_files",
      ];
      return allowedActions.includes(action);
    }

    // Employees: limited view access
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

    // Drivers: most limited access
    if (userRole === "driver") {
      const allowedActions = ["view_assigned_trips", "update_trip_status"];
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
  const isDispatch = userRole === "dispatch" || isAdmin;
  const isEmployee = userRole === "employee" || isDispatch;
  const isDriver = userRole === "driver";

  // Can manage users (invite, edit roles, etc.)
  const canManageUsers = isAdmin;
  // Can manage trips (create, assign, edit)
  const canManageTrips = isDispatch;
  // Can view employees list
  const canViewEmployees = isAdmin;

  return {
    can,
    userRole,
    isSuperAdmin,
    isOwner,
    isAdmin,
    isDispatch,
    isEmployee,
    isDriver,
    canManageUsers,
    canManageTrips,
    canViewEmployees,
  };
}
