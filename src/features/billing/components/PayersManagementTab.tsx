import { useState, type FormEvent } from "react";
import {
  Building2,
  CircleAlert,
  Plus,
  RefreshCw,
  WandSparkles,
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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
import {
  useBillingPayers,
  useCreatePayer,
  useUpdatePayer,
  useSeedStandardPayers,
} from "../hooks/useBillingPayers";
import type {
  PayerType,
  SubmissionChannel,
  BillingPayer,
} from "../types/billing";
import { payerConfigSchema } from "../types/schemas";
import { toast } from "sonner";

import {
  BillingDialogBody,
  BillingDialogContent,
  BillingDialogFooter,
  BillingDialogHeader,
} from "./BillingDialogLayout";

export function PayersManagementTab() {
  const { data: payers = [], isLoading, isError, refetch } = useBillingPayers();
  const createMutation = useCreatePayer();
  const updateMutation = useUpdatePayer();
  const seedMutation = useSeedStandardPayers();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayer, setEditingPayer] = useState<BillingPayer | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [payerType, setPayerType] = useState<PayerType>("broker_partner");
  const [submissionChannel, setSubmissionChannel] =
    useState<SubmissionChannel>("email");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [followUpDays, setFollowUpDays] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");

  const handleOpenAdd = () => {
    setEditingPayer(null);
    setName("");
    setPayerType("broker_partner");
    setSubmissionChannel("email");
    setPaymentTerms("");
    setFollowUpDays("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setNotes("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (p: BillingPayer) => {
    setEditingPayer(p);
    setName(p.name);
    setPayerType(p.payer_type);
    setSubmissionChannel(p.submission_channel);
    setPaymentTerms(p.payment_terms || "");
    setFollowUpDays(p.typical_follow_up_days?.toString() ?? "");
    setContactName(p.contact_name || "");
    setContactEmail(p.contact_email || "");
    setContactPhone(p.contact_phone || "");
    setNotes(p.notes || "");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Payer name is required");
      return;
    }

    const followUpResult =
      payerConfigSchema.shape.typical_follow_up_days.safeParse(
        followUpDays.trim() === "" ? null : Number(followUpDays),
      );
    if (!followUpResult.success) {
      toast.error("Enter a whole number of follow-up days, or leave it blank.");
      return;
    }

    try {
      if (editingPayer) {
        await updateMutation.mutateAsync({
          payerId: editingPayer.id,
          input: {
            name: name.trim(),
            payer_type: payerType,
            submission_channel: submissionChannel,
            payment_terms: paymentTerms.trim() || null,
            typical_follow_up_days: followUpResult.data,
            contact_name: contactName.trim() || null,
            contact_email: contactEmail.trim() || null,
            contact_phone: contactPhone.trim() || null,
            notes: notes.trim() || null,
          },
        });
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          payer_type: payerType,
          submission_channel: submissionChannel,
          payment_terms: paymentTerms.trim() || null,
          typical_follow_up_days: followUpResult.data,
          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
          notes: notes.trim() || null,
          is_active: true,
        });
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      console.error(
        "Save payer error:",
        err instanceof Error ? err.message : err,
      );
    }
  };

  const handleToggleActive = async (p: BillingPayer) => {
    try {
      await updateMutation.mutateAsync({
        payerId: p.id,
        input: { is_active: !p.is_active },
      });
    } catch (err: unknown) {
      console.error(
        "Toggle active error:",
        err instanceof Error ? err.message : err,
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Payers and partners</CardTitle>
          <CardDescription>
            Manage payer contacts, submission channels, and follow-up
            preferences for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          {payers.length === 0 && !isLoading && !isError && (
            <Button
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? (
                <RefreshCw
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <WandSparkles data-icon="inline-start" />
              )}
              {seedMutation.isPending
                ? "Configuring…"
                : "Configure standard payers"}
            </Button>
          )}
          <Button onClick={handleOpenAdd}>
            <Plus data-icon="inline-start" />
            Add custom payer
          </Button>
        </CardContent>
      </Card>

      <Card className="min-w-0 gap-0 overflow-hidden py-0">
        <CardHeader className="py-5">
          <CardTitle>
            Configured payers {isLoading ? "" : `(${payers.length})`}
          </CardTitle>
          <CardDescription>
            Scroll the table to view terms, status, and editing actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 px-0">
          {isLoading ? (
            <div
              role="status"
              aria-label="Loading payers"
              className="flex flex-col gap-3 px-6 pb-6"
            >
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <span className="sr-only">Loading payers…</span>
            </div>
          ) : isError ? (
            <div className="px-6 pb-6">
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Payers could not be loaded</AlertTitle>
                <AlertDescription>
                  <p>Check your connection and try again.</p>
                  <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCw data-icon="inline-start" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : payers.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Building2 />
                </EmptyMedia>
                <EmptyTitle>No payers configured</EmptyTitle>
                <EmptyDescription>
                  Add a payer or configure DHS / MHCP and Connectivity of MN.
                  Confirm their payment terms and submission details before use.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                >
                  <WandSparkles data-icon="inline-start" />
                  {seedMutation.isPending
                    ? "Configuring…"
                    : "Configure standard payers"}
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Table
              className="min-w-[960px]"
              aria-label="Configured billing payers"
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Payer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Submission channel</TableHead>
                  <TableHead>Payment terms</TableHead>
                  <TableHead>Follow-up cycle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payers.map((payer) => (
                  <TableRow key={payer.id}>
                    <TableCell className="py-4 pl-6">
                      <div className="flex max-w-60 flex-col gap-1 whitespace-normal break-words">
                        <span className="font-medium">{payer.name}</span>
                        {payer.contact_email && (
                          <span className="text-xs text-muted-foreground">
                            {payer.contact_email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="capitalize">
                        {payer.payer_type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 capitalize">
                      {payer.submission_channel.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="max-w-48 whitespace-normal break-words py-4">
                      {payer.payment_terms || "Not configured"}
                    </TableCell>
                    <TableCell className="py-4">
                      {payer.typical_follow_up_days === null
                        ? "Not configured"
                        : `Every ${payer.typical_follow_up_days} days`}
                    </TableCell>
                    <TableCell className="py-4">
                      <Button
                        variant={payer.is_active ? "secondary" : "outline"}
                        size="sm"
                        aria-pressed={payer.is_active}
                        aria-label={`${payer.is_active ? "Deactivate" : "Activate"} ${payer.name}`}
                        disabled={updateMutation.isPending}
                        onClick={() => handleToggleActive(payer)}
                      >
                        {payer.is_active ? "Active" : "Inactive"}
                      </Button>
                    </TableCell>
                    <TableCell className="py-4 pr-6 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(payer)}
                        aria-label={`Edit ${payer.name}`}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <BillingDialogContent className="sm:max-w-xl">
          <BillingDialogHeader>
            <DialogTitle>
              {editingPayer ? "Edit payer configuration" : "Add billing payer"}
            </DialogTitle>
            <DialogDescription>
              Save the contact and submission details you use when billing this
              payer.
            </DialogDescription>
          </BillingDialogHeader>
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <BillingDialogBody>
              <Field>
                <FieldLabel htmlFor="payer-name">
                  Payer name <span aria-hidden="true">*</span>
                </FieldLabel>
                <Input
                  id="payer-name"
                  placeholder="DHS / MHCP or partner name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </Field>
              <FieldGroup className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field className="min-w-0">
                  <FieldLabel htmlFor="payer-type">Payer type</FieldLabel>
                  <Select
                    value={payerType}
                    onValueChange={(value) => {
                      const result =
                        payerConfigSchema.shape.payer_type.safeParse(value);
                      if (result.success) setPayerType(result.data);
                    }}
                  >
                    <SelectTrigger id="payer-type" className="w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="medicaid_direct">
                          Medicaid direct (DHS)
                        </SelectItem>
                        <SelectItem value="broker_partner">
                          Broker / partner
                        </SelectItem>
                        <SelectItem value="commercial">
                          Commercial insurance
                        </SelectItem>
                        <SelectItem value="private_pay">Private pay</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="min-w-0">
                  <FieldLabel htmlFor="payer-channel">
                    Submission channel
                  </FieldLabel>
                  <Select
                    value={submissionChannel}
                    onValueChange={(value) => {
                      const result =
                        payerConfigSchema.shape.submission_channel.safeParse(
                          value,
                        );
                      if (result.success) setSubmissionChannel(result.data);
                    }}
                  >
                    <SelectTrigger
                      id="payer-channel"
                      className="w-full min-w-0"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="mn_its_dde">
                          MN-ITS DDE portal
                        </SelectItem>
                        <SelectItem value="partner_portal">
                          Partner portal
                        </SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="mail">Mail / paper</SelectItem>
                        <SelectItem value="fax">Fax</SelectItem>
                        <SelectItem value="clearinghouse">
                          Clearinghouse
                        </SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="min-w-0">
                  <FieldLabel htmlFor="payer-payment-terms">
                    Payment terms
                  </FieldLabel>
                  <Input
                    id="payer-payment-terms"
                    placeholder="Confirmed payment terms"
                    value={paymentTerms}
                    onChange={(event) => setPaymentTerms(event.target.value)}
                  />
                </Field>
                <Field className="min-w-0">
                  <FieldLabel htmlFor="payer-follow-up">
                    Follow-up cycle (days)
                  </FieldLabel>
                  <Input
                    id="payer-follow-up"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    placeholder="Not configured"
                    aria-describedby="payer-follow-up-description"
                    value={followUpDays}
                    onChange={(event) => setFollowUpDays(event.target.value)}
                  />
                  <FieldDescription id="payer-follow-up-description">
                    Leave blank when no follow-up cycle is configured.
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <Field>
                <FieldLabel htmlFor="payer-contact-name">
                  Contact name
                </FieldLabel>
                <Input
                  id="payer-contact-name"
                  autoComplete="name"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                />
              </Field>
              <FieldGroup className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field className="min-w-0">
                  <FieldLabel htmlFor="payer-contact-email">
                    Contact email
                  </FieldLabel>
                  <Input
                    id="payer-contact-email"
                    type="email"
                    autoComplete="email"
                    placeholder="billing@partner.org"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                  />
                </Field>
                <Field className="min-w-0">
                  <FieldLabel htmlFor="payer-contact-phone">
                    Contact phone
                  </FieldLabel>
                  <Input
                    id="payer-contact-phone"
                    type="tel"
                    autoComplete="tel"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                  />
                </Field>
              </FieldGroup>
              <Field>
                <FieldLabel htmlFor="payer-notes">
                  Notes and guidelines
                </FieldLabel>
                <Textarea
                  id="payer-notes"
                  placeholder="External submission guidelines or instructions"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                />
              </Field>
            </BillingDialogBody>
            <BillingDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && (
                  <RefreshCw
                    data-icon="inline-start"
                    className="animate-spin motion-reduce:animate-none"
                  />
                )}
                {isSaving
                  ? "Saving…"
                  : editingPayer
                    ? "Update payer"
                    : "Create payer"}
              </Button>
            </BillingDialogFooter>
          </form>
        </BillingDialogContent>
      </Dialog>
    </div>
  );
}
