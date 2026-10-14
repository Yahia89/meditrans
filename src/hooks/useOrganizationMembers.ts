import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  derivePresenceStatus,
  type OrganizationMember,
  type OrganizationPresenceRow,
} from "./organization-presence";
export type { OrganizationMember } from "./organization-presence";

interface UseOrganizationMembersResult {
  members: OrganizationMember[];
  isLoading: boolean;
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
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now);

  const {
    data: rawMembers = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["organization-members", currentOrganization?.id],
    queryFn: async ({ signal }): Promise<OrganizationPresenceRow[]> => {
      if (!currentOrganization?.id) return [];

      const { data, error } = await supabase
        .from("organization_memberships")
        .select("id, user_id, presence_status, last_active_at")
        .eq("org_id", currentOrganization.id)
        .abortSignal(signal);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
    staleTime: 15 * 1000, // 15 seconds
    refetchInterval: 30 * 1000, // Refetch every 30s for self-healing
  });

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
    if (!currentOrganization?.id) return;

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
  }, [currentOrganization?.id, queryClient]);

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
    error: error as Error | null,
    refetch,
    onlineCount,
    awayCount,
    offlineCount,
  };
}
