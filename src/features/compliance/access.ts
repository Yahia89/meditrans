export function canManageOrganizationAudit(
  orgId: string | null | undefined,
  userId: string | null | undefined,
  memberships: readonly { org_id: string; user_id: string; role: string }[],
) {
  return Boolean(orgId && userId && memberships.some((membership) =>
    membership.org_id === orgId && membership.user_id === userId &&
    (membership.role === "owner" || membership.role === "admin"),
  ));
}
