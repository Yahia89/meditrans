export const STS_RESULTS = ["passed", "failed", "follow_up", "pending"] as const;
export type StsInspectionResult = (typeof STS_RESULTS)[number];

export const STS_RESULT_LABELS: Record<StsInspectionResult, string> = {
  passed: "Passed",
  failed: "Failed",
  follow_up: "Follow-up needed",
  pending: "Pending",
};

export interface MobileInspectionItem {
  key: string;
  label: string;
  status: "good" | "no_good" | null;
  explanation?: string;
}

export interface MobileInspectionPayload {
  id: string;
  driverId: string;
  date: string;
  dayOfWeek: string;
  driverInfo: {
    driverName: string;
    mndotNumber: string;
    make: string;
    model: string;
    year: string;
    licensePlate: string;
    mileage: string;
  };
  items: MobileInspectionItem[];
  submittedAt: string;
}

export interface StsInspection {
  id: string;
  org_id: string;
  driver_id: string;
  title: string;
  inspection_date: string;
  inspector_name: string;
  result: StsInspectionResult;
  reference: string | null;
  notes: string | null;
  next_due_date: string | null;
  report_file_path: string | null;
  report_filename: string | null;
  report_file_type: string | null;
  report_file_size: number | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  // Optional while pre-migration query caches still contain the old row shape.
  source?: "web_crm" | "mobile_app";
  source_record_id?: string | null;
  inspection_payload?: MobileInspectionPayload | null;
}

export function inspectionResultLabel(inspection: Pick<StsInspection, "source" | "result">) {
  return inspection.source === "mobile_app" && inspection.result === "pending"
    ? "Pending review" : STS_RESULT_LABELS[inspection.result];
}

export interface StsInspectionInput {
  title: string;
  inspection_date: string;
  inspector_name: string;
  result: StsInspectionResult;
  reference: string;
  notes: string;
  next_due_date: string;
}

export interface StsDriverOption {
  id: string;
  full_name: string;
  active: boolean | null;
}

export interface StsInspectionFilters {
  driverId: string;
  result: StsInspectionResult | "all";
  startDate: string;
  endDate: string;
  search: string;
}

export function filterStsInspections(
  records: StsInspection[],
  filters: StsInspectionFilters,
  driverNames: ReadonlyMap<string, string> = new Map(),
) {
  const search = filters.search.trim().toLocaleLowerCase();
  return records.filter((record) => {
    if (filters.driverId && record.driver_id !== filters.driverId) return false;
    if (filters.result !== "all" && record.result !== filters.result) return false;
    if (filters.startDate && record.inspection_date < filters.startDate) return false;
    if (filters.endDate && record.inspection_date > filters.endDate) return false;
    if (search && ![
      record.title, record.inspector_name, record.reference,
      driverNames.get(record.driver_id),
    ].some((value) => value?.toLocaleLowerCase().includes(search))) return false;
    return true;
  });
}

export function formatInspectionDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date)
    : value;
}
