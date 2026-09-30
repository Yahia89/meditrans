import { formatInTimeZone } from "date-fns-tz";
import { billingDb } from "./client";
import { readBillingRows } from "./pagination";
import { addMoney } from "../utils/decimal";
import { billingRecordResponseSchema, decimalResponseSchema } from "../types/responses";

export interface BillingOverviewStats {
  billedThisMonth: string;
  receivedThisMonth: string;
  outstandingBalance: string;
}

export async function getBillingOverviewStats(
  orgId: string,
  timezone = "America/Chicago",
  now = new Date(),
): Promise<BillingOverviewStats> {
  const month = formatInTimeZone(now, timezone, "yyyy-MM");
  // Fetch independently. Never count the same receipt once per allocation.
  const [recordsData, paymentsData] = await Promise.all([
    readBillingRows(billingDb.from("billing_records").select("*").eq("org_id", orgId)
      .not("submission_status", "in", '("cancelled","superseded")').order("id")),
    readBillingRows(billingDb.from("billing_payments").select("amount, received_date, received_at").eq("org_id", orgId).order("id")),
  ]);

  let billedThisMonth = "0.00";
  let outstandingBalance = "0.00";
  for (const record of billingRecordResponseSchema.array().parse(recordsData)) {
    if (record.submission_status === "draft") continue;
    if (record.external_submitted_at && formatInTimeZone(record.external_submitted_at, timezone, "yyyy-MM") === month) {
      billedThisMonth = addMoney(billedThisMonth, record.original_submitted_amount ?? record.total_billed_amount);
    }
    outstandingBalance = addMoney(outstandingBalance, record.outstanding_balance);
  }

  let receivedThisMonth = "0.00";
  for (const payment of paymentsData) {
    // Old date-only receipts retain their precision; new receipts use the
    // actual event timestamp in the organization's timezone.
    const receivedMonth = payment.received_at
      ? formatInTimeZone(payment.received_at, timezone, "yyyy-MM")
      : payment.received_date?.slice(0, 7);
    if (receivedMonth === month) receivedThisMonth = addMoney(receivedThisMonth, decimalResponseSchema.parse(payment.amount));
  }
  return { billedThisMonth, receivedThisMonth, outstandingBalance };
}
