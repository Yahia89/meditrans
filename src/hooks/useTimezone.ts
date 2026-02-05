import { useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getActiveTimezone } from "@/lib/timezone";

export function useTimezone() {
  const { profile } = useAuth();
  const { currentOrganization } = useOrganization();

  const timezone = useMemo(
    () => getActiveTimezone(profile, currentOrganization),
    [profile, currentOrganization],
  );

  return timezone;
}
