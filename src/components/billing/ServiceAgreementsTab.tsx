import { useState } from "react";
import { CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/contexts/OrganizationContext";
import { billingDb } from "@/features/billing/api/client";
import { formatMoney } from "@/features/billing/utils/decimal";

import {
  BillingDialogBody,
  BillingDialogContent,
  BillingDialogFooter,
  BillingDialogHeader,
} from "@/features/billing/components/BillingDialogLayout";

export function ServiceAgreementsTab() {
  const { currentOrganization } = useOrganization();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgreementId, setSelectedAgreementId] = useState<string | null>(
    null,
  );

  const {
    data: agreements = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["service-agreements", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await billingDb
        .from("billing_service_agreements")
        .select(
          "*, patient:patients(full_name, medicaid_id), lines:billing_service_agreement_lines(*)",
        )
        .eq("org_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  const search = searchTerm.trim().toLowerCase();
  const filteredAgreements = agreements.filter((agreement) =>
    [
      agreement.agreement_number,
      agreement.patient?.full_name,
      agreement.patient?.medicaid_id,
    ].some((value) => value?.toLowerCase().includes(search)),
  );
  const selectedAgreement = agreements.find(
    (agreement) => agreement.id === selectedAgreementId,
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <CardTitle>Service agreements</CardTitle>
              <CardDescription>
                Review saved authorization periods and service codes while
                preparing billing records.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              disabled={isFetching}
              onClick={() => refetch()}
              className="w-full sm:w-auto sm:shrink-0"
            >
              <RefreshCw data-icon="inline-start" />
              {isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="service-agreement-search">
                Search agreements
              </FieldLabel>
              <Input
                id="service-agreement-search"
                type="search"
                placeholder="Patient, agreement number, or Medicaid ID"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Alert>
        <ShieldCheck />
        <AlertTitle>Reference for manual billing</AlertTitle>
        <AlertDescription>
          These agreements help staff review authorization details. Claims and
          invoices are submitted outside this workspace; this list does not
          validate trips or transmit claims.
        </AlertDescription>
      </Alert>

      <Card className="min-w-0 gap-0 overflow-hidden py-0">
        <CardHeader className="py-5">
          <CardTitle>
            Saved agreements {isLoading ? "" : `(${filteredAgreements.length})`}
          </CardTitle>
          <CardDescription>
            Open an agreement to review its service lines. Scroll the table to
            see all columns.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 px-0">
          {isLoading ? (
            <div
              role="status"
              aria-label="Loading service agreements"
              className="flex flex-col gap-3 px-6 pb-6"
            >
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <span className="sr-only">Loading service agreements…</span>
            </div>
          ) : isError ? (
            <div className="px-6 pb-6">
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Service agreements could not be loaded</AlertTitle>
                <AlertDescription>
                  <p>Check your connection and try again.</p>
                  <Button variant="outline" onClick={() => refetch()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : filteredAgreements.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShieldCheck />
                </EmptyMedia>
                <EmptyTitle>
                  {search
                    ? "No matching agreements"
                    : "No service agreements available"}
                </EmptyTitle>
                <EmptyDescription>
                  {search
                    ? "Try a different patient name, agreement number, or Medicaid ID."
                    : "Saved agreements appear here for reference during manual billing review."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table className="min-w-[760px]" aria-label="Service agreements">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Agreement</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Authorization period</TableHead>
                  <TableHead>Service codes</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgreements.map((agreement) => (
                  <TableRow key={agreement.id}>
                    <TableCell className="py-4 pl-6">
                      <Button
                        variant="link"
                        className="h-auto max-w-48 justify-start whitespace-normal break-words p-0 text-left"
                        aria-label={`View service agreement ${agreement.agreement_number}`}
                        onClick={() => setSelectedAgreementId(agreement.id)}
                      >
                        {agreement.agreement_number}
                      </Button>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex max-w-56 flex-col gap-1 whitespace-normal break-words">
                        <span className="font-medium">
                          {agreement.patient?.full_name ||
                            "Patient unavailable"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Medicaid ID:{" "}
                          {agreement.patient?.medicaid_id || "Not recorded"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 tabular-nums">
                      <div className="flex flex-col gap-1">
                        <span>
                          {format(
                            parseISO(agreement.effective_date),
                            "MMM d, yyyy",
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          to{" "}
                          {format(
                            parseISO(agreement.expiration_date),
                            "MMM d, yyyy",
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex max-w-60 flex-wrap gap-1.5">
                        {agreement.lines.length > 0 ? (
                          agreement.lines.map((line) => (
                            <Badge key={line.id} variant="outline">
                              {line.hcpcs_code}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">
                            No service lines
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 pr-6">
                      <Badge
                        variant={
                          agreement.status === "active"
                            ? "secondary"
                            : "outline"
                        }
                        className="capitalize"
                      >
                        {agreement.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedAgreement}
        onOpenChange={(open) => {
          if (!open) setSelectedAgreementId(null);
        }}
      >
        <BillingDialogContent className="sm:max-w-3xl">
          <BillingDialogHeader>
            <DialogTitle className="break-words">
              Service agreement {selectedAgreement?.agreement_number}
            </DialogTitle>
            <DialogDescription>
              Saved authorization details for manual billing review.
            </DialogDescription>
          </BillingDialogHeader>
          {selectedAgreement && (
            <BillingDialogBody>
              <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-sm text-muted-foreground">Patient</dt>
                  <dd className="mt-1 break-words font-medium">
                    {selectedAgreement.patient?.full_name ||
                      "Patient unavailable"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-muted-foreground">Medicaid ID</dt>
                  <dd className="mt-1 break-words">
                    {selectedAgreement.patient?.medicaid_id || "Not recorded"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-muted-foreground">
                    Authorization period
                  </dt>
                  <dd className="mt-1 text-sm tabular-nums">
                    {format(
                      parseISO(selectedAgreement.effective_date),
                      "MMM d, yyyy",
                    )}{" "}
                    to{" "}
                    {format(
                      parseISO(selectedAgreement.expiration_date),
                      "MMM d, yyyy",
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <Badge variant="secondary" className="capitalize">
                      {selectedAgreement.status}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Total authorized units
                  </dt>
                  <dd className="mt-1 tabular-nums">
                    {selectedAgreement.total_units_authorized ?? "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Total authorized amount
                  </dt>
                  <dd className="mt-1 tabular-nums">
                    {selectedAgreement.total_amount_authorized === null
                      ? "Not recorded"
                      : formatMoney(selectedAgreement.total_amount_authorized)}
                  </dd>
                </div>
              </dl>
              <div className="flex min-w-0 flex-col gap-3">
                <h3 className="font-medium">Authorized services</h3>
                {selectedAgreement.lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No service lines are recorded for this agreement.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Scroll the table to review all service details.
                    </p>
                    <Table
                      className="min-w-[540px]"
                      aria-label="Agreement service lines"
                    >
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Modifier</TableHead>
                          <TableHead className="text-right">
                            Authorized units
                          </TableHead>
                          <TableHead className="text-right">
                            Used units
                          </TableHead>
                          <TableHead className="text-right">
                            Unit rate
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedAgreement.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>{line.hcpcs_code}</TableCell>
                            <TableCell>{line.modifier || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.units_authorized ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.units_used ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.unit_rate === null
                                ? "—"
                                : formatMoney(line.unit_rate)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </div>
            </BillingDialogBody>
          )}
          <BillingDialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedAgreementId(null)}
            >
              Close
            </Button>
          </BillingDialogFooter>
        </BillingDialogContent>
      </Dialog>
    </div>
  );
}
