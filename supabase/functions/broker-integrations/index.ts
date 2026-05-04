import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

type JsonObject = Record<string, unknown>;
type BrokerType = "mtm_link";
type BrokerEnvironment = "sandbox" | "production";
type ConnectionStatus = "not_connected" | "testing" | "connected" | "failed" | "syncing";
type SyncRunStatus = "running" | "succeeded" | "partial" | "failed";
type ImportOperation = "imported" | "updated" | "skipped" | "failed";

interface BrokerConnectionConfig {
  scope?: string;
  provider_org_id?: string;
  api_base_url?: string;
  credential_hint?: string;
}

interface BrokerCredentials {
  client_id: string;
  client_secret: string;
  webhook_secret?: string;
}

interface BrokerConnectionInput {
  broker_type: BrokerType;
  name: string;
  environment: BrokerEnvironment;
  scope?: string;
  provider_org_id?: string;
  api_base_url?: string;
  sync_window_days_back: number;
  sync_window_days_ahead: number;
  auto_sync_enabled: boolean;
  webhook_enabled: boolean;
}

type BrokerActionRequest =
  | {
      action: "saveConnection";
      org_id: string;
      connection_id?: string;
      connection: BrokerConnectionInput;
      credentials?: Partial<BrokerCredentials>;
    }
  | {
      action: "testConnection";
      org_id: string;
      connection_id?: string;
      connection?: BrokerConnectionInput;
      credentials?: Partial<BrokerCredentials>;
    }
  | {
      action: "syncNow";
      org_id: string;
      connection_id: string;
    }
  | {
      action: "deleteConnection";
      org_id: string;
      connection_id: string;
    }
  | {
      action: "ingestWebhook";
      connection_id: string;
      event_type?: string;
      idempotency_key?: string;
      payload?: JsonObject;
    };

interface BrokerConnectionRow {
  id: string;
  org_id: string;
  broker_type: BrokerType;
  name: string;
  environment: BrokerEnvironment;
  status: ConnectionStatus;
  public_config: BrokerConnectionConfig;
  sync_window_days_back: number;
  sync_window_days_ahead: number;
  auto_sync_enabled: boolean;
  webhook_enabled: boolean;
  last_error: string | null;
}

interface NormalizedBrokerTrip {
  brokerTripId: string;
  referenceNumber?: string;
  memberName: string;
  memberPhone?: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupTime: string;
  appointmentTime?: string;
  tripType: string;
  mobilityRequirement?: string;
  notes?: string;
  externalStatus?: string;
  rawPayload: JsonObject;
}

interface BrokerAdapter {
  type: BrokerType;
  displayName: string;
  testConnection(
    credentials: BrokerCredentials,
    config: BrokerConnectionConfig,
  ): Promise<{ ok: boolean; message: string }>;
  fetchTrips(args: {
    credentials: BrokerCredentials;
    config: BrokerConnectionConfig;
    windowStart: string;
    windowEnd: string;
  }): Promise<JsonObject[]>;
  normalizeTrip(payload: JsonObject): NormalizedBrokerTrip;
  ingestWebhook?(payload: JsonObject): JsonObject;
  pushStatusUpdate?(
    trip: NormalizedBrokerTrip,
    status: string,
  ): Promise<{ ok: boolean; message: string }>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-broker-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const encoder = new TextEncoder();

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

function asObject(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function pickString(source: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function mask(value: string) {
  const clean = value.trim();
  if (clean.length <= 4) return "saved";
  return `ending ${clean.slice(-4)}`;
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function credentialKey() {
  const secret = requireEnv("BROKER_CREDENTIALS_KEY");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptCredentials(credentials: BrokerCredentials) {
  const key = await credentialKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(credentials));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return JSON.stringify({
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  });
}

async function decryptCredentials(encrypted: string): Promise<BrokerCredentials> {
  const envelope = asObject(JSON.parse(encrypted));
  const iv = base64ToBytes(asString(envelope.iv));
  const ciphertext = base64ToBytes(asString(envelope.ciphertext));
  const key = await credentialKey();
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  const decoded = new TextDecoder().decode(plaintext);
  const parsed = asObject(JSON.parse(decoded));
  const credentials = {
    client_id: asString(parsed.client_id),
    client_secret: asString(parsed.client_secret),
    webhook_secret: asString(parsed.webhook_secret) || undefined,
  };
  validateCredentials(credentials);
  return credentials;
}

function validateCredentials(credentials: Partial<BrokerCredentials>): BrokerCredentials {
  const normalized = {
    client_id: asString(credentials.client_id),
    client_secret: asString(credentials.client_secret),
    webhook_secret: asString(credentials.webhook_secret) || undefined,
  };

  if (!normalized.client_id || !normalized.client_secret) {
    throw new HttpError(400, "Client ID and client secret are required.");
  }

  return normalized;
}

function publicConfigFromInput(
  connection: BrokerConnectionInput,
  credentialHint?: string,
): BrokerConnectionConfig {
  return {
    scope: connection.scope?.trim() || undefined,
    provider_org_id: connection.provider_org_id?.trim() || undefined,
    api_base_url: connection.api_base_url?.trim() || undefined,
    credential_hint: credentialHint,
  };
}

function toBrokerConfig(value: unknown): BrokerConnectionConfig {
  const object = asObject(value);
  return {
    scope: asString(object.scope) || undefined,
    provider_org_id: asString(object.provider_org_id) || undefined,
    api_base_url: asString(object.api_base_url) || undefined,
    credential_hint: asString(object.credential_hint) || undefined,
  };
}

async function getOAuthToken(
  credentials: BrokerCredentials,
  config: BrokerConnectionConfig,
) {
  if (!config.api_base_url) {
    throw new HttpError(400, "MTM Link API base URL is required for live testing and sync.");
  }

  const tokenUrl = `${trimSlash(config.api_base_url)}/oauth/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
  });

  if (config.scope) body.set("scope", config.scope);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      pickString(asObject(responseBody), ["error_description", "message", "error"]) ||
      `Broker token request failed with ${response.status}.`;
    throw new HttpError(502, message);
  }

  const token = pickString(asObject(responseBody), ["access_token"]);
  if (!token) throw new HttpError(502, "Broker token response did not include access_token.");
  return token;
}

const mtmLinkAdapter: BrokerAdapter = {
  type: "mtm_link",
  displayName: "MTM Link",

  async testConnection(credentials, config) {
    if (!config.api_base_url) {
      return {
        ok: true,
        message:
          "Credentials are stored. Add the MTM Link API base URL when the broker endpoint is provisioned for live validation.",
      };
    }

    await getOAuthToken(credentials, config);
    return { ok: true, message: "MTM Link credentials were accepted." };
  },

  async fetchTrips({ credentials, config, windowStart, windowEnd }) {
    const token = await getOAuthToken(credentials, config);
    const url = new URL(`${trimSlash(config.api_base_url || "")}/trips`);
    url.searchParams.set("start", windowStart);
    url.searchParams.set("end", windowEnd);
    if (config.provider_org_id) url.searchParams.set("providerId", config.provider_org_id);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        pickString(asObject(responseBody), ["message", "error_description", "error"]) ||
        `Broker trip fetch failed with ${response.status}.`;
      throw new HttpError(502, message);
    }

    if (Array.isArray(responseBody)) return responseBody.map(asObject);

    const body = asObject(responseBody);
    const trips = body.trips || body.data || body.results;
    return Array.isArray(trips) ? trips.map(asObject) : [];
  },

  normalizeTrip(payload) {
    const brokerTripId = pickString(payload, [
      "tripId",
      "trip_id",
      "rideId",
      "ride_id",
      "id",
      "reservationId",
      "reservation_id",
    ]);
    if (!brokerTripId) throw new HttpError(422, "Broker trip is missing a trip id.");

    const pickupTime =
      pickString(payload, [
        "pickupTime",
        "pickup_time",
        "scheduledPickupTime",
        "scheduled_pickup_time",
        "pickupDateTime",
        "pickup_datetime",
      ]) || new Date().toISOString();

    return {
      brokerTripId,
      referenceNumber: pickString(payload, [
        "confirmationNumber",
        "confirmation_number",
        "referenceNumber",
        "reference_number",
        "tripNumber",
        "trip_number",
      ]),
      memberName:
        pickString(payload, [
          "memberName",
          "member_name",
          "passengerName",
          "passenger_name",
          "riderName",
          "rider_name",
          "patientName",
          "patient_name",
        ]) || `Broker rider ${brokerTripId}`,
      memberPhone: pickString(payload, ["memberPhone", "member_phone", "phone", "riderPhone"]),
      pickupAddress: pickString(payload, [
        "pickupAddress",
        "pickup_address",
        "pickupLocation",
        "pickup_location",
        "origin",
      ]),
      dropoffAddress: pickString(payload, [
        "dropoffAddress",
        "dropoff_address",
        "dropoffLocation",
        "dropoff_location",
        "destination",
      ]),
      pickupTime: new Date(pickupTime).toISOString(),
      appointmentTime:
        pickString(payload, ["appointmentTime", "appointment_time", "apptTime", "appt_time"]) ||
        undefined,
      tripType: pickString(payload, ["levelOfService", "level_of_service", "los", "tripType"]) ||
        "broker_trip",
      mobilityRequirement: pickString(payload, ["mobility", "mobilityRequirement", "los"]),
      notes: pickString(payload, ["notes", "specialInstructions", "special_instructions"]),
      externalStatus: pickString(payload, ["status", "tripStatus", "trip_status"]) || "dropped",
      rawPayload: payload,
    };
  },

  ingestWebhook(payload) {
    return payload;
  },
};

const adapters: Record<BrokerType, BrokerAdapter> = {
  mtm_link: mtmLinkAdapter,
};

function getAdapter(type: BrokerType) {
  const adapter = adapters[type];
  if (!adapter) throw new HttpError(400, `Unsupported broker type: ${type}`);
  return adapter;
}

function toConnectionRow(row: unknown): BrokerConnectionRow {
  const object = asObject(row);
  return {
    id: asString(object.id),
    org_id: asString(object.org_id),
    broker_type: asString(object.broker_type) as BrokerType,
    name: asString(object.name),
    environment: asString(object.environment) as BrokerEnvironment,
    status: asString(object.status) as ConnectionStatus,
    public_config: toBrokerConfig(object.public_config),
    sync_window_days_back: Number(object.sync_window_days_back || 0),
    sync_window_days_ahead: Number(object.sync_window_days_ahead || 14),
    auto_sync_enabled: Boolean(object.auto_sync_enabled),
    webhook_enabled: Boolean(object.webhook_enabled),
    last_error: asString(object.last_error) || null,
  };
}

async function loadConnection(
  admin: SupabaseClient,
  orgId: string,
  connectionId: string,
) {
  const { data, error } = await admin
    .from("broker_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("org_id", orgId)
    .single();

  if (error || !data) throw new HttpError(404, "Broker connection was not found.");
  return toConnectionRow(data);
}

async function loadCredentials(admin: SupabaseClient, connectionId: string) {
  const { data, error } = await admin
    .from("broker_connection_secrets")
    .select("encrypted_credentials")
    .eq("broker_connection_id", connectionId)
    .single();

  if (error || !data) {
    throw new HttpError(400, "Saved credentials were not found for this broker connection.");
  }

  const row = asObject(data);
  return decryptCredentials(asString(row.encrypted_credentials));
}

async function authorizeOrgAdmin(admin: SupabaseClient, orgId: string, userId: string) {
  const [{ data: profile }, { data: membership }] = await Promise.all([
    admin.from("user_profiles").select("is_super_admin").eq("user_id", userId).maybeSingle(),
    admin
      .from("organization_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const profileObject = asObject(profile);
  const membershipObject = asObject(membership);
  const role = asString(membershipObject.role);

  if (profileObject.is_super_admin === true || role === "owner" || role === "admin") {
    return;
  }

  throw new HttpError(403, "Only organization owners and admins can manage broker integrations.");
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new HttpError(401, "Missing authorization header.");

  const userClient = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Invalid session.");
  return data.user;
}

function adminClient() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

async function saveConnection(
  admin: SupabaseClient,
  userId: string,
  request: Extract<BrokerActionRequest, { action: "saveConnection" }>,
) {
  await authorizeOrgAdmin(admin, request.org_id, userId);

  const existing = request.connection_id
    ? await loadConnection(admin, request.org_id, request.connection_id)
    : null;
  const existingConfig = existing?.public_config || {};
  const credentialsProvided = Boolean(
    request.credentials?.client_id || request.credentials?.client_secret || request.credentials?.webhook_secret,
  );
  const credentials = credentialsProvided ? validateCredentials(request.credentials || {}) : null;
  const credentialHint = credentials
    ? mask(credentials.client_id)
    : asString(existingConfig.credential_hint) || undefined;
  const publicConfig = publicConfigFromInput(request.connection, credentialHint);

  if (!existing && !credentials) {
    throw new HttpError(400, "Credentials are required for a new broker connection.");
  }

  const connectionPayload = {
    org_id: request.org_id,
    broker_type: request.connection.broker_type,
    name: request.connection.name.trim(),
    environment: request.connection.environment,
    public_config: publicConfig,
    sync_window_days_back: request.connection.sync_window_days_back,
    sync_window_days_ahead: request.connection.sync_window_days_ahead,
    auto_sync_enabled: request.connection.auto_sync_enabled,
    webhook_enabled: request.connection.webhook_enabled,
    status: credentials ? "not_connected" : existing?.status || "not_connected",
    last_error: credentials ? null : existing?.last_error,
    created_by: userId,
  };

  const query = existing
    ? admin
        .from("broker_connections")
        .update(connectionPayload)
        .eq("id", existing.id)
        .eq("org_id", request.org_id)
        .select("*")
        .single()
    : admin.from("broker_connections").insert(connectionPayload).select("*").single();

  const { data: saved, error: saveError } = await query;
  if (saveError || !saved) throw new HttpError(400, saveError?.message || "Unable to save broker connection.");
  const savedConnection = toConnectionRow(saved);

  if (credentials) {
    const encrypted = await encryptCredentials(credentials);
    const fingerprint = (await sha256Hex(
      `${request.connection.broker_type}:${request.org_id}:${credentials.client_id}`,
    )).slice(0, 32);

    const { error: secretError } = await admin.from("broker_connection_secrets").upsert(
      {
        broker_connection_id: savedConnection.id,
        org_id: request.org_id,
        encrypted_credentials: encrypted,
        credential_fingerprint: fingerprint,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "broker_connection_id" },
    );

    if (secretError) throw new HttpError(400, secretError.message);
  }

  return { connection: savedConnection };
}

async function testConnection(
  admin: SupabaseClient,
  userId: string,
  request: Extract<BrokerActionRequest, { action: "testConnection" }>,
) {
  await authorizeOrgAdmin(admin, request.org_id, userId);

  let connection: BrokerConnectionRow;
  let credentials: BrokerCredentials;

  if (request.connection_id) {
    connection = await loadConnection(admin, request.org_id, request.connection_id);
    credentials = request.credentials?.client_id || request.credentials?.client_secret
      ? validateCredentials(request.credentials)
      : await loadCredentials(admin, connection.id);
  } else if (request.connection) {
    credentials = validateCredentials(request.credentials || {});
    connection = {
      id: "",
      org_id: request.org_id,
      broker_type: request.connection.broker_type,
      name: request.connection.name,
      environment: request.connection.environment,
      status: "testing",
      public_config: publicConfigFromInput(request.connection, mask(credentials.client_id)),
      sync_window_days_back: request.connection.sync_window_days_back,
      sync_window_days_ahead: request.connection.sync_window_days_ahead,
      auto_sync_enabled: request.connection.auto_sync_enabled,
      webhook_enabled: request.connection.webhook_enabled,
      last_error: null,
    };
  } else {
    throw new HttpError(400, "Connection details are required for testing.");
  }

  if (connection.id) {
    await admin
      .from("broker_connections")
      .update({ status: "testing", last_error: null })
      .eq("id", connection.id)
      .eq("org_id", request.org_id);
  }

  try {
    const adapter = getAdapter(connection.broker_type);
    const result = await adapter.testConnection(credentials, connection.public_config || {});
    const status: ConnectionStatus = result.ok ? "connected" : "failed";

    if (connection.id) {
      await admin
        .from("broker_connections")
        .update({
          status,
          last_tested_at: new Date().toISOString(),
          last_error: result.ok ? null : result.message,
        })
        .eq("id", connection.id)
        .eq("org_id", request.org_id);
    }

    return { status, message: result.message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection test failed.";
    if (connection.id) {
      await admin
        .from("broker_connections")
        .update({
          status: "failed",
          last_tested_at: new Date().toISOString(),
          last_error: message,
        })
        .eq("id", connection.id)
        .eq("org_id", request.org_id);
    }
    throw error;
  }
}

function normalizeInternalStatus(externalStatus?: string) {
  const value = (externalStatus || "").toLowerCase();
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("complete")) return "completed";
  return "pending";
}

function brokerNotes(trip: NormalizedBrokerTrip) {
  return [
    trip.notes,
    trip.referenceNumber ? `Broker confirmation: ${trip.referenceNumber}` : "",
    trip.mobilityRequirement ? `LOS/Mobility: ${trip.mobilityRequirement}` : "",
    trip.appointmentTime ? `Appointment: ${trip.appointmentTime}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function resolvePatient(
  admin: SupabaseClient,
  orgId: string,
  trip: NormalizedBrokerTrip,
) {
  const name = trip.memberName || `Broker rider ${trip.brokerTripId}`;
  const { data: existing } = await admin
    .from("patients")
    .select("id")
    .eq("org_id", orgId)
    .ilike("full_name", name)
    .limit(1)
    .maybeSingle();

  const existingObject = asObject(existing);
  if (existingObject.id) return asString(existingObject.id);

  const { data, error } = await admin
    .from("patients")
    .insert({
      org_id: orgId,
      full_name: name,
      phone: trip.memberPhone || null,
      primary_address: trip.pickupAddress || null,
      notes: "Created from broker trip import.",
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) throw new HttpError(400, error?.message || "Unable to create broker rider.");
  return asString(asObject(data).id);
}

async function recordImport(
  admin: SupabaseClient,
  args: {
    orgId: string;
    connectionId: string;
    syncRunId: string;
    tripId?: string;
    brokerName: string;
    normalized?: NormalizedBrokerTrip;
    rawPayload: JsonObject;
    operation: ImportOperation;
    errorMessage?: string;
  },
) {
  await admin.from("broker_trip_imports").insert({
    org_id: args.orgId,
    broker_connection_id: args.connectionId,
    broker_sync_run_id: args.syncRunId,
    trip_id: args.tripId || null,
    broker_name: args.brokerName,
    broker_trip_id: args.normalized?.brokerTripId || null,
    broker_reference_number: args.normalized?.referenceNumber || null,
    operation: args.operation,
    external_status: args.normalized?.externalStatus || null,
    raw_payload: args.rawPayload,
    normalized_payload: args.normalized || {},
    error_message: args.errorMessage || null,
  });
}

async function syncOneTrip(
  admin: SupabaseClient,
  args: {
    orgId: string;
    connection: BrokerConnectionRow;
    syncRunId: string;
    adapter: BrokerAdapter;
    payload: JsonObject;
  },
): Promise<ImportOperation> {
  const normalized = args.adapter.normalizeTrip(args.payload);
  const patientId = await resolvePatient(admin, args.orgId, normalized);
  const now = new Date().toISOString();
  const tripPayload = {
    org_id: args.orgId,
    patient_id: patientId,
    pickup_location: normalized.pickupAddress,
    dropoff_location: normalized.dropoffAddress,
    scheduled_time: normalized.pickupTime,
    pickup_time: normalized.pickupTime,
    trip_type: normalized.tripType,
    status: normalizeInternalStatus(normalized.externalStatus),
    notes: brokerNotes(normalized),
    broker_name: args.adapter.displayName,
    broker_trip_id: normalized.brokerTripId,
    broker_reference_number: normalized.referenceNumber || null,
    broker_connection_id: args.connection.id,
    external_status: normalized.externalStatus || null,
    external_payload_snapshot: normalized.rawPayload,
    synced_at: now,
  };

  const { data: existingLink } = await admin
    .from("broker_trip_links")
    .select("trip_id")
    .eq("org_id", args.orgId)
    .eq("broker_connection_id", args.connection.id)
    .eq("broker_trip_id", normalized.brokerTripId)
    .maybeSingle();

  const existingTripId = asString(asObject(existingLink).trip_id);
  let tripId = existingTripId;
  let operation: ImportOperation = existingTripId ? "updated" : "imported";

  if (existingTripId) {
    const { error } = await admin
      .from("trips")
      .update(tripPayload)
      .eq("id", existingTripId)
      .eq("org_id", args.orgId);
    if (error) throw new HttpError(400, error.message);
  } else {
    const { data, error } = await admin.from("trips").insert(tripPayload).select("id").single();
    if (error || !data) throw new HttpError(400, error?.message || "Unable to import broker trip.");
    tripId = asString(asObject(data).id);
  }

  const { error: linkError } = await admin.from("broker_trip_links").upsert(
    {
      org_id: args.orgId,
      broker_connection_id: args.connection.id,
      trip_id: tripId,
      broker_name: args.adapter.displayName,
      broker_trip_id: normalized.brokerTripId,
      broker_reference_number: normalized.referenceNumber || null,
      external_status: normalized.externalStatus || null,
      external_payload_snapshot: normalized.rawPayload,
      last_seen_at: now,
      last_synced_at: now,
    },
    { onConflict: "org_id,broker_connection_id,broker_trip_id" },
  );

  if (linkError) {
    operation = "failed";
    throw new HttpError(400, linkError.message);
  }

  await recordImport(admin, {
    orgId: args.orgId,
    connectionId: args.connection.id,
    syncRunId: args.syncRunId,
    tripId,
    brokerName: args.adapter.displayName,
    normalized,
    rawPayload: args.payload,
    operation,
  });

  return operation;
}

async function syncNow(
  admin: SupabaseClient,
  userId: string,
  request: Extract<BrokerActionRequest, { action: "syncNow" }>,
) {
  await authorizeOrgAdmin(admin, request.org_id, userId);
  const connection = await loadConnection(admin, request.org_id, request.connection_id);
  const credentials = await loadCredentials(admin, connection.id);
  const adapter = getAdapter(connection.broker_type);

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - connection.sync_window_days_back);
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + connection.sync_window_days_ahead);

  const { data: syncRun, error: syncRunError } = await admin
    .from("broker_sync_runs")
    .insert({
      org_id: request.org_id,
      broker_connection_id: connection.id,
      run_type: "manual",
      status: "running",
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      requested_by: userId,
    })
    .select("id")
    .single();

  if (syncRunError || !syncRun) {
    throw new HttpError(400, syncRunError?.message || "Unable to create sync run.");
  }

  const syncRunId = asString(asObject(syncRun).id);
  await admin
    .from("broker_connections")
    .update({ status: "syncing", last_error: null })
    .eq("id", connection.id);

  let fetchedTrips: JsonObject[] = [];
  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let firstError = "";

  try {
    fetchedTrips = await adapter.fetchTrips({
      credentials,
      config: connection.public_config || {},
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });

    for (const payload of fetchedTrips) {
      try {
        const operation = await syncOneTrip(admin, {
          orgId: request.org_id,
          connection,
          syncRunId,
          adapter,
          payload,
        });

        if (operation === "imported") importedCount += 1;
        if (operation === "updated") updatedCount += 1;
        if (operation === "skipped") skippedCount += 1;
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : "Trip import failed.";
        firstError ||= message;
        await recordImport(admin, {
          orgId: request.org_id,
          connectionId: connection.id,
          syncRunId,
          brokerName: adapter.displayName,
          rawPayload: payload,
          operation: "failed",
          errorMessage: message,
        });
      }
    }

    const status: SyncRunStatus = failedCount === 0 ? "succeeded" : importedCount + updatedCount > 0 ? "partial" : "failed";
    const connectionStatus: ConnectionStatus = status === "failed" ? "failed" : "connected";

    await Promise.all([
      admin
        .from("broker_sync_runs")
        .update({
          status,
          fetched_count: fetchedTrips.length,
          imported_count: importedCount,
          updated_count: updatedCount,
          skipped_count: skippedCount,
          failed_count: failedCount,
          error_message: firstError || null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncRunId),
      admin
        .from("broker_connections")
        .update({
          status: connectionStatus,
          last_synced_at: new Date().toISOString(),
          last_sync_status: status,
          last_error: firstError || null,
        })
        .eq("id", connection.id),
    ]);

    return {
      sync_run_id: syncRunId,
      status,
      fetched_count: fetchedTrips.length,
      imported_count: importedCount,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      error_message: firstError || null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Broker sync failed.";
    await Promise.all([
      admin
        .from("broker_sync_runs")
        .update({
          status: "failed",
          fetched_count: fetchedTrips.length,
          imported_count: importedCount,
          updated_count: updatedCount,
          skipped_count: skippedCount,
          failed_count: failedCount,
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncRunId),
      admin
        .from("broker_connections")
        .update({
          status: "failed",
          last_sync_status: "failed",
          last_error: message,
        })
        .eq("id", connection.id),
    ]);
    throw error;
  }
}

async function deleteConnection(
  admin: SupabaseClient,
  userId: string,
  request: Extract<BrokerActionRequest, { action: "deleteConnection" }>,
) {
  await authorizeOrgAdmin(admin, request.org_id, userId);
  const { error } = await admin
    .from("broker_connections")
    .delete()
    .eq("id", request.connection_id)
    .eq("org_id", request.org_id);
  if (error) throw new HttpError(400, error.message);
  return { deleted: true };
}

async function ingestWebhook(
  admin: SupabaseClient,
  req: Request,
  request: Extract<BrokerActionRequest, { action: "ingestWebhook" }>,
) {
  const secret = req.headers.get("x-broker-webhook-secret") || "";
  if (!secret) throw new HttpError(401, "Missing broker webhook secret.");

  const { data: connectionData, error: connectionError } = await admin
    .from("broker_connections")
    .select("*")
    .eq("id", request.connection_id)
    .single();
  if (connectionError || !connectionData) throw new HttpError(404, "Broker connection was not found.");

  const connection = toConnectionRow(connectionData);
  const credentials = await loadCredentials(admin, connection.id);
  if (!credentials.webhook_secret || credentials.webhook_secret !== secret) {
    throw new HttpError(401, "Invalid broker webhook secret.");
  }

  const adapter = getAdapter(connection.broker_type);
  const payload = adapter.ingestWebhook ? adapter.ingestWebhook(request.payload || {}) : request.payload || {};
  const { data, error } = await admin
    .from("broker_event_queue")
    .insert({
      org_id: connection.org_id,
      broker_connection_id: connection.id,
      broker_name: adapter.displayName,
      broker_trip_id: pickString(payload, ["tripId", "trip_id", "rideId", "ride_id"]),
      event_type: request.event_type || "broker_webhook",
      idempotency_key: request.idempotency_key || null,
      payload,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) throw new HttpError(400, error?.message || "Unable to queue broker webhook.");
  return { queued: true, event_id: asString(asObject(data).id) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const request = (await req.json()) as BrokerActionRequest;
    const admin = adminClient();

    if (request.action === "ingestWebhook") {
      return jsonResponse(await ingestWebhook(admin, req, request));
    }

    const user = await requireUser(req);

    switch (request.action) {
      case "saveConnection":
        return jsonResponse(await saveConnection(admin, user.id, request));
      case "testConnection":
        return jsonResponse(await testConnection(admin, user.id, request));
      case "syncNow":
        return jsonResponse(await syncNow(admin, user.id, request));
      case "deleteConnection":
        return jsonResponse(await deleteConnection(admin, user.id, request));
      default:
        return jsonResponse({ error: "Unsupported broker action" }, 400);
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unknown broker integration error.";
    console.error("Broker integration error:", message);
    return jsonResponse({ error: message }, status);
  }
});
