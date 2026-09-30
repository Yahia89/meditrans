import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { z } from "zod";

const moneySchema = z.string().trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Enter an amount with no more than two decimal places")
  .refine((value) => /[1-9]/.test(value), "Amount must be greater than zero");
const timestampSchema = z.string().datetime({ offset: true, message: "Enter a valid date and time" });
const optionalText = (limit: number) => z.string().trim().max(limit).nullish();

export function patientBillingReference(patientId: string): string {
  return patientId.split("-")[0] ?? "";
}

export function billingDateTimeLocal(timezone: string, date: Date = new Date()): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd'T'HH:mm");
}

/** A datetime-local input represents the organization's wall clock, not the browser's. */
export function billingDateTimeToIso(value: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Enter a valid date and time");
  }
  const date = fromZonedTime(value, timezone);
  // Reject impossible calendar dates and the missing hour during spring DST.
  if (!Number.isFinite(date.getTime()) || billingDateTimeLocal(timezone, date) !== value) {
    throw new Error("This date or time does not exist in your organization’s time zone");
  }
  return date.toISOString();
}

function localTimestampSchema(timezone: string) {
  return z.string().transform((value, ctx) => {
    try {
      return billingDateTimeToIso(value, timezone);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Enter a valid date and time" });
      return z.NEVER;
    }
  });
}

const manualRecordFields = z.object({
  request_id: z.string().uuid(),
  client_id: z.string().uuid("Select a patient"),
  agency_name: z.string().trim().min(1, "Enter the agency name").max(200),
  submitted_amount: moneySchema,
  submitted_at: timestampSchema,
  received_amount: moneySchema.nullish(),
  received_at: timestampSchema.nullish(),
  external_reference: optionalText(200),
  payment_reference: optionalText(200),
  notes: optionalText(5000),
});

function validateReceipt(
  data: { submitted_at: string; received_amount?: string | null; received_at?: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.received_amount && !data.received_at) {
    ctx.addIssue({ code: "custom", path: ["received_at"], message: "Enter when this payment was received" });
  }
  if (data.received_at && !data.received_amount) {
    ctx.addIssue({ code: "custom", path: ["received_amount"], message: "Enter the amount received, or clear the received date" });
  }
  if (data.received_at && Date.parse(data.received_at) < Date.parse(data.submitted_at)) {
    ctx.addIssue({ code: "custom", path: ["received_at"], message: "Payment cannot be received before the submission" });
  }
}

export const manualBillingRecordSchema = manualRecordFields.superRefine(validateReceipt);
export type ManualBillingRecordInput = z.infer<typeof manualBillingRecordSchema>;

export function manualBillingFormSchema(timezone: string) {
  return manualRecordFields.extend({
    submitted_at: localTimestampSchema(timezone),
    received_amount: z.preprocess((value) => value === "" ? null : value, moneySchema.nullish()),
    received_at: z.preprocess((value) => value === "" ? null : value, localTimestampSchema(timezone).nullish()),
  }).superRefine(validateReceipt);
}

export const manualReceiptSchema = z.object({
  request_id: z.string().uuid(),
  amount: moneySchema,
  received_at: timestampSchema,
  reference_number: optionalText(200),
  notes: optionalText(5000),
});
