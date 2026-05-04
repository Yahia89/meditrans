import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Link2,
  Loader2,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  BROKER_PROVIDERS,
  DEFAULT_BROKER_FORM_VALUES,
  type BrokerConnection,
  type BrokerConnectionFormValues,
  type BrokerConnectionStatus,
  type BrokerSyncRun,
} from "@/lib/brokers/types";
import {
  fetchBrokerConnections,
  fetchBrokerSyncRuns,
  fetchRecentBrokerImports,
  saveBrokerConnection,
  syncBrokerConnection,
  testBrokerConnection,
} from "@/lib/brokers/client";
import { cn } from "@/lib/utils";

const statusMeta: Record<
  BrokerConnectionStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  not_connected: {
    label: "Not connected",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: Plug,
  },
  testing: {
    label: "Testing",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Activity,
  },
  connected: {
    label: "Connected",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "border-red-200 bg-red-50 text-red-700",
    icon: AlertTriangle,
  },
  syncing: {
    label: "Syncing",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: RefreshCw,
  },
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const emptyConnections: BrokerConnection[] = [];
const emptySyncRuns: BrokerSyncRun[] = [];
const emptyImports: Awaited<ReturnType<typeof fetchRecentBrokerImports>> = [];

function formatDateTime(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return dateTimeFormatter.format(date);
}

function fieldValue(value: string | undefined) {
  return value || "";
}

function buildConnectionPayload(formValues: BrokerConnectionFormValues) {
  return {
    broker_type: formValues.broker_type,
    name: formValues.name,
    environment: formValues.environment,
    scope: formValues.scope,
    provider_org_id: formValues.provider_org_id,
    api_base_url: formValues.api_base_url,
    sync_window_days_back: formValues.sync_window_days_back,
    sync_window_days_ahead: formValues.sync_window_days_ahead,
    auto_sync_enabled: formValues.auto_sync_enabled,
    webhook_enabled: formValues.webhook_enabled,
  };
}

function credentialsFromForm(formValues: BrokerConnectionFormValues) {
  const hasCredentialInput =
    formValues.client_id.trim() ||
    formValues.client_secret.trim() ||
    formValues.webhook_secret.trim();

  if (!hasCredentialInput) return undefined;

  return {
    client_id: formValues.client_id.trim(),
    client_secret: formValues.client_secret.trim(),
    webhook_secret: formValues.webhook_secret.trim() || undefined,
  };
}

function StatusBadge({ status }: { status: BrokerConnectionStatus }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;

  return (
    <Badge variant="outline" className={cn("gap-1.5 border", meta.className)}>
      <Icon className={cn("size-3.5", status === "syncing" && "animate-spin")} />
      {meta.label}
    </Badge>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: typeof Database;
  label: string;
  value: string | number;
  tone?: "slate" | "green" | "amber" | "red";
}) {
  const toneClass = {
    slate: "bg-slate-50 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={cn("flex size-10 items-center justify-center rounded-lg", toneClass)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-tight text-slate-900">{value}</div>
          <div className="truncate text-xs font-medium text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SyncRunRow({
  run,
  connection,
}: {
  run: BrokerSyncRun;
  connection?: BrokerConnection;
}) {
  const statusClass =
    run.status === "succeeded"
      ? "bg-emerald-50 text-emerald-700"
      : run.status === "partial"
        ? "bg-amber-50 text-amber-700"
        : run.status === "failed"
          ? "bg-red-50 text-red-700"
          : "bg-blue-50 text-blue-700";

  return (
    <div className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 md:grid-cols-[1.3fr_0.8fr_1.2fr] md:items-center">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-900">
          {connection?.name || "Broker connection"}
        </div>
        <div className="text-xs text-slate-500">{formatDateTime(run.started_at)}</div>
      </div>
      <div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", statusClass)}>
          {run.status}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600 md:justify-end">
        <span>{run.fetched_count} fetched</span>
        <span>{run.imported_count} new</span>
        <span>{run.updated_count} updated</span>
        <span className={run.failed_count > 0 ? "text-red-600" : ""}>
          {run.failed_count} failed
        </span>
      </div>
    </div>
  );
}

export function BrokerIntegrationsPage() {
  const { currentOrganization } = useOrganization();
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<BrokerConnectionFormValues>(
    DEFAULT_BROKER_FORM_VALUES,
  );

  const connectionsQuery = useQuery({
    queryKey: ["broker-connections", orgId],
    queryFn: () => fetchBrokerConnections(orgId || ""),
    enabled: Boolean(orgId),
  });

  const syncRunsQuery = useQuery({
    queryKey: ["broker-sync-runs", orgId],
    queryFn: () => fetchBrokerSyncRuns(orgId || ""),
    enabled: Boolean(orgId),
  });

  const importsQuery = useQuery({
    queryKey: ["broker-trip-imports", orgId],
    queryFn: () => fetchRecentBrokerImports(orgId || ""),
    enabled: Boolean(orgId),
  });

  const connections = connectionsQuery.data ?? emptyConnections;
  const syncRuns = syncRunsQuery.data ?? emptySyncRuns;
  const recentImports = importsQuery.data ?? emptyImports;
  const activeConnection = connections.find((connection) => connection.id === activeConnectionId);

  const lastRunByConnection = useMemo(() => {
    const map = new Map<string, BrokerSyncRun>();
    for (const run of syncRuns) {
      if (!map.has(run.broker_connection_id)) {
        map.set(run.broker_connection_id, run);
      }
    }
    return map;
  }, [syncRuns]);

  const stats = useMemo(() => {
    const latestRun = syncRuns[0];
    const totalImported = recentImports.filter((row) => row.operation === "imported").length;
    const totalUpdated = recentImports.filter((row) => row.operation === "updated").length;
    const totalFailed = recentImports.filter((row) => row.operation === "failed").length;

    return {
      connected: connections.filter((connection) => connection.status === "connected").length,
      lastSync: latestRun ? formatDateTime(latestRun.completed_at || latestRun.started_at) : "Never",
      imported: totalImported + totalUpdated,
      failed: totalFailed,
    };
  }, [connections, recentImports, syncRuns]);

  const invalidateBrokerQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["broker-connections", orgId] }),
      queryClient.invalidateQueries({ queryKey: ["broker-sync-runs", orgId] }),
      queryClient.invalidateQueries({ queryKey: ["broker-trip-imports", orgId] }),
      queryClient.invalidateQueries({ queryKey: ["trips"] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!orgId) throw new Error("No organization selected.");
      return saveBrokerConnection({
        org_id: orgId,
        connection_id: activeConnectionId || undefined,
        connection: buildConnectionPayload(formValues),
        credentials: credentialsFromForm(formValues),
      });
    },
    onSuccess: async ({ connection }) => {
      toast.success("Broker connection saved");
      setActiveConnectionId(connection.id);
      setFormValues((current) => ({
        ...current,
        client_id: "",
        client_secret: "",
        webhook_secret: "",
      }));
      await invalidateBrokerQueries();
    },
    onError: (error) => {
      toast.error("Unable to save broker connection", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => {
      if (!orgId) throw new Error("No organization selected.");
      return testBrokerConnection({
        org_id: orgId,
        connection_id: activeConnectionId || undefined,
        connection: activeConnectionId ? undefined : buildConnectionPayload(formValues),
        credentials: credentialsFromForm(formValues),
      });
    },
    onSuccess: async (result) => {
      toast.success(result.status === "connected" ? "Connection test passed" : "Connection tested", {
        description: result.message,
      });
      await invalidateBrokerQueries();
    },
    onError: (error) => {
      toast.error("Connection test failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      void invalidateBrokerQueries();
    },
  });

  const syncMutation = useMutation({
    mutationFn: (connectionId: string) => {
      if (!orgId) throw new Error("No organization selected.");
      return syncBrokerConnection(orgId, connectionId);
    },
    onSuccess: async (result) => {
      toast.success("Broker sync finished", {
        description: `${result.imported_count} new, ${result.updated_count} updated, ${result.failed_count} failed`,
      });
      await invalidateBrokerQueries();
    },
    onError: (error) => {
      toast.error("Broker sync failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      void invalidateBrokerQueries();
    },
  });

  const updateField = <Key extends keyof BrokerConnectionFormValues>(
    key: Key,
    value: BrokerConnectionFormValues[Key],
  ) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const startNewConnection = () => {
    setActiveConnectionId(null);
    setFormValues(DEFAULT_BROKER_FORM_VALUES);
  };

  const editConnection = (connection: BrokerConnection) => {
    setActiveConnectionId(connection.id);
    setFormValues({
      broker_type: connection.broker_type,
      name: connection.name,
      environment: connection.environment,
      client_id: "",
      client_secret: "",
      scope: fieldValue(connection.public_config.scope),
      provider_org_id: fieldValue(connection.public_config.provider_org_id),
      api_base_url: fieldValue(connection.public_config.api_base_url),
      webhook_secret: "",
      sync_window_days_back: connection.sync_window_days_back,
      sync_window_days_ahead: connection.sync_window_days_ahead,
      auto_sync_enabled: connection.auto_sync_enabled,
      webhook_enabled: connection.webhook_enabled,
    });
  };

  if (!currentOrganization) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-500">
        Select an organization to manage broker integrations.
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-center">
        <div>
          <ShieldCheck className="mx-auto mb-3 size-10 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Admin access required</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Broker credentials and sync controls are limited to organization admins.
          </p>
        </div>
      </div>
    );
  }

  const credentialHint = activeConnection?.public_config.credential_hint;
  const isBusy = saveMutation.isPending || testMutation.isPending || syncMutation.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-[#3D5A3D] text-white">
              <Plug className="size-5" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Broker Integrations
              </h1>
              <p className="text-sm text-slate-500">
                Connect broker trip drops to the operational trips scheduler.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void invalidateBrokerQueries()}
            disabled={connectionsQuery.isFetching || syncRunsQuery.isFetching}
            className="gap-2 border-slate-200 bg-white"
          >
            <RefreshCw
              className={cn(
                "size-4",
                (connectionsQuery.isFetching || syncRunsQuery.isFetching) && "animate-spin",
              )}
            />
            Refresh
          </Button>
          <Button
            onClick={startNewConnection}
            className="gap-2 rounded-md bg-[#3D5A3D] text-white hover:bg-[#2E4A2E]"
          >
            <Plus className="size-4" />
            New Connection
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatTile icon={Link2} label="Connected brokers" value={stats.connected} tone="green" />
        <StatTile icon={Database} label="Recent imports/updates" value={stats.imported} />
        <StatTile icon={Clock3} label="Last sync" value={stats.lastSync} tone="amber" />
        <StatTile icon={AlertTriangle} label="Recent failed rows" value={stats.failed} tone="red" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.35fr)]">
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Connections</h2>
              <p className="text-xs text-slate-500">{connections.length} configured</p>
            </div>
            {connectionsQuery.isLoading && <Loader2 className="size-4 animate-spin text-slate-400" />}
          </div>

          <div className="divide-y divide-slate-100">
            {connections.length === 0 && !connectionsQuery.isLoading ? (
              <div className="px-5 py-10 text-center">
                <Plug className="mx-auto mb-3 size-10 text-slate-300" />
                <h3 className="text-sm font-semibold text-slate-900">No broker connected</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                  Add MTM Link credentials, test the connection, then sync dropped trips into the
                  scheduler.
                </p>
              </div>
            ) : (
              connections.map((connection) => {
                const lastRun = lastRunByConnection.get(connection.id);
                const isActive = connection.id === activeConnectionId;

                return (
                  <button
                    key={connection.id}
                    type="button"
                    onClick={() => editConnection(connection)}
                    className={cn(
                      "block w-full rounded-none border-0 bg-white p-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5A3D]/30",
                      isActive && "bg-[#f8fafc]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {connection.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{connection.environment}</span>
                          <span>{connection.public_config.provider_org_id || "Provider ID pending"}</span>
                        </div>
                      </div>
                      <StatusBadge status={connection.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md bg-slate-50 px-2 py-1.5">
                        <div className="font-semibold text-slate-900">
                          {lastRun?.imported_count || 0}
                        </div>
                        <div className="text-slate-500">New</div>
                      </div>
                      <div className="rounded-md bg-slate-50 px-2 py-1.5">
                        <div className="font-semibold text-slate-900">
                          {lastRun?.updated_count || 0}
                        </div>
                        <div className="text-slate-500">Updated</div>
                      </div>
                      <div className="rounded-md bg-slate-50 px-2 py-1.5">
                        <div className={cn("font-semibold", (lastRun?.failed_count || 0) > 0 ? "text-red-600" : "text-slate-900")}>
                          {lastRun?.failed_count || 0}
                        </div>
                        <div className="text-slate-500">Failed</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      Last sync: {formatDateTime(connection.last_synced_at)}
                    </div>
                    {connection.last_error && (
                      <div className="mt-2 line-clamp-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">
                        {connection.last_error}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {activeConnection ? "Connection Settings" : "New Broker Connection"}
              </h2>
              <p className="text-xs text-slate-500">
                {activeConnection
                  ? `${activeConnection.name} credentials are saved server-side.`
                  : "MTM Link is available now; additional brokers can use the same adapter boundary."}
              </p>
            </div>
            {activeConnection && <StatusBadge status={activeConnection.status} />}
          </div>

          <div className="space-y-5 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="broker-type" label="Broker">
                <Select
                  value={formValues.broker_type}
                  onValueChange={(value) => updateField("broker_type", value as BrokerConnectionFormValues["broker_type"])}
                >
                  <SelectTrigger id="broker-type" className="h-10 w-full bg-white">
                    <SelectValue placeholder="Select broker" />
                  </SelectTrigger>
                  <SelectContent>
                    {BROKER_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="environment" label="Environment">
                <Select
                  value={formValues.environment}
                  onValueChange={(value) => updateField("environment", value as BrokerConnectionFormValues["environment"])}
                >
                  <SelectTrigger id="environment" className="h-10 w-full bg-white">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field id="connection-name" label="Connection Name">
                <Input
                  id="connection-name"
                  value={formValues.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="MTM Link"
                  className="h-10 bg-white"
                />
              </Field>

              <Field id="provider-org-id" label="Org / Provider ID">
                <Input
                  id="provider-org-id"
                  value={formValues.provider_org_id}
                  onChange={(event) => updateField("provider_org_id", event.target.value)}
                  placeholder="Broker-issued provider id"
                  className="h-10 bg-white"
                />
              </Field>

              <Field id="client-id" label="Client ID">
                <Input
                  id="client-id"
                  value={formValues.client_id}
                  onChange={(event) => updateField("client_id", event.target.value)}
                  placeholder={credentialHint ? `Saved credential ${credentialHint}` : "Client ID"}
                  className="h-10 bg-white"
                  autoComplete="off"
                />
              </Field>

              <Field id="client-secret" label="Client Secret">
                <Input
                  id="client-secret"
                  type="password"
                  value={formValues.client_secret}
                  onChange={(event) => updateField("client_secret", event.target.value)}
                  placeholder={credentialHint ? "Leave blank to keep saved secret" : "Client secret"}
                  className="h-10 bg-white"
                  autoComplete="new-password"
                />
              </Field>

              <Field id="scope" label="Scope">
                <Input
                  id="scope"
                  value={formValues.scope}
                  onChange={(event) => updateField("scope", event.target.value)}
                  placeholder="trips.read trips.write"
                  className="h-10 bg-white"
                />
              </Field>

              <Field id="api-base-url" label="API Base URL">
                <Input
                  id="api-base-url"
                  value={formValues.api_base_url}
                  onChange={(event) => updateField("api_base_url", event.target.value)}
                  placeholder="https://broker.example.com"
                  className="h-10 bg-white"
                />
              </Field>

              <Field id="webhook-secret" label="Webhook / Shared Secret">
                <Input
                  id="webhook-secret"
                  type="password"
                  value={formValues.webhook_secret}
                  onChange={(event) => updateField("webhook_secret", event.target.value)}
                  placeholder="Optional shared secret"
                  className="h-10 bg-white"
                  autoComplete="new-password"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field id="sync-days-back" label="Past Days">
                  <Input
                    id="sync-days-back"
                    type="number"
                    min={0}
                    max={30}
                    value={formValues.sync_window_days_back}
                    onChange={(event) => updateField("sync_window_days_back", Number(event.target.value))}
                    className="h-10 bg-white"
                  />
                </Field>
                <Field id="sync-days-ahead" label="Future Days">
                  <Input
                    id="sync-days-ahead"
                    type="number"
                    min={0}
                    max={365}
                    value={formValues.sync_window_days_ahead}
                    onChange={(event) => updateField("sync_window_days_ahead", Number(event.target.value))}
                    className="h-10 bg-white"
                  />
                </Field>
              </div>
            </div>

            <div className="grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">Webhook ingestion</div>
                  <div className="truncate text-xs text-slate-500">Queue inbound broker events</div>
                </div>
                <Switch
                  checked={formValues.webhook_enabled}
                  onCheckedChange={(checked) => updateField("webhook_enabled", checked)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">Scheduled sync</div>
                  <div className="truncate text-xs text-slate-500">Ready for Supabase cron</div>
                </div>
                <Switch
                  checked={formValues.auto_sync_enabled}
                  onCheckedChange={(checked) => updateField("auto_sync_enabled", checked)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="gap-2 border-slate-200 bg-white"
                onClick={() => testMutation.mutate()}
                disabled={isBusy}
              >
                {testMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Settings2 className="size-4" />
                )}
                Test Connection
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-slate-200 bg-white"
                onClick={() => activeConnectionId && syncMutation.mutate(activeConnectionId)}
                disabled={!activeConnectionId || isBusy}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Sync Now
              </Button>
              <Button
                className="gap-2 bg-[#3D5A3D] text-white hover:bg-[#2E4A2E]"
                onClick={() => saveMutation.mutate()}
                disabled={isBusy}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save Connection
              </Button>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Recent Sync History</h2>
            <p className="text-xs text-slate-500">Latest manual, scheduled, and webhook runs</p>
          </div>
          {syncRunsQuery.isLoading && <Loader2 className="size-4 animate-spin text-slate-400" />}
        </div>
        {syncRuns.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            No broker syncs have run yet.
          </div>
        ) : (
          syncRuns.map((run) => (
            <SyncRunRow
              key={run.id}
              run={run}
              connection={connections.find((connection) => connection.id === run.broker_connection_id)}
            />
          ))
        )}
      </section>
    </div>
  );
}
