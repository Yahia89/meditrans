"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/auth-context";

interface NotificationState {
  id: string;
  org_id: string;
  alert_id: string;
  status: "read" | "dismissed";
  acted_by: string | null;
  created_at: string;
}

const QUERY_KEY = "notification-states";

export function useNotificationStates() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  // Fetch all notification states for this org
  const { data: states = [], isLoading } = useQuery<NotificationState[]>({
    queryKey: [QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("notification_states")
        .select("*")
        .eq("org_id", orgId);
      if (error) throw error;
      return (data || []) as NotificationState[];
    },
    enabled: !!orgId,
    staleTime: 0, // always refetch when invalidated
    refetchInterval: 60_000,
  });

  // Derive sets for fast lookups
  const readIds = new Set(
    states.filter((s) => s.status === "read").map((s) => s.alert_id),
  );
  const dismissedIds = new Set(
    states.filter((s) => s.status === "dismissed").map((s) => s.alert_id),
  );

  // Mark an alert as read
  const markRead = useCallback(
    async (alertId: string) => {
      if (!orgId || !user?.id) return;

      // Optimistic update
      queryClient.setQueryData<NotificationState[]>(
        [QUERY_KEY, orgId],
        (old = []) => {
          if (old.some((s) => s.alert_id === alertId)) return old;
          return [
            ...old,
            {
              id: crypto.randomUUID(),
              org_id: orgId,
              alert_id: alertId,
              status: "read" as const,
              acted_by: user.id,
              created_at: new Date().toISOString(),
            },
          ];
        },
      );

      // Upsert to DB then refetch
      await supabase.from("notification_states").upsert(
        {
          org_id: orgId,
          alert_id: alertId,
          status: "read",
          acted_by: user.id,
        },
        { onConflict: "org_id,alert_id" },
      );
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, orgId] });
    },
    [orgId, user?.id, queryClient],
  );

  // Dismiss an alert
  const dismiss = useCallback(
    async (alertId: string) => {
      if (!orgId || !user?.id) return;

      // Optimistic update
      queryClient.setQueryData<NotificationState[]>(
        [QUERY_KEY, orgId],
        (old = []) => {
          const existing = old.find((s) => s.alert_id === alertId);
          if (existing) {
            return old.map((s) =>
              s.alert_id === alertId
                ? { ...s, status: "dismissed" as const }
                : s,
            );
          }
          return [
            ...old,
            {
              id: crypto.randomUUID(),
              org_id: orgId,
              alert_id: alertId,
              status: "dismissed" as const,
              acted_by: user.id,
              created_at: new Date().toISOString(),
            },
          ];
        },
      );

      // Upsert to DB then refetch
      await supabase.from("notification_states").upsert(
        {
          org_id: orgId,
          alert_id: alertId,
          status: "dismissed",
          acted_by: user.id,
        },
        { onConflict: "org_id,alert_id" },
      );
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, orgId] });
    },
    [orgId, user?.id, queryClient],
  );

  // Bulk dismiss all read alerts
  const clearAllRead = useCallback(
    async (alertIds: string[]) => {
      if (!orgId || !user?.id || alertIds.length === 0) return;

      // Optimistic update — mark all as dismissed
      queryClient.setQueryData<NotificationState[]>(
        [QUERY_KEY, orgId],
        (old = []) => {
          const idsSet = new Set(alertIds);
          const updated = old.map((s) =>
            idsSet.has(s.alert_id) ? { ...s, status: "dismissed" as const } : s,
          );
          // Add any new ones not yet in the list
          const existingIds = new Set(old.map((s) => s.alert_id));
          const newEntries = alertIds
            .filter((id) => !existingIds.has(id))
            .map((alertId) => ({
              id: crypto.randomUUID(),
              org_id: orgId,
              alert_id: alertId,
              status: "dismissed" as const,
              acted_by: user.id,
              created_at: new Date().toISOString(),
            }));
          return [...updated, ...newEntries];
        },
      );

      // Batch upsert
      const rows = alertIds.map((alertId) => ({
        org_id: orgId,
        alert_id: alertId,
        status: "dismissed",
        acted_by: user.id,
      }));
      await supabase
        .from("notification_states")
        .upsert(rows, { onConflict: "org_id,alert_id" });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, orgId] });
    },
    [orgId, user?.id, queryClient],
  );

  return {
    readIds,
    dismissedIds,
    markRead,
    dismiss,
    clearAllRead,
    isLoading,
  };
}
