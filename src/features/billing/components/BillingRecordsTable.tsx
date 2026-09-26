import { useState, useMemo } from "react";
import {
  Download as DownloadSimple,
  RefreshCw as ArrowsClockwise,
  CircleAlert as WarningCircle,
  FileText,
  Plus,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useBillingRecords } from "../hooks/useBillingRecords";
import { useBillingPayers } from "../hooks/useBillingPayers";
import type {
  BillingRecordType,
  SubmissionStatus,
  SettlementStatus,
} from "../types/billing";
import {
  getSubmissionStatusMeta,
  getAdjudicationStatusMeta,
  getSettlementStatusMeta,
  doesRecordRequireAction,
} from "../utils/status-helpers";
import { formatMoney } from "../utils/decimal";
import { generateCsv, downloadCsvFile } from "../utils/export-helpers";

interface BillingRecordsTableProps {
  onSelectRecord: (recordId: string) => void;
  onAddRecordClick: () => void;
  initialActionNeeded?: boolean;
}

export function BillingRecordsTable({
  onSelectRecord,
  onAddRecordClick,
  initialActionNeeded = false,
}: BillingRecordsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [payerFilter, setPayerFilter] = useState<string>("all");
  const [recordTypeFilter, setRecordTypeFilter] = useState<
    BillingRecordType | "all"
  >("all");
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<
    SubmissionStatus | "all"
  >("all");
  const [settlementStatusFilter, setSettlementStatusFilter] = useState<
    SettlementStatus | "all"
  >("all");
  const [actionNeededOnly, setActionNeededOnly] = useState(initialActionNeeded);

  const { data: payers = [] } = useBillingPayers();

  const queryFilters = useMemo(
    () => ({
      search: searchTerm.trim() || undefined,
      payerId: payerFilter !== "all" ? payerFilter : undefined,
      recordType: recordTypeFilter !== "all" ? recordTypeFilter : undefined,
      submissionStatus:
        submissionStatusFilter !== "all" ? submissionStatusFilter : undefined,
      settlementStatus:
        settlementStatusFilter !== "all" ? settlementStatusFilter : undefined,
      actionNeededOnly,
    }),
    [
      searchTerm,
      payerFilter,
      recordTypeFilter,
      submissionStatusFilter,
      settlementStatusFilter,
      actionNeededOnly,
    ],
  );

  const {
    data: records = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useBillingRecords(queryFilters);

  // CSV export handler
  const handleExportCsv = () => {
    const headers = [
      "Internal Reference",
      "Record Type",
      "Payer",
      "Client",
      "Billing Period Start",
      "Billing Period End",
      "External Submitted At",
      "Submission Status",
      "Adjudication Status",
      "Settlement Status",
      "Billed Amount",
      "Allowed Amount",
      "Paid Amount",
      "Adjusted Amount",
      "Outstanding Balance",
      "Next Follow-up Date",
      "Notes",
    ];

    const rows = records.map((r) => [
      r.internal_reference,
      r.record_type === "dhs_claim" ? "DHS Claim" : "Partner Invoice",
      r.payer?.name || "",
      r.client?.full_name ||
        (r.lines && r.lines.length > 0 ? `${r.lines.length} lines` : ""),
      r.billing_period_start,
      r.billing_period_end,
      r.external_submitted_at ? r.external_submitted_at.slice(0, 10) : "",
      r.submission_status,
      r.adjudication_status,
      r.settlement_status,
      r.total_billed_amount,
      r.total_allowed_amount || "",
      r.total_paid_amount,
      r.total_adjusted_amount,
      r.outstanding_balance,
      r.next_follow_up_date || "",
      r.notes || "",
    ]);

    const csvData = generateCsv(headers, rows);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`billing_records_${dateStr}.csv`, csvData);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0">
        <CardHeader className="gap-4">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <CardTitle>Billing records</CardTitle>
              <CardDescription>
                Find claims and invoices, review balances, and record follow-up.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
              <Button
                variant="outline"
                onClick={handleExportCsv}
                disabled={records.length === 0}
              >
                <DownloadSimple data-icon="inline-start" />
                Export CSV
              </Button>
              <Button onClick={onAddRecordClick}>
                <Plus data-icon="inline-start" />
                Add billing record
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-4">
          <FieldGroup className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field className="min-w-0 sm:col-span-2 xl:col-span-3">
              <FieldLabel htmlFor="billing-record-search">
                Search records
              </FieldLabel>
              <Input
                id="billing-record-search"
                type="search"
                placeholder="Reference or notes"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </Field>
            <Field className="min-w-0 sm:col-span-2 sm:justify-end xl:col-span-1">
              <Button
                variant={actionNeededOnly ? "default" : "outline"}
                aria-pressed={actionNeededOnly}
                onClick={() => setActionNeededOnly(!actionNeededOnly)}
              >
                <WarningCircle data-icon="inline-start" />
                Action needed
              </Button>
            </Field>
            <Field className="min-w-0">
              <FieldLabel htmlFor="billing-payer-filter">Payer</FieldLabel>
              <Select value={payerFilter} onValueChange={setPayerFilter}>
                <SelectTrigger
                  id="billing-payer-filter"
                  className="w-full min-w-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All payers</SelectItem>
                    {payers.map((payer) => (
                      <SelectItem key={payer.id} value={payer.id}>
                        {payer.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="min-w-0">
              <FieldLabel htmlFor="billing-type-filter">Record type</FieldLabel>
              <Select
                value={recordTypeFilter}
                onValueChange={(value) => {
                  if (
                    value === "all" ||
                    value === "dhs_claim" ||
                    value === "partner_invoice"
                  )
                    setRecordTypeFilter(value);
                }}
              >
                <SelectTrigger
                  id="billing-type-filter"
                  className="w-full min-w-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="dhs_claim">DHS claims</SelectItem>
                    <SelectItem value="partner_invoice">
                      Partner invoices
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="min-w-0">
              <FieldLabel htmlFor="billing-submission-filter">
                Submission
              </FieldLabel>
              <Select
                value={submissionStatusFilter}
                onValueChange={(value) => {
                  if (
                    value === "all" ||
                    value === "draft" ||
                    value === "submitted" ||
                    value === "received" ||
                    value === "rejected" ||
                    value === "cancelled" ||
                    value === "superseded"
                  )
                    setSubmissionStatusFilter(value);
                }}
              >
                <SelectTrigger
                  id="billing-submission-filter"
                  className="w-full min-w-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All submissions</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="superseded">Superseded</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="min-w-0">
              <FieldLabel htmlFor="billing-settlement-filter">
                Payment status
              </FieldLabel>
              <Select
                value={settlementStatusFilter}
                onValueChange={(value) => {
                  if (
                    value === "all" ||
                    value === "unpaid" ||
                    value === "payment_scheduled" ||
                    value === "partially_paid" ||
                    value === "paid" ||
                    value === "overpaid"
                  )
                    setSettlementStatusFilter(value);
                }}
              >
                <SelectTrigger
                  id="billing-settlement-filter"
                  className="w-full min-w-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All payment statuses</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="payment_scheduled">
                      Payment scheduled
                    </SelectItem>
                    <SelectItem value="partially_paid">
                      Partially paid
                    </SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overpaid">Overpaid</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="min-w-0 gap-0 overflow-hidden py-0">
        <CardHeader className="py-5">
          <CardTitle>
            Records {isLoading ? "" : `(${records.length})`}
          </CardTitle>
          <CardDescription>
            Open a reference to view its details. Scroll the table to see all
            columns.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 px-0">
          {isLoading ? (
            <div
              role="status"
              aria-label="Loading billing records"
              className="flex flex-col gap-3 px-6 pb-6"
            >
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <span className="sr-only">Loading billing records…</span>
            </div>
          ) : isError ? (
            <div className="px-6 pb-6">
              <Alert variant="destructive">
                <WarningCircle />
                <AlertTitle>Billing records could not be loaded</AlertTitle>
                <AlertDescription>
                  <p className="break-words">
                    {error?.message || "Check your connection and try again."}
                  </p>
                  <Button variant="outline" onClick={() => refetch()}>
                    <ArrowsClockwise data-icon="inline-start" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : records.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>No billing records found</EmptyTitle>
                <EmptyDescription>
                  {actionNeededOnly
                    ? "No claims or invoices currently need attention."
                    : "No records match these filters. Add a DHS claim or partner invoice to begin tracking."}
                </EmptyDescription>
              </EmptyHeader>
              {!actionNeededOnly && (
                <EmptyContent>
                  <Button onClick={onAddRecordClick}>
                    <Plus data-icon="inline-start" />
                    Add billing record
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <Table className="min-w-[1100px]" aria-label="Billing records">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Reference</TableHead>
                  <TableHead>Type / payer</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service period</TableHead>
                  <TableHead>Submitted on</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="pr-6 text-right">
                    Open balance
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const submission = getSubmissionStatusMeta(
                    record.submission_status,
                  );
                  const adjudication = getAdjudicationStatusMeta(
                    record.adjudication_status,
                  );
                  const settlement = getSettlementStatusMeta(
                    record.settlement_status,
                  );
                  return (
                    <TableRow
                      key={record.id}
                      onClick={() => onSelectRecord(record.id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="py-4 pl-6">
                        <div className="flex items-start gap-2">
                          {doesRecordRequireAction(record) && (
                            <WarningCircle
                              className="mt-2 size-4 shrink-0 text-destructive"
                              aria-label="Action needed"
                            />
                          )}
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="link"
                              className="h-auto max-w-52 justify-start whitespace-normal break-words p-0 text-left"
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelectRecord(record.id);
                              }}
                              aria-label={`View billing record ${record.internal_reference}`}
                            >
                              {record.internal_reference}
                            </Button>
                            {record.original_external_reference && (
                              <span className="max-w-52 whitespace-normal break-words text-xs text-muted-foreground">
                                External: {record.original_external_reference}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col items-start gap-2">
                          <Badge variant="outline">
                            {record.record_type === "dhs_claim"
                              ? "DHS claim"
                              : "Partner invoice"}
                          </Badge>
                          <span className="max-w-48 whitespace-normal break-words">
                            {record.payer?.name || "Unknown payer"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {record.client ? (
                          <div className="flex flex-col gap-1">
                            <span className="max-w-48 whitespace-normal break-words">
                              {record.client.full_name}
                            </span>
                            {record.client.medicaid_id && (
                              <span className="text-xs text-muted-foreground">
                                ID: {record.client.medicaid_id}
                              </span>
                            )}
                          </div>
                        ) : record.lines?.length ? (
                          `${new Set(record.lines.map((line) => line.client_id)).size} clients (${record.lines.length} lines)`
                        ) : (
                          <span className="text-muted-foreground">
                            No client assigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 tabular-nums">
                        <div className="flex flex-col gap-1">
                          <span>{record.billing_period_start}</span>
                          <span className="text-muted-foreground">
                            to {record.billing_period_end}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {record.external_submitted_at ? (
                          <div className="flex flex-col gap-1">
                            <span className="tabular-nums">
                              {record.external_submitted_at.slice(0, 10)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              via{" "}
                              {record.submission_channel?.replace(/_/g, " ") ||
                                "external"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            Not submitted
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          <Badge
                            variant={
                              record.submission_status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {submission.label}
                          </Badge>
                          {record.adjudication_status !== "not_reported" && (
                            <Badge
                              variant={
                                record.adjudication_status === "denied"
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {adjudication.label}
                            </Badge>
                          )}
                          <Badge
                            variant={
                              record.settlement_status === "overpaid"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {settlement.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-right tabular-nums">
                        {formatMoney(record.total_billed_amount)}
                      </TableCell>
                      <TableCell className="py-4 text-right tabular-nums">
                        {formatMoney(record.total_paid_amount)}
                      </TableCell>
                      <TableCell className="py-4 pr-6 text-right font-medium tabular-nums">
                        {formatMoney(record.outstanding_balance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
