import { Button } from "@/components/ui/button";

export function DirectoryTripTotalsStatus({
  ready,
  failed,
  retry,
}: {
  ready: boolean;
  failed: boolean;
  retry: () => void;
}) {
  if (ready) return null;
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-slate-500">
      <span>{failed ? "Trip totals could not be loaded." : "Trip totals are loading…"}</span>
      {failed && <Button variant="ghost" size="sm" onClick={retry}>Retry totals</Button>}
    </div>
  );
}
