import { useDeferredValue, useState } from "react";
import { Download, RefreshCw, CircleAlert, FileText, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/contexts/OrganizationContext";
import { filterBillingRecords } from "../api/records";
import { useBillingRecords } from "../hooks/useBillingRecords";
import { useBillingPayers } from "../hooks/useBillingPayers";
import type { SettlementStatus } from "../types/billing";
import { getSettlementStatusMeta } from "../utils/status-helpers";
import { formatMoney } from "../utils/decimal";
import { formatBillingTimestamp } from "../utils/dates";
import { generateCsv, downloadCsvFile } from "../utils/export-helpers";

interface BillingRecordsTableProps {
  onSelectRecord: (recordId: string) => void;
  onAddRecordClick: () => void;
}

export function BillingRecordsTable({ onSelectRecord, onAddRecordClick }: BillingRecordsTableProps) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [agency, setAgency] = useState("all");
  const [status, setStatus] = useState<SettlementStatus | "all">("all");
  const { currentOrganization } = useOrganization();
  const timezone = currentOrganization?.timezone || "America/Chicago";
  const { data: agencies = [], isError: agencyError } = useBillingPayers();
  const { data: allRecords = [], isLoading, isError, error, refetch } = useBillingRecords({
    payerId: agency === "all" ? undefined : agency,
    settlementStatus: status === "all" ? undefined : status,
  });

  const records = filterBillingRecords(allRecords, deferredSearch);

  const exportRecords = () => {
    const headers = ["Patient reference", "Patient", "Agency", "External reference", "Submitted at (UTC)", "Original submitted amount", "Received amount", "Adjustments", "Open balance", "Payment status", "Recorded at (UTC)", "Notes"];
    const rows = records.map((r) => [
      r.internal_reference, r.client?.full_name || "", r.payer?.name || "", r.original_external_reference || "",
      r.external_submitted_at || "", r.original_submitted_amount ?? r.total_billed_amount, r.total_paid_amount,
      r.total_adjusted_amount, r.outstanding_balance, r.settlement_status, r.created_at, r.notes || "",
    ]);
    downloadCsvFile(`billing_records_${new Date().toISOString().slice(0, 10)}.csv`, generateCsv(headers, rows));
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <CardTitle>Billing records</CardTitle>
            <CardDescription>Compare original submissions with money received. Open a record to add receipts or files.</CardDescription>
          </div>
          <Button variant="outline" onClick={exportRecords} disabled={isLoading || isError || records.length === 0}>
            <Download data-icon="inline-start" />Export CSV
          </Button>
        </div>
        <FieldGroup className="grid min-w-0 gap-4 sm:grid-cols-2 @4xl/billing:grid-cols-[2fr_1fr_1fr]">
          <Field className="min-w-0 sm:col-span-2 @4xl/billing:col-span-1">
            <FieldLabel htmlFor="billing-record-search">Search records</FieldLabel>
            <Input id="billing-record-search" type="search" placeholder="Patient, reference, agency, or notes" value={search} onChange={(event) => setSearch(event.target.value)} />
          </Field>
          <Field className="min-w-0">
            <FieldLabel htmlFor="billing-agency-filter">Agency</FieldLabel>
            <Select value={agency} onValueChange={setAgency}>
              <SelectTrigger id="billing-agency-filter" className="w-full min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="all">All agencies</SelectItem>{agencies.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            {agencyError && <p className="text-sm text-destructive">Agency filters could not be loaded.</p>}
          </Field>
          <Field className="min-w-0">
            <FieldLabel htmlFor="billing-settlement-filter">Payment status</FieldLabel>
            <Select value={status} onValueChange={(value) => {
              if (value === "all" || value === "unpaid" || value === "payment_scheduled" || value === "partially_paid" || value === "paid" || value === "overpaid") setStatus(value);
            }}>
              <SelectTrigger id="billing-settlement-filter" className="w-full min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="all">All payment statuses</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partially_paid">Partially paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overpaid">Overpaid</SelectItem>
                <SelectItem value="payment_scheduled">Payment scheduled</SelectItem>
              </SelectGroup></SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </CardHeader>
      <CardContent className="min-w-0 px-0">
        {isLoading ? (
          <div role="status" aria-label="Loading billing records" className="flex flex-col gap-3 px-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : isError ? (
          <div className="px-6"><Alert variant="destructive"><CircleAlert /><AlertTitle>Billing records could not be loaded</AlertTitle><AlertDescription><p>{error?.message || "Check your connection and try again."}</p><Button variant="outline" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></AlertDescription></Alert></div>
        ) : records.length === 0 ? (
          <Empty><EmptyHeader><EmptyMedia variant="icon"><FileText /></EmptyMedia><EmptyTitle>No billing records found</EmptyTitle><EmptyDescription>Add your first submission, or change the filters to find a record.</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={onAddRecordClick}><Plus data-icon="inline-start" />Add billing record</Button></EmptyContent></Empty>
        ) : (
          <Table className="min-w-[1000px]" aria-label="Billing records">
            <TableHeader><TableRow>
              <TableHead className="pl-6">Patient / reference</TableHead><TableHead>Agency</TableHead><TableHead>Submitted</TableHead><TableHead>Payment status</TableHead><TableHead className="text-right">Originally submitted</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="pr-6 text-right">Open balance</TableHead>
            </TableRow></TableHeader>
            <TableBody>{records.map((record) => (
              <TableRow key={record.id} className="cursor-pointer" onClick={() => onSelectRecord(record.id)}>
                <TableCell className="py-4 pl-6"><div className="flex flex-col gap-1">
                  <Button variant="link" className="h-auto max-w-56 justify-start whitespace-normal break-words p-0 text-left" aria-label={`View billing record ${record.internal_reference}`} onClick={(event) => { event.stopPropagation(); onSelectRecord(record.id); }}>{record.client?.full_name || record.internal_reference}</Button>
                  <span className="font-mono text-xs text-muted-foreground">{record.internal_reference}</span>
                  {record.original_external_reference && <span className="max-w-56 whitespace-normal break-words text-xs text-muted-foreground">External: {record.original_external_reference}</span>}
                </div></TableCell>
                <TableCell className="max-w-56 whitespace-normal break-words">{record.payer?.name || "Agency unavailable"}</TableCell>
                <TableCell className="tabular-nums">{formatBillingTimestamp(record.external_submitted_at, timezone)}{["draft", "cancelled", "superseded"].includes(record.submission_status) && <span className="block text-xs capitalize text-muted-foreground">{record.submission_status}</span>}</TableCell>
                <TableCell><Badge variant="secondary">{getSettlementStatusMeta(record.settlement_status).label}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(record.original_submitted_amount ?? record.total_billed_amount)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(record.total_paid_amount)}</TableCell>
                <TableCell className="pr-6 text-right font-medium tabular-nums">{formatMoney(record.outstanding_balance)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
