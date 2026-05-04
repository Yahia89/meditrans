export type BrokerType = "mtm_link";
export type BrokerEnvironment = "sandbox" | "production";

export type BrokerConnectionStatus =
  | "not_connected"
  | "testing"
  | "connected"
  | "failed"
  | "syncing";

export type BrokerSyncRunStatus = "running" | "succeeded" | "partial" | "failed";
export type BrokerImportOperation = "imported" | "updated" | "skipped" | "failed";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export interface BrokerProvider {
  id: BrokerType;
  label: string;
  description: string;
}

export interface BrokerPublicConfig {
  scope?: string;
  provider_org_id?: string;
  api_base_url?: string;
  credential_hint?: string;
}

export interface BrokerConnection {
  id: string;
  org_id: string;
  broker_type: BrokerType;
  name: string;
  environment: BrokerEnvironment;
  status: BrokerConnectionStatus;
  public_config: BrokerPublicConfig;
  sync_window_days_back: number;
  sync_window_days_ahead: number;
  auto_sync_enabled: boolean;
  webhook_enabled: boolean;
  last_tested_at: string | null;
  last_synced_at: string | null;
  last_sync_status: BrokerSyncRunStatus | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrokerCredentialsInput {
  client_id: string;
  client_secret: string;
  webhook_secret?: string;
}

export interface BrokerConnectionFormValues {
  broker_type: BrokerType;
  name: string;
  environment: BrokerEnvironment;
  client_id: string;
  client_secret: string;
  scope: string;
  provider_org_id: string;
  api_base_url: string;
  webhook_secret: string;
  sync_window_days_back: number;
  sync_window_days_ahead: number;
  auto_sync_enabled: boolean;
  webhook_enabled: boolean;
}

export interface SaveBrokerConnectionInput {
  org_id: string;
  connection_id?: string;
  connection: Omit<
    BrokerConnectionFormValues,
    "client_id" | "client_secret" | "webhook_secret"
  >;
  credentials?: Partial<BrokerCredentialsInput>;
}

export interface TestBrokerConnectionInput {
  org_id: string;
  connection_id?: string;
  connection?: Omit<
    BrokerConnectionFormValues,
    "client_id" | "client_secret" | "webhook_secret"
  >;
  credentials?: Partial<BrokerCredentialsInput>;
}

export interface BrokerSyncRun {
  id: string;
  org_id: string;
  broker_connection_id: string;
  run_type: "manual" | "scheduled" | "webhook";
  status: BrokerSyncRunStatus;
  window_start: string | null;
  window_end: string | null;
  fetched_count: number;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface BrokerTripImport {
  id: string;
  org_id: string;
  broker_connection_id: string;
  broker_sync_run_id: string | null;
  trip_id: string | null;
  broker_name: string;
  broker_trip_id: string | null;
  broker_reference_number: string | null;
  operation: BrokerImportOperation;
  external_status: string | null;
  error_message: string | null;
  created_at: string;
}

export interface BrokerSyncResult {
  sync_run_id: string;
  status: BrokerSyncRunStatus;
  fetched_count: number;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  error_message: string | null;
}

export const BROKER_PROVIDERS: BrokerProvider[] = [
  {
    id: "mtm_link",
    label: "MTM Link",
    description: "OAuth-based trip drops from MTM Link.",
  },
];

export const DEFAULT_BROKER_FORM_VALUES: BrokerConnectionFormValues = {
  broker_type: "mtm_link",
  name: "MTM Link",
  environment: "sandbox",
  client_id: "",
  client_secret: "",
  scope: "",
  provider_org_id: "",
  api_base_url: "",
  webhook_secret: "",
  sync_window_days_back: 0,
  sync_window_days_ahead: 14,
  auto_sync_enabled: false,
  webhook_enabled: false,
};
