import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

type AccessTargetType = "employee" | "driver" | "patient";
type MembershipRole = "owner" | "admin" | "dispatch" | "employee" | "driver" | "patient";

interface ToggleAccessRequest {
  target_type: AccessTargetType;
  record_id: string;
}

interface TargetRecord {
  id: string;
  org_id: string;
  full_name: string;
  email: string | null;
  user_id: string | null;
  disabled?: boolean | null;
  active?: boolean | null;
}

interface OrganizationRow {
  id: string;
  name: string;
}

const FUTURE_TRANSPORTATION_ORG = "future transportation llc";
const FUTURE_TRANSPORTATION_ALLOWED_EMAIL = "yahiaalhejoj@yahoo.com";
const AUTH_BAN_DURATION = "876000h";

const targetConfig = {
  employee: {
    table: "employees",
    select: "id, org_id, full_name, email, user_id, disabled",
  },
  driver: {
    table: "drivers",
    select: "id, org_id, full_name, email, user_id, active",
  },
  patient: {
    table: "patients",
    select: "id, org_id, full_name, email, user_id, disabled",
  },
} as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function adminClient() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return atob(padded);
}

function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new HttpError(401, "Missing authorization header.");

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const [, payloadSegment] = token.split(".");
  if (!payloadSegment) throw new HttpError(401, "Invalid session.");

  const payload = JSON.parse(decodeBase64Url(payloadSegment)) as {
    sub?: string;
    email?: string;
  };

  if (!payload.sub) throw new HttpError(401, "Invalid session.");
  return { id: payload.sub, email: payload.email };
}

function normalizeOrgName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function isFutureTransportation(org: OrganizationRow) {
  return normalizeOrgName(org.name) === FUTURE_TRANSPORTATION_ORG;
}

function isAuthorizedForOrg(
  org: OrganizationRow,
  role: MembershipRole | null,
  userEmail: string | undefined,
) {
  const normalizedEmail = userEmail?.trim().toLowerCase();

  if (isFutureTransportation(org)) {
    return role === "owner" || normalizedEmail === FUTURE_TRANSPORTATION_ALLOWED_EMAIL;
  }

  return role === "owner" || role === "admin";
}

function getTableName(targetType: AccessTargetType) {
  return targetConfig[targetType].table;
}

function isRecordDisabled(targetType: AccessTargetType, record: TargetRecord) {
  if (targetType === "driver") return record.active === false;
  return record.disabled === true;
}

async function loadTarget(
  admin: SupabaseClient,
  targetType: AccessTargetType,
  recordId: string,
) {
  const config = targetConfig[targetType];
  const { data, error } = await admin
    .from(config.table)
    .select(config.select)
    .eq("id", recordId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new HttpError(404, "Record not found.");
  return data as TargetRecord;
}

async function loadOrganization(admin: SupabaseClient, orgId: string) {
  const { data, error } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new HttpError(404, "Organization not found.");
  return data as OrganizationRow;
}

async function loadMembershipRole(admin: SupabaseClient, orgId: string, userId: string) {
  const { data, error } = await admin
    .from("organization_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.role || null) as MembershipRole | null;
}

async function findLinkedUserId(admin: SupabaseClient, record: TargetRecord) {
  if (record.user_id) return record.user_id;
  if (!record.email) return null;

  const { data, error } = await admin
    .from("organization_memberships")
    .select("user_id")
    .eq("org_id", record.org_id)
    .ilike("email", record.email)
    .maybeSingle();

  if (error) throw error;
  return (data?.user_id as string | undefined) || null;
}

async function updateAuthAccess(admin: SupabaseClient, userId: string | null, disabled: boolean) {
  if (!userId) return;

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: disabled ? AUTH_BAN_DURATION : "0",
  });

  if (error) throw error;
}

async function toggleUserAccess(
  admin: SupabaseClient,
  userId: string,
  userEmail: string | undefined,
  request: ToggleAccessRequest,
) {
  const target = await loadTarget(admin, request.target_type, request.record_id);
  const [org, role] = await Promise.all([
    loadOrganization(admin, target.org_id),
    loadMembershipRole(admin, target.org_id, userId),
  ]);

  if (!role) throw new HttpError(403, "You are not a member of this organization.");
  if (!isAuthorizedForOrg(org, role, userEmail)) {
    throw new HttpError(403, "You do not have permission to change account access.");
  }

  const nextDisabled = !isRecordDisabled(request.target_type, target);
  const linkedUserId = await findLinkedUserId(admin, target);
  await updateAuthAccess(admin, linkedUserId, nextDisabled);

  const now = new Date().toISOString();
  const table = getTableName(request.target_type);
  const updates =
    request.target_type === "driver"
      ? {
          active: !nextDisabled,
          disabled_at: nextDisabled ? now : null,
          disabled_by: nextDisabled ? userId : null,
          disabled_reason: null,
        }
      : {
          disabled: nextDisabled,
          disabled_at: nextDisabled ? now : null,
          disabled_by: nextDisabled ? userId : null,
          disabled_reason: null,
        };

  const { data, error } = await admin
    .from(table)
    .update(updates)
    .eq("id", target.id)
    .select("*")
    .single();

  if (error) throw error;

  return {
    record: data,
    target_type: request.target_type,
    disabled: nextDisabled,
    auth_user_updated: Boolean(linkedUserId),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const request = (await req.json()) as ToggleAccessRequest;
    if (!request.target_type || !request.record_id || !(request.target_type in targetConfig)) {
      throw new HttpError(400, "Invalid access toggle request.");
    }

    const user = await requireUser(req);
    const admin = adminClient();
    return jsonResponse(await toggleUserAccess(admin, user.id, user.email, request));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return jsonResponse({ error: message }, status);
  }
});
