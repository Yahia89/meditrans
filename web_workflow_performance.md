# Web trip workflow and dashboard performance

Verified September 30, 2026 in `/Users/yahiaalhejoj/meditrans`.

## Delivered behavior

Owners, admins, and dispatchers belonging to the trip's organization can use
**Start Driving to Pickup → Arrived at Pickup → Pickup Patient → Complete Trip**
on the web. Existing assignment/edit controls remain the entry point for pending
trips. Completion requires a rider signature and signer name, or the existing
declined-signature reason. Trips already progressed by the driver app retain
their supported completion states.

Office actions use the atomic `apply_trip_transition` RPC, with authenticated
actor, event ID, expected status, and `manual / web_crm / web` provenance. All
location fields are null; an office location is never substituted for the
driver's location. The database independently checks membership. Drivers retain
GPS requirements. Signature validation, retries, and cancellation auditing remain
in the same transaction. Buttons stay disabled until updated query data arrives;
PT409 and legacy 40001 conflicts refresh the visible trip.

No Show and Cancel retain their confirmation UI. A pre-existing No Show defect
was fixed: its confirmation has no reason selector, so it now supplies
`patient_no_show` instead of sending null to an RPC that requires a reason.

## Performance

- Closed trip, discharge, and import dialogs mount only when opened.
- PDF code loads on export. Vite chunking no longer pulls shared startup helpers
  through the PDF vendor chunk. Chart plotting loads separately from dashboard
  data fetching and the rest of the dashboard.
- Dashboard chart/calendar requests use `dashboard_trip_buckets`; complete
  counts no longer depend on downloading every trip or the API's raw row cap.
  Ranges are bounded and timezone aware, with an exclusive end timestamp.
- Dashboard trip queries share the trip invalidation prefix, cache for 30
  seconds, and refresh every 60 seconds while active. Organization, timezone,
  date, and range are in the relevant keys. Existing trip-cache consumers ignore
  dashboard aggregate/partial shapes.
- Onboarding counts and upload history use user/organization-scoped TanStack
  Query caches instead of repeated effects and unscoped sentinel counts.

Compiled JavaScript graph measurements (gzip, measured per chunk):

| Scope | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Initial application shell | 436,189 B | 300,776 B | 31.0% |
| Populated dashboard, including its chart and previously mounted closed dialogs | 806,433 B | 429,013 B | 46.8% |

These are bundle measurements, not measured browser load-time improvements.
Reproduce with `scripts/measure-dashboard-bundles.mjs` and Vite builds made using
`--manifest`. Current baseline and final builds are under
`/tmp/meditrans-performance-baseline` and `/tmp/meditrans-performance-final`.

A representative hosted latest-trip query changed from a 1,383-row sequential
scan plus sort to an index scan returning six requested rows directly. Its
benchmark-only organization-selection subquery still scans the org index; the
whole query does not read only six rows. Single timings are not a speed guarantee.
The UI requests five recent trips. The existing pickup-time index is reused.

A hosted read-only query, executing with an authenticated member's RLS, verified
September's aggregate total of 199 against 199 raw trips: 27 returned buckets,
2,764 JSON bytes versus 13,527 raw JSON bytes. No hosted trip fixtures were written.

## Backend deployment

Applied to the verified CRM project `devszzjyobijwldayicb`:

1. `20260930190613_restore_manager_web_trip_flow.sql`
2. `20260930190614_dashboard_trip_buckets.sql`

The connected Supabase plugin listed a different project. Deployment therefore
used the existing CRM CLI link in an isolated workdir with fetched hosted
migration history. The dry run listed only these two migrations. The live trip
function was checked for drift before deployment, preserving the newer mobile
PT409 behavior already present on the server.

All three changed functions match the locally tested definitions exactly. Both
RPCs remain SECURITY INVOKER with a fixed search path and no anonymous execute
grant. The history guard remains ENABLE ALWAYS and cannot be directly executed
by authenticated users. The recent-trip index is valid. Hosted security advisors
remained at the same 23 existing notices, with no new notice from this change.

Docker container `supabase_db_futuretransportation` was started and remains
running. Its default database has older trip schema; it was not overwritten.
Tests used a separate database, `meditrans_web_qa_20260930`, containing a
schema-only copy of the hosted `public`/`private` schemas plus these migrations.
No hosted patient or trip data was copied. Local fixture writes roll back.

## Verification

- Production build and TypeScript check passed.
- Scoped lint passed for the changed app/dashboard/trip code. The existing
  Fast Refresh export convention in `OnboardingContext.tsx`, `JourneyTimeline.tsx`,
  and the shared button primitive was excluded for their separate check; no
  repository-wide clean-lint claim.
- Trip workflow: 15 tests; browser GPS evidence: 5 tests; dashboard ranges and
  buckets: 4 tests. Billing, driver print, and compliance suites also passed.
- `web_trip_flow_rollback.sql`: 109/109 database checks.
- Existing `web_trip_completion_rollback.sql`: 28/28 database checks.
- `dashboard_trip_buckets_rollback.sql`: 13/13 database checks, including more
  than 1,000 trips, organization/RLS isolation, DST, boundaries, and invalid input.

Argent browser verification uses isolated Chrome with synthetic auth and
intercepted API responses. Evidence lives in `test-results/web-workflow`;
`tests/web-workflow/bootstrap.mjs` recreates its fixture harness. This verifies
the rendered web behavior without changing real trips or sending messages.
Database/RLS checks are separate from synthetic browser evidence.

Observed browser scenarios: owner full flow with a drawn signature; admin start;
dispatch completion with decline reason; unchanged cancellation/no-show dialogs;
PT409 refresh without duplicate history; unauthorized workflow controls hidden;
assigned driver blocked by denied GPS; dashboard chart/calendar; navigation from
recent activity into trip details and back; cached revisit with zero additional
aggregate RPCs; and lazy opening of all three trip/import dialogs. At 390×844,
dashboard and trip details had no horizontal overflow and signature controls
remained reachable through scrolling. The existing signature dialog extends
approximately 8px below that viewport. External map-provider calls were blocked
by the fixture harness, so address-provider functionality was not accepted here.

The production build also passed dashboard → recent trip → signature dialog →
dashboard with no product runtime errors. The final type-cleanup build has 82
JavaScript chunks byte-identical to that tested production artifact. Screenshots:
`test-results/web-workflow/production-dashboard.png` and
`test-results/web-workflow/production-signature-dialog.png`; full browser report:
`test-results/web-workflow/qa-summary.json`.

Session-owned Argent Chromium, Chrome, and Vite preview processes were stopped
after QA. Docker remains running.

Small touch improvements from the supplied reference were applied to web only:
precise-pointer link hover, button touch handling/press feedback, coarse-pointer
input sizing, and light browser theme color. Physical phone/Safari keyboard and
safe-area behavior were not tested.

Frontend changes are in the working tree; the website was not published and no
commit or push was made. Backend migrations are already live.

## Project environment

```json
{
  "workspace": "/Users/yahiaalhejoj/meditrans",
  "is_react_native": false,
  "is_native_ios": false,
  "is_native_android": false,
  "platforms": ["web"],
  "framework": "React 19 / Vite 7 / TypeScript 5.9",
  "query_library": "TanStack React Query 5",
  "package_manager": "npm",
  "start": "npm run dev",
  "build": "npm run build",
  "typecheck": "npm run typecheck",
  "browser_qa": "Argent Chromium CDP with synthetic API fixtures"
}
```
