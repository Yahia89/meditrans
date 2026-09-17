import { Loader2 } from "lucide-react";
import { STSInspectionPanel } from "@/features/sts-inspections/STSInspectionPanel";
import { useAuditAccess } from "@/hooks/useAuditAccess";
import { useTimezone } from "@/hooks/useTimezone";

export function STSInspectionPage({ onDriverClick }: { onDriverClick: (driverId: string) => void }) {
  const { canManageAudit, orgId, loading } = useAuditAccess();
  const timezone = useTimezone();

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label="Loading access" /></div>;
  if (!canManageAudit || !orgId) return <p className="p-6 text-sm text-slate-500">STS inspections are available to company owners and admins.</p>;

  return <div className="p-2 sm:p-4"><STSInspectionPanel orgId={orgId} canEdit timezone={timezone} onDriverClick={onDriverClick} /></div>;
}
