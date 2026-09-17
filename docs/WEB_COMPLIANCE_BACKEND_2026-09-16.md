# Web trip completion and compliance backend

The shared Supabase project now supports administrative web trip completion,
company audit documents, and driver STS inspection history. These changes were
explicitly authorized and deployed through normal migration history from an
isolated deployment workspace. No real trip was completed for testing.

## Deployed migrations

- `20260916234925_allow_manager_web_trip_completion.sql`: the existing atomic
  RPC permits a same-organization owner/admin/dispatcher to complete an eligible
  trip from `manual` / `web_crm` / `web` without coordinates. Signature or actual
  decline reason, authenticated actor, expected status, and retry semantics stay
  required. Ordinary driver completion still requires accurate, fresh GPS.
- `20260917012021_allow_administrative_completion_evidence.sql`: aligns the
  existing history CHECK constraint with that precise administrative event shape.
  A narrow, always-enabled trigger requires the RPC marker, authenticated actor,
  and same-organization manager membership. Direct administrative evidence
  insertion remains forbidden. Other legacy writers are unaffected.
- `20260917012659_add_compliance_documents_and_sts_inspections.sql`: creates
  `company_documents`, `driver_sts_inspections`, and the private
  `compliance-documents` Storage bucket, with explicit grants and tenant-scoped
  policies.

The first migration is copied from the previously prepared mobile repository
backend artifact so this web checkout retains the deployed contract. The latter
migrations and live verification scripts are maintained here. This document
supersedes the earlier local-only deployment note in that checkout.

The separately gated migrations `20260831052226` and `20260831063630` were not
applied, and their two broad writer-guard triggers remain absent. Do not apply
all pending historical migrations indiscriminately; those guards still require
retiring every legacy direct writer.

## Compliance contract

An active owner/admin membership in the record's organization permits managing
compliance records and files. The later mobile synchronization migration adds
own-driver access to mobile-submitted STS rows through a restricted RPC and SELECT
policy; see [the mobile synchronization contract](MOBILE_STS_SYNC_2026-09-16.md).
Dispatchers, unrelated organizations, anonymous callers, and a global administrator
without the relevant membership receive no management access. Drivers retain no
company-document or compliance-file access. Neither table grants authenticated
DELETE.

STS records contain title, inspection date, inspector, result, optional reference,
notes and next due date, plus an optional report. `next_due_date` must be on or
after the inspection date. A composite foreign key binds the driver to the same
organization, and the driver binding is immutable. Legacy `drivers.inspection_date`
is preserved and never converted into an invented inspection record.

Company records contain title, label, notes, optional audit year, and an uploaded
file. Title/label/notes/year are editable. The original file fields, uploader ID,
uploader name snapshot, and creation time are immutable. The snapshot comes from
the authenticated user's profile, with UUID fallback. Audit IDs remain durable
when the corresponding profile is later removed; they are not user-editable.

All creator/uploader/updater IDs and timestamps are server controlled. Company
labels have a 100-character limit, both notes fields 10,000, and audit years range
from 2000 through 2100. The client omits audit columns on INSERT/UPDATE.

The bucket accepts PDF, JPEG, PNG, and WebP up to 20 MiB. Paths have the shape
`orgId/company/recordId/random.ext` or `orgId/sts/recordId/random.ext`. Upload the
object first; the record trigger verifies its actual Storage MIME type and size.
Uploads are immutable: no UPDATE/upsert is allowed. STS report replacement uses a
new path, preserves the inspection creator, and records the editor. Referenced
files cannot be deleted; cleanup can remove an old/orphaned file only after no
record references it. Short-lived signed URLs remain subject to these policies.

## Verification

- Administrative completion: **28/28** authenticated live SQL checks, using only
  disposable fixtures and rolling back every write. Coverage includes all three
  manager roles, all four eligible statuses, signed/declined outcomes, replay,
  cross-organization denial, driver GPS admission, and direct evidence denial.
- Compliance schema: **32/32** live SQL/RLS checks passed before deployment in a
  rolled-back schema transaction, then passed again after deployment. These cover
  role/tenant boundaries, original attribution, date/FK constraints, immutable
  fields, and Storage policy behavior.
- Authenticated PostgREST and actual Storage API: **29/29** checks passed. These
  include real PDF upload, metadata insertion, admin edit, signed download access,
  STS report replacement, orphan cleanup, referenced-file retention, disallowed
  MIME rejection, and negative dispatcher/driver/cross-organization operations.
  API-created test records and files were deleted after their checks.

Post-deployment catalog verification confirmed all three migration versions,
RLS and explicit grants, the private bucket configuration, the always-enabled
administrative evidence guard, absent broad deferred guards, and zero users/orgs
remaining from the rolled-back SQL suites. Database advisors reported no findings
referencing the new compliance tables/functions; unrelated project findings
remain outside this change.

The original 14-case local PostgreSQL RPC suite also passed with the deployed
history constraints and the follow-up migration loaded during diagnosis. The
persistent web regression scripts below exercise the actual deployed constraints.

```sh
supabase db query --linked -f supabase/tests/web_trip_completion_rollback.sql -o json
supabase db query --linked -f supabase/tests/compliance_authorization_rollback.sql -o json
```

Run them from a workspace linked to the shared project (or pass its `--workdir`).
Both use isolated synthetic identities, leave no fixtures, and avoid notification
side effects. The completion suite suppresses ordinary assignment notification
triggers while keeping RLS, RPC validation, and the new always-enabled evidence
trigger active. It does not drive the mobile app.

Browser-QA cleanup is complete. Both synthetic organizations, all five Auth
users and profiles, their memberships, drivers, company documents, STS records,
and two remaining uploaded files were removed. A final read-only catalog check
confirmed zero matching organizations, users, profiles, memberships, drivers,
trips, compliance records, or Storage objects. The two task-owned Argent secret
entries and temporary credential/key files were removed; unrelated secrets were
preserved. The local synthetic PDF remains only as a non-sensitive verification
artifact. No production binaries, app-store submissions, unrelated backend
upgrades, or Git commits are part of this work.
