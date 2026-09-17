# Mobile inspection sync and detailed driver trip printing

This follow-up supersedes the local-only inspection limitation from the first
web compliance round. Changes span `/Users/yahiaalhejoj/futuretransportation`
and `/Users/yahiaalhejoj/meditrans`. The reviewed database migrations are live;
web and mobile client changes are local and have not been published.

## Inspections

The previous mobile `InspectionContext` wrote only MMKV records. It did not
submit inspections to Supabase, so an empty web register was expected.

The mobile app now verifies the authenticated user's driver and organization,
imports that driver's valid legacy reports without deleting their originals,
and uploads the full vehicle/driver snapshot and 12 checklist answers through
`submit_driver_sts_inspection`. It reads saved reports back from the shared
table. A stable driver/date identity prevents duplicate imports.

Each new or edited report is saved to an account/organization/driver-scoped
device queue before uploading. Reconnect, app foreground, manual Sync reports,
and an active-app retry timer resume uploads. The report list distinguishes
saved, waiting, and rejected/conflicting records. A stale edit cannot silently
replace a newer cloud version. Local-only deletion was removed because these
reports are now company audit records.

The web register, individual driver STS tab, STS printout, and driver-profile
printout include the original checklist, explanations, vehicle details, and
device submission timestamp. Mobile reports are labeled Driver app and begin
as Pending review. Office staff can edit review metadata and attach a report;
the driver-submitted source snapshot and inspection date remain read-only.
The register refreshes on focus and every 30 seconds while visible.

See [the backend contract](MOBILE_STS_SYNC_2026-09-16.md) for authorization,
concurrency, migration history, and database checks.

## Driver trip printout

Print Out now offers Trips and count, including pickup date/time, full trip and
broker references, passenger, pickup/dropoff addresses, status, and recorded
and estimated mileage with distinct labels. Optional From/To pickup dates use
the report timezone, including daylight-saving boundaries. Empty dates include
all assigned trips. Missing details are labeled instead of invented.

Data is loaded fresh and paginated across the full selected range. A failed or
inconsistent read stops PDF generation rather than printing a misleading zero
or a truncated list. Basic information, trips, and inspection history remain
independently selectable.

## Verification and release notes

- Mobile: 185 tests across 22 suites, typecheck, and scoped lint passed.
- Web: 18 driver-print tests and 28 STS tests passed; scoped lint and Vite
  production build passed. The same seven pre-existing TypeScript errors remain.
- Live database: 34 inspection-sync, 32 compliance, and 28 trip-completion
  checks passed with transaction-rolled-back fixtures.
- Argent iPhone 17 Pro Max: a pre-existing August 30 phone report automatically
  uploaded and displayed Saved to company history. Its 11 good answers, one
  issue, and explanation remained visible. This existing report was preserved.
- Rendered PDF evidence: `/tmp/meditrans-driver-trip-details-qa/` includes
  trips-only/full-profile and 45-trip pagination checks;
  `/tmp/meditrans-audit-qa/sts-sync/` includes the complete checklist PDF.

Existing phones need the updated client and an online session before their
historical device-only reports can appear on the web. There is no server-side
source from which to recover reports on a phone that has not synced. Invalid
legacy JSON remains untouched on the device and is excluded from automatic
import. The existing role resolver still needs network access on a fully
offline cold start; saved queued reports survive, but initial account readiness
offline is not claimed by this change.

No Git commit, push, mobile binary/update release, or web publication was made.
The earlier deferred broad trip-write guard migrations remain unapplied.
