import { supabase } from "@/lib/supabase";
import { removeComplianceFile, uploadComplianceFile } from "@/features/compliance/files";
import { prepareCompanyDocumentDetails, type CompanyDocument, type CompanyDocumentDetails } from "./types";

export async function fetchCompanyDocuments(orgId: string): Promise<CompanyDocument[]> {
  const result: CompanyDocument[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("company_documents").select("*")
      .eq("org_id", orgId).order("created_at", { ascending: false }).order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    result.push(...(data as CompanyDocument[]));
    if (data.length < 500) return result;
  }
}

export async function saveCompanyDocument({ orgId, details, file, existing }: {
  orgId: string; details: CompanyDocumentDetails; file: File | null; existing?: CompanyDocument;
}) {
  const fields = prepareCompanyDocumentDetails(details);
  if (existing) {
    if (existing.org_id !== orgId) throw new Error("This document belongs to a different company.");
    const { data, error } = await supabase.from("company_documents").update(fields)
      .eq("org_id", orgId).eq("id", existing.id).eq("updated_at", existing.updated_at)
      .select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("This document changed or your access expired. Refresh the list before editing again.");
    return;
  }
  if (!file) throw new Error("Choose the document to upload.");
  const id = crypto.randomUUID();
  const uploaded = await uploadComplianceFile({ orgId, kind: "company", recordId: id, file });
  const { error } = await supabase.from("company_documents").insert({ id, org_id: orgId, ...fields, ...uploaded });
  if (error) {
    try { await removeComplianceFile(uploaded.file_path); }
    catch { throw new Error("Document details could not be saved, and the private upload could not be removed. Contact your administrator before retrying."); }
    throw error;
  }
}
