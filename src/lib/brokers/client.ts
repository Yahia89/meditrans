import { supabase } from "@/lib/supabase";
import type {
  BrokerConnection,
  BrokerSyncResult,
  BrokerSyncRun,
  BrokerTripImport,
  SaveBrokerConnectionInput,
  TestBrokerConnectionInput,
} from "./types";

interface BrokerFunctionError {
  error?: string;
}

function assertBrokerFunctionSuccess<T>(data: T | BrokerFunctionError | null): T {
  if (!data) throw new Error("Broker integration function returned no data.");
  if (typeof data === "object" && "error" in data && data.error) {
    throw new Error(data.error);
  }
  return data as T;
}

async function invokeBrokerFunction<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<T | BrokerFunctionError>(
    "broker-integrations",
    { body },
  );

  if (error) throw error;
  return assertBrokerFunctionSuccess<T>(data);
}

export async function fetchBrokerConnections(orgId: string) {
  const { data, error } = await supabase
    .from("broker_connections")
    .select(
      `
        id,
        org_id,
        broker_type,
        name,
        environment,
        status,
        public_config,
        sync_window_days_back,
        sync_window_days_ahead,
        auto_sync_enabled,
        webhook_enabled,
        last_tested_at,
        last_synced_at,
        last_sync_status,
        last_error,
        created_at,
        updated_at
      `,
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as BrokerConnection[];
}

export async function fetchBrokerSyncRuns(orgId: string) {
  const { data, error } = await supabase
    .from("broker_sync_runs")
    .select(
      `
        id,
        org_id,
        broker_connection_id,
        run_type,
        status,
        window_start,
        window_end,
        fetched_count,
        imported_count,
        updated_count,
        skipped_count,
        failed_count,
        error_message,
        started_at,
        completed_at
      `,
    )
    .eq("org_id", orgId)
    .order("started_at", { ascending: false })
    .limit(12);

  if (error) throw error;
  return (data || []) as unknown as BrokerSyncRun[];
}

export async function fetchRecentBrokerImports(orgId: string) {
  const { data, error } = await supabase
    .from("broker_trip_imports")
    .select(
      `
        id,
        org_id,
        broker_connection_id,
        broker_sync_run_id,
        trip_id,
        broker_name,
        broker_trip_id,
        broker_reference_number,
        operation,
        external_status,
        error_message,
        created_at
      `,
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []) as unknown as BrokerTripImport[];
}

export function saveBrokerConnection(input: SaveBrokerConnectionInput) {
  return invokeBrokerFunction<{ connection: BrokerConnection }>({
    action: "saveConnection",
    ...input,
  });
}

export function testBrokerConnection(input: TestBrokerConnectionInput) {
  return invokeBrokerFunction<{ status: BrokerConnection["status"]; message: string }>({
    action: "testConnection",
    ...input,
  });
}

export function syncBrokerConnection(orgId: string, connectionId: string) {
  return invokeBrokerFunction<BrokerSyncResult>({
    action: "syncNow",
    org_id: orgId,
    connection_id: connectionId,
  });
}

export function deleteBrokerConnection(orgId: string, connectionId: string) {
  return invokeBrokerFunction<{ deleted: true }>({
    action: "deleteConnection",
    org_id: orgId,
    connection_id: connectionId,
  });
}
