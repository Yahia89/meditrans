import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Download, FileText, Loader2, Pencil, Plus, Printer, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useAuditAccess } from "@/hooks/useAuditAccess";
import { useTimezone } from "@/hooks/useTimezone";
import { formatInUserTimezone } from "@/lib/timezone";
import { fetchCompanyDocuments, saveCompanyDocument } from "@/features/company/api";
import type { CompanyDocument, CompanyDocumentDetails } from "@/features/company/types";
import { COMPLIANCE_FILE_ACCEPT, openComplianceFile } from "@/features/compliance/files";

const emptyDetails: CompanyDocumentDetails = { title: "", label: "", notes: "", audit_year: "" };
const message = (error: unknown) => error instanceof Error ? error.message : "The document could not be saved. Try again.";

function CompanyDocumentEditor({ orgId, existing, onClose }: {
  orgId: string; existing?: CompanyDocument; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [details, setDetails] = useState<CompanyDocumentDetails>(existing ? {
    title: existing.title, label: existing.label, notes: existing.notes ?? "", audit_year: existing.audit_year?.toString() ?? "",
  } : emptyDetails);
  const [file, setFile] = useState<File | null>(null);
  const mutation = useMutation({
    mutationFn: () => saveCompanyDocument({ orgId, details, existing, file }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["company-documents", orgId] });
      toast.success(existing ? "Document details updated" : "Document uploaded"); onClose();
    },
  });
  const update = (key: keyof CompanyDocumentDetails, value: string) => setDetails((prev) => ({ ...prev, [key]: value }));
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent className="sm:max-w-xl overflow-y-auto" showCloseButton={!mutation.isPending}>
      <DialogHeader><DialogTitle>{existing ? "Edit document details" : "Upload company document"}</DialogTitle>
        <DialogDescription>Organize a document for your company records and yearly audit.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <div className="space-y-2"><Label htmlFor="company-title">Title</Label><Input id="company-title" required maxLength={200} value={details.title} onChange={(e) => update("title", e.target.value)} placeholder="For example, certificate of insurance" /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="company-label">Label</Label><Input id="company-label" required maxLength={100} value={details.label} onChange={(e) => update("label", e.target.value)} placeholder="For example, Insurance" /></div>
          <div className="space-y-2"><Label htmlFor="company-year">Audit year <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="company-year" type="number" min={2000} max={2100} value={details.audit_year} onChange={(e) => update("audit_year", e.target.value)} placeholder={String(new Date().getFullYear())} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="company-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="company-notes" maxLength={10000} rows={3} value={details.notes} onChange={(e) => update("notes", e.target.value)} /></div>
        {!existing && <div className="space-y-2"><Label htmlFor="company-file">Document</Label><Input id="company-file" type="file" accept={COMPLIANCE_FILE_ACCEPT} required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">PDF, JPEG, PNG, or WebP. Up to 20 MB. Only company owners and admins can access these files.</p></div>}
        {existing && <p className="break-all text-sm text-muted-foreground">Original file: {existing.original_filename}</p>}
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{message(mutation.error)}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="size-4 animate-spin" />}{mutation.isPending ? "Saving…" : existing ? "Save changes" : "Upload document"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function CompanyDocumentsPage() {
  const { orgId, userId } = useAuditAccess();
  const { isDemoMode } = useOnboarding();
  return <CompanyDocumentsContent key={`${orgId}:${userId}:${isDemoMode}`} />;
}

function CompanyDocumentsContent() {
  const { currentOrganization } = useOrganization();
  const { isDemoMode } = useOnboarding();
  const { orgId, canManageAudit, loading } = useAuditAccess();
  const timezone = useTimezone();
  const [search, setSearch] = useState("");
  const [label, setLabel] = useState("");
  const [year, setYear] = useState("");
  const [editor, setEditor] = useState<"new" | CompanyDocument | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["company-documents", orgId], queryFn: () => fetchCompanyDocuments(orgId!), enabled: Boolean(orgId && canManageAudit && !isDemoMode) });
  const documents = useMemo(() => query.data ?? [], [query.data]);
  const labels = useMemo(() => [...new Set(documents.map((d) => d.label))].sort(), [documents]);
  const years = useMemo(() => [...new Set(documents.flatMap((d) => d.audit_year ? [d.audit_year] : []))].sort((a, b) => b - a), [documents]);
  const visible = useMemo(() => documents.filter((d) => (!label || d.label === label) && (!year || String(d.audit_year) === year) &&
    `${d.title} ${d.label} ${d.original_filename} ${d.notes ?? ""} ${d.uploaded_by_name}`.toLowerCase().includes(search.toLowerCase().trim())), [documents, label, year, search]);
  const open = async (doc: CompanyDocument, mode: "print" | "download") => {
    setBusy(doc.id);
    try { await openComplianceFile({ filePath: doc.file_path, fileName: doc.original_filename, mode }); }
    catch (error) { toast.error(message(error)); }
    finally { setBusy(null); }
  };
  const printRegister = async () => {
    setBusy("register");
    try {
      const { buildCompanyRegisterPdf } = await import("@/features/company/print");
      const pdf = buildCompanyRegisterPdf(visible, currentOrganization?.name ?? "Company", timezone);
      pdf.save("company-document-register.pdf");
    } catch (error) { toast.error(message(error)); }
    finally { setBusy(null); }
  };
  if (loading) return <div className="p-8" role="status">Loading company records…</div>;
  if (!canManageAudit || !orgId) return <div className="p-8"><h1 className="text-xl font-semibold">Company</h1><p className="mt-2 text-muted-foreground">Company records are available to this company’s owners and admins.</p></div>;
  if (isDemoMode) return <div className="p-8"><h1 className="text-xl font-semibold">Company</h1><p className="mt-2 text-muted-foreground">Exit demo mode to view and upload your company’s documents.</p></div>;
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="size-4" />{currentOrganization?.name}</div><h1 className="text-2xl font-semibold tracking-tight">Company</h1><p className="mt-1 text-sm text-muted-foreground">Keep company documents organized for your yearly DHS audit.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={printRegister} disabled={!visible.length || query.isError || busy !== null}><Printer className="size-4" />Print register</Button><Button onClick={() => setEditor("new")}><Plus className="size-4" />Upload document</Button></div>
    </header>
    <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm"><ShieldCheck className="size-5 shrink-0 text-emerald-700" /><p>Private company records <span className="text-muted-foreground">· Owners and admins only</span></p></div>
    <section aria-label="Company documents" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-end gap-3 border-b p-4">
        <div className="min-w-48 flex-1 space-y-1.5"><Label htmlFor="company-search">Search documents</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id="company-search" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, label, notes, or uploader" /></div></div>
        <div className="space-y-1.5"><Label htmlFor="company-label-filter">Label</Label><select id="company-label-filter" value={label} onChange={(e) => setLabel(e.target.value)} className="h-9 w-40 rounded-md border bg-background px-3 text-sm"><option value="">All labels</option>{labels.map((l) => <option key={l}>{l}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="company-year-filter">Audit year</Label><select id="company-year-filter" value={year} onChange={(e) => setYear(e.target.value)} className="h-9 w-32 rounded-md border bg-background px-3 text-sm"><option value="">All years</option>{years.map((y) => <option key={y}>{y}</option>)}</select></div>
      </div>
      {query.isPending ? <p className="p-8 text-center text-muted-foreground" role="status">Loading documents…</p> : query.isError ? <div className="space-y-3 p-8 text-center"><p role="alert">Company documents could not be loaded.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div> : !visible.length ? <div className="space-y-2 p-10 text-center"><FileText className="mx-auto mb-3 size-8 text-muted-foreground" /><h2 className="font-medium">{documents.length ? "No matching documents" : "Your company records start here"}</h2><p className="text-sm text-muted-foreground">{documents.length ? "Try a different search, label, or audit year." : "Upload a document, give it a clear title and label, and find it here when you need it."}</p></div> : <>
        <div className="border-b px-4 py-2 text-xs text-muted-foreground">{visible.length} of {documents.length} documents · Times shown in {timezone}</div>
        <ul className="divide-y">{visible.map((doc) => <li key={doc.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
          <FileText className="mt-1 hidden size-6 shrink-0 text-slate-500 sm:block" />
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words font-semibold">{doc.title}</h2><Badge variant="secondary">{doc.label}</Badge>{doc.audit_year && <Badge variant="outline">{doc.audit_year}</Badge>}</div>
            <p className="mt-1 break-all text-xs text-muted-foreground">{doc.original_filename} · {doc.file_size < 1024 ? `${doc.file_size} B` : doc.file_size < 1024 * 1024 ? `${(doc.file_size / 1024).toFixed(1)} KB` : `${(doc.file_size / 1024 / 1024).toFixed(1)} MB`}</p>
            {doc.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{doc.notes}</p>}
            <p className="mt-3 text-xs text-muted-foreground">Uploaded by <span className="font-medium text-foreground">{doc.uploaded_by_name || doc.uploaded_by}</span> · {formatInUserTimezone(doc.created_at, timezone, "MMM d, yyyy 'at' h:mm a")}</p>
            {doc.updated_at !== doc.created_at && <p className="mt-1 text-xs text-muted-foreground">Details updated {formatInUserTimezone(doc.updated_at, timezone, "MMM d, yyyy 'at' h:mm a")}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-1"><Button size="sm" variant="outline" disabled={busy === doc.id} onClick={() => open(doc, "print")}><Printer className="size-4" />View / print</Button><Button size="icon" variant="ghost" aria-label={`Download ${doc.title}`} disabled={busy === doc.id} onClick={() => open(doc, "download")}><Download className="size-4" /></Button><Button size="icon" variant="ghost" aria-label={`Edit ${doc.title}`} onClick={() => setEditor(doc)}><Pencil className="size-4" /></Button></div>
        </li>)}</ul>
      </>}
    </section>
    {editor && <CompanyDocumentEditor key={`${orgId}:${editor === "new" ? "new" : editor.id}`} orgId={orgId} existing={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} />}
  </div>;
}
