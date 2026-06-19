import type { MembershipRole } from "@/lib/supabase";

const FUTURE_TRANSPORTATION_ORG = "future transportation llc";
const FUTURE_TRANSPORTATION_ALLOWED_EMAIL = "yahiaalhejoj@yahoo.com";

function normalizeOrgName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function canManageUserAccess({
  organizationName,
  userRole,
  userEmail,
}: {
  organizationName: string | null | undefined;
  userRole: MembershipRole | null;
  userEmail: string | null | undefined;
}) {
  const normalizedEmail = userEmail?.trim().toLowerCase();
  const normalizedOrgName = organizationName
    ? normalizeOrgName(organizationName)
    : "";

  if (normalizedOrgName === FUTURE_TRANSPORTATION_ORG) {
    return userRole === "owner" || normalizedEmail === FUTURE_TRANSPORTATION_ALLOWED_EMAIL;
  }

  return userRole === "owner" || userRole === "admin";
}

export function getAccessStateLabel(disabled: boolean) {
  return disabled ? "Disabled" : "Access Active";
}
