import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type { Database } from "@/types/supabase";

type Rows = Database["public"]["Tables"];
export type UserProfile = Pick<Rows["user_profiles"]["Row"],
  "user_id" | "full_name" | "phone" | "default_org_id" | "is_super_admin" | "timezone" | "created_at">;
export type OrganizationSummary = Pick<Rows["organizations"]["Row"],
  "id" | "name" | "created_at" | "timezone" | "npi" | "tax_id" | "billing_state" |
  "billing_enabled" | "brokers_enabled" | "sftp_enabled" | "mn_its_submitter_id">;
export type OrganizationMembership = Pick<Rows["organization_memberships"]["Row"],
  "id" | "org_id" | "user_id" | "role" | "is_primary" | "created_at">;
export type DriverIdentity = Pick<Rows["drivers"]["Row"],
  "id" | "org_id" | "user_id" | "full_name" | "phone" | "active" | "disabled_at">;

// Parsing rejects partial/malformed authorization responses before the shell can
// treat them as known access. Schemas are checked against generated row subsets.
const profileSchema: z.ZodType<UserProfile> = z.object({
  user_id: z.string(), full_name: z.string().nullable(), phone: z.string().nullable(),
  default_org_id: z.string().nullable(), is_super_admin: z.boolean().nullable(),
  timezone: z.string().nullable(), created_at: z.string(),
});
const organizationSchema: z.ZodType<OrganizationSummary> = z.object({
  id: z.string(), name: z.string(), created_at: z.string(), timezone: z.string().nullable(),
  npi: z.string().nullable(), tax_id: z.string().nullable(), billing_state: z.string().nullable(),
  billing_enabled: z.boolean().nullable(), brokers_enabled: z.boolean().nullable(),
  sftp_enabled: z.boolean().nullable(), mn_its_submitter_id: z.string().nullable(),
});
const membershipSchema: z.ZodType<OrganizationMembership & { organization: OrganizationSummary | null }> = z.object({
  id: z.string(), org_id: z.string(), user_id: z.string(),
  role: z.enum(["owner", "admin", "dispatch", "employee", "driver", "patient"]),
  is_primary: z.boolean(), created_at: z.string(), organization: organizationSchema.nullable(),
});
const driverSchema: z.ZodType<DriverIdentity> = z.object({
  id: z.string(), org_id: z.string(), user_id: z.string().nullable(),
  full_name: z.string(), phone: z.string().nullable(), active: z.boolean(), disabled_at: z.string().nullable(),
});

export interface IdentityBootstrap {
  userId: string;
  profile: UserProfile | null;
  memberships: OrganizationMembership[];
  organizations: OrganizationSummary[];
  drivers: DriverIdentity[];
}

export const IDENTITY_QUERY_ROOT = "identity-bootstrap";
// Billing identifiers support existing exports, but integration credentials never
// belong in the shared shell response. Settings fetch those on their own route.
export const ORGANIZATION_SUMMARY_FIELDS = "id,name,created_at,timezone,npi,tax_id,billing_state,billing_enabled,brokers_enabled,sftp_enabled,mn_its_submitter_id";
export const PROFILE_FIELDS = "user_id,full_name,phone,default_org_id,is_super_admin,timezone,created_at";
export const DRIVER_IDENTITY_FIELDS = "id,org_id,user_id,full_name,phone,active,disabled_at";
const MEMBERSHIP_FIELDS = "id,org_id,user_id,role,is_primary,created_at";

export function identityQueryKey(userId: string | null) {
  return [IDENTITY_QUERY_ROOT, userId] as const;
}

function accessSignature(identity: IdentityBootstrap) {
  return JSON.stringify([
    identity.profile?.default_org_id,
    identity.profile?.is_super_admin,
    identity.memberships.map(({ user_id, org_id, role, is_primary }) =>
      [user_id, org_id, role, is_primary]).sort((left, right) => String(left[1]).localeCompare(String(right[1]))),
  ]);
}

/** Apply access changes before Query publishes the next identity to consumers. */
export function reconcileIdentityAccess(queryClient: QueryClient, next: IdentityBootstrap) {
  const previous = queryClient.getQueryData<IdentityBootstrap>(identityQueryKey(next.userId));
  if (previous && accessSignature(previous) !== accessSignature(next)) clearPrivateQueries(queryClient, true);
  return next;
}

export async function fetchIdentityBootstrap(
  client: SupabaseClient,
  userId: string,
  signal: AbortSignal,
): Promise<IdentityBootstrap> {
  const [profileResult, driverResult, membershipResult] = await Promise.all([
    client.from("user_profiles").select(PROFILE_FIELDS).eq("user_id", userId).abortSignal(signal).maybeSingle(),
    client.from("drivers").select(DRIVER_IDENTITY_FIELDS).eq("user_id", userId).abortSignal(signal),
    client.from("organization_memberships")
      .select(`${MEMBERSHIP_FIELDS},organization:organizations!organization_memberships_org_id_fkey(${ORGANIZATION_SUMMARY_FIELDS})`)
      .eq("user_id", userId).order("is_primary", { ascending: false }).abortSignal(signal),
  ]);
  for (const result of [profileResult, driverResult, membershipResult]) {
    if (result.error) throw result.error;
  }
  // Never publish a partial membership response as authorization success.
  if (signal.aborted) throw new DOMException("Bootstrap cancelled", "AbortError");
  const rows = z.array(membershipSchema).parse(membershipResult.data ?? []);
  const memberships = rows.filter((row) => row.user_id === userId).map((row) => ({
    id: row.id, org_id: row.org_id, user_id: row.user_id, role: row.role,
    is_primary: row.is_primary, created_at: row.created_at,
  }));
  const organizations = rows.flatMap((row) => row.user_id === userId && row.organization?.id === row.org_id
    ? [row.organization] : []);
  const drivers = z.array(driverSchema).parse(driverResult.data ?? []).filter((driver) => driver.user_id === userId);
  const rawProfile = profileSchema.nullable().parse(profileResult.data);
  let profile = rawProfile?.user_id === userId ? rawProfile : null;
  const fallbackDriver = drivers.find((driver) => driver.org_id === profile?.default_org_id) ?? drivers[0];
  if (fallbackDriver) {
    profile = profile ? {
      ...profile,
      full_name: profile.full_name || fallbackDriver.full_name,
      phone: profile.phone || fallbackDriver.phone,
    } : {
      user_id: userId, full_name: fallbackDriver.full_name, phone: fallbackDriver.phone,
      default_org_id: null, is_super_admin: false, timezone: null, created_at: "",
    };
  }
  return { userId, profile, memberships, organizations, drivers };
}

export function resolveOrganization(
  bootstrap: IdentityBootstrap | undefined,
  selected: { userId: string; orgId: string } | null,
): OrganizationSummary | null {
  if (!bootstrap) return null;
  const available = bootstrap.organizations.filter((org) => bootstrap.memberships.some((membership) =>
    membership.user_id === bootstrap.userId && membership.org_id === org.id));
  const preferredIds = [
    selected?.userId === bootstrap.userId ? selected.orgId : null,
    bootstrap.profile?.default_org_id,
    bootstrap.memberships.find((membership) => membership.is_primary)?.org_id,
  ];
  for (const id of preferredIds) {
    const organization = available.find((org) => org.id === id);
    if (organization) return organization;
  }
  return available[0] ?? null;
}

/** Old unscoped feature keys also need clearing until all features include user IDs. */
export function clearPrivateQueries(queryClient: QueryClient, preserveIdentity = false) {
  const filters = { predicate: (query: { queryKey: readonly unknown[] }) =>
    !preserveIdentity || query.queryKey[0] !== IDENTITY_QUERY_ROOT };
  void queryClient.cancelQueries(filters);
  queryClient.removeQueries(filters);
  if (!preserveIdentity) queryClient.getMutationCache().clear();
}
