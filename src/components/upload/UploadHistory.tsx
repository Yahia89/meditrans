import * as React from "react";
import {
  Files,
  FileXls,
  FilePdf,
  FileText,
  CircleNotch,
  Trash,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useUploadHistory } from "@/hooks/use-upload-history";
import type { UploadRecord } from "./types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ITEMS_PER_PAGE = 4;

function formatDateTime(value: string) {
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getFileKind(mime?: string | null, name?: string | null) {
  const lower = (name ?? "").toLowerCase();
  const m = (mime ?? "").toLowerCase();

  if (m.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (
    m.includes("spreadsheet") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls")
  )
    return "xls";
  if (m.includes("csv") || lower.endsWith(".csv")) return "csv";
  return "file";
}

function FileIcon({ kind }: { kind: "pdf" | "xls" | "csv" | "file" }) {
  const cls = "h-5 w-5";
  switch (kind) {
    case "pdf":
      return <FilePdf className={cls} weight="duotone" />;
    case "xls":
      return <FileXls className={cls} weight="duotone" />;
    case "csv":
      return <FileText className={cls} weight="duotone" />;
    default:
      return <Files className={cls} weight="duotone" />;
  }
}

function statusLabel(status?: string | null) {
  if (!status) return "unknown";
  const s = String(status).toLowerCase();
  if (s === "ready_for_review") return "Review Pending";
  return s.charAt(0).toUpperCase() + s.slice(1).replaceAll("_", " ");
}

function sourceLabel(source?: string | null) {
  if (!source) return "unknown";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function UploadHistory() {
  const { recentUploads, isLoading, deleteUpload, isDeleting } =
    useUploadHistory();

  // Local state
  const [currentPage, setCurrentPage] = React.useState(0);
  const [uploadToDelete, setUploadToDelete] =
    React.useState<UploadRecord | null>(null);

  const uploads = (recentUploads ?? []) as UploadRecord[];

  // Keep pagination sane if list length changes (e.g., after delete)
  React.useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(uploads.length / ITEMS_PER_PAGE) - 1);
    setCurrentPage((p) => Math.min(p, maxPage));
  }, [uploads.length]);

  const totalPages = React.useMemo(
    () => Math.max(1, Math.ceil(uploads.length / ITEMS_PER_PAGE)),
    [uploads.length]
  );

  const currentData = React.useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE;
    return uploads.slice(start, start + ITEMS_PER_PAGE);
  }, [uploads, currentPage]);

  const handleConfirmDelete = React.useCallback(() => {
    if (!uploadToDelete) return;
    deleteUpload(uploadToDelete);
    setUploadToDelete(null);
  }, [deleteUpload, uploadToDelete]);

  const showInitialLoader = isLoading && uploads.length === 0;
  if (showInitialLoader) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-8 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-center gap-3">
          <CircleNotch className="h-5 w-5 animate-spin text-slate-500" />
          <p className="text-xs font-semibold text-slate-500">
            Loading upload history…
          </p>
        </div>
      </div>
    );
  }

  if (uploads.length === 0) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-4 space-y-4 duration-500">
      <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur-sm transition-shadow duration-300 hover:shadow-md">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50">
              <Files className="h-5 w-5 text-slate-700" weight="duotone" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Recent Uploads
              </h3>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Import history
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CircleNotch className="h-4 w-4 animate-spin" />
              Syncing…
            </div>
          ) : null}
        </div>

        {/* List */}
        <div className="min-h-[220px] space-y-3">
          {currentData.map((upload) => {
            const name = upload.original_filename ?? "Untitled file";
            const kind = getFileKind(
              upload.mime_type,
              upload.original_filename
            );
            const bytes = formatBytes(upload.file_size);
            const metaLeft = formatDateTime(upload.created_at);
            const uploaderName =
              upload.committed_by_profile?.full_name ||
              upload.uploaded_by_profile?.full_name;

            const metaRight = [
              bytes,
              sourceLabel(upload.source),
              statusLabel(upload.status),
              uploaderName ? `by ${uploaderName}` : null,
            ]
              .filter(Boolean)
              .join(" • ");

            return (
              <div
                key={upload.id}
                className="group flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white p-3.5 transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50 transition-colors group-hover:bg-slate-100">
                    <div
                      className={
                        kind === "pdf"
                          ? "text-rose-600"
                          : kind === "xls"
                          ? "text-emerald-600"
                          : kind === "csv"
                          ? "text-sky-600"
                          : "text-slate-700"
                      }
                    >
                      <FileIcon kind={kind as any} />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900">
                      {name}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {metaLeft}
                      {metaRight ? (
                        <span className="normal-case"> — {metaRight}</span>
                      ) : null}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    onClick={() => setUploadToDelete(upload)}
                    disabled={isDeleting}
                    aria-label={`Delete ${name}`}
                    title="Delete"
                  >
                    <Trash weight="bold" className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {uploads.length > ITEMS_PER_PAGE ? (
          <div className="mt-6 flex items-center justify-between border-t border-slate-200/60 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Page {currentPage + 1} of {totalPages}
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                aria-label="Previous page"
              >
                <CaretLeft weight="bold" className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                disabled={currentPage >= totalPages - 1}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                }
                aria-label="Next page"
              >
                <CaretRight weight="bold" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Delete dialog */}
      <AlertDialog
        open={!!uploadToDelete}
        onOpenChange={(open) => !open && setUploadToDelete(null)}
      >
        <AlertDialogContent className="rounded-[1.5rem] border-slate-200 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-slate-900">
              Delete upload?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              This will permanently remove{" "}
              <strong className="text-slate-900">
                {uploadToDelete?.original_filename ?? "this file"}
              </strong>{" "}
              and any related staging rows that haven’t been committed.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-2 gap-3">
            <AlertDialogCancel className="h-11 rounded-xl font-semibold">
              Keep
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="h-11 rounded-xl bg-rose-600 font-semibold hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
