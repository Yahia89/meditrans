import { billingDb } from "./client";
import { billingDocumentResponseSchema } from "../types/responses";
import { supabase } from "@/lib/supabase";
import type { BillingDocument } from "../types/billing";
import { billingFileContentType, billingFileExtension, validateBillingFile } from "../utils/documents";

const uploadAttempts = new WeakMap<File, Map<string, string>>();

export async function uploadBillingDocument(params: {
  orgId: string;
  recordId?: string | null;
  paymentId?: string | null;
  file: File;
  documentType: BillingDocument["document_type"];
  notes?: string;
}): Promise<BillingDocument> {
  const validationError = validateBillingFile(params.file);
  if (validationError) throw new Error(validationError);
  const ownerId = params.recordId || params.paymentId;
  if (!ownerId) throw new Error("Save the billing record before attaching files.");

  const target = `${params.orgId}/${ownerId}`;
  let attempts = uploadAttempts.get(params.file);
  if (!attempts) {
    attempts = new Map();
    uploadAttempts.set(params.file, attempts);
  }
  const documentId = attempts.get(target) || crypto.randomUUID();
  attempts.set(target, documentId);
  const storagePath = `${target}/${documentId}.${billingFileExtension(params.file)}`;
  const bucket = supabase.storage.from("billing-documents");

  const { error: uploadError } = await bucket.upload(storagePath, params.file, {
    cacheControl: "3600",
    contentType: billingFileContentType(params.file),
    upsert: false,
  });

  // A previous attempt may have reached Storage before its response was lost.
  if (uploadError) {
    const status = "statusCode" in uploadError ? String(uploadError.statusCode) : "";
    const alreadyUploaded = status === "409" || (status === "400" && /already exists/i.test(uploadError.message));
    if (!alreadyUploaded) throw uploadError;
  }

  const { data, error: dbError } = await billingDb
    .from("billing_documents")
    .insert({
      id: documentId,
      org_id: params.orgId,
      record_id: params.recordId || null,
      payment_id: params.paymentId || null,
      storage_path: storagePath,
      file_name: params.file.name,
      file_size: params.file.size,
      mime_type: billingFileContentType(params.file),
      document_type: params.documentType,
      notes: params.notes || null,
    })
    .select()
    .single();

  if (!dbError) return billingDocumentResponseSchema.parse(data);

  // Confirm whether metadata committed before cleanup: a lost response must not
  // cause us to remove a file already attached to a financial record.
  const { data: existing, error: lookupError } = await billingDb
    .from("billing_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (existing) return billingDocumentResponseSchema.parse(existing);
  if (!lookupError) {
    const { error: cleanupError } = await bucket.remove([storagePath]);
    if (cleanupError) console.error("Could not clean up an unattached billing file", cleanupError.message);
  }
  throw dbError;
}

export async function uploadBillingFiles(params: {
  orgId: string;
  recordId: string;
  files: File[];
  documentType?: BillingDocument["document_type"];
}): Promise<{ uploadedCount: number; failedFiles: File[]; errors: string[] }> {
  const failedFiles: File[] = [];
  const errors: string[] = [];
  for (const file of params.files) {
    try {
      await uploadBillingDocument({ ...params, file, documentType: params.documentType ?? "other" });
    } catch (error) {
      failedFiles.push(file);
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Upload failed";
      errors.push(`${file.name}: ${message}`);
    }
  }
  return { uploadedCount: params.files.length - failedFiles.length, failedFiles, errors };
}

export async function getSignedDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("billing-documents")
    .createSignedUrl(storagePath, 300, { download: true });

  if (error || !data?.signedUrl) throw error || new Error("Failed to generate signed download URL");
  return data.signedUrl;
}
