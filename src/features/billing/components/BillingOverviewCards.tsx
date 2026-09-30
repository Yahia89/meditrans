import { AlertCircle, Info, RotateCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBillingStats } from "../hooks/useBillingStats";
import { formatMoney } from "../utils/decimal";

export function BillingOverviewCards() {
  const { data: stats, isError, isFetching, refetch } = useBillingStats();

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Billing totals are unavailable</AlertTitle>
        <AlertDescription className="min-w-0 gap-3">
          <p>Try again, or ask an administrator to check billing access and setup.</p>
          <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
            <RotateCw data-icon="inline-start" />
            {isFetching ? "Retrying…" : "Retry totals"}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!stats) {
    return (
      <div role="status" aria-label="Loading billing totals" className="grid min-w-0 grid-cols-1 gap-3 @2xl/billing:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="min-w-0 gap-3 py-4">
            <CardHeader className="px-4"><Skeleton className="h-4 w-28" /></CardHeader>
            <CardContent className="flex flex-col gap-3 px-4">
              <Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-40 max-w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      key: "billed", label: "Submitted this month", value: formatMoney(stats.billedThisMonth),
      detail: "Original submission amounts",
      explanation: "Original amounts submitted this calendar month in your organization’s timezone. Drafts and superseded records are excluded.",
    },
    {
      key: "received", label: "Received this month", value: formatMoney(stats.receivedThisMonth),
      detail: "Confirmed funds received",
      explanation: "Payment totals with a confirmed receipt date this calendar month. Each payment is counted once, regardless of its allocations.",
    },
    {
      key: "balance", label: "Outstanding balance", value: formatMoney(stats.outstandingBalance),
      detail: "Across tracked billing",
      explanation: "Active billed charges minus confirmed payment allocations and posted adjustments. Overpayments remain visible as negative balances.",
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 @2xl/billing:grid-cols-3">
      {metrics.map((metric) => (
        <Card key={metric.key} className="min-w-0 gap-3 py-4">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
            <CardTitle>{metric.label}</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`About ${metric.label.toLowerCase()}`} className="shrink-0">
                  <Info />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-72">{metric.explanation}</TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-2 px-4">
            <p className="break-words text-2xl font-semibold tracking-tight tabular-nums">{metric.value}</p>
            <p className="text-sm text-muted-foreground">{metric.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
