export const BILLING_FILE_MAX_BYTES = 20 * 1024 * 1024;

const mimeTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  csv: "text/csv",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const BILLING_FILE_ACCEPT = Object.keys(mimeTypesByExtension).map((extension) => `.${extension}`).join(",");

export function billingFileExtension(file: Pick<File, "name">): string {
  return file.name.split(".").pop()?.toLowerCase() || "";
}

export function billingFileContentType(file: Pick<File, "name">): string {
  return mimeTypesByExtension[billingFileExtension(file)];
}

export function validateBillingFile(file: Pick<File, "name" | "size" | "type">): string | null {
  const extension = billingFileExtension(file);
  const contentType = mimeTypesByExtension[extension];
  if (!contentType) return "Choose a PDF, image (PNG, JPEG or WebP), Word, Excel, CSV or text file.";
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > BILLING_FILE_MAX_BYTES) return `${file.name} exceeds the 20 MB limit.`;
  // Browsers sometimes report CSV as Excel and Office files as binary/ZIP.
  const alternateType = (extension === "csv" && ["application/vnd.ms-excel", "text/plain"].includes(file.type))
    || (["docx", "xlsx"].includes(extension) && file.type === "application/zip");
  if (file.type && file.type !== "application/octet-stream" && file.type !== contentType && !alternateType) {
    return `${file.name} has a file type that does not match its extension.`;
  }
  return null;
}
