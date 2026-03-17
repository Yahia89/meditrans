import { useState, useEffect, useRef } from "react";
import { Plus, Loader2, ShieldAlert, Trash, Upload } from "lucide-react";
import {
  FilePdf,
  FileDoc,
  FileXls,
  FileImage,
  FileText,
  Files,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  DownloadSimple,
} from "@phosphor-icons/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { useTimezone } from "@/hooks/useTimezone";
import { formatInUserTimezone } from "@/lib/timezone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface OrgDocument {
  id: string;
  file_path: string;
  file_type: string;
  original_filename: string;
  file_size: number;
  created_at: string;
  uploaded_by: string;
  document_label?: string;
  uploader_profile?: {
    full_name: string;
  };
}

interface DocumentManagerProps {
  ownerId: string;
  purpose: "patient_document" | "driver_document" | "employee_document";
  source: "patients" | "drivers" | "employees";
  onUploadSuccess?: () => void;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileKind(mime?: string | null, name?: string | null) {
  const lower = (name ?? "").toLowerCase();
  const m = (mime ?? "").toLowerCase();

  if (m.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (
    m.includes("image") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".heic")
  )
    return "image";
  if (
    m.includes("spreadsheet") ||
    m.includes("excel") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    m.includes("csv") ||
    lower.endsWith(".csv")
  )
    return "xls";
  if (
    m.includes("word") ||
    m.includes("officedocument.word") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".doc")
  )
    return "word";
  return "file";
}

function DocumentIcon({ kind }: { kind: string }) {
  const cls = "h-5 w-5";
  switch (kind) {
    case "image":
      return <FileImage className={cls} weight="duotone" />;
    case "pdf":
      return <FilePdf className={cls} weight="duotone" />;
    case "xls":
      return <FileXls className={cls} weight="duotone" />;
    case "word":
      return <FileDoc className={cls} weight="duotone" />;
    case "file":
      return <FileText className={cls} weight="duotone" />;
    default:
      return <Files className={cls} weight="duotone" />;
  }
}

function formatDate(dateStr: string | null, timezone: string) {
  if (!dateStr) return "Not specified";
  return formatInUserTimezone(dateStr, timezone, "MMMM d, yyyy");
}

interface DocumentPreviewProps {
  doc: OrgDocument | null;
  onClose: () => void;
  onDownload: (doc: OrgDocument) => void;
  activeTimezone: string;
}

function DocumentPreview({
  doc,
  onClose,
  onDownload,
  activeTimezone,
}: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!doc) {
      setSignedUrl(null);
      setZoom(100);
      return;
    }

    const fetchUrl = async () => {
      setIsLoading(true);
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 3600); // 1 hour
      setSignedUrl(data?.signedUrl || null);
      setIsLoading(false);
    };

    fetchUrl();
  }, [doc]);

  if (!doc) return null;

  const kind = getFileKind(doc.file_type, doc.original_filename);

  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[85dvh] sm:h-[85vh] p-0 overflow-hidden flex flex-col gap-0 rounded-2xl sm:rounded-[2rem] border-slate-200 shadow-2xl">
        <DialogHeader className="p-3 sm:p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl",
                  kind === "image"
                    ? "bg-indigo-50 text-indigo-600"
                    : kind === "pdf"
                      ? "bg-rose-50 text-rose-600"
                      : kind === "xls"
                        ? "bg-emerald-50 text-emerald-600"
                        : kind === "word"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-slate-50 text-slate-600",
                )}
              >
                <DocumentIcon kind={kind} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                  {doc.document_label || doc.original_filename}
                </DialogTitle>
                <DialogDescription className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">
                  {doc.document_label && (
                    <span className="text-slate-600 font-medium">{doc.original_filename} — </span>
                  )}
                  {formatBytes(doc.file_size)} • Uploaded{" "}
                  {formatDate(doc.created_at, activeTimezone)}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 mr-6 sm:mr-8 shrink-0">
              {kind === "image" && (
                <div className="hidden sm:flex items-center bg-slate-50 rounded-xl p-1 gap-1 border border-slate-200/60 mr-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setZoom((prev) => Math.max(25, prev - 25))}
                  >
                    <MagnifyingGlassMinus size={16} />
                  </Button>
                  <span className="text-[10px] font-bold text-slate-500 w-10 text-center">
                    {zoom}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setZoom((prev) => Math.min(400, prev + 25))}
                  >
                    <MagnifyingGlassPlus size={16} />
                  </Button>
                </div>
              )}
              <Button
                variant="outline"
                className="h-9 px-3 sm:px-4 rounded-xl gap-2 font-semibold text-xs border-slate-200"
                onClick={() => onDownload(doc)}
              >
                <DownloadSimple size={14} />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-slate-50 overflow-auto relative flex items-center justify-center p-3 sm:p-8">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              <p className="text-xs font-semibold text-slate-400">
                Loading preview...
              </p>
            </div>
          ) : signedUrl ? (
            <>
              {kind === "image" ? (
                <div
                  className="transition-all duration-200"
                  style={{ width: `${zoom}%`, maxWidth: "none" }}
                >
                  <img
                    src={signedUrl}
                    alt={doc.original_filename}
                    className="w-full h-auto rounded-xl shadow-lg border border-white"
                  />
                </div>
              ) : kind === "pdf" ? (
                <iframe
                  src={`${signedUrl}#view=FitH`}
                  className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-sm"
                  title={doc.original_filename}
                />
              ) : (
                <div className="flex flex-col items-center text-center max-w-sm">
                  <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center mb-6 border border-slate-100">
                    <DocumentIcon kind={kind} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No Preview Available
                  </h3>
                  <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                    This file type ({kind.toUpperCase()}) cannot be previewed
                    directly in the browser. Please download the file to view
                    its content.
                  </p>
                  <Button
                    size="lg"
                    className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white rounded-2xl px-12 font-bold shadow-lg gap-3"
                    onClick={() => onDownload(doc)}
                  >
                    <DownloadSimple size={20} weight="bold" />
                    Download Now
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ShieldAlert size={40} className="text-rose-200" />
              <p className="text-sm font-semibold text-slate-400">
                Failed to load preview URL
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentManager({
  ownerId,
  purpose,
  source,
  onUploadSuccess,
}: DocumentManagerProps) {
  const [docToDelete, setDocToDelete] = useState<OrgDocument | null>(null);
  const [docPreview, setDocPreview] = useState<OrgDocument | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [documentLabel, setDocumentLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [labelError, setLabelError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentOrganization } = useOrganization();
  const { isAdmin, isOwner } = usePermissions();
  const activeTimezone = useTimezone();
  const queryClient = useQueryClient();

  const canManage = isAdmin || isOwner;

  // Reset upload dialog state
  const resetUploadDialog = () => {
    setUploadDialogOpen(false);
    setDocumentLabel("");
    setSelectedFile(null);
    setLabelError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Fetch documents
  const { data: documents, isLoading: isLoadingDocs } = useQuery({
    queryKey: ["documents", ownerId, purpose],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("org_uploads")
        .select(
          `
                    *,
                    uploader_profile:uploaded_by (
                        full_name
                    )
                `,
        )
        .eq("org_id", currentOrganization.id)
        .eq("purpose", purpose)
        .eq("notes", ownerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as OrgDocument[];
    },
    enabled: !!ownerId && !!currentOrganization,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, label }: { file: File; label: string }) => {
      if (!currentOrganization) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${ownerId}/${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const filePath = `${currentOrganization.id}/${source}/${fileName}`;

      // 1. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Create record in org_uploads
      const { data: authUser } = await supabase.auth.getUser();
      const { error: dbError } = await supabase.from("org_uploads").insert({
        org_id: currentOrganization.id,
        file_path: filePath,
        file_type: file.type,
        source: source,
        purpose: purpose,
        notes: ownerId, // Store entity ID in notes
        original_filename: file.name,
        document_label: label.trim(),
        status: "committed",
        file_size: file.size,
        uploaded_by: authUser.user?.id,
      });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["documents", ownerId, purpose],
      });
      resetUploadDialog();
      onUploadSuccess?.();
    },
    onError: (error: any) => {
      console.error("Upload failed:", error);
      alert(`Failed to upload document: ${error.message || "Unknown error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: OrgDocument) => {
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("org_uploads")
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["documents", ownerId, purpose],
      });
    },
  });

  const handleDownload = async (doc: OrgDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 60, {
          download: doc.original_filename,
        });

      if (error) throw error;
      if (data?.signedUrl) {
        const link = document.createElement("a");
        link.href = data.signedUrl;
        link.download = doc.original_filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to generate download link");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadSubmit = () => {
    const trimmed = documentLabel.trim();
    if (!trimmed) {
      setLabelError("Please describe what you are uploading.");
      return;
    }
    if (trimmed.length < 3) {
      setLabelError("Description must be at least 3 characters.");
      return;
    }
    if (!selectedFile) {
      setLabelError("Please select a file to upload.");
      return;
    }
    setLabelError("");
    uploadMutation.mutate({ file: selectedFile, label: trimmed });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 capitalize">
            {source.replace("s", "")} Documents
          </h3>
          {canManage && (
            <Button
              size="sm"
              className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white gap-2 rounded-xl"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Plus size={16} />
              Upload
            </Button>
          )}
        </div>
        <div className="p-3 sm:p-6 space-y-2 sm:space-y-3">
          {isLoadingDocs ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-200" />
            </div>
          ) : documents && documents.length > 0 ? (
            documents.map((doc) => {
              const kind = getFileKind(doc.file_type, doc.original_filename);
              return (
                <div
                  key={doc.id}
                  onClick={() => setDocPreview(doc)}
                  className="group flex items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200/60 bg-white p-2.5 sm:p-3.5 transition-all duration-200 hover:border-slate-300 hover:shadow-sm cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-slate-200/60 bg-slate-50 transition-colors group-hover:bg-slate-100">
                      <div
                        className={cn(
                          kind === "image"
                            ? "text-indigo-600"
                            : kind === "pdf"
                              ? "text-rose-600"
                              : kind === "xls"
                                ? "text-emerald-600"
                                : kind === "word"
                                  ? "text-blue-600"
                                  : "text-slate-600",
                        )}
                      >
                        <DocumentIcon kind={kind} />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {doc.document_label || doc.original_filename || doc.file_path.split("/").pop()}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {doc.document_label && (
                            <span className="normal-case text-slate-500 hidden sm:inline">
                              {doc.original_filename} —{" "}
                            </span>
                          )}
                          {formatDate(doc.created_at, activeTimezone)}
                          <span className="normal-case hidden sm:inline">
                            {" "}
                            — {formatBytes(doc.file_size)} •{" "}
                            {doc.uploader_profile?.full_name || "System"}
                          </span>
                        </p>
                        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                            Click to view
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex shrink-0 items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl text-slate-400 transition-colors hover:bg-slate-50"
                      title="Download"
                      onClick={() => handleDownload(doc)}
                    >
                      <DownloadSimple size={16} />
                    </Button>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        title="Delete"
                        onClick={() => setDocToDelete(doc)}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending &&
                        docToDelete?.id === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash size={16} />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 sm:p-12 text-center bg-slate-50/50 rounded-xl sm:rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <FileText className="text-slate-300" size={24} />
              </div>
              <p className="text-slate-500 text-sm font-medium">
                No documents uploaded yet.
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Uploaded files will appear here.
              </p>
            </div>
          )}
        </div>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
          if (!open) resetUploadDialog();
        }}>
          <DialogContent className="sm:max-w-md rounded-2xl sm:rounded-[2rem] border-slate-200 shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="p-4 sm:p-6 pb-2">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3D5A3D]/10">
                  <Upload className="h-5 w-5 text-[#3D5A3D]" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-slate-900">
                    Upload Document
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 mt-0.5">
                    Describe the document before uploading.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3 sm:space-y-4">
              {/* Document Label (Required) */}
              <div className="space-y-2">
                <Label htmlFor="document-label" className="text-sm font-semibold text-slate-700">
                  Document Description <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="document-label"
                  placeholder="e.g. Driver's License, Insurance Card, Medical Record..."
                  value={documentLabel}
                  onChange={(e) => {
                    setDocumentLabel(e.target.value);
                    if (labelError) setLabelError("");
                  }}
                  className={cn(
                    "rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors",
                    labelError && "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                  )}
                  maxLength={120}
                  autoFocus
                />
                {labelError && (
                  <p className="text-xs font-medium text-rose-500 flex items-center gap-1.5">
                    <ShieldAlert size={12} />
                    {labelError}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 font-medium">
                  {documentLabel.trim().length}/120 characters
                </p>
              </div>

              {/* File Picker */}
              <div className="space-y-2">
                <Label htmlFor="document-file" className="text-sm font-semibold text-slate-700">
                  Select File <span className="text-rose-500">*</span>
                </Label>
                <div
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 sm:p-6 transition-all cursor-pointer",
                    selectedFile
                      ? "border-[#3D5A3D]/30 bg-[#3D5A3D]/5"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    id="document-file"
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp,.heic"
                  />
                  {selectedFile ? (
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200/60">
                        <DocumentIcon kind={getFileKind(selectedFile.type, selectedFile.name)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {formatBytes(selectedFile.size)} — Click to change
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-2 shadow-sm border border-slate-100">
                        <Plus size={18} className="text-slate-400" />
                      </div>
                      <p className="text-xs font-semibold text-slate-600">Click to select a file</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        PDF, DOC, XLS, CSV, JPG, PNG, HEIC • Max 10MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-2 sm:gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl border-slate-200 font-semibold"
                  onClick={resetUploadDialog}
                  disabled={uploadMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white font-semibold gap-1.5 sm:gap-2 text-xs sm:text-sm"
                  onClick={handleUploadSubmit}
                  disabled={uploadMutation.isPending || !documentLabel.trim() || !selectedFile}
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Upload Document
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Shared UI Components */}
        <DocumentPreview
          doc={docPreview}
          onClose={() => setDocPreview(null)}
          onDownload={handleDownload}
          activeTimezone={activeTimezone}
        />

        <DeleteConfirmationDialog
          open={!!docToDelete}
          onOpenChange={(open) => !open && setDocToDelete(null)}
          onConfirm={() => {
            if (docToDelete) {
              deleteMutation.mutate(docToDelete, {
                onSettled: () => setDocToDelete(null),
              });
            }
          }}
          title="Delete document?"
          description="This will permanently remove"
          itemName={docToDelete?.original_filename || "this file"}
          isDeleting={deleteMutation.isPending}
        />
      </div>
    </div>
  );
}
