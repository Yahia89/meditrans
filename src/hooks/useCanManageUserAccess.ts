import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/OrganizationContext";
import { canManageUserAccess } from "@/lib/user-access-policy";

export function useCanManageUserAccess() {
  const { user } = useAuth();
  const { currentOrganization, userRole } = useOrganization();

  return canManageUserAccess({
    organizationName: currentOrganization?.name,
    userRole,
    userEmail: user?.email,
  });
}
