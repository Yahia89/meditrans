import type {
  SubmissionStatus,
  AdjudicationStatus,
  SettlementStatus,
  BillingRecord,
} from "../types/billing";

export interface StatusMeta {
  label: string;
  badgeClass: string;
  textClass: string;
  description: string;
}

export function getSubmissionStatusMeta(status: SubmissionStatus): StatusMeta {
  switch (status) {
    case "draft":
      return {
        label: "Internal Draft",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
        textClass: "text-slate-600",
        description: "Not yet submitted externally. Editable draft.",
      };
    case "submitted":
      return {
        label: "Submitted Externally",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
        textClass: "text-blue-600",
        description: "Submitted outside system. Awaiting payer acknowledgement.",
      };
    case "received":
      return {
        label: "Received by Payer",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300",
        textClass: "text-indigo-600",
        description: "Payer acknowledged receipt. In adjudication queue.",
      };
    case "rejected":
      return {
        label: "Rejected — Correction Required",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
        textClass: "text-rose-600",
        description: "Payer rejected submission. Staff correction required.",
      };
    case "cancelled":
      return {
        label: "Cancelled Locally",
        badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400",
        textClass: "text-zinc-500",
        description: "Cancelled internally; no claims transmitted.",
      };
    case "superseded":
      return {
        label: "Superseded by Resubmission",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
        textClass: "text-amber-600",
        description: "Replaced by a subsequent corrected submission revision.",
      };
  }
}

export function getAdjudicationStatusMeta(status: AdjudicationStatus): StatusMeta {
  switch (status) {
    case "not_reported":
      return {
        label: "Not Reported",
        badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
        textClass: "text-slate-500",
        description: "No adjudication decision reported yet.",
      };
    case "in_review":
      return {
        label: "Under Review / Suspended",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
        textClass: "text-amber-600",
        description: "Under payer medical review or additional documentation requested.",
      };
    case "approved":
      return {
        label: "Approved — Payment Outstanding",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
        textClass: "text-emerald-600",
        description: "Payer approved charges. Awaiting funds deposit.",
      };
    case "partially_approved":
      return {
        label: "Partially Approved",
        badgeClass: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300",
        textClass: "text-teal-600",
        description: "Some lines approved; others reduced or denied.",
      };
    case "denied":
      return {
        label: "Denied",
        badgeClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300",
        textClass: "text-red-600",
        description: "Claim or invoice was formally denied by payer.",
      };
  }
}

export function getSettlementStatusMeta(status: SettlementStatus): StatusMeta {
  switch (status) {
    case "unpaid":
      return {
        label: "Unpaid",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
        textClass: "text-slate-600",
        description: "No confirmed payments received.",
      };
    case "payment_scheduled":
      return {
        label: "Payment Scheduled",
        badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
        textClass: "text-sky-600",
        description: "Payer issued EFT/Check; funds in transit.",
      };
    case "partially_paid":
      return {
        label: "Partially Paid",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        textClass: "text-amber-600",
        description: "Partial funds confirmed; balance remains open.",
      };
    case "paid":
      return {
        label: "Paid",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        textClass: "text-emerald-600",
        description: "Full confirmed payment received and reconciled.",
      };
    case "overpaid":
      return {
        label: "Overpayment / Credit to Resolve",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
        textClass: "text-purple-600",
        description: "Receipts exceed billed charges. Overpayment to resolve.",
      };
  }
}

/**
 * Evaluates whether a record requires immediate staff attention (the "Action Needed" filter):
 * - Rejections
 * - Denials
 * - Overdue follow-up date (past or today)
 * - Under review / suspended
 * - Overpayment to resolve
 * - Past-due partner invoices
 */
export function doesRecordRequireAction(record: BillingRecord): boolean {
  if (record.submission_status === "rejected") return true;
  if (record.adjudication_status === "denied" && record.settlement_status !== "paid") return true;
  if (record.adjudication_status === "in_review") return true;
  if (record.settlement_status === "overpaid") return true;

  // Check next follow-up date
  if (record.next_follow_up_date) {
    const today = new Date().toISOString().slice(0, 10);
    if (record.next_follow_up_date <= today && record.settlement_status !== "paid") {
      return true;
    }
  }

  // Check due date for partner invoice
  if (record.record_type === "partner_invoice" && record.due_date) {
    const today = new Date().toISOString().slice(0, 10);
    if (record.due_date < today && record.settlement_status === "unpaid") {
      return true;
    }
  }

  return false;
}
