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

    // Dispatch: Dashboard + Trips (full), Patients/Drivers (view only), NO employees/uploads/billing/medicaid
    if (userRole === "dispatch") {
      const allowedActions = [
        "view_dashboard",
        "view_patients",
        "view_drivers",
        "view_trips",
        "create_trips",
        "assign_trips",
        "edit_trips",
        "delete_trips",
        "complete_trips",
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
  const isDispatchOnly = userRole === "dispatch";
  const isDispatch = isDispatchOnly || isAdmin;
  const isEmployee = userRole === "employee" || isDispatch;
  const isDriver = userRole === "driver";

  // Granular permission flags
  const canManageUsers = isAdmin; // Add/edit/invite employees
  const canManageTrips = isDispatch; // Create, assign, edit trips
  const canViewEmployees = isAdmin; // Only admin+ can see employees page
  const canUploadFiles = isAdmin; // Only admin+ can use upload feature
  const canViewBilling = isAdmin; // Only admin+ can see billing
  const canViewMedicaid = isAdmin; // Only admin+ can see medicaid
  const canViewNotifications = isAdmin; // Only admin+ can see notifications
  const canEditPatients = isAdmin; // Dispatch can only view patients
  const canEditDrivers = isAdmin; // Dispatch can only view drivers
  const canEditOwnName = isAdmin; // Dispatch cannot change their own name

  return {
    can,
    userRole,
    isSuperAdmin,
    isOwner,
    isAdmin,
    isDispatch,
    isDispatchOnly,
    isEmployee,
    isDriver,
    canManageUsers,
    canManageTrips,
    canViewEmployees,
    canUploadFiles,
    canViewBilling,
    canViewMedicaid,
    canViewNotifications,
    canEditPatients,
    canEditDrivers,
    canEditOwnName,
  };
}
