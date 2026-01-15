import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type MembershipRole } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";

type PresenceStatus = "online" | "away" | "offline";

export interface OrganizationMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: MembershipRole;
  presence_status: PresenceStatus;
  last_active_at: string | null;
  is_primary: boolean;
  created_at: string;
  // Employee record data (if linked)
  employee_id: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
  hire_date: string | null;
}

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
 * Hook to fetch organization members with their real-time presence status
 * Includes realtime subscription for live presence updates
 */
export function useOrganizationMembers(): UseOrganizationMembersResult {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  const {
    data: members = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["organization-members", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      // Fetch memberships with user profiles
      const { data: memberships, error: membershipError } = await supabase
        .from("organization_memberships")
        .select(
          `
          id,
          user_id,
          role,
          is_primary,
          presence_status,
          last_active_at,
          created_at
        `
        )
        .eq("org_id", currentOrganization.id)
        .order("role", { ascending: true });

      if (membershipError) throw membershipError;

      if (!memberships || memberships.length === 0) return [];

      // Get user IDs to fetch profiles
      const userIds = memberships.map((m) => m.user_id);

      // Fetch user profiles
      const { data: profiles, error: profileError } = await supabase
        .from("user_profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);

      if (profileError) throw profileError;

      // Fetch user emails from auth.users via a function or join
      // Since we can't directly query auth.users, we'll get emails from org_invites as a fallback
      const { data: invites } = await supabase
        .from("org_invites")
        .select("email, role")
        .eq("org_id", currentOrganization.id)
        .not("accepted_at", "is", null);

      // Fetch employees for department/position info
      const { data: employees, error: employeeError } = await supabase
        .from("employees")
        .select(
          "id, email, full_name, department, role, phone, hire_date, user_id"
        )
        .eq("org_id", currentOrganization.id);

      if (employeeError) throw employeeError;

      // Create lookup maps
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      const employeeByUserIdMap = new Map(
        (employees || []).filter((e) => e.user_id).map((e) => [e.user_id, e])
      );
      const inviteByRoleMap = new Map(
        invites?.map((i) => [i.role, i.email]) || []
      );

      // Combine data
      const combinedMembers: OrganizationMember[] = memberships.map((m) => {
        const profile = profileMap.get(m.user_id);
        const employee = employeeByUserIdMap.get(m.user_id);

        // Try to get email from various sources
        let email = "";
        if (employee?.email) email = employee.email;
        else email = inviteByRoleMap.get(m.role) || "";

        return {
          id: m.id,
          user_id: m.user_id,
          email,
          full_name: profile?.full_name || employee?.full_name || null,
          role: m.role as MembershipRole,
          presence_status: (m.presence_status || "offline") as PresenceStatus,
          last_active_at: m.last_active_at,
          is_primary: m.is_primary,
          created_at: m.created_at,
          employee_id: employee?.id || null,
          department: employee?.department || null,
          position: employee?.role || null,
          phone: profile?.phone || employee?.phone || null,
          hire_date: employee?.hire_date || null,
        };
      });

      return combinedMembers;
    },
    enabled: !!currentOrganization?.id,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute for presence updates
  });

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
            (oldData: OrganizationMember[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.map((member) =>
                member.id === payload.new.id
                  ? {
                      ...member,
                      presence_status: payload.new.presence_status || "offline",
                      last_active_at: payload.new.last_active_at,
                    }
                  : member
              );
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id, queryClient]);

  // Compute presence counts
  const onlineCount = members.filter(
    (m) => m.presence_status === "online"
  ).length;
  const awayCount = members.filter((m) => m.presence_status === "away").length;
  const offlineCount = members.filter(
    (m) => m.presence_status === "offline"
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
