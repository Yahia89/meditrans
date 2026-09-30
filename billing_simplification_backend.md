# Simplified billing backend verification

Verified September 26, 2026. Migration `20260926142042_simplify_manual_billing.sql` is applied to both local Docker database `supabase_db_futuretransportation` and hosted CRM project `devszzjyobijwldayicb`.

## Implemented behavior

- `create_manual_billing_record(p_record jsonb)` atomically creates/reuses the agency, saves a submitted record and optional initial receipt, and derives the internal reference from the patient's UUID prefix. Multiple submissions may share that patient reference.
- `record_billing_receipt(p_record_id uuid, p_receipt jsonb)` appends receipts to a record and updates paid/balance totals. Overpayments remain visible. Both commands enforce organization/role access and stable request IDs; duplicate retries return the existing result, while changed input with a reused request ID is rejected.
- `original_submitted_amount` preserves the first submission amount, independently of receipts and later adjustments. A database trigger prevents rewriting an established snapshot.
- New receipt timestamps use `received_at`; legacy date-only receipts retain their original precision. Submission/receipt times retain their UTC instants. New receipts cannot precede submission.
- Files use the existing private `billing-documents` bucket, limited to 20 MiB. PDF, PNG, JPEG, WebP, CSV, TXT, DOC, DOCX, XLS and XLSX are allowed. New metadata must point to an existing object under the same organization and record/payment path; uploader identity comes from the authenticated user.
- Existing financial tables, records, history, authorizations and ledger RPCs were preserved. No external billing connection was introduced.

## Deployment and verification

The migration was first executed transactionally in the existing local database, then its exact version was recorded in local migration history. Hosted deployment used an isolated CLI workdir containing fetched hosted history. The dry-run listed **only the new migration**, and that single migration was pushed successfully; no unrelated repository migrations or seed data were pushed.

Passed local checks:

- `manual_billing_rollback.sql`: authenticated creation/receipt recording, exact timestamps/amounts, repeated patient submissions, agency reuse, record/receipt retry idempotency, changed-input rejection, overpayments, atomic rollback, invalid amount/date rejection, immutable original amount, restricted direct ledger access, organization/dispatch/anonymous isolation, storage RLS, and uploaded metadata/path checks. All fixtures roll back.
- Existing `billing_api_access_rollback.sql` role/tenant/integrity regression suite.
- All five existing `billing-db.test.mjs` database tests.
- `manual_billing_concurrency.mjs`: three concurrent record retries produced one record; duplicate receipt retries produced one payment; separate concurrent receipts retained all amounts and correct balance. Its temporary local fixtures were removed.

Read-only hosted verification found exact local/hosted parity for the five changed/new function definitions and privileges, six new columns, two new triggers, bucket settings, migration version and removed patient-reference uniqueness. Anonymous callers cannot execute the new RPCs. Authenticated callers cannot execute either new trigger helper or the internal totals helper. Both databases had **zero billing records and zero payments** after testing. No hosted financial fixtures were created.

Local security advisors reported 17 existing warnings and none on changed billing objects. Hosted advisors reported 23 warnings, including two new notices for the deliberately authenticated `SECURITY DEFINER` billing commands. Those commands use a fixed empty search path, explicit organization/role checks, and checked transactional writes because direct client ledger writes remain denied. These notices were reviewed, not suppressed; they are not a clean-advisor claim.

Only the pre-existing `supabase_db_futuretransportation` container was started for this work; it remains running. Other stopped local stack containers were not started. Browser verification was skipped at the user's request; schema parity and database tests do not establish a logged-in hosted browser upload/receipt flow.

## Re-run local verification

```sh
docker exec -i supabase_db_futuretransportation psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/manual_billing_rollback.sql
docker exec -i supabase_db_futuretransportation psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/billing_api_access_rollback.sql
node --test supabase/tests/manual_billing_concurrency.mjs src/features/billing/tests/billing-db.test.mjs
```

Evidence files: `/tmp/meditrans-simple-billing-remote-dry-run.txt`, `/tmp/meditrans-simple-billing-remote-push.txt`, `/tmp/meditrans-simple-billing-local-verification.json`, `/tmp/meditrans-simple-billing-remote-verification.json`, `/tmp/meditrans-simple-billing-local-advisors.json`, and `/tmp/meditrans-simple-billing-remote-advisors.json`. The isolated deployment workdir path is recorded in `/tmp/meditrans-simplify-billing-workdir.txt`.
