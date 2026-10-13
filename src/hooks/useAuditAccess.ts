import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/OrganizationContext";
import { canManageOrganizationAudit } from "@/features/compliance/access";

export function useAuditAccess(requestedOrgId?: string | null) {
  const { user, memberships, loading: authLoading, error: authError } = useAuth();
  const { currentOrganization, loading: orgLoading, error: orgError } = useOrganization();
  const orgId = requestedOrgId === undefined ? currentOrganization?.id ?? null : requestedOrgId;
  const userId = user?.id ?? null;
  const loading = authLoading || orgLoading;
  return { orgId, userId, loading,
    canManageAudit: !loading && !authError && !orgError && canManageOrganizationAudit(orgId, userId, memberships) };
}
