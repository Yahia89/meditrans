-- Explicit Data API privileges for manual billing. Table access remains subject
-- to the organization/role policies in 20260926022817. This migration changes
-- privileges only; it does not rewrite billing records or payment history.

REVOKE ALL ON TABLE
  public.billing_payers,
  public.billing_records,
  public.billing_record_lines,
  public.billing_submission_attempts,
  public.billing_payer_responses,
  public.billing_payments,
  public.billing_payment_allocations,
  public.billing_adjustments,
  public.billing_activity_logs,
  public.billing_documents
FROM anon, authenticated;

GRANT SELECT ON TABLE
  public.billing_payers,
  public.billing_records,
  public.billing_record_lines,
  public.billing_submission_attempts,
  public.billing_payer_responses,
  public.billing_payments,
  public.billing_payment_allocations,
  public.billing_adjustments,
  public.billing_activity_logs,
  public.billing_documents
TO authenticated;

-- Payer configuration and document metadata are the only independent inserts
-- made by the UI. Financial history must go through the checked atomic RPCs.
GRANT INSERT, UPDATE ON public.billing_payers TO authenticated;
GRANT INSERT ON public.billing_documents TO authenticated;
GRANT UPDATE (next_follow_up_date, follow_up_notes, updated_at)
  ON public.billing_records TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.billing_payers,
  public.billing_records,
  public.billing_record_lines,
  public.billing_submission_attempts,
  public.billing_payer_responses,
  public.billing_payments,
  public.billing_payment_allocations,
  public.billing_adjustments,
  public.billing_activity_logs,
  public.billing_documents
TO service_role;

REVOKE ALL ON FUNCTION public.has_billing_permission(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_billing_permission(uuid, text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION
  public.create_billing_record(jsonb, jsonb[]),
  public.record_external_submission(uuid, jsonb),
  public.record_payer_response(uuid, jsonb),
  public.record_payment_and_allocations(jsonb, jsonb[]),
  public.record_adjustment(uuid, jsonb),
  public.record_resubmission(uuid, jsonb, jsonb[])
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.create_billing_record(jsonb, jsonb[]),
  public.record_external_submission(uuid, jsonb),
  public.record_payer_response(uuid, jsonb),
  public.record_payment_and_allocations(jsonb, jsonb[]),
  public.record_adjustment(uuid, jsonb),
  public.record_resubmission(uuid, jsonb, jsonb[])
TO authenticated, service_role;

-- This internal helper has no caller authorization check. Only the privileged
-- transactional functions (and trusted server role) may invoke it.
REVOKE ALL ON FUNCTION public.sync_billing_record_financials(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_billing_record_financials(uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';
