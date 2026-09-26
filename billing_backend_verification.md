# Billing backend verification

Verified September 26, 2026 UTC. The app targets Supabase project `devszzjyobijwldayicb`; its backend URL and credentials were not changed.

## Migration state

These three migrations are applied in both local Docker database `supabase_db_futuretransportation` and hosted CRM project `devszzjyobijwldayicb`, with all three exact versions recorded in each migration history:

| Version | File | Purpose |
| --- | --- | --- |
| `20260926022817` | `supabase/migrations/20260926022817_manual_billing_and_payments.sql` | Manual billing tables, RLS, storage bucket and transactional RPCs; already present locally when this stage began. |
| `20260926035801` | `supabase/migrations/20260926035801_billing_api_access.sql` | Explicit authenticated table/API privileges; direct financial changes restricted to checked RPCs; anonymous RPC and direct internal totals-helper access revoked. |
| `20260926040224` | `supabase/migrations/20260926040224_billing_tenant_reference_integrity.sql` | Validate same-organization payer/client/trip references, DHS line identity, agreement identity, allocation/adjustment line identity and document links for new or changed rows. |

The two follow-up migrations change privileges and install validation triggers. They do not rewrite existing financial records. They were executed transactionally locally, then their exact versions were recorded with `supabase migration repair --local --status applied` in an isolated CLI workdir pointed at the existing Docker project. No unrelated historical migrations were applied.

## Local verification

```sh
docker exec -i supabase_db_futuretransportation psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/billing_api_access_rollback.sql
node --test src/features/billing/tests/billing-db.test.mjs
docker exec supabase_db_futuretransportation psql -U postgres -d postgres -Atc "select version,name from supabase_migrations.schema_migrations where version >= '20260926022817' order by version;"
```

- Rollback SQL test passed using the actual `authenticated` and `anon` database roles. It checks admin record/payment creation, permitted follow-up updates, forbidden direct ledger/internal-helper access, dispatch and foreign-tenant isolation, invalid payer/client/trip references, mismatched allocation/adjustment lines, atomic rejection and valid multi-client partner invoices.
- All five existing billing database tests passed. Their foreign-tenant fixture now uses a payer and patient from that same foreign tenant and cleans up through a test teardown hook.
- Local PostgREST accepted all four app query shapes with HTTP 200: billing records with payer/client/line joins, payments with allocations/record joins, overview records, and received-payment totals.
- All ten manual-billing tables have RLS enabled and authenticated SELECT privileges; anonymous SELECT and anonymous/direct-authenticated internal totals-helper execution are denied.
- Local security advisors found no warnings on manual-billing objects. There were 17 existing warnings elsewhere, including the legacy `update_billing_claims_updated_at` function's mutable search path; these were not changed. Latest report: `/tmp/meditrans-billing-security-advisors.json`.
- The local billing record/payment counts were both zero after test cleanup. No real financial records were edited.

## Remote deployment and verification

The active Supabase plugin connection was scoped to the unrelated **LabyrinthMaze** project and denied CRM requests. Local `.agents/mcp_config.json` and the pre-existing CLI link both correctly identified CRM. The normal, already-configured **Supabase CLI connection** successfully read CRM migration history and database schema; no credentials were extracted or credential stores searched.

Remote preflight confirmed that all ten manual-billing tables and the billing document bucket were absent, all required legacy dependency tables/types existed, and the three billing migration versions were missing. The previous app API errors were HTTP 404 / `PGRST205`.

Deployment used an isolated temporary CLI workdir containing the existing CRM link metadata. `supabase migration fetch --linked` populated that isolated directory with 91 already-applied remote migrations; only the three reviewed billing files were then added. `supabase db push --linked --dry-run` listed **exactly those three files**, followed by a successful `supabase db push --linked --yes`. The repository's unrelated older migrations, roles and seed data were not pushed. No remote migration history was repaired or falsified.

Read-only hosted verification confirmed:

- All three exact migration versions are recorded.
- All ten tables exist, have RLS enabled, grant SELECT to `authenticated`, and deny SELECT to `anon`.
- All six integrity triggers are installed and the billing document bucket is private.
- Authenticated callers can execute `create_billing_record`; neither anonymous nor authenticated callers can execute the internal totals helper directly.
- All 166 billing columns and all nine complete function definitions/signatures match the tested local database exactly; no generated application-type changes are needed.
- The four record/payment/metrics SQL read shapes succeeded in a `BEGIN READ ONLY` transaction with `SET LOCAL ROLE authenticated`, then rolled back. This verifies database privileges and joins; it is not a logged-in user's hosted HTTP test.
- Public-client HTTP reads of records, payments and payers now return the intended **401 / `42501` permission denial**, rather than missing-table errors. Billing data requires an authenticated authorized user.
- Manual billing record/payment counts remain zero; legacy claim and claim-line counts remain unchanged at zero. No hosted financial fixtures were created.

Evidence files: `/tmp/meditrans-billing-remote-dry-run.txt`, `/tmp/meditrans-billing-remote-push.txt`, and `/tmp/meditrans-billing-remote-verification.json`. They contain migration/schema verification, not application credentials.

The hosted security advisor returned 21 warnings, including seven notices for the intentionally authenticated `SECURITY DEFINER` permission helper and transactional billing RPCs. Each checks the caller's identity/organization permissions; privileged RPC execution is necessary for the current design because direct ledger writes are denied. The unguarded internal totals helper is not exposed to either client role. These notices were reviewed, not suppressed; see [Supabase's authenticated definer-function advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). The hosted report is `/tmp/meditrans-billing-remote-advisors.json`.

## Remaining acceptance boundary

The browser layout checks in this session use synthetic intercepted fixtures. No logged-in hosted browser session is available, so those screenshots do not prove authenticated hosted workflows. Backend migrations and access checks are complete; the owner should reload their existing authenticated app session and confirm billing records/metrics load. Creating real financial records was intentionally not part of hosted verification.
