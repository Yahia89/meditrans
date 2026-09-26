# Billing cleanup — 2026-09-25

This pass repairs the TypeScript/unused-declaration cleanup and the billing page's missing-export crash. It does not certify completion of every acceptance criterion in `billing_work.md`.

Follow-through: `billing_responsive.md` and `billing_backend_verification.md` document the subsequent responsive browser work and local/hosted migration deployment. Their evidence supersedes the browser and remote-access limitations recorded below for this earlier cleanup stage.

## Changes

- Fixed the runtime imports of TypeScript-only declarations, including `BillingRecordFilterParams`.
- Removed unused declarations and corrected all 27 initial TypeScript diagnostics without weakening compiler settings.
- Parsed the add-record form through its schema so defaults such as `is_summary_only` reach the API. Corrected payment allocation `record_id`, response/select narrowing, and callback signatures.
- Scoped billing database access to the existing authenticated Supabase client with the generated database contract. Validated API responses with Zod, including money normalization and nullable joins, instead of asserting unverified domain types.
- Propagated all record-detail query errors; corrected duplicate action counts and removed service-period fallback for missing external submission dates.
- Preserved existing payer configuration during standard-payer setup and left unverified partner terms/follow-up intervals unset.
- Added `npm run typecheck` and `npm run lint:billing`. The build now runs TypeScript first. Billing lint requires explicit type imports and rejects non-null assertions.
- Fixed small existing compiler/unused issues outside billing: status-map completeness, missing summary filter defaults, the patient join type, and unused bindings. Existing workflow logic remains in place.

## Verification actually run

| Command | Result |
| --- | --- |
| `npm run build` | Passed, including full TypeScript check |
| `npm run lint:billing` | Passed with zero warnings |
| `npm run test:billing` | 27 passed: 14 unit, 8 API, 5 local database |
| `npm run test:browser-event-location` | 5 passed |
| `npm run test:trip-completion` | 9 passed |
| `npm run test:driver-print` | 18 passed |
| `npm run test:compliance` | 32 passed |
| `git diff --check` | Passed |

The full `eslint src` scan has zero unused-variable findings, down from 15. It still reports 126 pre-existing errors and 20 warnings, mostly explicit `any` and React rules outside billing; no new diagnostics were introduced.

The development server's transformed billing hook no longer imports the missing runtime type export. Interactive browser validation was not performed because Argent was unavailable and permission to use alternative browser tooling was unanswered.

The existing local Docker database already contained the billing schema. Tests used disposable local fixtures and cleaned them up. Response contracts were checked against 166 columns in 10 local billing tables. The database tests exercise command-level behavior; they are not comprehensive direct-table RLS, concurrency, or storage acceptance tests. Remote Supabase schema access was denied by MCP permissions. No production migrations or financial records were changed. No migration was created or applied in this cleanup.

## Remaining work from the larger brief

These observed pre-existing gaps need a separate workflow completion pass before claiming the full module is ready:

- The record-detail resubmission action opens the new-record dialog without linking the original record to the resubmission API.
- The add-record form still pre-populates an unverified procedure code and rate (`A0130`, `$25.00`).
- Date-only submission/response inputs still become noon-UTC timestamps; date precision and organization timezone handling remain incomplete.
- Full browser walkthroughs and the broader authorization, storage, concurrency, and financial acceptance criteria in `billing_work.md` remain unverified.

Reload the billing page to clear an already-caught module-loading error. Run the three billing/build commands above after subsequent edits. The database tests require the local `supabase_db_futuretransportation` Docker container; they do not target the configured remote application database.
