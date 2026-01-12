import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useAuth } from "./auth-context";
import { supabase, type MembershipRole } from "@/lib/supabase";

// Types
interface Organization {
  id: string;
  name: string;
  created_at: string;
  npi?: string;
  tax_id?: string;
  billing_state?: string;
  billing_enabled?: boolean;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  userRole: MembershipRole | null;
  loading: boolean;
  setCurrentOrganization: (org: Organization | null) => void;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider"
    );
  }
  return context;
};

interface OrganizationProviderProps {
  children: React.ReactNode;
}

export const OrganizationProvider = ({
  children,
}: OrganizationProviderProps) => {
  const { user, memberships, profile } = useAuth();
  const [currentOrganization, setCurrentOrganization] =
    useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch organizations based on user's memberships
  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!user || memberships.length === 0) {
        setOrganizations([]);
        setCurrentOrganization(null);
        setLoading(false);
        return;
      }

      try {
        // Get all organization IDs from memberships
        const orgIds = memberships.map((m) => m.org_id);

        // Fetch organization details
        const { data, error } = await supabase
          .from("organizations")
          .select("*")
          .in("id", orgIds);

        if (error) throw error;

        setOrganizations(data || []);

        // Set current organization based on user's default or first membership
        if (data && data.length > 0) {
          // Try to use the default org from profile
          if (profile?.default_org_id) {
            const defaultOrg = data.find(
              (org) => org.id === profile.default_org_id
            );
            if (defaultOrg) {
              setCurrentOrganization(defaultOrg);
              setLoading(false);
              return;
            }
          }

          // Otherwise, use the primary membership's organization
          const primaryMembership = memberships.find((m) => m.is_primary);
          if (primaryMembership) {
            const primaryOrg = data.find(
              (org) => org.id === primaryMembership.org_id
            );
            if (primaryOrg) {
              setCurrentOrganization(primaryOrg);
              setLoading(false);
              return;
            }
          }

          // Fallback to first organization
          setCurrentOrganization(data[0]);
        }
      } catch (error) {
        console.error("Error fetching organizations:", error);
        setOrganizations([]);
        setCurrentOrganization(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, [user, memberships, profile]);

  const refreshOrganization = async () => {
    if (!currentOrganization?.id) return;

    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", currentOrganization.id)
        .single();

      if (error) throw error;
      if (data) {
        setCurrentOrganization(data);
        setOrganizations((prev) =>
          prev.map((org) => (org.id === data.id ? data : org))
        );
      }
    } catch (error) {
      console.error("Error refreshing organization:", error);
    }
  };

  const userRole = useMemo(() => {
    if (!currentOrganization || memberships.length === 0) return null;
    const membership = memberships.find(
      (m) => m.org_id === currentOrganization.id
    );
    return membership?.role || null;
  }, [currentOrganization, memberships]);

  const value = {
    currentOrganization,
    organizations,
    userRole,
    loading,
    setCurrentOrganization,
    refreshOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};
