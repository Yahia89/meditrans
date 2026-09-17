import { Badge } from "@/components/ui/badge";
import { buildMobileInspectionMetadataRows, mobileItemStatusLabel, readMobileInspectionPayload } from "./mobilePayload";
import type { StsInspection } from "./types";

export function MobileInspectionSnapshot({ inspection, timezone }: { inspection: StsInspection; timezone: string }) {
  if (inspection.source !== "mobile_app") return null;
  const payload = readMobileInspectionPayload(inspection);
  if (!payload) return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">The original driver checklist could not be read. Refresh the history before reviewing or printing this inspection.</p>;

  return <section aria-label="Original driver checklist" className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div>
      <h3 className="font-semibold text-slate-900">Driver app checklist</h3>
      <p className="mt-1 text-sm text-slate-500">Original driver responses are read-only. Review details below can be updated separately.</p>
    </div>
    <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
      {buildMobileInspectionMetadataRows(payload, timezone).map(([label, value]) => <div key={label} className="min-w-0">
        <dt className="text-xs font-medium text-slate-500">{label}</dt>
        <dd className="mt-1 break-words text-sm text-slate-900">{value}</dd>
      </div>)}
    </dl>
    <div className="space-y-2">
      {payload.items.map((item, index) => <div key={`${item.key}:${index}`} className="rounded-lg border bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-medium text-slate-900">{item.label}</span>
          <Badge variant="outline" className={item.status === "no_good" ? "shrink-0 border-red-200 bg-red-50 text-red-800" : item.status === "good" ? "shrink-0 border-emerald-200 bg-emerald-50 text-emerald-800" : "shrink-0"}>{mobileItemStatusLabel(item.status)}</Badge>
        </div>
        {item.explanation && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{item.explanation}</p>}
      </div>)}
    </div>
  </section>;
}
