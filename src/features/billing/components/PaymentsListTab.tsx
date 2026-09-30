import { CircleAlert, Coins, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useBillingPayments } from "../hooks/useBillingPayments";
import { formatMoney, toCents } from "../utils/decimal";
import { formatBillingDate, formatBillingTimestamp } from "../utils/dates";

export function PaymentsListTab({ onSelectRecord }: { onSelectRecord: (recordId: string) => void }) {
  const { currentOrganization } = useOrganization();
  const timezone = currentOrganization?.timezone || "America/Chicago";
  const { data: payments = [], isLoading, isError, refetch } = useBillingPayments({});

  const receivedPayments = payments.filter((payment) => payment.received_at || payment.received_date);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Payments received</CardTitle>
        <CardDescription>Receipts linked to your billing records. Add a receipt from the record it belongs to.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 px-0">
        {isLoading ? (
          <div role="status" aria-label="Loading payments" className="flex flex-col gap-3 px-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : isError ? (
          <div className="px-6"><Alert variant="destructive"><CircleAlert /><AlertTitle>Payments could not be loaded</AlertTitle><AlertDescription><p>Check your connection and try again.</p><Button variant="outline" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></AlertDescription></Alert></div>
        ) : receivedPayments.length === 0 ? (
          <Empty><EmptyHeader><EmptyMedia variant="icon"><Coins /></EmptyMedia><EmptyTitle>No payments received yet</EmptyTitle><EmptyDescription>Open a billing record to add money received and its receipt date.</EmptyDescription></EmptyHeader></Empty>
        ) : (
          <Table className="min-w-[760px]" aria-label="Payments">
            <TableHeader><TableRow><TableHead className="pl-6">Billing record</TableHead><TableHead>Agency</TableHead><TableHead>Received</TableHead><TableHead>Payment reference</TableHead><TableHead className="pr-6 text-right">Amount received</TableHead></TableRow></TableHeader>
            <TableBody>{receivedPayments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="py-4 pl-6"><div className="flex flex-col items-start gap-1">{payment.allocations?.length ? payment.allocations.map((allocation) => (
                  <Button key={allocation.id} variant="link" className="h-auto max-w-56 whitespace-normal break-words p-0 text-left" onClick={() => onSelectRecord(allocation.record_id)}>
                    {allocation.record?.internal_reference || "View record"}{payment.allocations && payment.allocations.length > 1 ? ` · ${formatMoney(allocation.amount)}` : ""}
                  </Button>
                )) : <span className="text-muted-foreground">Unassigned receipt</span>}</div></TableCell>
                <TableCell className="max-w-56 whitespace-normal break-words">{payment.payer?.name || "Agency unavailable"}</TableCell>
                <TableCell className="tabular-nums">{payment.received_at ? formatBillingTimestamp(payment.received_at, timezone) : payment.received_date ? `${formatBillingDate(payment.received_date)} (date only)` : "Receipt not confirmed"}</TableCell>
                <TableCell className="max-w-56 whitespace-normal break-words">{payment.reference_number || "—"}</TableCell>
                <TableCell className="pr-6 text-right tabular-nums">{formatMoney(payment.amount)}{toCents(payment.unapplied_amount) !== 0n && <span className="block text-xs text-muted-foreground">{formatMoney(payment.unapplied_amount)} unassigned</span>}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
