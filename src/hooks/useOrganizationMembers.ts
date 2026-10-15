import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { isDirectoryAuthorizationError, shouldRetryDirectoryRead } from "@/lib/directory-state";
import {
  derivePresenceStatus,
  type OrganizationMember,
  type OrganizationPresenceRow,
} from "./organization-presence";
export type { OrganizationMember } from "./organization-presence";
const EMPTY_MEMBERS: OrganizationPresenceRow[] = [];

interface UseOrganizationMembersResult {
  members: OrganizationMember[];
  isLoading: boolean;
  isPending: boolean;
  isFetching: boolean;
  hasData: boolean;
  error: Error | null;
  refetch: () => void;
  onlineCount: number;
  awayCount: number;
  offlineCount: number;
}

/**
 * Lightweight organization presence, joined to employees by user_id in the page.
 * Avoid loading profiles, invitations, and a duplicate employee directory.
 * Includes:
 * - Realtime subscription for live presence updates via Postgres changes
 * - Client-side stale detection (marks users offline if last_active_at > 2 min)
 * - Periodic refetch every 30s for self-healing
 */
export function useOrganizationMembers(): UseOrganizationMembersResult {
  const { currentOrganization } = useOrganization();
  const { can } = usePermissions();
  // Match the existing directory read permission, including employee bookmarks.
  const canViewEmployees = can("view_employees");
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now);

  const {
    data,
    isLoading,
    isPending,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["organization-members", currentOrganization?.id],
    queryFn: async ({ signal }): Promise<OrganizationPresenceRow[]> => {
      if (!currentOrganization?.id) throw new Error("An organization is required for presence.");

      const { data, error } = await supabase
        .from("organization_memberships")
        .select("id, user_id, presence_status, last_active_at")
        .eq("org_id", currentOrganization.id)
        .abortSignal(signal);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id && canViewEmployees,
    retry: shouldRetryDirectoryRead,
    staleTime: 15 * 1000, // 15 seconds
    refetchInterval: 30 * 1000, // Refetch every 30s for self-healing
  });
  const hasData = canViewEmployees && !isDirectoryAuthorizationError(error) && data !== undefined;
  const rawMembers = hasData ? data : EMPTY_MEMBERS;

  // Expire stale sessions even when refetch returns identical rows or fails.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const members = useMemo(() => rawMembers.map((member) => ({
    ...member,
    presence_status: derivePresenceStatus(
      member.presence_status,
      member.last_active_at,
      now,
    ),
  })), [rawMembers, now]);

  // Set up realtime subscription for presence updates
  useEffect(() => {
    if (!currentOrganization?.id || !canViewEmployees) return;

    const channel = supabase
      .channel(`org-presence-${currentOrganization.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "organization_memberships",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        (payload) => {
          // Update the specific member's presence in the cache
          queryClient.setQueryData(
            ["organization-members", currentOrganization.id],
            (oldData: OrganizationPresenceRow[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.map((member) =>
                member.id === payload.new.id
                  ? {
                      ...member,
                      presence_status: payload.new.presence_status,
                      last_active_at: payload.new.last_active_at,
                    }
                  : member,
              );
            },
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id, canViewEmployees, queryClient]);

  // Compute presence counts
  const onlineCount = members.filter(
    (m) => m.presence_status === "online",
  ).length;
  const awayCount = members.filter((m) => m.presence_status === "away").length;
  const offlineCount = members.filter(
    (m) => m.presence_status === "offline",
  ).length;

  return {
    members,
    isLoading,
    isPending,
    isFetching,
    hasData,
    error: error as Error | null,
    refetch,
    onlineCount,
    awayCount,
    offlineCount,
  };
}
