import { billingDb } from "./client";
import { billingDocumentResponseSchema } from "../types/responses";
import { supabase } from "@/lib/supabase";
import type { BillingDocument } from "../types/billing";

export async function uploadBillingDocument(params: {
  orgId: string;
  recordId?: string | null;
  paymentId?: string | null;
  file: File;
  documentType: BillingDocument["document_type"];
  notes?: string;
}): Promise<BillingDocument> {
  const fileExt = params.file.name.split(".").pop();
  const safeUniqueId = crypto.randomUUID();
  const storagePath = `${params.orgId}/${params.recordId || params.paymentId || "general"}/${safeUniqueId}.${fileExt}`;

  // 1. Upload to private bucket
  const { error: uploadError } = await supabase.storage
    .from("billing-documents")
    .upload(storagePath, params.file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw uploadError;
  }

  // 2. Save metadata in billing_documents
  const { data, error: dbError } = await billingDb
    .from("billing_documents")
    .insert({
      org_id: params.orgId,
      record_id: params.recordId || null,
      payment_id: params.paymentId || null,
      storage_path: storagePath,
      file_name: params.file.name,
      file_size: params.file.size,
      mime_type: params.file.type || "application/octet-stream",
      document_type: params.documentType,
      notes: params.notes || null,
    })
    .select()
    .single();

  if (dbError) {
    console.error("DB insert error for document metadata:", dbError);
    throw dbError;
  }

  return billingDocumentResponseSchema.parse(data);
}

export async function getSignedDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("billing-documents")
    .createSignedUrl(storagePath, 300); // 5-minute expiring URL

  if (error || !data?.signedUrl) {
    console.error("Error creating signed URL:", error);
    throw error || new Error("Failed to generate signed download URL");
  }

  return data.signedUrl;
}
