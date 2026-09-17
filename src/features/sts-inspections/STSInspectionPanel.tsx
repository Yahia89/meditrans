import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Download, FileText, Loader2, Pencil, Plus, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuditAccess } from "@/hooks/useAuditAccess";
import { useOrganization } from "@/contexts/OrganizationContext";
import { formatInUserTimezone } from "@/lib/timezone";
import { COMPLIANCE_FILE_ACCEPT, openComplianceFile } from "@/features/compliance/files";
import { fetchStsDrivers, fetchStsInspections, saveStsInspection } from "./api";
import { filterStsInspections, formatInspectionDate, inspectionResultLabel, STS_RESULTS, STS_RESULT_LABELS, type StsInspection, type StsInspectionFilters, type StsInspectionInput } from "./types";
import { MobileInspectionSnapshot } from "./MobileInspectionSnapshot";

export interface STSInspectionPanelProps {
  orgId: string;
  driverId?: string;
  driverName?: string;
  canEdit: boolean;
  isDemoMode?: boolean;
  timezone: string;
  onDriverClick?: (driverId: string) => void;
}

const EMPTY_RECORDS: StsInspection[] = [];
const selectStyle = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const resultStyles = {
  passed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  failed: "border-red-200 bg-red-50 text-red-800",
  follow_up: "border-amber-200 bg-amber-50 text-amber-800",
  pending: "border-slate-200 bg-slate-50 text-slate-700",
};

function errorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message) : "Something went wrong. Please try again.";
}

export function STSInspectionPanel(props: STSInspectionPanelProps) {
  const { userId } = useAuditAccess(props.orgId);
  return <InspectionWorkspace key={`${props.orgId}:${props.driverId ?? "all"}:${userId}`} {...props} />;
}

function InspectionWorkspace({ orgId, driverId, driverName, canEdit, isDemoMode = false, timezone, onDriverClick }: STSInspectionPanelProps) {
  const access = useAuditAccess(orgId);
  const { currentOrganization } = useOrganization();
  const authorized = access.canManageAudit && access.orgId === orgId;
  const writable = authorized && canEdit && !isDemoMode;
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<StsInspectionFilters>({ driverId: "", result: "all", startDate: "", endDate: "", search: "" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ record?: StsInspection } | null>(null);
  const [editingDriverId, setEditingDriverId] = useState(driverId ?? "");
  const [form, setForm] = useState<StsInspectionInput>({ title: "", inspection_date: "", inspector_name: "", result: "pending", reference: "", notes: "", next_due_date: "" });
  const [report, setReport] = useState<File | null>(null);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [openingFile, setOpeningFile] = useState<string | null>(null);

  const inspections = useQuery({
    queryKey: ["sts-inspections", orgId, driverId ?? "all"],
    queryFn: () => fetchStsInspections({ orgId, driverId }),
    enabled: authorized && !isDemoMode,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const drivers = useQuery({
    queryKey: ["sts-drivers", orgId],
    queryFn: () => fetchStsDrivers(orgId),
    enabled: authorized && !isDemoMode && !driverId,
  });
  const names = useMemo(() => {
    const values = new Map((drivers.data ?? []).map((driver) => [driver.id, driver.full_name]));
    if (driverId) values.set(driverId, driverName || "Driver");
    return values;
  }, [drivers.data, driverId, driverName]);
  const records = inspections.data ?? EMPTY_RECORDS;
  const visible = useMemo(() => filterStsInspections(records, filters, names), [records, filters, names]);
  const selected = visible.filter((record) => selectedIds.has(record.id));
  const dateRangeInvalid = !!(filters.startDate && filters.endDate && filters.endDate < filters.startDate);

  const save = useMutation({
    mutationFn: () => {
      if (!writable) throw new Error("Only company owners and admins can change inspections.");
      if (!editingDriverId) throw new Error("Choose a driver.");
      return saveStsInspection({ orgId, driverId: editingDriverId, input: form, existing: dialog?.record, report });
    },
    onSuccess: async ({ cleanupWarning }) => {
      setDialog(null);
      setReport(null);
      toast.success("Inspection saved");
      if (cleanupWarning) toast.warning("Inspection saved, but the old report could not be removed. Contact an administrator.");
      await queryClient.invalidateQueries({ queryKey: ["sts-inspections", orgId] });
    },
    onError: (error) => setSavingError(errorMessage(error)),
  });

  const openEditor = (record?: StsInspection) => {
    setEditingDriverId(record?.driver_id ?? driverId ?? "");
    setForm(record ? {
      title: record.title, inspection_date: record.inspection_date, inspector_name: record.inspector_name,
      result: record.result, reference: record.reference ?? "", notes: record.notes ?? "", next_due_date: record.next_due_date ?? "",
    } : {
      title: "STS inspection", inspection_date: formatInUserTimezone(new Date(), timezone, "yyyy-MM-dd"),
      inspector_name: "", result: "pending", reference: "", notes: "", next_due_date: "",
    });
    setReport(null);
    setSavingError(null);
    setDialog({ record });
  };

  const printRecords = async (items: StsInspection[]) => {
    if (!authorized || !items.length) return;
    if (!driverId && (!drivers.isSuccess || drivers.isError)) {
      toast.error("Load driver names successfully before printing inspection history.");
      return;
    }
    const popup = window.open("", "_blank");
    if (!popup) { toast.error("Allow pop-ups to open the inspection print preview."); return; }
    popup.opener = null;
    popup.document.title = "Preparing STS inspection print preview";
    setPrinting(true);
    try {
      const { createStsInspectionPDF } = await import("./print");
      const title = items.length === 1 ? `STS Inspection - ${items[0].title}` : `STS Inspection History${driverName ? ` - ${driverName}` : ""}`;
      const organizationName = currentOrganization?.id === orgId ? currentOrganization.name : "Company";
      const doc = createStsInspectionPDF({ records: items, driverNames: names, organizationName, title, timezone });
      const url = URL.createObjectURL(doc.output("blob"));
      if (popup.closed) { URL.revokeObjectURL(url); return; }
      popup.location.replace(`${url}#toolbar=1`);
      const timer = window.setInterval(() => {
        if (popup.closed) { URL.revokeObjectURL(url); window.clearInterval(timer); }
      }, 1000);
    } catch (error) { popup.close(); toast.error(errorMessage(error)); }
    finally { setPrinting(false); }
  };

  const openReport = async (record: StsInspection, mode: "print" | "download") => {
    if (!authorized || !record.report_file_path || !record.report_filename) return;
    setOpeningFile(record.id);
    try { await openComplianceFile({ filePath: record.report_file_path, fileName: record.report_filename, mode }); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setOpeningFile(null); }
  };

  const submit = (event: FormEvent) => { event.preventDefault(); setSavingError(null); save.mutate(); };
  const setFilter = <K extends keyof StsInspectionFilters>(key: K, value: StsInspectionFilters[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setSelectedIds(new Set());
  };

  if (!authorized) return <p className="p-6 text-sm text-muted-foreground">STS inspections are available to company owners and admins.</p>;
  if (isDemoMode) return <p className="p-6 text-sm text-muted-foreground">Inspection history is available for saved drivers.</p>;

  return <section className="space-y-5" aria-label="STS inspection history">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900"><ClipboardCheck className="h-6 w-6 text-[#3D5A3D]" />STS Inspection</h2>
        <p className="mt-1 text-sm text-slate-500">{driverName ? `${driverName}'s inspection records and reports.` : "Inspection records and reports across your company’s drivers."}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void inspections.refetch()} disabled={inspections.isFetching} aria-label="Refresh inspection history"><RefreshCw className={`h-4 w-4 ${inspections.isFetching ? "animate-spin" : ""}`} /></Button>
        <Button variant="outline" disabled={printing || !visible.length || inspections.isError || dateRangeInvalid || (!driverId && (!drivers.isSuccess || drivers.isError))} onClick={() => void printRecords(selected.length ? selected : visible)}><Printer className="mr-2 h-4 w-4" />{printing ? "Preparing…" : selected.length ? `Print selected (${selected.length})` : `Print results (${visible.length})`}</Button>
        {writable && <Button className="bg-[#3D5A3D] hover:bg-[#2E4A2E]" onClick={() => openEditor()}><Plus className="mr-2 h-4 w-4" />Add inspection</Button>}
      </div>
    </div>

    <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
      {!driverId && <div className="space-y-1.5"><Label htmlFor="sts-filter-driver">Driver</Label><select id="sts-filter-driver" className={selectStyle} value={filters.driverId} onChange={(event) => setFilter("driverId", event.target.value)}><option value="">All drivers</option>{(drivers.data ?? []).map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}{driver.active === false ? " (inactive)" : ""}</option>)}</select></div>}
      <div className="space-y-1.5"><Label htmlFor="sts-filter-result">Result</Label><select id="sts-filter-result" className={selectStyle} value={filters.result} onChange={(event) => setFilter("result", event.target.value as StsInspectionFilters["result"])}><option value="all">All results</option>{STS_RESULTS.map((result) => <option key={result} value={result}>{STS_RESULT_LABELS[result]}</option>)}</select></div>
      <div className="space-y-1.5"><Label htmlFor="sts-start">From date</Label><Input id="sts-start" type="date" value={filters.startDate} onChange={(event) => setFilter("startDate", event.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="sts-end">To date</Label><Input id="sts-end" type="date" min={filters.startDate} value={filters.endDate} onChange={(event) => setFilter("endDate", event.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="sts-search">Search records</Label><Input id="sts-search" placeholder="Title, inspector, reference…" value={filters.search} onChange={(event) => setFilter("search", event.target.value)} /></div>
    </div>
    {dateRangeInvalid && <p role="alert" className="text-sm text-red-700">The end date must be on or after the start date.</p>}
    {drivers.isError && !driverId && <p role="alert" className="text-sm text-red-700">Driver names could not be loaded. <button className="underline" onClick={() => void drivers.refetch()}>Try again</button></p>}
    {inspections.isError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5"><p className="font-medium text-red-900">Inspection history could not be loaded.</p><p className="mt-1 text-sm text-red-700">{errorMessage(inspections.error)}</p><Button variant="outline" className="mt-3" onClick={() => void inspections.refetch()}>Try again</Button></div>
      : inspections.isPending ? <div className="flex items-center justify-center gap-2 p-12 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading inspections…</div>
        : !visible.length ? <div className="rounded-xl border border-dashed bg-white p-10 text-center"><ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-slate-400" /><h3 className="font-medium">{records.length ? "No inspections match these filters" : "No STS inspections recorded"}</h3><p className="mt-2 text-sm text-slate-500">{records.length ? "Adjust the driver, date, result, or search filters." : "Add an inspection to start a dated history with its result and supporting report."}</p></div>
          : <div className="overflow-hidden rounded-xl border bg-white"><Table><TableHeader><TableRow>
            <TableHead className="w-10"><input type="checkbox" aria-label="Select all visible inspections" checked={visible.length > 0 && selected.length === visible.length} onChange={(event) => setSelectedIds(event.target.checked ? new Set(visible.map((record) => record.id)) : new Set())} /></TableHead>
            <TableHead>Inspection</TableHead>{!driverId && <TableHead>Driver</TableHead>}<TableHead>Date / inspector</TableHead><TableHead>Result</TableHead><TableHead>Next due</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader><TableBody>{visible.map((record) => <TableRow key={record.id}>
            <TableCell><input type="checkbox" aria-label={`Select ${record.title} on ${record.inspection_date}`} checked={selectedIds.has(record.id)} onChange={(event) => setSelectedIds((previous) => { const next = new Set(previous); if (event.target.checked) next.add(record.id); else next.delete(record.id); return next; })} /></TableCell>
            <TableCell className="min-w-44 max-w-72 !whitespace-normal"><button className="text-left font-medium text-[#3D5A3D] hover:underline" onClick={() => openEditor(record)}>{record.title}</button>{record.source === "mobile_app" && <div className="mt-1"><Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Driver app</Badge></div>}{record.reference && <p className="mt-1 text-xs text-slate-500">Ref: {record.reference}</p>}{record.report_filename && <p className="mt-1 truncate text-xs text-slate-500" title={record.report_filename}>{record.report_filename}</p>}</TableCell>
            {!driverId && <TableCell>{onDriverClick ? <button className="text-[#3D5A3D] hover:underline" onClick={() => onDriverClick(record.driver_id)}>{names.get(record.driver_id) || "View driver"}</button> : names.get(record.driver_id) || record.driver_id}</TableCell>}
            <TableCell>{formatInspectionDate(record.inspection_date)}<p className="mt-1 text-xs text-slate-500">{record.inspector_name}</p></TableCell>
            <TableCell><Badge variant="outline" className={resultStyles[record.result]}>{inspectionResultLabel(record)}</Badge></TableCell>
            <TableCell>{formatInspectionDate(record.next_due_date)}</TableCell>
            <TableCell><div className="flex justify-end gap-1">{record.report_file_path && <><Button variant="ghost" size="sm" disabled={openingFile === record.id} onClick={() => void openReport(record, "print")}><FileText className="mr-1 h-4 w-4" />View / print report</Button><Button variant="ghost" size="icon" aria-label={`Download report for ${record.title}`} disabled={openingFile === record.id} onClick={() => void openReport(record, "download")}><Download className="h-4 w-4" /></Button></>}
              <Button variant="ghost" size="icon" aria-label={`Print ${record.title}`} disabled={printing || (!driverId && (!drivers.isSuccess || drivers.isError))} onClick={() => void printRecords([record])}><Printer className="h-4 w-4" /></Button>{writable && <Button variant="ghost" size="icon" aria-label={`Edit ${record.title}`} onClick={() => openEditor(record)}><Pencil className="h-4 w-4" /></Button>}</div></TableCell>
          </TableRow>)}</TableBody></Table></div>}

    <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open && !save.isPending) setDialog(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{dialog?.record ? dialog.record.source === "mobile_app" ? "Review driver inspection" : writable ? "Edit STS inspection" : "STS inspection" : "Add STS inspection"}</DialogTitle><DialogDescription>{dialog?.record?.source === "mobile_app" ? "Review the driver's original checklist and update your company's inspection details." : "Record the inspection details and attach the original report when available."}</DialogDescription></DialogHeader>
      {dialog?.record?.source === "mobile_app" && <MobileInspectionSnapshot inspection={dialog.record} timezone={timezone} />}
      <form onSubmit={submit} className="space-y-4">
        {!driverId && <div className="space-y-1.5"><Label htmlFor="sts-driver">Driver *</Label><select id="sts-driver" required className={selectStyle} value={editingDriverId} disabled={!!dialog?.record || !writable || save.isPending} onChange={(event) => setEditingDriverId(event.target.value)}><option value="">Choose a driver</option>{(drivers.data ?? []).map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}{driver.active === false ? " (inactive)" : ""}</option>)}</select></div>}
        <div className="space-y-1.5"><Label htmlFor="sts-title">Title *</Label><Input id="sts-title" required maxLength={200} value={form.title} disabled={!writable || save.isPending} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="sts-date">Inspection date *</Label><Input id="sts-date" type="date" required value={form.inspection_date} disabled={!writable || save.isPending || dialog?.record?.source === "mobile_app"} onChange={(event) => setForm({ ...form, inspection_date: event.target.value })} />{dialog?.record?.source === "mobile_app" && <p className="text-xs text-slate-500">Recorded by the driver app.</p>}</div><div className="space-y-1.5"><Label htmlFor="sts-inspector">Inspector *</Label><Input id="sts-inspector" required maxLength={200} value={form.inspector_name} disabled={!writable || save.isPending} onChange={(event) => setForm({ ...form, inspector_name: event.target.value })} /></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="sts-result">Result *</Label><select id="sts-result" className={selectStyle} value={form.result} disabled={!writable || save.isPending} onChange={(event) => setForm({ ...form, result: event.target.value as StsInspectionInput["result"] })}>{STS_RESULTS.map((result) => <option key={result} value={result}>{STS_RESULT_LABELS[result]}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="sts-due">Next due date</Label><Input id="sts-due" type="date" min={form.inspection_date} value={form.next_due_date} disabled={!writable || save.isPending} onChange={(event) => setForm({ ...form, next_due_date: event.target.value })} /></div></div>
        <div className="space-y-1.5"><Label htmlFor="sts-reference">Reference / report number</Label><Input id="sts-reference" maxLength={200} value={form.reference} disabled={!writable || save.isPending} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="sts-notes">Notes</Label><textarea id="sts-notes" rows={4} maxLength={10000} className="w-full rounded-md border border-input bg-background p-3 text-sm" value={form.notes} disabled={!writable || save.isPending} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
        {writable && <div className="space-y-1.5"><Label htmlFor="sts-report">{dialog?.record?.report_filename ? "Replace attached report" : "Attach report"}</Label><Input id="sts-report" type="file" accept={COMPLIANCE_FILE_ACCEPT} disabled={save.isPending} onChange={(event) => setReport(event.target.files?.[0] ?? null)} /><p className="text-xs text-slate-500">PDF, JPEG, PNG or WebP, up to 20 MB.{dialog?.record?.report_filename ? ` Current: ${dialog.record.report_filename}` : ""}</p></div>}
        {dialog?.record && <p className="text-xs text-slate-500">Last updated {formatInUserTimezone(dialog.record.updated_at, timezone, "MMM d, yyyy h:mm a")}</p>}
        {savingError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{savingError}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setDialog(null)}>Cancel</Button>{writable && <Button type="submit" disabled={save.isPending} className="bg-[#3D5A3D] hover:bg-[#2E4A2E]">{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save inspection</Button>}</DialogFooter>
      </form>
    </DialogContent></Dialog>
  </section>;
}
