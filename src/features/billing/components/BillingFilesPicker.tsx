import { useId, useRef } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BILLING_FILE_ACCEPT, validateBillingFile } from "../utils/documents";

interface BillingFilesPickerProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

export function BillingFilesPicker({ files, onFilesChange, disabled }: BillingFilesPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionId = useId();

  return (
    <div className="min-w-0 flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        multiple
        accept={BILLING_FILE_ACCEPT}
        disabled={disabled}
        aria-label="Choose billing files"
        aria-describedby={descriptionId}
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          const valid = selected.filter((file) => {
            const error = validateBillingFile(file);
            if (error) toast.error(error);
            return !error;
          });
          const next = [...files];
          for (const file of valid) {
            if (!next.some((existing) => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) {
              next.push(file);
            }
          }
          onFilesChange(next);
          event.target.value = "";
        }}
      />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()} className="min-h-11 sm:min-h-9">
        <Paperclip data-icon="inline-start" /> Attach files
      </Button>
      <p id={descriptionId} className="text-xs text-muted-foreground">PDF, images, Word, Excel, CSV or text · Up to 20 MB per file</p>
      {files.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Selected billing files">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-w-0 items-center gap-2 rounded-lg border p-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 break-all">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</span>
              <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Remove ${file.name}`} onClick={() => onFilesChange(files.filter((_, position) => position !== index))}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
