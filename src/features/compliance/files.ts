import { supabase } from "@/lib/supabase";
import { complianceFilePath, inspectComplianceFile } from "./fileValidation";
export { COMPLIANCE_FILE_ACCEPT, validateComplianceFile } from "./fileValidation";

const BUCKET = "compliance-documents";
export interface ComplianceFileMetadata {
  file_path: string;
  original_filename: string;
  file_type: string;
  file_size: number;
}

export async function uploadComplianceFile({ orgId, kind, recordId, file }: {
  orgId: string; kind: "company" | "sts"; recordId: string; file: File;
}): Promise<ComplianceFileMetadata> {
  const { mimeType, extension } = await inspectComplianceFile(file);
  const path = complianceFilePath(orgId, kind, recordId, crypto.randomUUID(), extension);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: mimeType, upsert: false, cacheControl: "0",
  });
  if (error) throw error;
  return { file_path: path, original_filename: file.name, file_type: mimeType, file_size: file.size };
}

export async function removeComplianceFile(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

async function imageAsPdf(blob: Blob, name: string) {
  const { jsPDF } = await import("jspdf");
  const source = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 4096 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser could not prepare the image for printing.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? "landscape" : "portrait", format: "a4" });
    pdf.setProperties({ title: name });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min((pageWidth - 20) / canvas.width, (pageHeight - 20) / canvas.height);
    const width = canvas.width * ratio;
    const height = canvas.height * ratio;
    pdf.addImage(canvas.toDataURL("image/jpeg", .94), "JPEG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height);
    return pdf.output("blob");
  } finally { URL.revokeObjectURL(source); }
}

/** Authenticated download: no public URLs or persistent signed links. */
export async function openComplianceFile({ filePath, fileName, mode }: {
  filePath: string; fileName: string; mode: "view" | "print" | "download";
}) {
  const preview = mode === "download" ? null : window.open("about:blank", "_blank");
  if (mode !== "download" && !preview) throw new Error("Allow pop-ups for this site to view or print the document.");
  if (preview) {
    preview.opener = null;
    preview.document.title = fileName;
    preview.document.body.textContent = "Preparing your document…";
  }
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(filePath);
    if (error || !data) throw error ?? new Error("The document could not be downloaded.");
    const blob = mode === "print" && data.type.startsWith("image/") ? await imageAsPdf(data, fileName) : data;
    const url = URL.createObjectURL(blob);
    if (preview) {
      if (preview.closed) { URL.revokeObjectURL(url); return; }
      preview.location.replace(`${url}${blob.type === "application/pdf" ? "#toolbar=1" : ""}`);
      // PDF viewers provide their own print control. Keep the source alive while open.
      const timer = window.setInterval(() => {
        if (preview.closed) { URL.revokeObjectURL(url); window.clearInterval(timer); }
      }, 1000);
    } else {
      const link = document.createElement("a");
      link.href = url; link.download = fileName; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } catch (error) {
    preview?.close();
    throw error;
  }
}
