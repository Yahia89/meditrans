# Mobile STS submissions in the shared web register

The mobile app previously saved every inspection only in MMKV under
`inspection.<driverId>.<date>` with a per-driver date index. There was no Supabase
writer. Live schema inspection found no separate vehicle-inspection table or
submission RPC; the web STS table had no rows. Legacy driver inspection dates do
not contain checklist evidence and were not converted into reports.

Migration `20260917022052_sync_mobile_driver_sts_inspections.sql` is deployed and
adds the authenticated upload contract. The web repository is canonical; exact
migration copies, including the two prerequisite compliance/evidence migrations,
are mirrored in the mobile repository for backend history parity. Broad deferred
trip writer guards remain excluded.

Follow-up migration `20260917023615_consolidate_mobile_sts_authorization_policies.sql`
combines the equivalent manager-or-driver conditions into one policy per action
to avoid duplicate permissive-policy evaluation. It does not change the contract
or permissions.

## Contract

`driver_sts_inspections` adds `source` (`web_crm` or `mobile_app`), nullable
`source_record_id`, and nullable `inspection_payload`. Mobile rows retain the
complete device record: stable driver/date ID, submitted time, vehicle and driver
snapshot, and all 12 checklist entries with statuses and explanations. The
stable ID must equal `<driverId>_<yyyy-MM-dd>`. A unique source key prevents
repeated imports from creating duplicates.

Call the invoker RPC and request one row from PostgREST:

```ts
const { data, error } = await supabase.rpc("submit_driver_sts_inspection", {
  p_org_id: currentOrganizationId,
  p_payload: inspectionRecord,
  p_expected_updated_at: knownServerVersion ?? null,
}).single();
```

Use the returned `updated_at` string unchanged as the next expected version;
converting it through a JavaScript Date can lose PostgreSQL microseconds.

The authenticated user must own an active `drivers.user_id` binding in the
supplied active organization. Driver identity is never inferred from email or a
client-provided name. Drivers can read their own `mobile_app` rows and submit
through this RPC. They cannot directly insert/update/delete STS rows, read other
drivers' or staff-created records, or access the private compliance Storage
bucket. Owner/admin review access and company-document restrictions remain.

A new mobile row starts with result `pending`. Checklist answers do not fabricate
an official passed/failed inspection decision. The inspector name comes from the
submitted snapshot; authenticated creator/updater IDs and receipt timestamps
come from the server. Notes contain an explicitly labeled initial checklist
summary, bounded to 10,000 characters, while complete findings remain in JSON.

Exact payload replay returns the existing current row without rewriting staff
edits. Different payload requires the exact current server version and a later
submitted timestamp. Missing/stale versions return SQLSTATE `40001`, leaving
both records unchanged. An accepted driver edit updates only the submitted JSON
and server updater/version; staff title, result, notes, reference, due date,
inspector, date, and attached report stay intact. The source, source key, mobile
inspection date, and raw snapshot cannot be edited directly through the web.

## Existing phone reports

There is no server-side checklist backfill source. The updated mobile client must
upload saved MMKV reports after verifying the signed-in user's current driver and
organization. Invalid/corrupt records and conflicts should remain on the device
with a visible sync error; they must never be discarded or silently overwrite a
newer cloud version. Historical device submission time is preserved separately
from server receipt/audit time.

## Verification

The new live PostgreSQL regression suite passed **34/34** checks before deployment
inside a rolled-back schema transaction, then passed again after deployment. It
covers own-driver submission/read, raw snapshot preservation, truthful pending
status, exact replay, direct-write denial, malformed records, missing/stale
versions, review-field preservation, source immutability, attached report
preservation without Storage access, cross-driver/organization denial, disabled
drivers, and restricted invoker RPC privileges.

Existing live compliance authorization checks also passed **32/32**, and web
trip-completion checks passed **28/28** after this deployment. Catalog checks
confirmed recorded migration history, an invoker RPC executable by authenticated
users but not anonymous users, no deferred broad trip guards, and no remaining
SQL fixture users or organizations.

```sh
supabase db query --linked -f supabase/tests/mobile_inspection_sync_rollback.sql -o json
```

The suite uses isolated identities and rolls back every fixture and submission.
It verifies the deployed database contract; actual phone import and web rendering
are separate client checks.
