import { supabase } from "@/lib/supabase";
import { removeComplianceFile, uploadComplianceFile } from "@/features/compliance/files";
import { STS_RESULTS, type StsDriverOption, type StsInspection, type StsInspectionInput } from "./types";

const PAGE_SIZE = 500;

export async function fetchStsInspections({ orgId, driverId }: { orgId: string; driverId?: string }) {
  const records: StsInspection[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase.from("driver_sts_inspections").select("*")
      .eq("org_id", orgId)
      .order("inspection_date", { ascending: false })
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (driverId) query = query.eq("driver_id", driverId);
    const { data, error } = await query;
    if (error) throw error;
    records.push(...(data as StsInspection[]));
    if (data.length < PAGE_SIZE) return records;
  }
}

export async function fetchStsDrivers(orgId: string) {
  const records: StsDriverOption[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("drivers")
      .select("id,full_name,active").eq("org_id", orgId)
      .order("full_name").order("id").range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    records.push(...(data as StsDriverOption[]));
    if (data.length < PAGE_SIZE) return records;
  }
}

export async function saveStsInspection({
  orgId, driverId, input, existing, report,
}: {
  orgId: string;
  driverId: string;
  input: StsInspectionInput;
  existing?: StsInspection;
  report?: File | null;
}): Promise<{ inspection: StsInspection; cleanupWarning: boolean }> {
  const id = existing?.id ?? crypto.randomUUID();
  if (!input.title.trim() || !input.inspector_name.trim() || !input.inspection_date) {
    throw new Error("Title, inspection date, and inspector are required.");
  }
  if (input.title.trim().length > 200 || input.inspector_name.trim().length > 200 || input.reference.trim().length > 200 || input.notes.trim().length > 10000) {
    throw new Error("Title, inspector, and reference must be 200 characters or fewer; notes must be 10,000 characters or fewer.");
  }
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.getUTCFullYear() > 0 && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDate(input.inspection_date) || (input.next_due_date && !validDate(input.next_due_date))) {
    throw new Error("Enter valid inspection and next due dates.");
  }
  if (!STS_RESULTS.includes(input.result)) throw new Error("Choose a valid inspection result.");
  if (input.next_due_date && input.next_due_date < input.inspection_date) {
    throw new Error("Next due date must be on or after the inspection date.");
  }
  if (existing && (existing.org_id !== orgId || existing.driver_id !== driverId)) {
    throw new Error("The inspection does not belong to this driver and company.");
  }
  if (existing?.source === "mobile_app" && input.inspection_date !== existing.inspection_date) {
    throw new Error("The inspection date recorded by the driver app cannot be changed.");
  }

  const upload = report ? await uploadComplianceFile({ orgId, kind: "sts", recordId: id, file: report }) : null;
  const values = {
    title: input.title.trim(), inspection_date: input.inspection_date,
    inspector_name: input.inspector_name.trim(), result: input.result,
    reference: input.reference.trim() || null, notes: input.notes.trim() || null,
    next_due_date: input.next_due_date || null,
    ...(upload ? {
      report_file_path: upload.file_path, report_filename: upload.original_filename,
      report_file_type: upload.file_type, report_file_size: upload.file_size,
    } : {}),
  };
  let inspection: StsInspection;
  try {
    const query = existing
      ? supabase.from("driver_sts_inspections").update(values).eq("id", id)
        .eq("org_id", orgId).eq("driver_id", driverId).eq("updated_at", existing.updated_at)
      : supabase.from("driver_sts_inspections").insert({ id, org_id: orgId, driver_id: driverId, ...values });
    const { data, error } = await query.select().single();
    if (error) {
      if (error.code === "PGRST116") throw new Error("This record changed. Refresh the history and try again.");
      throw error;
    }
    inspection = data as StsInspection;
  } catch (error) {
    if (upload) {
      try { await removeComplianceFile(upload.file_path); }
      catch (cleanupError) {
        console.warn("Could not remove unlinked STS report:", cleanupError);
        throw new Error("The inspection was not saved and its new report could not be removed. Please contact an administrator.");
      }
    }
    throw error;
  }

  let cleanupWarning = false;
  if (upload && existing?.report_file_path) {
    try { await removeComplianceFile(existing.report_file_path); }
    catch (error) { cleanupWarning = true; console.warn("Could not remove replaced STS report:", error); }
  }
  return { inspection, cleanupWarning };
}
