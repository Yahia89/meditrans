export const COMPLIANCE_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";
export const MAX_COMPLIANCE_FILE_SIZE = 20 * 1024 * 1024;

export async function inspectComplianceFile(file: File) {
  if (!file.size) throw new Error("Choose a file that is not empty.");
  if (file.size > MAX_COMPLIANCE_FILE_SIZE) throw new Error("Files must be 20 MB or smaller.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = new TextDecoder("ascii").decode(bytes);
  const extension = file.name.split(".").pop()?.toLowerCase();
  const detected = text.startsWith("%PDF-") ? "application/pdf"
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "image/jpeg"
    : [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte) ? "image/png"
    : text.startsWith("RIFF") && text.slice(8, 12) === "WEBP" ? "image/webp" : null;
  const extensions: Record<string, string[]> = {
    "application/pdf": ["pdf"], "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"], "image/webp": ["webp"],
  };
  if (!detected || !extension || !extensions[detected].includes(extension) ||
      (file.type && file.type !== detected)) {
    throw new Error("Choose a valid PDF, JPEG, PNG, or WebP file with the matching file extension.");
  }
  return { mimeType: detected, extension };
}

export async function validateComplianceFile(file: File): Promise<void> {
  await inspectComplianceFile(file);
}

export function complianceFilePath(orgId: string, kind: "company" | "sts", recordId: string, fileId: string, extension: string) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (![orgId, recordId, fileId].every((id) => uuid.test(id)) || !["pdf", "jpg", "jpeg", "png", "webp"].includes(extension)) {
    throw new Error("The document could not be assigned a secure storage location.");
  }
  return `${orgId}/${kind}/${recordId}/${fileId}.${extension}`;
}
