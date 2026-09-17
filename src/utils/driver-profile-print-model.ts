import { inspectionResultLabel, type StsInspection } from "../features/sts-inspections/types.ts";
import { buildMobileInspectionPrintRows } from "../features/sts-inspections/mobilePayload.ts";

export interface DriverPrintSections {
  basicInfo: boolean;
  tripCount: boolean;
  stsHistory: boolean;
}

export const DEFAULT_DRIVER_PRINT_SECTIONS: Readonly<DriverPrintSections> = {
  basicInfo: true,
  tripCount: true,
  stsHistory: true,
};

export function hasDriverPrintSections(sections: DriverPrintSections) {
  return sections.basicInfo || sections.tripCount || sections.stsHistory;
}

export interface DriverProfilePrintData {
  id: string;
  org_id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  county?: string | null;
  id_number?: string | null;
  license_number?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_info?: string | null;
  vehicle_color?: string | null;
  vehicle_type?: string | null;
  license_plate?: string | null;
  dot_medical_number?: string | null;
  dot_medical_expiration?: string | null;
  insurance_company?: string | null;
  insurance_policy_number?: string | null;
  insurance_start_date?: string | null;
  insurance_expiration_date?: string | null;
  inspection_date?: string | null;
  driver_record_issue_date?: string | null;
  driver_record_expiration?: string | null;
  npi?: string | null;
  umpi?: string | null;
  notes?: string | null;
  status?: string | null;
  active?: boolean;
  created_at?: string | null;
}

export type DriverPrintRow = [string, string];

export function buildDriverBasicPrintRows(
  driver: DriverProfilePrintData,
  formatDate: (value: string | null | undefined) => string,
): DriverPrintRow[] {
  const value = (text: string | null | undefined) => text?.trim() || "Not recorded";
  return [
    ["Phone", value(driver.phone)],
    ["Email", value(driver.email)],
    ["Address", value(driver.address)],
    ["County", value(driver.county)],
    ["Driver license", value(driver.id_number || driver.license_number)],
    ["Vehicle", value([driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(" ") || driver.vehicle_info)],
    ["Vehicle color", value(driver.vehicle_color)],
    ["Vehicle type", value(driver.vehicle_type?.replace(/_/g, " "))],
    ["License plate", value(driver.license_plate)],
    ["DOT medical number", value(driver.dot_medical_number)],
    ["DOT medical expiration", formatDate(driver.dot_medical_expiration)],
    ["Insurance company", value(driver.insurance_company)],
    ["Policy number", value(driver.insurance_policy_number)],
    ["Insurance start", formatDate(driver.insurance_start_date)],
    ["Insurance expiration", formatDate(driver.insurance_expiration_date)],
    ["Profile inspection date", formatDate(driver.inspection_date)],
    ["Driver record issued", formatDate(driver.driver_record_issue_date)],
    ["Driver record expiration", formatDate(driver.driver_record_expiration)],
    ["NPI", value(driver.npi)],
    ["UMPI", value(driver.umpi)],
    ["Status", value(driver.status?.replace(/_/g, " "))],
    ["System access", driver.active === false ? "Disabled" : driver.active === true ? "Enabled" : "Not recorded"],
    ["Member since", formatDate(driver.created_at)],
    ["Notes", value(driver.notes)],
  ];
}

export function buildDriverInspectionPrintRows(
  driver: Pick<DriverProfilePrintData, "id" | "org_id">,
  inspections: readonly StsInspection[] | undefined,
  formatDate: (value: string | null | undefined) => string,
  timezone = "UTC",
): { title: string; rows: DriverPrintRow[] }[] {
  if (!inspections) {
    throw new Error("STS inspection history is unavailable. Try again or deselect STS inspection history.");
  }
  if (inspections.some((inspection) => inspection.driver_id !== driver.id || inspection.org_id !== driver.org_id)) {
    throw new Error("The inspection history does not match the selected driver.");
  }
  if (!inspections.length) {
    return [{ title: "STS inspection history", rows: [["Recorded inspections", "No STS inspections recorded for this driver."]] }];
  }
  return [...inspections]
    .sort((a, b) => b.inspection_date.localeCompare(a.inspection_date) || b.created_at.localeCompare(a.created_at))
    .map((inspection) => ({
      title: `STS inspection - ${formatDate(inspection.inspection_date)}`,
      rows: [
        ["Title", inspection.title],
        ["Inspection date", formatDate(inspection.inspection_date)],
        ["Result", inspectionResultLabel(inspection)],
        ["Inspector", inspection.inspector_name?.trim() || "Not recorded"],
        ["Reference", inspection.reference?.trim() || "Not recorded"],
        ["Next due date", formatDate(inspection.next_due_date)],
        ["Notes", inspection.notes?.trim() || "No notes recorded"],
        ["Report file", inspection.report_filename || "Not attached"],
        ...buildMobileInspectionPrintRows(inspection, timezone),
      ] as DriverPrintRow[],
    }));
}
