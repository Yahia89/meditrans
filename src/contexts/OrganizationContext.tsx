import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";
import type { MembershipRole } from "@/lib/supabase";
import { clearPrivateQueries, resolveOrganization, type OrganizationSummary } from "@/lib/identity-bootstrap";
import { markStartup } from "@/lib/startup-performance";

type Organization = OrganizationSummary;
const EMPTY_ORGANIZATIONS: Organization[] = [];

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  userRole: MembershipRole | null;
  loading: boolean;
  error: Error | null;
  setCurrentOrganization: (org: Organization | null) => void;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) throw new Error("useOrganization must be used within an OrganizationProvider");
  return context;
};

export const OrganizationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, bootstrap, loading, error, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<{ userId: string; orgId: string } | null>(null);
  const organizations = bootstrap?.organizations ?? EMPTY_ORGANIZATIONS;
  // Selection is derived from the same validated response as membership; there
  // is no render in which unknown membership looks like a resolved empty org.
  const currentOrganization = resolveOrganization(bootstrap, selected);
  const userRole = bootstrap?.memberships.find((membership) =>
    membership.user_id === user?.id && membership.org_id === currentOrganization?.id)?.role ?? null;

  const setCurrentOrganization = useCallback((organization: Organization | null) => {
    if (!user || !organization || !organizations.some((org) => org.id === organization.id)) return;
    if (organization.id === currentOrganization?.id) return;
    // Clear even legacy feature keys and cancel requests before changing tenant.
    clearPrivateQueries(queryClient, true);
    setSelected({ userId: user.id, orgId: organization.id });
  }, [user, organizations, currentOrganization?.id, queryClient]);

  useEffect(() => {
    if (!loading && !error && bootstrap) markStartup("organization-ready");
  }, [loading, error, bootstrap]);

  return <OrganizationContext.Provider value={{
    currentOrganization, organizations, userRole, loading, error,
    setCurrentOrganization, refreshOrganization: refresh,
  }}>{children}</OrganizationContext.Provider>;
};
