-- Validate new/changed billing references without rewriting historical rows.
-- Runs inside both the checked RPCs and direct metadata inserts. Invoker rights
-- preserve RLS for direct callers; this function does not grant database access.
CREATE OR REPLACE FUNCTION public.validate_billing_tenant_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _record public.billing_records%ROWTYPE;
  _payment public.billing_payments%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'Billing records cannot be moved between organizations'
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME IN ('billing_records', 'billing_payments') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.billing_payers p
      WHERE p.id = NEW.payer_id AND p.org_id = NEW.org_id
    ) THEN
      RAISE EXCEPTION 'Billing payer must belong to the same organization'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'billing_records' THEN
    IF NEW.client_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = NEW.client_id AND p.org_id = NEW.org_id
    ) THEN
      RAISE EXCEPTION 'Billing client must belong to the same organization'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.record_type = 'dhs_claim' AND EXISTS (
      SELECT 1 FROM public.billing_record_lines l
      WHERE l.record_id = NEW.id AND l.client_id IS DISTINCT FROM NEW.client_id
    ) THEN
      RAISE EXCEPTION 'Every DHS service line must belong to the claim client'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'billing_record_lines' THEN
    SELECT * INTO _record FROM public.billing_records
      WHERE id = NEW.record_id AND org_id = NEW.org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Service line must belong to a billing record in the same organization'
        USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = NEW.client_id AND p.org_id = NEW.org_id
    ) THEN
      RAISE EXCEPTION 'Service line client must belong to the same organization'
        USING ERRCODE = '23514';
    END IF;
    IF _record.record_type = 'dhs_claim' AND NEW.client_id IS DISTINCT FROM _record.client_id THEN
      RAISE EXCEPTION 'Every DHS service line must belong to the claim client'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.trip_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = NEW.trip_id AND t.org_id = NEW.org_id AND t.patient_id = NEW.client_id
    ) THEN
      RAISE EXCEPTION 'Source trip must belong to the service line client and organization'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.service_agreement_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.billing_service_agreements a
      WHERE a.id = NEW.service_agreement_id AND a.org_id = NEW.org_id AND a.patient_id = NEW.client_id
    ) THEN
      RAISE EXCEPTION 'Service agreement must belong to the service line client and organization'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.service_agreement_line_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.billing_service_agreement_lines l
      JOIN public.billing_service_agreements a ON a.id = l.agreement_id
      WHERE l.id = NEW.service_agreement_line_id AND a.org_id = NEW.org_id AND a.patient_id = NEW.client_id
        AND (NEW.service_agreement_id IS NULL OR a.id = NEW.service_agreement_id)
    ) THEN
      RAISE EXCEPTION 'Agreement line must match the service line client, organization and agreement'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME IN ('billing_payment_allocations', 'billing_adjustments', 'billing_documents') THEN
    IF NEW.record_id IS NOT NULL THEN
      SELECT * INTO _record FROM public.billing_records
        WHERE id = NEW.record_id AND org_id = NEW.org_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked billing record must belong to the same organization'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF TG_TABLE_NAME IN ('billing_payment_allocations', 'billing_documents') THEN
      IF NEW.payment_id IS NOT NULL THEN
        SELECT * INTO _payment FROM public.billing_payments
          WHERE id = NEW.payment_id AND org_id = NEW.org_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Linked payment must belong to the same organization'
            USING ERRCODE = '23514';
        END IF;
      END IF;
    END IF;

    IF TG_TABLE_NAME = 'billing_payment_allocations' THEN
      IF _record.payer_id IS DISTINCT FROM _payment.payer_id THEN
        RAISE EXCEPTION 'Allocation payer must match the billing record payer'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF TG_TABLE_NAME IN ('billing_payment_allocations', 'billing_adjustments') THEN
      IF NEW.record_line_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.billing_record_lines l
        WHERE l.id = NEW.record_line_id AND l.record_id = NEW.record_id AND l.org_id = NEW.org_id
      ) THEN
        RAISE EXCEPTION 'Linked service line must belong to the selected billing record'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_billing_tenant_references()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER billing_records_validate_tenant_references
BEFORE INSERT OR UPDATE OF org_id, payer_id, client_id, record_type ON public.billing_records
FOR EACH ROW EXECUTE FUNCTION public.validate_billing_tenant_references();

CREATE TRIGGER billing_payments_validate_tenant_references
BEFORE INSERT OR UPDATE OF org_id, payer_id ON public.billing_payments
FOR EACH ROW EXECUTE FUNCTION public.validate_billing_tenant_references();

CREATE TRIGGER billing_lines_validate_tenant_references
BEFORE INSERT OR UPDATE OF org_id, record_id, client_id, trip_id, service_agreement_id, service_agreement_line_id
ON public.billing_record_lines
FOR EACH ROW EXECUTE FUNCTION public.validate_billing_tenant_references();

CREATE TRIGGER billing_allocations_validate_tenant_references
BEFORE INSERT OR UPDATE OF org_id, payment_id, record_id, record_line_id ON public.billing_payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.validate_billing_tenant_references();

CREATE TRIGGER billing_adjustments_validate_tenant_references
BEFORE INSERT OR UPDATE OF org_id, record_id, record_line_id ON public.billing_adjustments
FOR EACH ROW EXECUTE FUNCTION public.validate_billing_tenant_references();

CREATE TRIGGER billing_documents_validate_tenant_references
BEFORE INSERT OR UPDATE OF org_id, record_id, payment_id ON public.billing_documents
FOR EACH ROW EXECUTE FUNCTION public.validate_billing_tenant_references();

NOTIFY pgrst, 'reload schema';
