import { Button } from "@/components/ui/button";
import { readSavedPatientsView, type DirectoryViewMode } from "@/lib/directory-state";
import { usePermissions } from "@/hooks/usePermissions";

export function DirectoryListStatus({ label, pending, failed, refreshing, stale, retry }: {
  label: string;
  pending: boolean;
  failed: boolean;
  refreshing: boolean;
  stale: boolean;
  retry: () => void;
}) {
  const title = label.charAt(0).toUpperCase() + label.slice(1);
  const text = failed ? `${title} could not be loaded.`
    : stale ? `Showing saved ${label}. Refresh failed.`
    : pending ? `Loading ${label}…`
    : refreshing ? `Refreshing ${label}…` : "";
  if (!text) return null;
  return (
    <div role="status" className="flex min-h-8 items-center gap-2 text-sm text-slate-500">
      <span>{text}</span>
      {(failed || stale) && <Button variant="ghost" size="sm" onClick={retry}>Retry list</Button>}
    </div>
  );
}

export function DirectoryPresenceStatus({ pending, failed, ready, refreshing, retry }: {
  pending: boolean;
  failed: boolean;
  ready: boolean;
  refreshing: boolean;
  retry: () => void;
}) {
  const text = failed ? ready ? "Showing saved presence. Refresh failed." : "Presence could not be loaded."
    : pending ? "Loading presence…" : refreshing ? "Refreshing presence…" : "";
  if (!text) return null;
  return (
    <div role="status" className="flex min-h-8 items-center gap-2 text-sm text-slate-500">
      <span>{text}</span>
      {failed && <Button variant="ghost" size="sm" onClick={retry}>Retry presence</Button>}
    </div>
  );
}

export function DirectoryRowsSkeleton({ viewMode }: { viewMode: DirectoryViewMode }) {
  return (
    <div data-testid="directory-rows-skeleton" aria-hidden="true" className={viewMode === "list" ? "overflow-hidden rounded-2xl border border-slate-200 bg-white" : "grid grid-cols-1 gap-4 lg:grid-cols-2"}>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className={viewMode === "list" ? "flex h-[85px] items-center gap-5 border-b border-slate-100 px-6 last:border-0" : "h-[260px] space-y-6 rounded-2xl border border-slate-200 bg-white p-5"}>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-100" />
            <div className="space-y-2"><div className="h-4 w-32 rounded bg-slate-100" /><div className="h-3 w-20 rounded bg-slate-100" /></div>
          </div>
          <div className="h-3 w-28 rounded bg-slate-100" />
          <div className="h-3 w-36 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function DirectoryPageSkeleton({ directory }: { directory: "patients" | "drivers" | "employees" }) {
  const permissions = usePermissions();
  const canManageDrivers = permissions.canCreateDrivers || permissions.canEditDrivers || permissions.canDeleteDrivers;
  const canCreate = directory === "patients" ? permissions.canCreatePatients : directory === "drivers" ? permissions.canCreateDrivers : permissions.isAdmin;
  const title = directory === "patients" ? "Clients" : directory === "drivers" ? "Drivers" : "Employees";
  const description = directory === "patients" ? "Manage and view all client records"
    : directory === "drivers" ? canManageDrivers ? "Manage driver fleet and availability" : "View driver fleet and availability" : "Manage staff members and departments";
  const viewMode = directory === "patients" ? readSavedPatientsView() : "bento";
  const columns = directory === "employees" ? "md:grid-cols-5" : directory === "drivers" ? "md:grid-cols-3" : "md:grid-cols-4";
  const statCount = directory === "employees" ? 5 : directory === "drivers" ? 3 : 4;
  return (
    <div data-testid="directory-page-skeleton" className="space-y-6" aria-busy="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1"><h1 className="text-2xl font-semibold text-slate-900">{title}</h1><p className="text-sm text-slate-500">{description}</p></div>
        {canCreate && <div aria-hidden="true" className="h-9 w-full rounded-lg bg-slate-100 sm:w-28" />}
      </div>
      <div role="status" className="flex min-h-8 items-center text-sm text-slate-500">Loading {title.toLowerCase()}…</div>
      <div aria-hidden="true" className={`grid min-h-[106px] grid-cols-2 gap-8 rounded-2xl border border-slate-200 bg-white p-6 ${columns}`}>
        {Array.from({ length: statCount }, (_, index) => <div key={index} className="h-14 space-y-3"><div className="h-3 w-20 rounded bg-slate-100" /><div className="h-6 w-12 rounded bg-slate-100" /></div>)}
      </div>
      <div aria-hidden="true" className="flex flex-col gap-3 sm:flex-row">
        <div className="h-[46px] flex-1 rounded-lg border border-slate-200 bg-white" />
        {directory === "employees" && <div className="h-10 w-40 rounded-lg border border-slate-200 bg-white" />}
        <div className={directory === "employees" ? "h-10 w-[120px] rounded-lg border border-slate-200 bg-white" : "h-[42px] w-[130px] rounded-lg border border-slate-200 bg-white"} />
        <div className={directory === "employees" ? "h-10 rounded-lg border border-slate-200 bg-white sm:w-24" : "h-9 rounded-lg border border-slate-200 bg-white sm:w-24"} />
        <div className="h-11 rounded-lg border border-slate-200 bg-white sm:w-20" />
      </div>
      <div aria-hidden="true" className="h-[58px] rounded-xl border border-slate-200 bg-slate-50" />
      <DirectoryRowsSkeleton viewMode={viewMode} />
    </div>
  );
}
