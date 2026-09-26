import { billingDb } from "./client";
import { addMoney } from "../utils/decimal";
import { doesRecordRequireAction } from "../utils/status-helpers";
import { billingRecordResponseSchema, decimalResponseSchema } from "../types/responses";

export interface BillingOverviewStats {
  billedThisMonth: string;
  receivedThisMonth: string;
  outstandingBalance: string;
  actionNeededCount: number;
}

export async function getBillingOverviewStats(orgId: string): Promise<BillingOverviewStats> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const monthStart = `${year}-${month}-01`;
  // Last day of month
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

  // Fetch each active record once so rejected records are not counted twice.
  const { data: recordsData, error: recordsError } = await billingDb
    .from("billing_records")
    .select("*")
    .eq("org_id", orgId)
    .not("submission_status", "in", '("cancelled","superseded")');

  if (recordsError) throw recordsError;

  const records = billingRecordResponseSchema.array().parse(recordsData ?? []);

  let billedThisMonth = "0.00";
  let totalOutstanding = "0.00";
  let actionCount = 0;

  for (const r of records) {
    if (doesRecordRequireAction(r)) actionCount++;
    if (r.submission_status === "draft") continue;

    // A service period alone is not evidence of an external submission.
    const subDate = r.external_submitted_at?.slice(0, 10);

    if (subDate && subDate >= monthStart && subDate <= monthEnd) {
      billedThisMonth = addMoney(billedThisMonth, r.total_billed_amount);
    }

    // Accumulate total open balance
    totalOutstanding = addMoney(totalOutstanding, r.outstanding_balance);

  }

  // 2. Confirmed payments received this month (counted from billing_payments header, not duplicate allocations)
  const { data: paymentsData, error: paymentsError } = await billingDb
    .from("billing_payments")
    .select("amount, received_date")
    .eq("org_id", orgId)
    .gte("received_date", monthStart)
    .lte("received_date", monthEnd);

  if (paymentsError) throw paymentsError;

  let receivedThisMonth = "0.00";
  if (paymentsData) {
    for (const p of paymentsData) {
      receivedThisMonth = addMoney(receivedThisMonth, decimalResponseSchema.parse(p.amount));
    }
  }

  return {
    billedThisMonth,
    receivedThisMonth,
    outstandingBalance: totalOutstanding,
    actionNeededCount: actionCount,
  };
}
