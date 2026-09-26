import { Fragment, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Coins,
  Plus,
  RefreshCw,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useBillingPayments } from "../hooks/useBillingPayments";
import { useBillingPayers } from "../hooks/useBillingPayers";
import type { BillingPayment } from "../types/billing";
import { formatMoney } from "../utils/decimal";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

const reconciliationLabels: Record<
  BillingPayment["reconciliation_status"],
  string
> = {
  unapplied: "Unapplied cash",
  partially_applied: "Partially applied",
  fully_applied: "Fully allocated",
  reconciled: "Reconciled",
};

export function PaymentsListTab() {
  const [payerFilter, setPayerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    BillingPayment["reconciliation_status"] | "all"
  >("all");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(
    null,
  );
  const { data: payers = [] } = useBillingPayers();
  const {
    data: payments = [],
    isLoading,
    isError,
    refetch,
  } = useBillingPayments({
    payerId: payerFilter !== "all" ? payerFilter : undefined,
    reconciliationStatus: statusFilter !== "all" ? statusFilter : undefined,
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <CardTitle>External payments</CardTitle>
              <CardDescription>
                Track money received from payers and its allocation to claims
                and invoices.
              </CardDescription>
            </div>
            <Button
              onClick={() => setPaymentDialogOpen(true)}
              className="w-full sm:w-auto lg:shrink-0"
            >
              <Plus data-icon="inline-start" />
              Record external payment
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          <FieldGroup className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field className="min-w-0">
              <FieldLabel htmlFor="payment-payer-filter">Payer</FieldLabel>
              <Select value={payerFilter} onValueChange={setPayerFilter}>
                <SelectTrigger
                  id="payment-payer-filter"
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
              <FieldLabel htmlFor="payment-status-filter">
                Allocation status
              </FieldLabel>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  if (
                    value === "all" ||
                    value === "unapplied" ||
                    value === "partially_applied" ||
                    value === "fully_applied" ||
                    value === "reconciled"
                  )
                    setStatusFilter(value);
                }}
              >
                <SelectTrigger
                  id="payment-status-filter"
                  className="w-full min-w-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="fully_applied">
                      Fully allocated
                    </SelectItem>
                    <SelectItem value="partially_applied">
                      Partially applied
                    </SelectItem>
                    <SelectItem value="unapplied">Unapplied cash</SelectItem>
                    <SelectItem value="reconciled">Reconciled</SelectItem>
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
            Payment ledger {isLoading ? "" : `(${payments.length})`}
          </CardTitle>
          <CardDescription>
            Expand a payment to view its allocations. Scroll the table to see
            all columns.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 px-0">
          {isLoading ? (
            <div
              role="status"
              aria-label="Loading payments"
              className="flex flex-col gap-3 px-6 pb-6"
            >
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <span className="sr-only">Loading payments…</span>
            </div>
          ) : isError ? (
            <div className="px-6 pb-6">
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Payments could not be loaded</AlertTitle>
                <AlertDescription>
                  <p>Check your connection and try again.</p>
                  <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCw data-icon="inline-start" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : payments.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Coins />
                </EmptyMedia>
                <EmptyTitle>No payments found</EmptyTitle>
                <EmptyDescription>
                  Record a check, EFT, or other external payment and allocate it
                  to claims or invoices.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setPaymentDialogOpen(true)}>
                  <Plus data-icon="inline-start" />
                  Record payment
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Table
              className="min-w-[900px]"
              aria-label="External payments ledger"
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 pl-4">
                    <span className="sr-only">Allocations</span>
                  </TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Received date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total amount</TableHead>
                  <TableHead className="pr-6 text-right">
                    Unapplied cash
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const isExpanded = expandedPaymentId === payment.id;
                  const allocations = payment.allocations || [];
                  return (
                    <Fragment key={payment.id}>
                      <TableRow>
                        <TableCell className="pl-4">
                          {allocations.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`${isExpanded ? "Hide" : "Show"} allocations for payment ${payment.reference_number}`}
                              aria-expanded={isExpanded}
                              aria-controls={`payment-allocations-${payment.id}`}
                              onClick={() =>
                                setExpandedPaymentId(
                                  isExpanded ? null : payment.id,
                                )
                              }
                            >
                              {isExpanded ? <ChevronDown /> : <ChevronRight />}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="max-w-48 whitespace-normal break-words py-4 font-medium">
                          {payment.reference_number}
                        </TableCell>
                        <TableCell className="max-w-48 whitespace-normal break-words py-4">
                          {payment.payer?.name || "Unknown payer"}
                        </TableCell>
                        <TableCell className="py-4 capitalize">
                          {payment.payment_method.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="py-4 tabular-nums">
                          {payment.received_date || (
                            <span className="text-muted-foreground">
                              Pending deposit
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge
                            variant={
                              payment.reconciliation_status === "unapplied"
                                ? "outline"
                                : "secondary"
                            }
                          >
                            {
                              reconciliationLabels[
                                payment.reconciliation_status
                              ]
                            }
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-right font-medium tabular-nums">
                          {formatMoney(payment.amount)}
                        </TableCell>
                        <TableCell className="py-4 pr-6 text-right tabular-nums">
                          {formatMoney(payment.unapplied_amount)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && allocations.length > 0 && (
                        <TableRow id={`payment-allocations-${payment.id}`}>
                          <TableCell
                            colSpan={8}
                            className="bg-muted/40 px-6 py-4 whitespace-normal"
                          >
                            <div className="flex flex-col gap-3">
                              <p className="text-sm font-medium">
                                Allocated to {allocations.length}{" "}
                                {allocations.length === 1
                                  ? "record"
                                  : "records"}
                              </p>
                              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {allocations.map((allocation) => (
                                  <li
                                    key={allocation.id}
                                    className="flex min-w-0 items-start justify-between gap-4 rounded-lg border bg-card p-3"
                                  >
                                    <div className="flex min-w-0 flex-col gap-1">
                                      <span className="break-words font-medium">
                                        {allocation.record
                                          ?.internal_reference || "Record"}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {allocation.record?.record_type ===
                                        "dhs_claim"
                                          ? "DHS claim"
                                          : allocation.record?.record_type ===
                                              "partner_invoice"
                                            ? "Partner invoice"
                                            : "Billing record"}
                                      </span>
                                      {allocation.notes && (
                                        <span className="break-words text-sm text-muted-foreground">
                                          {allocation.notes}
                                        </span>
                                      )}
                                    </div>
                                    <span className="shrink-0 font-medium tabular-nums">
                                      {formatMoney(allocation.amount)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />
    </div>
  );
}
