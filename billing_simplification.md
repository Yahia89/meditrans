# Billing simplification — September 26, 2026

This pass supersedes the larger claims-management UI described in `billing_work.md`. The page now focuses on manual submissions and actual receipts.

## Workflow

1. Choose **Add billing record**, select a patient, and enter the agency, original submitted amount, and submission date/time. The internal reference is the first segment of the patient's UUID, derived again on the server. Additional submissions for the same patient can use the same reference.
2. Optionally enter money already received and its actual receipt date/time, an agency reference, notes, and files. Dates use the organization's timezone; decimal amounts are validated and stored with cent precision.
3. Open the saved record to add later received amounts or billing files. Original submitted amount, total received, and open balance remain separate. **Payments** lists confirmed receipts and links back to their records.

The page has three totals cards, two tabs, a search field, agency/payment-status filters, and CSV export. Removed the authorizations/payers tabs and their components, attention card/filter, external-submission banner, manual-tracking badge, global payment dialog, complex claim/service-line editor, submission checkbox, and unused frontend mutation APIs/hooks. Historical financial and document data remain accessible from record details; existing database tables and historical RPCs were retained.

## Files and menus

- Files can be selected with a new record or attached later: PDF, PNG/JPEG/WebP, Word, Excel, CSV, and text, up to 20 MiB each. Storage remains private with expiring forced-download links.
- Metadata/upload failures preserve the saved record, retain only failed files for retry, and reconcile uncertain upload responses before removing an unattached object.
- Replaced conflicting global Radix scroll-lock overrides with a stable-gutter compensation rule. The page no longer forces overflow visible while overlays lock scrolling. This shared CSS change affects menus/dialogs across the web app.
- Browser tests were updated for the reduced workflow and a menu-geometry regression check, but **were not executed**, as explicitly requested. The menu fix and visual layout therefore still lack live browser acceptance evidence from this pass.

## Verification

- `npm run build` — passed (full TypeScript check and Vite production build).
- `npm run lint:billing` — passed, zero warnings.
- `npm run test:billing` — 47 tests passed, including local DB tests, timezone/DST conversion, money validation, original amount totals, receipt counts, more than 1,000 rows, literal search, file validation/cleanup/retry and signed-download behavior.
- Separate rollback SQL and concurrent database checks passed; the migration is applied and verified locally and on hosted Supabase. See `billing_simplification_backend.md` for scope, exact commands, advisors, and deployment evidence.

Only database migrations were deployed. The frontend remains a workspace change for the existing development server. No commit or frontend deployment was made. No real financial records were entered.
