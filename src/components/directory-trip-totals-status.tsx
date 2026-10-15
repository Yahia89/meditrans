import { Button } from "@/components/ui/button";

export function DirectoryTripTotalsStatus({
  ready,
  failed,
  refreshing = false,
  retry,
}: {
  ready: boolean;
  failed: boolean;
  refreshing?: boolean;
  retry: () => void;
}) {
  return (
    <div role="status" className="flex min-h-8 items-center gap-2 text-sm text-slate-500">
      <span>{failed ? ready ? "Showing saved trip totals. Refresh failed." : "Trip totals could not be loaded."
        : ready ? refreshing ? "Refreshing trip totals…" : "" : "Trip totals are loading…"}</span>
      {failed && <Button variant="ghost" size="sm" onClick={retry}>Retry totals</Button>}
    </div>
  );
}
