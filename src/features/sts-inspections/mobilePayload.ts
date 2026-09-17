import { formatInspectionDate, type MobileInspectionPayload, type StsInspection } from "./types.ts";

const driverFields = ["driverName", "mndotNumber", "make", "model", "year", "licensePlate", "mileage"] as const;
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Validate before rendering a saved JSON snapshot; never invent missing responses. */
export function readMobileInspectionPayload(inspection: StsInspection): MobileInspectionPayload | null {
  if (inspection.source !== "mobile_app") return null;
  const payload: unknown = inspection.inspection_payload;
  if (!isObject(payload) || !["id", "driverId", "date", "dayOfWeek", "submittedAt"].every((key) => typeof payload[key] === "string")) return null;
  if (payload.driverId !== inspection.driver_id || payload.id !== inspection.source_record_id) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date as string) || !Number.isFinite(Date.parse(payload.submittedAt as string))) return null;
  const originalDate = new Date(`${payload.date}T00:00:00Z`);
  if (!Number.isFinite(originalDate.getTime()) || originalDate.toISOString().slice(0, 10) !== payload.date) return null;
  const driverInfo = payload.driverInfo;
  if (!isObject(driverInfo) || !driverFields.every((key) => typeof driverInfo[key] === "string")) return null;
  if (!Array.isArray(payload.items) || !payload.items.length || !payload.items.every((item) =>
    isObject(item) && typeof item.key === "string" && typeof item.label === "string" &&
    (item.status === "good" || item.status === "no_good" || item.status === null) &&
    (item.explanation === undefined || typeof item.explanation === "string"),
  )) return null;
  return payload as unknown as MobileInspectionPayload;
}

export function mobileItemStatusLabel(status: MobileInspectionPayload["items"][number]["status"]) {
  return status === "good" ? "Good" : status === "no_good" ? "No Good" : "Not recorded";
}

export function buildMobileInspectionMetadataRows(payload: MobileInspectionPayload, timezone: string): [string, string][] {
  const value = (text: string) => text.trim() || "Not recorded";
  const submitted = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium", timeStyle: "short", timeZone: timezone,
  }).format(new Date(payload.submittedAt));
  return [
    ["Driver name at submission", value(payload.driverInfo.driverName)],
    ["Original inspection date", formatInspectionDate(payload.date)],
    ["Day", value(payload.dayOfWeek)],
    ["MNDOT number", value(payload.driverInfo.mndotNumber)],
    ["Vehicle make", value(payload.driverInfo.make)],
    ["Vehicle model", value(payload.driverInfo.model)],
    ["Vehicle year", value(payload.driverInfo.year)],
    ["License plate", value(payload.driverInfo.licensePlate)],
    ["Mileage", value(payload.driverInfo.mileage)],
    ["Driver submitted", `${submitted} (${timezone})`],
    ["App record ID", payload.id],
  ];
}

/** Shared by the inspection report and the selectable driver-profile STS section. */
export function buildMobileInspectionPrintRows(inspection: StsInspection, timezone: string): [string, string][] {
  if (inspection.source !== "mobile_app") return [];
  const payload = readMobileInspectionPayload(inspection);
  if (!payload) throw new Error("The original driver checklist is unavailable or invalid. Refresh the history before printing.");
  return [
    ["Source", "Driver app - original checklist"],
    ...buildMobileInspectionMetadataRows(payload, timezone),
    ...payload.items.map((item): [string, string] => [
      item.label,
      `${mobileItemStatusLabel(item.status)}${item.explanation ? `\n${item.explanation}` : ""}`,
    ]),
  ];
}
