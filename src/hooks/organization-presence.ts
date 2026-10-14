export type PresenceStatus = "online" | "away" | "offline";

export interface OrganizationPresenceRow {
  id: string;
  user_id: string;
  presence_status: string | null;
  last_active_at: string | null;
}

export interface OrganizationMember extends Omit<OrganizationPresenceRow, "presence_status"> {
  presence_status: PresenceStatus;
}

/** Heartbeats older than two minutes must not show a disconnected user online. */
export function derivePresenceStatus(
  dbStatus: string | null,
  lastActiveAt: string | null,
  now = Date.now(),
): PresenceStatus {
  if (dbStatus !== "online" && dbStatus !== "away") return "offline";
  if (!lastActiveAt) return dbStatus;
  const lastActive = Date.parse(lastActiveAt);
  return !Number.isFinite(lastActive) || now - lastActive > 2 * 60_000
    ? "offline"
    : dbStatus;
}
