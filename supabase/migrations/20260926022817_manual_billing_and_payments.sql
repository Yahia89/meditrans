-- Migration: Manual Billing and Payment Tracking Module
-- Date: 2026-09-26
-- Description: Complete production schema, authorization, transactional RPCs, and RLS
-- for tracking external DHS/MHCP claims, partner invoices (e.g. Connectivity of MN),
-- external submission attempts, payer responses, payments, allocations, adjustments,
-- activity audit logs, and supporting documents.

-- 1. Helper function for billing authorization
CREATE OR REPLACE FUNCTION public.has_billing_permission(_org_id uuid, _action text DEFAULT 'view_billing')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _is_super boolean := false;
  _role public.membership_role;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Super admin check
  SELECT is_super_admin INTO _is_super
  FROM public.user_profiles
  WHERE user_id = _user_id;

  IF _is_super IS TRUE THEN
    RETURN true;
  END IF;

  -- Check membership and role
  SELECT om.role INTO _role
  FROM public.organization_memberships om
  WHERE om.org_id = _org_id
    AND om.user_id = _user_id;

  IF _role IS NULL THEN
    RETURN false;
  END IF;

  -- Ensure user is not disabled
  IF EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.org_id = _org_id AND e.user_id = _user_id AND e.disabled = true
  ) OR EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.org_id = _org_id AND d.user_id = _user_id AND d.active = false
  ) OR EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.org_id = _org_id AND p.user_id = _user_id AND p.disabled = true
  ) THEN
    RETURN false;
  END IF;

  -- Role mapping: Only owner and admin have billing access
  IF _role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 2. Tenant-scoped Payers Table
CREATE TABLE IF NOT EXISTS public.billing_payers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  payer_type text NOT NULL CHECK (payer_type IN ('medicaid_direct', 'broker_partner', 'commercial', 'private_pay', 'other')),
  submission_channel text NOT NULL DEFAULT 'other' CHECK (submission_channel IN ('mn_its_dde', 'partner_portal', 'email', 'mail', 'fax', 'clearinghouse', 'other')),
  contact_name text,
  contact_email text,
  contact_phone text,
  payment_terms text, -- e.g. "Net 30", "Net 15", "Due on receipt"
  typical_follow_up_days integer DEFAULT 14 CHECK (typical_follow_up_days >= 0),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT billing_payers_org_name_key UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_billing_payers_org ON public.billing_payers(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_payers_type ON public.billing_payers(org_id, payer_type);

-- 3. Billing Records Table (Shared Model: DHS Claims and Partner Invoices)
CREATE TABLE IF NOT EXISTS public.billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN ('dhs_claim', 'partner_invoice')),
  payer_id uuid NOT NULL REFERENCES public.billing_payers(id) ON DELETE RESTRICT,
  internal_reference text NOT NULL,
  client_id uuid REFERENCES public.patients(id) ON DELETE RESTRICT,
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  due_date date,
  original_external_reference text,
  current_submission_attempt integer NOT NULL DEFAULT 0 CHECK (current_submission_attempt >= 0),
  external_submitted_at timestamptz,
  submitted_by_name text,
  submission_channel text CHECK (submission_channel IS NULL OR submission_channel IN ('mn_its_dde', 'partner_portal', 'email', 'mail', 'fax', 'clearinghouse', 'other')),
  payer_acknowledged_at timestamptz,
  follow_up_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  next_follow_up_date date,
  follow_up_notes text,
  
  -- Three Strongly Typed Status Dimensions
  submission_status text NOT NULL DEFAULT 'draft' CHECK (submission_status IN ('draft', 'submitted', 'received', 'rejected', 'cancelled', 'superseded')),
  adjudication_status text NOT NULL DEFAULT 'not_reported' CHECK (adjudication_status IN ('not_reported', 'in_review', 'approved', 'partially_approved', 'denied')),
  settlement_status text NOT NULL DEFAULT 'unpaid' CHECK (settlement_status IN ('unpaid', 'payment_scheduled', 'partially_paid', 'paid', 'overpaid')),
  
  -- Financial Totals (Numeric precision 12,2)
  total_billed_amount numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_billed_amount >= 0),
  total_allowed_amount numeric(12,2) CHECK (total_allowed_amount IS NULL OR total_allowed_amount >= 0),
  total_paid_amount numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_paid_amount >= 0),
  total_adjusted_amount numeric(12,2) NOT NULL DEFAULT 0.00,
  outstanding_balance numeric(12,2) NOT NULL DEFAULT 0.00,
  
  -- Versioning & Provenance
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_historical boolean NOT NULL DEFAULT false,
  is_summary_only boolean NOT NULL DEFAULT false,
  provenance text NOT NULL DEFAULT 'manual_entry' CHECK (provenance IN ('manual_entry', 'historical_backfill', 'legacy_import')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  superseded_by_record_id uuid REFERENCES public.billing_records(id) ON DELETE SET NULL,
  replaces_record_id uuid REFERENCES public.billing_records(id) ON DELETE SET NULL,
  
  CONSTRAINT billing_records_dhs_requires_client CHECK (record_type != 'dhs_claim' OR client_id IS NOT NULL),
  CONSTRAINT billing_records_period_valid CHECK (billing_period_start <= billing_period_end),
  CONSTRAINT billing_records_org_reference_key UNIQUE (org_id, internal_reference)
);

CREATE INDEX IF NOT EXISTS idx_billing_records_org ON public.billing_records(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_payer ON public.billing_records(org_id, payer_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_client ON public.billing_records(org_id, client_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_statuses ON public.billing_records(org_id, submission_status, adjudication_status, settlement_status);
CREATE INDEX IF NOT EXISTS idx_billing_records_period ON public.billing_records(org_id, billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_billing_records_follow_up ON public.billing_records(org_id, next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;

-- 4. Service Lines Table
CREATE TABLE IF NOT EXISTS public.billing_record_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.billing_records(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  service_date date NOT NULL,
  description text NOT NULL,
  hcpcs_code text,
  modifiers text[],
  quantity numeric(10,2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
  unit_type text NOT NULL DEFAULT 'one_way_trips' CHECK (unit_type IN ('miles', 'one_way_trips', 'hours', 'units', 'flat_rate', 'other')),
  unit_rate numeric(10,2) CHECK (unit_rate IS NULL OR unit_rate >= 0),
  billed_amount numeric(12,2) NOT NULL CHECK (billed_amount >= 0),
  allowed_amount numeric(12,2) CHECK (allowed_amount IS NULL OR allowed_amount >= 0),
  adjusted_amount numeric(12,2) NOT NULL DEFAULT 0.00,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
  line_status text NOT NULL DEFAULT 'draft' CHECK (line_status IN ('draft', 'submitted', 'received', 'approved', 'partially_approved', 'denied', 'paid', 'adjusted')),
  service_agreement_id uuid REFERENCES public.billing_service_agreements(id) ON DELETE SET NULL,
  service_agreement_line_id uuid REFERENCES public.billing_service_agreement_lines(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  trip_component text CHECK (trip_component IS NULL OR trip_component IN ('transport', 'mileage', 'no_show', 'wait_time', 'other')),
  denial_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_record_lines_record ON public.billing_record_lines(record_id);
CREATE INDEX IF NOT EXISTS idx_billing_record_lines_client ON public.billing_record_lines(client_id);
CREATE INDEX IF NOT EXISTS idx_billing_record_lines_trip ON public.billing_record_lines(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_record_lines_service_date ON public.billing_record_lines(service_date);

-- Duplicate Trip Component Protection Trigger Function
CREATE OR REPLACE FUNCTION public.check_trip_component_duplicate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _existing_ref text;
  _parent_status text;
BEGIN
  IF NEW.trip_id IS NULL OR NEW.trip_component IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if the parent record is active
  SELECT submission_status INTO _parent_status
  FROM public.billing_records
  WHERE id = NEW.record_id;

  IF _parent_status IN ('cancelled', 'superseded') THEN
    RETURN NEW;
  END IF;

  -- Look for conflicting active line on another record
  SELECT br.internal_reference INTO _existing_ref
  FROM public.billing_record_lines brl
  JOIN public.billing_records br ON br.id = brl.record_id
  WHERE brl.trip_id = NEW.trip_id
    AND brl.trip_component = NEW.trip_component
    AND brl.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND brl.record_id != NEW.record_id
    AND br.submission_status NOT IN ('cancelled', 'superseded')
    AND br.adjudication_status != 'denied'
  LIMIT 1;

  IF _existing_ref IS NOT NULL THEN
    RAISE EXCEPTION 'Trip % component "%" has already been recorded/billed on active record %',
      NEW.trip_id, NEW.trip_component, _existing_ref;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_trip_component_duplicate ON public.billing_record_lines;
CREATE TRIGGER trg_check_trip_component_duplicate
  BEFORE INSERT OR UPDATE OF trip_id, trip_component, record_id
  ON public.billing_record_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.check_trip_component_duplicate();

-- 5. Submission Attempts Table
CREATE TABLE IF NOT EXISTS public.billing_submission_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.billing_records(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  purpose text NOT NULL CHECK (purpose IN ('original', 'resubmission_correction', 'replacement', 'void_recorded')),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_name text,
  submission_channel text NOT NULL CHECK (submission_channel IN ('mn_its_dde', 'partner_portal', 'email', 'mail', 'fax', 'clearinghouse', 'other')),
  external_reference text,
  snapshot_billed_amount numeric(12,2) NOT NULL CHECK (snapshot_billed_amount >= 0),
  notes text,
  CONSTRAINT billing_submission_attempts_record_attempt_key UNIQUE (record_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_billing_submission_attempts_record ON public.billing_submission_attempts(record_id);

-- 6. Payer Responses Table
CREATE TABLE IF NOT EXISTS public.billing_payer_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.billing_records(id) ON DELETE CASCADE,
  submission_attempt_id uuid REFERENCES public.billing_submission_attempts(id) ON DELETE SET NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  response_type text NOT NULL CHECK (response_type IN ('acknowledgement', 'review_notice', 'approval', 'partial_approval', 'denial', 'remittance_835', 'dispute', 'other')),
  adjudication_status text CHECK (adjudication_status IS NULL OR adjudication_status IN ('in_review', 'approved', 'partially_approved', 'denied')),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payer_claim_number text,
  category_code text,
  status_code text,
  adjustment_group_code text,
  adjustment_reason_code text,
  remark_code text,
  payer_reported_amount numeric(12,2),
  raw_description text,
  evidence_doc_name text,
  evidence_doc_reference text,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_billing_payer_responses_record ON public.billing_payer_responses(record_id);

-- 7. Payments Table (Tenant Scoped, Checks, EFT, ACH)
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES public.billing_payers(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  payment_method text NOT NULL CHECK (payment_method IN ('check', 'eft', 'ach', 'credit_card', 'virtual_card', 'other')),
  reference_number text NOT NULL,
  payer_reported_date date,
  received_date date, -- Confirmed funds received date; if NULL, funds unconfirmed
  reconciliation_status text NOT NULL DEFAULT 'unapplied' CHECK (reconciliation_status IN ('unapplied', 'partially_applied', 'fully_applied', 'reconciled')),
  unapplied_amount numeric(12,2) NOT NULL CHECK (unapplied_amount >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reconciled_at timestamptz,
  reconciled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT billing_payments_unapplied_valid CHECK (unapplied_amount <= amount)
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_org ON public.billing_payments(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_payer ON public.billing_payments(org_id, payer_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_dates ON public.billing_payments(org_id, received_date);

-- 8. Payment Allocations Table
CREATE TABLE IF NOT EXISTS public.billing_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.billing_payments(id) ON DELETE RESTRICT,
  record_id uuid NOT NULL REFERENCES public.billing_records(id) ON DELETE RESTRICT,
  record_line_id uuid REFERENCES public.billing_record_lines(id) ON DELETE SET NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  allocated_at timestamptz NOT NULL DEFAULT now(),
  allocated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_billing_payment_allocations_payment ON public.billing_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_payment_allocations_record ON public.billing_payment_allocations(record_id);

-- 9. Adjustments Table (Contractual, Payer reductions, Write-offs)
CREATE TABLE IF NOT EXISTS public.billing_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.billing_records(id) ON DELETE RESTRICT,
  record_line_id uuid REFERENCES public.billing_record_lines(id) ON DELETE SET NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('contractual_allowance', 'payer_reduction', 'discretionary_write_off', 'copay_deductible', 'reversal', 'recoupment', 'other')),
  amount numeric(12,2) NOT NULL,
  reason text NOT NULL,
  authorized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT billing_adjustments_reason_not_empty CHECK (length(trim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_billing_adjustments_record ON public.billing_adjustments(record_id);

-- 10. Activity Logs Table (Append-only Audit Trail)
CREATE TABLE IF NOT EXISTS public.billing_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.billing_records(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  payload jsonb DEFAULT '{}'::jsonb,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_billing_activity_logs_record ON public.billing_activity_logs(record_id, occurred_at);

-- 11. Attached Documents Table
CREATE TABLE IF NOT EXISTS public.billing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  record_id uuid REFERENCES public.billing_records(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.billing_payments(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0),
  mime_type text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('claim_copy', 'invoice_copy', 'submission_receipt', 'payer_notice', 'remittance_advice', 'service_agreement', 'trip_summary', 'other')),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_billing_documents_record ON public.billing_documents(record_id);
CREATE INDEX IF NOT EXISTS idx_billing_documents_payment ON public.billing_documents(payment_id);

-- 12. Row Level Security Policies
ALTER TABLE public.billing_payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_record_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_submission_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payer_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_documents ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_billing_payers" ON public.billing_payers TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_billing_records" ON public.billing_records TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_billing_record_lines" ON public.billing_record_lines TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_billing_submission_attempts" ON public.billing_submission_attempts TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_billing_payer_responses" ON public.billing_payer_responses TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_billing_payments" ON public.billing_payments TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_billing_payment_allocations" ON public.billing_payment_allocations TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_billing_adjustments" ON public.billing_adjustments TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_billing_activity_logs" ON public.billing_activity_logs TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_billing_documents" ON public.billing_documents TO service_role USING (true) WITH CHECK (true);

-- Authenticated billing permission policies
CREATE POLICY "auth_billing_payers_select" ON public.billing_payers FOR SELECT TO authenticated
  USING (has_billing_permission(org_id, 'view_billing'));
CREATE POLICY "auth_billing_payers_modify" ON public.billing_payers FOR ALL TO authenticated
  USING (has_billing_permission(org_id, 'manage_payers'))
  WITH CHECK (has_billing_permission(org_id, 'manage_payers'));

CREATE POLICY "auth_billing_records_select" ON public.billing_records FOR SELECT TO authenticated
  USING (has_billing_permission(org_id, 'view_billing'));
CREATE POLICY "auth_billing_records_modify" ON public.billing_records FOR ALL TO authenticated
  USING (has_billing_permission(org_id, 'manage_billing_records'))
  WITH CHECK (has_billing_permission(org_id, 'manage_billing_records'));

CREATE POLICY "auth_billing_record_lines_select" ON public.billing_record_lines FOR SELECT TO authenticated
  USING (has_billing_permission(org_id, 'view_billing'));
CREATE POLICY "auth_billing_record_lines_modify" ON public.billing_record_lines FOR ALL TO authenticated
  USING (has_billing_permission(org_id, 'manage_billing_records'))
  WITH CHECK (has_billing_permission(org_id, 'manage_billing_records'));

CREATE POLICY "auth_billing_submission_attempts_select" ON public.billing_submission_attempts FOR SELECT TO authenticated
  USING (has_billing_permission(org_id, 'view_billing'));
CREATE POLICY "auth_billing_submission_attempts_insert" ON public.billing_submission_attempts FOR INSERT TO authenticated
  WITH CHECK (has_billing_permission(org_id, 'manage_billing_records'));

CREATE POLICY "auth_billing_payer_responses_select" ON public.billing_payer_responses FOR SELECT TO authenticated
  USING (has_billing_permission(org_id, 'view_billing'));
CREATE POLICY "auth_billing_payer_responses_insert" ON public.billing_payer_responses FOR INSERT TO authenticated
  WITH CHECK (has_billing_permission(org_id, 'record_payer_responses'));

CREATE POLICY "auth_billing_payments_select" ON public.billing_payments FOR SELECT TO authenticated
  USING (has_billing_permission(org_id, 'view_billing'));
CREATE POLICY "auth_billing_payments_modify" ON public.billing_payments FOR ALL TO authenticated
  USING (has_billing_permission(org_id, 'record_payments'))
  WITH CHECK (has_billing_permission(org_id, 'record_payments'));

CREATE POLICY "auth_billing_payment_allocations_select" ON public.billing_payment_allocations FOR SELECT TO authenticated
  USING (has_billing_permission(org_id, 'view_billing'));
CREATE POLICY "auth_billing_payment_allocations_modify" ON public.billing_payment_allocations FOR ALL TO authenticated
  USING (has_billing_permission(org_id, 'record_payments'))
  WITH CHECK (has_billing_permission(org_id, 'record_payments'));

CREATE POLICY "auth_billing_adjustments_select" ON public.billing_adjustments FOR SELECT TO authenticated
  USING (has_billing_permission(org_id, 'view_billing'));
CREATE POLICY "auth_billing_adjustments_insert" ON public.billing_adjustments FOR INSERT TO authenticated
  WITH CHECK (has_billing_permission(org_id, 'approve_adjustments'));

CREATE POLICY "auth_billing_activity_logs_select" ON public.billing_activity_logs FOR SELECT TO authenticated
  USING (has_billing_permission(org_id, 'view_billing'));
CREATE POLICY "auth_billing_activity_logs_insert" ON public.billing_activity_logs FOR INSERT TO authenticated
  WITH CHECK (has_billing_permission(org_id, 'view_billing'));

CREATE POLICY "auth_billing_documents_select" ON public.billing_documents FOR SELECT TO authenticated
  USING (has_billing_permission(org_id, 'view_billing'));
CREATE POLICY "auth_billing_documents_modify" ON public.billing_documents FOR ALL TO authenticated
  USING (has_billing_permission(org_id, 'manage_billing_records'))
  WITH CHECK (has_billing_permission(org_id, 'manage_billing_records'));

-- 13. Private Storage Bucket Setup for billing-documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'billing-documents',
  'billing-documents',
  false,
  20971520, -- 20MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/csv', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/csv', 'text/plain'];

-- Storage RLS
CREATE POLICY "billing_docs_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'billing-documents' AND
    has_billing_permission((storage.foldername(name))[1]::uuid, 'view_billing')
  );

CREATE POLICY "billing_docs_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'billing-documents' AND
    has_billing_permission((storage.foldername(name))[1]::uuid, 'manage_billing_records')
  );

CREATE POLICY "billing_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'billing-documents' AND
    has_billing_permission((storage.foldername(name))[1]::uuid, 'manage_billing_records')
  );

-- 14. Transactional RPC Commands

-- Helper: Recalculate and update billing record financial state and settlement status
CREATE OR REPLACE FUNCTION public.sync_billing_record_financials(_record_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _billed numeric(12,2) := 0.00;
  _paid numeric(12,2) := 0.00;
  _adjusted numeric(12,2) := 0.00;
  _balance numeric(12,2) := 0.00;
  _new_settlement text := 'unpaid';
  _sub_status text;
BEGIN
  -- Sum billed from lines
  SELECT COALESCE(SUM(billed_amount), 0.00) INTO _billed
  FROM public.billing_record_lines
  WHERE record_id = _record_id;

  -- Sum net allocations from payments
  SELECT COALESCE(SUM(bpa.amount), 0.00) INTO _paid
  FROM public.billing_payment_allocations bpa
  JOIN public.billing_payments bp ON bp.id = bpa.payment_id
  WHERE bpa.record_id = _record_id
    AND bp.received_date IS NOT NULL; -- Net confirmed receipts only!

  -- Sum adjustments
  SELECT COALESCE(SUM(amount), 0.00) INTO _adjusted
  FROM public.billing_adjustments
  WHERE record_id = _record_id;

  _balance := _billed - _paid - _adjusted;

  -- Determine settlement status
  IF _paid > 0 AND _balance <= 0 AND (_paid + _adjusted) > _billed THEN
    _new_settlement := 'overpaid';
  ELSIF _paid > 0 AND _balance <= 0 THEN
    _new_settlement := 'paid';
  ELSIF _paid > 0 AND _balance > 0 THEN
    _new_settlement := 'partially_paid';
  ELSIF _paid = 0 AND _balance <= 0 AND _adjusted >= _billed AND _billed > 0 THEN
    -- Fully adjusted/written off with zero cash receipts: remains unpaid or adjusted, NOT 'paid'
    _new_settlement := 'unpaid';
  ELSE
    _new_settlement := 'unpaid';
  END IF;

  UPDATE public.billing_records
  SET
    total_billed_amount = _billed,
    total_paid_amount = _paid,
    total_adjusted_amount = _adjusted,
    outstanding_balance = _balance,
    settlement_status = _new_settlement,
    updated_at = now()
  WHERE id = _record_id;
END;
$$;

-- RPC 1: Create Billing Record with Lines
CREATE OR REPLACE FUNCTION public.create_billing_record(
  p_record jsonb,
  p_lines jsonb[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _org_id uuid := (p_record->>'org_id')::uuid;
  _user_id uuid := auth.uid();
  _record_id uuid;
  _internal_ref text := p_record->>'internal_reference';
  _record_type text := p_record->>'record_type';
  _payer_id uuid := (p_record->>'payer_id')::uuid;
  _client_id uuid := (p_record->>'client_id')::uuid;
  _period_start date := (p_record->>'billing_period_start')::date;
  _period_end date := (p_record->>'billing_period_end')::date;
  _sub_status text := COALESCE(p_record->>'submission_status', 'draft');
  _ext_submitted_at timestamptz := (p_record->>'external_submitted_at')::timestamptz;
  _total_billed numeric(12,2) := 0.00;
  _line jsonb;
  _line_amount numeric(12,2);
  _seq integer;
  _result jsonb;
BEGIN
  -- Permission check
  IF NOT public.has_billing_permission(_org_id, 'manage_billing_records') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient billing permissions for organization %', _org_id;
  END IF;

  -- Validate record type
  IF _record_type NOT IN ('dhs_claim', 'partner_invoice') THEN
    RAISE EXCEPTION 'Invalid record_type: %', _record_type;
  END IF;

  -- DHS claim must have client_id
  IF _record_type = 'dhs_claim' AND _client_id IS NULL THEN
    RAISE EXCEPTION 'DHS claims must have an associated client_id';
  END IF;

  -- For already submitted records, require actual external submission date
  IF _sub_status = 'submitted' AND _ext_submitted_at IS NULL THEN
    RAISE EXCEPTION 'External submission date (external_submitted_at) is required when marking a record as submitted';
  END IF;

  -- Generate internal reference if not provided
  IF _internal_ref IS NULL OR trim(_internal_ref) = '' THEN
    SELECT COALESCE(COUNT(*), 0) + 1 INTO _seq
    FROM public.billing_records
    WHERE org_id = _org_id AND record_type = _record_type;

    IF _record_type = 'dhs_claim' THEN
      _internal_ref := 'CLM-' || to_char(now(), 'YYYY') || '-' || lpad(_seq::text, 4, '0');
    ELSE
      _internal_ref := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(_seq::text, 4, '0');
    END IF;
  END IF;

  -- Sum up billed amount from lines
  FOREACH _line IN ARRAY p_lines
  LOOP
    _line_amount := (_line->>'billed_amount')::numeric(12,2);
    _total_billed := _total_billed + _line_amount;
  END LOOP;

  -- Insert header record
  INSERT INTO public.billing_records (
    org_id,
    record_type,
    payer_id,
    internal_reference,
    client_id,
    billing_period_start,
    billing_period_end,
    due_date,
    original_external_reference,
    current_submission_attempt,
    external_submitted_at,
    submitted_by_name,
    submission_channel,
    submission_status,
    adjudication_status,
    settlement_status,
    total_billed_amount,
    total_allowed_amount,
    total_paid_amount,
    total_adjusted_amount,
    outstanding_balance,
    version,
    is_historical,
    is_summary_only,
    provenance,
    notes,
    follow_up_owner_id,
    next_follow_up_date,
    follow_up_notes,
    created_by,
    updated_by
  ) VALUES (
    _org_id,
    _record_type,
    _payer_id,
    _internal_ref,
    _client_id,
    _period_start,
    _period_end,
    (p_record->>'due_date')::date,
    p_record->>'original_external_reference',
    CASE WHEN _sub_status = 'submitted' THEN 1 ELSE 0 END,
    _ext_submitted_at,
    p_record->>'submitted_by_name',
    p_record->>'submission_channel',
    _sub_status,
    COALESCE(p_record->>'adjudication_status', 'not_reported'),
    COALESCE(p_record->>'settlement_status', 'unpaid'),
    _total_billed,
    (p_record->>'total_allowed_amount')::numeric(12,2),
    0.00,
    0.00,
    _total_billed,
    1,
    COALESCE((p_record->>'is_historical')::boolean, false),
    COALESCE((p_record->>'is_summary_only')::boolean, false),
    COALESCE(p_record->>'provenance', 'manual_entry'),
    p_record->>'notes',
    (p_record->>'follow_up_owner_id')::uuid,
    (p_record->>'next_follow_up_date')::date,
    p_record->>'follow_up_notes',
    _user_id,
    _user_id
  ) RETURNING id INTO _record_id;

  -- Insert lines
  FOREACH _line IN ARRAY p_lines
  LOOP
    INSERT INTO public.billing_record_lines (
      record_id,
      org_id,
      client_id,
      service_date,
      description,
      hcpcs_code,
      modifiers,
      quantity,
      unit_type,
      unit_rate,
      billed_amount,
      allowed_amount,
      adjusted_amount,
      paid_amount,
      line_status,
      service_agreement_id,
      service_agreement_line_id,
      trip_id,
      trip_component,
      notes
    ) VALUES (
      _record_id,
      _org_id,
      COALESCE((_line->>'client_id')::uuid, _client_id),
      (_line->>'service_date')::date,
      _line->>'description',
      _line->>'hcpcs_code',
      CASE WHEN _line->'modifiers' IS NOT NULL AND jsonb_typeof(_line->'modifiers') = 'array' 
           THEN ARRAY(SELECT jsonb_array_elements_text(_line->'modifiers'))
           ELSE NULL END,
      COALESCE((_line->>'quantity')::numeric(10,2), 1.00),
      COALESCE(_line->>'unit_type', 'one_way_trips'),
      (_line->>'unit_rate')::numeric(10,2),
      (_line->>'billed_amount')::numeric(12,2),
      (_line->>'allowed_amount')::numeric(12,2),
      0.00,
      0.00,
      CASE WHEN _sub_status = 'submitted' THEN 'submitted' ELSE 'draft' END,
      (_line->>'service_agreement_id')::uuid,
      (_line->>'service_agreement_line_id')::uuid,
      (_line->>'trip_id')::uuid,
      _line->>'trip_component',
      _line->>'notes'
    );
  END LOOP;

  -- If submitted at creation, record initial submission attempt
  IF _sub_status = 'submitted' THEN
    INSERT INTO public.billing_submission_attempts (
      record_id,
      org_id,
      attempt_number,
      purpose,
      occurred_at,
      recorded_at,
      recorded_by,
      submitted_by_name,
      submission_channel,
      external_reference,
      snapshot_billed_amount,
      notes
    ) VALUES (
      _record_id,
      _org_id,
      1,
      'original',
      _ext_submitted_at,
      now(),
      _user_id,
      p_record->>'submitted_by_name',
      COALESCE(p_record->>'submission_channel', 'other'),
      p_record->>'original_external_reference',
      _total_billed,
      'Initial external submission recorded'
    );
  END IF;

  -- Record audit log
  INSERT INTO public.billing_activity_logs (
    record_id,
    org_id,
    event_type,
    occurred_at,
    actor_id,
    notes,
    payload
  ) VALUES (
    _record_id,
    _org_id,
    CASE WHEN _sub_status = 'submitted' THEN 'external_submission_recorded' ELSE 'draft_created' END,
    COALESCE(_ext_submitted_at, now()),
    _user_id,
    CASE WHEN _sub_status = 'submitted' THEN 'Recorded external submission upon creation' ELSE 'Created draft billing record' END,
    jsonb_build_object('internal_reference', _internal_ref, 'total_billed', _total_billed)
  );

  -- Return complete record JSON
  SELECT to_jsonb(r) INTO _result
  FROM public.billing_records r
  WHERE r.id = _record_id;

  RETURN _result;
END;
$$;

-- RPC 2: Record External Submission
CREATE OR REPLACE FUNCTION public.record_external_submission(
  p_record_id uuid,
  p_submission jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _rec public.billing_records%ROWTYPE;
  _user_id uuid := auth.uid();
  _occurred_at timestamptz := (p_submission->>'occurred_at')::timestamptz;
  _next_attempt integer;
  _ext_ref text := p_submission->>'external_reference';
  _channel text := COALESCE(p_submission->>'submission_channel', 'other');
  _submitted_by text := p_submission->>'submitted_by_name';
  _notes text := p_submission->>'notes';
  _result jsonb;
BEGIN
  SELECT * INTO _rec FROM public.billing_records WHERE id = p_record_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing record not found: %', p_record_id;
  END IF;

  IF NOT public.has_billing_permission(_rec.org_id, 'manage_billing_records') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient billing permissions';
  END IF;

  IF _occurred_at IS NULL THEN
    RAISE EXCEPTION 'Actual external submission date/time (occurred_at) is required';
  END IF;

  _next_attempt := _rec.current_submission_attempt + 1;

  -- Freeze snapshot in submission attempt
  INSERT INTO public.billing_submission_attempts (
    record_id,
    org_id,
    attempt_number,
    purpose,
    occurred_at,
    recorded_at,
    recorded_by,
    submitted_by_name,
    submission_channel,
    external_reference,
    snapshot_billed_amount,
    notes
  ) VALUES (
    p_record_id,
    _rec.org_id,
    _next_attempt,
    COALESCE(p_submission->>'purpose', 'original'),
    _occurred_at,
    now(),
    _user_id,
    _submitted_by,
    _channel,
    _ext_ref,
    _rec.total_billed_amount,
    _notes
  );

  -- Update record state
  UPDATE public.billing_records
  SET
    submission_status = 'submitted',
    current_submission_attempt = _next_attempt,
    external_submitted_at = _occurred_at,
    submitted_by_name = COALESCE(_submitted_by, submitted_by_name),
    submission_channel = _channel,
    original_external_reference = COALESCE(_ext_ref, original_external_reference),
    version = version + 1,
    updated_at = now(),
    updated_by = _user_id
  WHERE id = p_record_id;

  -- Update line statuses
  UPDATE public.billing_record_lines
  SET line_status = 'submitted', updated_at = now()
  WHERE record_id = p_record_id AND line_status = 'draft';

  -- Activity log
  INSERT INTO public.billing_activity_logs (
    record_id,
    org_id,
    event_type,
    occurred_at,
    actor_id,
    notes,
    payload
  ) VALUES (
    p_record_id,
    _rec.org_id,
    'external_submission_recorded',
    _occurred_at,
    _user_id,
    'Recorded external submission attempt ' || _next_attempt,
    jsonb_build_object('attempt_number', _next_attempt, 'external_reference', _ext_ref, 'channel', _channel)
  );

  SELECT to_jsonb(r) INTO _result FROM public.billing_records r WHERE r.id = p_record_id;
  RETURN _result;
END;
$$;

-- RPC 3: Record Payer Response
CREATE OR REPLACE FUNCTION public.record_payer_response(
  p_record_id uuid,
  p_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _rec public.billing_records%ROWTYPE;
  _user_id uuid := auth.uid();
  _occurred_at timestamptz := (p_response->>'occurred_at')::timestamptz;
  _response_type text := p_response->>'response_type';
  _adjudication text := p_response->>'adjudication_status';
  _new_sub_status text;
  _new_adj_status text;
  _result jsonb;
BEGIN
  SELECT * INTO _rec FROM public.billing_records WHERE id = p_record_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing record not found: %', p_record_id;
  END IF;

  IF NOT public.has_billing_permission(_rec.org_id, 'record_payer_responses') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient billing permissions';
  END IF;

  IF _occurred_at IS NULL THEN
    RAISE EXCEPTION 'Response date/time (occurred_at) is required';
  END IF;

  -- Map normalized status updates based on response type
  _new_sub_status := _rec.submission_status;
  _new_adj_status := _rec.adjudication_status;

  IF _response_type = 'acknowledgement' THEN
    _new_sub_status := 'received';
  ELSIF _response_type = 'review_notice' THEN
    _new_sub_status := 'received';
    _new_adj_status := 'in_review';
  ELSIF _response_type = 'approval' THEN
    _new_sub_status := 'received';
    _new_adj_status := 'approved';
  ELSIF _response_type = 'partial_approval' THEN
    _new_sub_status := 'received';
    _new_adj_status := 'partially_approved';
  ELSIF _response_type = 'denial' THEN
    _new_adj_status := 'denied';
  ELSIF _response_type = 'dispute' THEN
    _new_adj_status := 'in_review';
  END IF;

  IF _adjudication IS NOT NULL THEN
    _new_adj_status := _adjudication;
  END IF;

  -- Insert response entry
  INSERT INTO public.billing_payer_responses (
    record_id,
    submission_attempt_id,
    org_id,
    response_type,
    adjudication_status,
    occurred_at,
    recorded_at,
    recorded_by,
    payer_claim_number,
    category_code,
    status_code,
    adjustment_group_code,
    adjustment_reason_code,
    remark_code,
    payer_reported_amount,
    raw_description,
    evidence_doc_name,
    evidence_doc_reference,
    notes
  ) VALUES (
    p_record_id,
    (p_response->>'submission_attempt_id')::uuid,
    _rec.org_id,
    _response_type,
    _new_adj_status,
    _occurred_at,
    now(),
    _user_id,
    p_response->>'payer_claim_number',
    p_response->>'category_code',
    p_response->>'status_code',
    p_response->>'adjustment_group_code',
    p_response->>'adjustment_reason_code',
    p_response->>'remark_code',
    (p_response->>'payer_reported_amount')::numeric(12,2),
    p_response->>'raw_description',
    p_response->>'evidence_doc_name',
    p_response->>'evidence_doc_reference',
    p_response->>'notes'
  );

  -- Update record statuses
  UPDATE public.billing_records
  SET
    submission_status = _new_sub_status,
    adjudication_status = _new_adj_status,
    payer_acknowledged_at = CASE WHEN _new_sub_status = 'received' AND payer_acknowledged_at IS NULL THEN _occurred_at ELSE payer_acknowledged_at END,
    version = version + 1,
    updated_at = now(),
    updated_by = _user_id
  WHERE id = p_record_id;

  -- Activity log
  INSERT INTO public.billing_activity_logs (
    record_id,
    org_id,
    event_type,
    occurred_at,
    actor_id,
    notes,
    payload
  ) VALUES (
    p_record_id,
    _rec.org_id,
    'payer_response_recorded',
    _occurred_at,
    _user_id,
    'Recorded payer response: ' || _response_type,
    p_response
  );

  SELECT to_jsonb(r) INTO _result FROM public.billing_records r WHERE r.id = p_record_id;
  RETURN _result;
END;
$$;

-- RPC 4: Record Payment and Allocations
CREATE OR REPLACE FUNCTION public.record_payment_and_allocations(
  p_payment jsonb,
  p_allocations jsonb[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _org_id uuid := (p_payment->>'org_id')::uuid;
  _payer_id uuid := (p_payment->>'payer_id')::uuid;
  _total_payment numeric(12,2) := (p_payment->>'amount')::numeric(12,2);
  _user_id uuid := auth.uid();
  _payment_id uuid;
  _total_allocated numeric(12,2) := 0.00;
  _alloc jsonb;
  _alloc_amount numeric(12,2);
  _rec_id uuid;
  _rec_org uuid;
  _rec_payer uuid;
  _result jsonb;
BEGIN
  IF NOT public.has_billing_permission(_org_id, 'record_payments') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient billing permissions to record payments';
  END IF;

  IF _total_payment <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- Validate sum of allocations
  IF p_allocations IS NOT NULL THEN
    FOREACH _alloc IN ARRAY p_allocations
    LOOP
      _alloc_amount := (_alloc->>'amount')::numeric(12,2);
      _rec_id := (_alloc->>'record_id')::uuid;

      IF _alloc_amount <= 0 THEN
        RAISE EXCEPTION 'Allocation amount must be greater than zero';
      END IF;

      -- Validate tenant and payer match
      SELECT org_id, payer_id INTO _rec_org, _rec_payer
      FROM public.billing_records
      WHERE id = _rec_id;

      IF _rec_org IS NULL THEN
        RAISE EXCEPTION 'Billing record not found for allocation: %', _rec_id;
      END IF;

      IF _rec_org != _org_id THEN
        RAISE EXCEPTION 'Cross-tenant allocation rejected: record % belongs to org %', _rec_id, _rec_org;
      END IF;

      IF _rec_payer != _payer_id THEN
        RAISE EXCEPTION 'Payer mismatch on allocation: record % belongs to payer %', _rec_id, _rec_payer;
      END IF;

      _total_allocated := _total_allocated + _alloc_amount;
    END LOOP;
  END IF;

  IF _total_allocated > _total_payment THEN
    RAISE EXCEPTION 'Total allocated (%) cannot exceed available payment amount (%)',
      _total_allocated, _total_payment;
  END IF;

  -- Insert payment header
  INSERT INTO public.billing_payments (
    org_id,
    payer_id,
    amount,
    currency,
    payment_method,
    reference_number,
    payer_reported_date,
    received_date,
    reconciliation_status,
    unapplied_amount,
    notes,
    created_by
  ) VALUES (
    _org_id,
    _payer_id,
    _total_payment,
    COALESCE(p_payment->>'currency', 'USD'),
    p_payment->>'payment_method',
    p_payment->>'reference_number',
    (p_payment->>'payer_reported_date')::date,
    (p_payment->>'received_date')::date,
    CASE 
      WHEN _total_allocated = 0 THEN 'unapplied'
      WHEN _total_allocated < _total_payment THEN 'partially_applied'
      ELSE 'fully_applied'
    END,
    _total_payment - _total_allocated,
    p_payment->>'notes',
    _user_id
  ) RETURNING id INTO _payment_id;

  -- Insert allocations and sync each record
  IF p_allocations IS NOT NULL THEN
    FOREACH _alloc IN ARRAY p_allocations
    LOOP
      _alloc_amount := (_alloc->>'amount')::numeric(12,2);
      _rec_id := (_alloc->>'record_id')::uuid;

      INSERT INTO public.billing_payment_allocations (
        payment_id,
        record_id,
        record_line_id,
        org_id,
        amount,
        allocated_by,
        notes
      ) VALUES (
        _payment_id,
        _rec_id,
        (_alloc->>'record_line_id')::uuid,
        _org_id,
        _alloc_amount,
        _user_id,
        _alloc->>'notes'
      );

      -- Sync financial totals on the record
      PERFORM public.sync_billing_record_financials(_rec_id);

      -- Activity log on the record
      INSERT INTO public.billing_activity_logs (
        record_id,
        org_id,
        event_type,
        occurred_at,
        actor_id,
        notes,
        payload
      ) VALUES (
        _rec_id,
        _org_id,
        'payment_allocated',
        COALESCE((p_payment->>'received_date')::timestamptz, now()),
        _user_id,
        'Allocated $' || _alloc_amount || ' from payment ref ' || (p_payment->>'reference_number'),
        jsonb_build_object('payment_id', _payment_id, 'amount', _alloc_amount)
      );
    END LOOP;
  END IF;

  SELECT to_jsonb(p) INTO _result FROM public.billing_payments p WHERE p.id = _payment_id;
  RETURN _result;
END;
$$;

-- RPC 5: Record Adjustment
CREATE OR REPLACE FUNCTION public.record_adjustment(
  p_record_id uuid,
  p_adjustment jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _rec public.billing_records%ROWTYPE;
  _user_id uuid := auth.uid();
  _amount numeric(12,2) := (p_adjustment->>'amount')::numeric(12,2);
  _type text := p_adjustment->>'adjustment_type';
  _reason text := p_adjustment->>'reason';
  _adj_id uuid;
  _result jsonb;
BEGIN
  SELECT * INTO _rec FROM public.billing_records WHERE id = p_record_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing record not found: %', p_record_id;
  END IF;

  IF NOT public.has_billing_permission(_rec.org_id, 'approve_adjustments') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient billing permissions for adjustments';
  END IF;

  IF _reason IS NULL OR trim(_reason) = '' THEN
    RAISE EXCEPTION 'Adjustment reason is required';
  END IF;

  INSERT INTO public.billing_adjustments (
    record_id,
    record_line_id,
    org_id,
    adjustment_type,
    amount,
    reason,
    authorized_by,
    created_by
  ) VALUES (
    p_record_id,
    (p_adjustment->>'record_line_id')::uuid,
    _rec.org_id,
    _type,
    _amount,
    _reason,
    COALESCE((p_adjustment->>'authorized_by')::uuid, _user_id),
    _user_id
  ) RETURNING id INTO _adj_id;

  -- Recalculate financials
  PERFORM public.sync_billing_record_financials(p_record_id);

  -- Activity log
  INSERT INTO public.billing_activity_logs (
    record_id,
    org_id,
    event_type,
    occurred_at,
    actor_id,
    notes,
    payload
  ) VALUES (
    p_record_id,
    _rec.org_id,
    'adjustment_recorded',
    now(),
    _user_id,
    'Recorded adjustment of $' || _amount || ' (' || _type || '): ' || _reason,
    p_adjustment
  );

  SELECT to_jsonb(r) INTO _result FROM public.billing_records r WHERE r.id = p_record_id;
  RETURN _result;
END;
$$;

-- RPC 6: Record Resubmission / Replacement
CREATE OR REPLACE FUNCTION public.record_resubmission(
  p_original_record_id uuid,
  p_new_record jsonb,
  p_lines jsonb[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _orig public.billing_records%ROWTYPE;
  _user_id uuid := auth.uid();
  _new_record_json jsonb;
  _new_record_id uuid;
  _result jsonb;
BEGIN
  SELECT * INTO _orig FROM public.billing_records WHERE id = p_original_record_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original record not found: %', p_original_record_id;
  END IF;

  IF NOT public.has_billing_permission(_orig.org_id, 'manage_billing_records') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient billing permissions';
  END IF;

  -- Mark original as superseded
  UPDATE public.billing_records
  SET
    submission_status = 'superseded',
    version = version + 1,
    updated_at = now(),
    updated_by = _user_id
  WHERE id = p_original_record_id;

  -- Create replacement record
  _new_record_json := p_new_record || jsonb_build_object(
    'org_id', _orig.org_id,
    'replaces_record_id', p_original_record_id
  );

  _result := public.create_billing_record(_new_record_json, p_lines);
  _new_record_id := (_result->>'id')::uuid;

  -- Link original to new replacement
  UPDATE public.billing_records
  SET superseded_by_record_id = _new_record_id
  WHERE id = p_original_record_id;

  -- Activity log on both
  INSERT INTO public.billing_activity_logs (
    record_id, org_id, event_type, occurred_at, actor_id, notes, payload
  ) VALUES (
    p_original_record_id, _orig.org_id, 'superseded_by_resubmission', now(), _user_id,
    'Claim superseded by replacement revision ' || (_result->>'internal_reference'),
    jsonb_build_object('replacement_record_id', _new_record_id)
  );

  INSERT INTO public.billing_activity_logs (
    record_id, org_id, event_type, occurred_at, actor_id, notes, payload
  ) VALUES (
    _new_record_id, _orig.org_id, 'resubmission_created', now(), _user_id,
    'Created resubmission replacing ' || _orig.internal_reference,
    jsonb_build_object('original_record_id', p_original_record_id)
  );

  RETURN _result;
END;
$$;
