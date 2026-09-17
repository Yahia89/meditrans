import type { ComplianceFileMetadata } from "@/features/compliance/files";

export interface CompanyDocument extends ComplianceFileMetadata {
  id: string;
  org_id: string;
  title: string;
  label: string;
  notes: string | null;
  audit_year: number | null;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export interface CompanyDocumentDetails {
  title: string;
  label: string;
  notes: string;
  audit_year: string;
}

export function prepareCompanyDocumentDetails(input: CompanyDocumentDetails) {
  const title = input.title.trim();
  const label = input.label.trim();
  const notes = input.notes.trim();
  if (!title || title.length > 200) throw new Error("Enter a document title of 1–200 characters.");
  if (!label || label.length > 100) throw new Error("Enter a label of 1–100 characters.");
  if (notes.length > 10000) throw new Error("Notes must be 10,000 characters or fewer.");
  const auditYear = input.audit_year.trim();
  if (auditYear && (!/^\d{4}$/.test(auditYear) || Number(auditYear) < 2000 || Number(auditYear) > 2100)) {
    throw new Error("Enter an audit year from 2000 to 2100, or leave it blank.");
  }
  return { title, label, notes: notes || null, audit_year: auditYear ? Number(auditYear) : null };
}
