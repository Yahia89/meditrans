import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/OrganizationContext";
import { canManageOrganizationAudit } from "@/features/compliance/access";

export function useAuditAccess(requestedOrgId?: string | null) {
  const { user, memberships, loading: authLoading } = useAuth();
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const orgId = requestedOrgId === undefined ? currentOrganization?.id ?? null : requestedOrgId;
  const userId = user?.id ?? null;
  const loading = authLoading || orgLoading;
  return { orgId, userId, loading,
    canManageAudit: !loading && canManageOrganizationAudit(orgId, userId, memberships) };
}
