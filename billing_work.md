Implement a production-quality MANUAL BILLING AND PAYMENT TRACKING module
inside the existing Future Transportation CRM.

This is an implementation task, not merely a design proposal. Inspect the
current repository, follow its relevant skills and conventions, and implement
the feature with appropriate migrations, backend authorization, frontend
workflows, and tests.

IMPORTANT SCOPE:
We are NOT implementing automated billing, claim transmission, invoice
sending, 837P generation, broker integrations, SFTP, or automatic remittance
parsing in this phase.

Our staff submit billing OUTSIDE this application. This module records and
tracks those external actions.

Do not modify unrelated dispatch, driver, mobile-app, location, or trip
completion functionality.

Prepare and test migrations in a development/local environment. Do not run
destructive changes, apply production migrations, or alter real financial
records without explicit authorization.

1. BUSINESS CONTEXT AND THE PROBLEM TO SOLVE

Future Transportation is a NEMT/waiver transportation provider.

We currently have two billing relationships:

A. DHS / MHCP direct billing
Staff submit claims externally, such as through MN-ITS DDE.
We need to record claims, service lines, external references, dates,
responses, adjustments, outstanding amounts, and payments.

B. Connectivity of MN
Some clients are referred through Connectivity of MN.
For this work, we bill Connectivity rather than DHS directly.
We need to record invoices/billing statements submitted externally,
acknowledgement, disputes, payment terms, payments, and follow-ups.

Support additional payers later through configuration, not hardcoded
company-specific conditionals.

The module must answer:

- What services have been recorded as billed?
- Which client received those services?
- Who was billed?
- What was submitted, when, and by whom?
- Did the payer acknowledge receipt?
- Was it rejected, denied, approved, or placed under review?
- What amount was billed, allowed, adjusted, and actually received?
- Which records still require attention?
- Has the same service already been billed somewhere else?
- Where are the supporting documents and historical changes?

Keep referral source distinct from bill-to payer.

A referral from Connectivity must not automatically create both a
Connectivity invoice and a DHS claim.

2. REPOSITORY INSPECTION AND SKILLS

Read the repository instructions and applicable installed skills before
implementation.

Inspect at minimum:

- package.json and TypeScript configuration.
- src/App.tsx and the existing navigation/route arrangement.
- src/components/MedicaidBillingPage.tsx.
- src/components/ClaimHistoryTable.tsx.
- src/components/ClaimSummaryDialog.tsx.
- src/components/billing/ServiceAgreementsTab.tsx.
- src/components/billing/ResponsesTab.tsx.
- src/components/admin/OrgBillingSettings.tsx.
- OrganizationContext and existing authentication/RBAC utilities.
- Supabase client/types, migrations, functions, and tests.
- Existing patients, trips, organization fees, documents, and client credits.
- banned_useEffect.md and theme.md where relevant.

Read .agents/skills/frontend-design/SKILL.md.

Discover any other actually available skills covering React, TypeScript,
Supabase/PostgreSQL, accessibility, security, and testing. Use the relevant
ones; do not invent skill names or claim to have used unavailable skills.

The inspected repository uses React/Vite. Keep the existing framework and
routing patterns. Do not migrate to Next.js or TanStack Start for this task.

First identify what is implemented versus placeholder UI. Do not treat old
automation planning documents as a mandate to implement automation now.

Inspect the actual database schema when authorized read-only access is
available. Do not assume the deployed schema exactly matches old migrations.

Preserve existing data. Prefer a compatible extension of existing structures
where they fit. If separate tables are necessary, explain why and provide an
explicit migration/mapping strategy.

3. PRODUCT LANGUAGE AND UI DIRECTION

Rename the visible module to:

Billing & Payments

Suggested description:
“Track external claims, invoices, payer responses, and payments.”

Show a clear, unobtrusive notice:
“Submissions happen outside this system.”

Primary action:
“Add Billing Record”

Other actions:

- Record External Submission
- Record Payer Response
- Record Payment
- Attach Document
- Add Follow-up
- Record Resubmission

Do not use buttons that imply the app is transmitting anything:
“Submit to DHS,” “Send Invoice,” “Transmit,” or “New Claim Batch.”

Remove automation-focused messaging from the manual experience, including
SFTP polling claims and automatic reconciliation claims.

Do not gate manual tracking behind SFTP credentials, a batch submitter ID,
or successful 837P configuration. Preserve legitimate organization access
controls, but separate those from transmission setup.

Use the existing CRM design system with a polished, practical layout:
clear financial hierarchy, readable tables, good spacing, accessible dialogs,
and restrained use of status colors.

Do not turn this into a decorative dashboard with enormous empty areas.
The primary workspace should be a useful, filterable billing table.

4. BILLING RECORD TYPES AND PAYER MODEL

Use a shared billing-record model with explicitly typed variants:

- dhs_claim
- partner_invoice

DHS claim:

- Exactly one client per individual claim record.
- External payer claim number separate from our internal reference.
- Service agreement references supported at the service-line level.
- Diagnosis and procedure information recorded only from verified source
  information; never invented or copied from a different client.

Partner invoice:

- One bill-to organization.
- May contain services for one client or multiple clients.
- Every line must remain attributable to its correct client.
- Support external invoice number, payment terms, due date, and contact.
- Do not require an MHCP member ID, HCPCS code, or DHS authorization number
  where the partner invoice does not use those fields.

Create tenant-scoped payer records.

For the appropriate organization, support configuring DHS/MHCP and
Connectivity of MN. Do not seed those payers into every tenant.

Payer configuration can include:

- Display name and payer type.
- Relevant contact details.
- Typical external submission channel.
- Optional payment terms.
- Optional follow-up interval.
- Active/inactive status.

Do not assume Connectivity’s rates, payment terms, API availability, or
submission requirements. Keep these configurable and initially unset
unless verified information exists.

5. ADDING RECORDS: SUPPORT CURRENT WORK AND HISTORICAL BACKFILL

Provide two entry paths:

A. Record billing already submitted externally.
B. Prepare an internal draft to track planned billing.

For already-submitted records, require the actual external submission date.
Do not use the database creation timestamp as a substitute.

Support entering historical records even when their trips were never
recorded in this CRM.

Trip linkage should be encouraged but not require users to invent trips,
mileage, diagnoses, or identifiers.

Clearly distinguish:

- Fully linked to source trips.
- Partially linked.
- Historical/manual record with supporting documentation.

For already-submitted records, preserve what was actually submitted—even
if it contains a mistake. Flag discrepancies for correction rather than
silently rewriting history.

For new drafts, surface missing information before staff mark them as
submitted externally.

Allow an incomplete draft to be saved.

Creating a draft or attaching a PDF must never automatically mean:
submitted, received by payer, approved, or paid.

6. RECORD AND SERVICE-LINE FIELDS

Record-level fields should include, as applicable:

- Organization ID.
- Record type.
- Payer ID.
- Internal reference.
- Client ID for single-client claims.
- Billing period start and end.
- Original external claim/invoice reference.
- Current submission-attempt reference.
- External submission date/time.
- Submitted by, if known.
- Submission channel.
- Payer acknowledgement date/time.
- Optional due date.
- Follow-up owner and next follow-up date.
- Notes and evidence references.
- Created/updated timestamps and actors.
- Version number for concurrency control.
- Historical/imported provenance.

Keep member IDs, NPIs, authorization numbers, invoice references, claim
control numbers, and bank/payment references as strings. Preserve leading
zeros and formatting.

Service lines should support:

- Client ID.
- Actual date of service.
- Description/service component.
- Optional HCPCS and modifiers where applicable.
- Quantity and unit type: miles, one-way trips, or a configured partner
  unit—not an ambiguous generic quantity.
- Optional unit rate.
- Actual billed amount.
- Optional allowed amount.
- Explicit adjustments and their reasons.
- Line-level outcome.
- Authorization/service-agreement reference where applicable.
- Links to one or more source trips/legs.
- Source/document reference.

Allow a daily aggregated line to link to multiple actual trip legs.

Keep a service date separate from the invoice/billing period. A July billing
record must not silently rewrite every trip’s service date to July 1.

Where detailed line data is genuinely unavailable for historical records,
support an explicitly marked summary record with its documented total.
Do not fabricate quantities to reverse-engineer that total.

7. STATUS MODEL: DO NOT MIX ACKNOWLEDGEMENT WITH PAYMENT

Use separate, strongly typed dimensions rather than one overloaded status.

Suggested submission status:
draft
submitted
received
rejected
cancelled
superseded

Suggested payer/adjudication status:
not_reported
in_review
approved
partially_approved
denied

Suggested settlement status:
unpaid
payment_scheduled
partially_paid
paid
overpaid

Adapt names only if the resulting model is clearer and equally expressive.

User-facing labels should be explicit:

- Submitted externally
- Received by payer
- Under review / Suspended
- Rejected — correction required
- Denied
- Approved — payment outstanding
- Partially paid
- Paid
- Overpayment / credit to resolve

“Received” means the payer received the billing, not that we received money.

A payer reporting a payable amount is not equivalent to a confirmed bank
deposit. Keep payer-reported payment and confirmed funds received distinct.

A fully credited or written-off record with no cash received should not
display as “Paid.”

A record may have mixed line outcomes. Show those outcomes without turning
the entire record into “Paid” merely because one line has a payment.

Preserve raw payer codes separately from our normalized statuses:

- Source/type of response.
- Category code.
- Status code.
- Adjustment group/reason.
- Remark code.
- Exact payer-provided description.
- Evidence document and relevant page/line where known.

Do not guess a code definition from its number alone. Different code sets
can reuse the same number. Do not implement an unverified automatic X12
code interpreter in this phase.

Unknown external codes must remain recordable without being mislabeled.

8. EXTERNAL SUBMISSIONS, RESPONSES, AND HISTORY

A billing record can have multiple external submission attempts.

Each attempt should preserve:

- Attempt number.
- Original/corrected/resubmitted/replacement purpose.
- Actual external submission timestamp.
- Submission channel.
- External identifier.
- Who submitted it, when known.
- Who recorded it in this app.
- Notes and supporting evidence.
- Payer responses associated with that attempt.

Provide an append-only activity timeline containing:

- Draft created.
- External submission recorded.
- Receipt acknowledged.
- Review/suspension recorded.
- Rejection or denial recorded.
- Approval recorded.
- Payment scheduled/reported.
- Funds received.
- Payment allocated.
- Adjustment recorded.
- Follow-up added/completed.
- Correction/resubmission recorded.

Store both:
occurred_at — when the external event actually happened.
recorded_at — when staff entered it into the CRM.

Support date-only historical information without pretending the exact time
is known.

Adding historical events must not blindly overwrite a newer current status.

Once an external submission is recorded, freeze the relevant submitted
financial snapshot. Subsequent corrections must create a new revision or
submission attempt, not silently overwrite the submitted version.

Local cancellation or recording an external void must never actually send a
void request to a payer.

Store enough history to explain every current status and amount.

9. PAYMENTS, ADJUSTMENTS, AND RECONCILIATION

Implement manual payment recording independently from status selection.

A payment record should include:

- Payer.
- Amount and currency.
- Payment method.
- Payer payment/EFT reference.
- Payer-reported issue/scheduled date, if provided.
- Actual received date when confirmed.
- Reconciliation status and reconciled timestamp/actor.
- Evidence and notes.

One payment can cover multiple billing records.
One billing record can receive multiple payments.

Use payment allocations rather than duplicating one EFT payment for every
claim on the remittance.

Allow unapplied cash while allocation is being resolved. Do not allow
allocations to exceed the available payment amount.

Validate allocations belong to the same tenant and payer unless an
explicitly supported, documented exception exists.

Support:

- Partial payments.
- Rate reductions and other adjustments.
- Denied or disputed balances.
- Authorized write-offs/credits.
- Payment reversals, refunds, and recoupments.
- Overpayments without silently clamping balances to zero.

Do not assume every difference between billed and paid is:
a patient responsibility, a write-off, or a fee-schedule reduction.

Require a reason and source for adjustments. Require an appropriate
permission for discretionary write-offs.

Never automatically move an unpaid Medicaid balance to Client Credits
or make the client personally responsible.

Define and test the financial formulas. For example:

Posted outstanding balance =
current billed charges
minus net confirmed payment allocations
minus authorized posted credits/write-offs/adjustments.

Keep approved-but-unpaid, denied/disputed, and unapplied payment amounts
visible separately. Do not double-subtract an adjustment.

A denial should not silently erase the balance; it remains an action item
until resolved or explicitly adjusted.

Cash-collection metrics must use confirmed receipts, not submission totals,
approval totals, or numbers merely displayed in a payer response.

10. MONEY AND DATE CORRECTNESS

Use PostgreSQL NUMERIC with explicit precision/scale for financial data,
or a consistently implemented integer-minor-unit model where appropriate.

Use exact decimal handling for quantities × rates. Do not use unguarded
JavaScript floating-point arithmetic as financial truth.

Prefer validated decimal strings at API/form boundaries and a dedicated
decimal calculation utility. Avoid Number(value) as a universal conversion.

Define the rounding rule explicitly. Round money to cents at the documented
calculation boundary, not to whole dollars.

Preserve both the reported billed amount and an independently calculated
quantity × rate comparison when historical data differs.

Example arithmetic test:
80 × 1.54 = 123.20, not 124.00.

Use DATE for service dates and date-only payment/due dates.
Use timestamptz for actual events and audit timestamps.
Display timestamps using the organization’s configured timezone.

Do not shift service dates through UTC conversion.

Do not confuse:
service date,
billing period,
external submission date,
payer response date,
scheduled payment date,
actual receipt date,
and database creation date.

11. SERVICE AGREEMENTS AND TRIP COVERAGE

Reuse existing service-agreement data where appropriate, with a clear
distinction between the agreement header and individual authorized lines.

Record authorization at the applicable procedure/service line, including
effective dates, unit type, rate, quantity limits, and verified restrictions.

Do not add transportation base charges to a mileage-only authorization.

Do not treat an authorization limit as delivered service:
“80 miles per week” is not a reason to populate every week with 80 miles.
Record the quantities actually submitted and link them to actual service
evidence where available.

Do not divide mileage units and one-way-trip units interchangeably.

Do not determine billability solely from internal labels such as Pleasure,
Will Call, Medical Appointment, or Regular Transportation.

This module records billing and supporting evidence. It must not claim to
verify live Medicaid eligibility or guarantee coverage/payment.

Do not infer remaining authorization solely from records in this app if
there may be historical submissions outside the app. Show “tracked usage”
and allow a separately documented external balance/as-of date.

Do not hardcode a two-unit T2003 line cap, a universal POS, universal rates,
or other speculative payer rules.

Monthly organization is a useful default filter/workflow, not a blanket
payer-rule assertion. Preserve the actual grouping used externally.

12. DUPLICATE PROTECTION WITHOUT BLOCKING LEGITIMATE COMPONENTS

Do not use a single trip.billing_status flag as the complete billing truth.

One trip may have separately tracked service components, such as a one-way
transport component and mileage. Recording one does not automatically
mean the other was billed.

Maintain an explicit relationship between source services, billed
components, record revisions, and external submission attempts.

Prevent accidentally recording/billing the same economic service component
to both DHS and Connectivity.

A payer change must not erase an existing billing assignment. Require a
documented correction/reassignment workflow.

Resubmitting a rejected or denied claim must retain the original history
without doubling billed revenue or making the same services newly
available to bill.

Use database-backed duplicate/concurrency safeguards, not only a frontend
“already billed” check.

For historical imports, detect possible duplicates using tenant, payer,
external reference, client, dates, component, and amount. Flag uncertain
matches for review rather than merging solely by name or amount.

Never select or link clients by display name alone. Verify tenant and stable
client identifiers.

A missing source link must display as “Unreconciled historical coverage,”
not automatically mean “Unbilled.”

13. SERVER-SIDE AUTHORIZATION AND TRANSACTIONS

Financial integrity and authorization must be enforced on the backend.

Use existing Supabase infrastructure. Do not introduce a new server framework
only for this module.

Use authenticated database commands/RPCs for transactional changes such as:

- Creating a record with its lines.
- Recording an external submission.
- Recording a response and updating normalized state.
- Posting a payment and allocations.
- Posting/reversing an adjustment.
- Creating a correction/revision.

An Edge Function may orchestrate a command if needed, but multiple separate
browser or Edge Function database writes are not an atomic transaction.

Verify the signed-in user and current organization membership server-side.
Never trust submitted actor IDs, role strings, calculated totals, or org_id
without checking authorization.

Enable and test RLS on all new exposed tables and private-storage objects.
Secure child tables and joins as carefully as parent records.

Enforce same-tenant relationships with suitable composite foreign keys or
equivalent database constraints—not just UI filters.

Use narrowly scoped permissions:

- View billing.
- Manage billing records.
- Record payer responses.
- Record payments.
- Approve adjustments/write-offs.
- Export financial data.
- Manage payer/settings configuration.

Map these onto existing roles. Do not give every dispatcher or driver billing
access automatically. Disabled members must not retain billing access.

For privileged command functions, use minimal necessary privileges,
explicit execute grants, a safe search_path, and explicit authorization.
Prefer security-invoker where sufficient; use security-definer only where
necessary and deliberately secured.

Do not leave a direct table-write path that bypasses the command invariants.
Use constraints/triggers/privileges as appropriate.

Keep service-role credentials out of the browser.

Use idempotency keys for duplicate requests and expected version checks for
concurrent edits. Return actionable conflict messages rather than silently
overwriting another employee’s changes.

Audit events must be generated server-side and protected from ordinary
client edits/deletion.

Do not assume old billing migrations prove the live system’s RLS is correct;
verify the policies and grants used by this feature.

14. DOCUMENTS, PRIVACY, AND EXPORTS

Support manually attaching:

- Claims or invoice copies.
- Submission receipts.
- Payer emails/screenshots.
- Remittance/payment advice.
- Service agreements.
- Supporting trip summaries.

Uploading a document must not automatically change a financial status.

Store documents in private Supabase Storage with tenant-aware access.
Use expiring authorized access rather than public URLs.

Allow a remittance document to link to multiple relevant records without
duplicating its financial amounts.

Validate allowed file types, sizes, and content expectations server-side.
Do not render uploaded HTML or other active content as trusted application
markup. Integrate scanning if existing infrastructure supports it; do not
claim files are scanned when they are not.

Use non-identifying storage keys. Avoid patient names, diagnoses, bank data,
and entire payer responses in logs, analytics, notifications, or URLs.

Keep only information needed for billing operations.

Provide CSV exports of visible/filtered billing records and payment
allocations, with export permissions and CSV formula-injection protection.

Do not add AI/OCR remittance interpretation or external document processing
in this phase.

Do not invent a retention period or advertise HIPAA certification.
Follow the organization’s verified policies and preserve financial history.

15. UI WORKFLOWS AND DASHBOARD

Suggested navigation:

- Overview.
- Billing Records.
- Payments.
- Authorizations / Agreements.
- Payers.
- Settings, only where necessary.

Billing Records:
Use an accessible, server-paginated table with filters for payer, client,
service period, submission status, review status, payment status, owner,
and follow-up date.

Useful columns:
internal reference,
record type,
client/client count,
payer,
service period,
submitted externally on,
workflow status,
billed amount,
confirmed received amount,
open balance,
next follow-up,
last activity.

Support an “Action needed” view for:
rejections,
denials,
unresolved reductions,
missing references,
past-due partner invoices,
overdue follow-ups,
and unreconciled payments.

Record detail:

- Clear financial summary.
- Service-line table.
- External submission attempts.
- Payer responses.
- Payments and allocations.
- Documents.
- Activity timeline.
- Follow-up notes.

Show an explicit confirmation when staff record external submission:
“This records a submission already made outside this system. It does not
send anything to the payer.”

Support adding a historical record directly at its known stage without
inventing intermediate acknowledgements or dates.

Dashboard:
Replace all hardcoded metrics with tenant-scoped database results.

Prefer four useful cards:

- Billed externally this month.
- Confirmed payments received this month.
- Outstanding tracked balance.
- Records requiring attention.

Define each metric and its date basis in a tooltip.
Exclude drafts and superseded revisions from billed totals.
Do not count resubmission attempts as new revenue.
Do not count one EFT multiple times through its allocations.
Show unknown/unavailable values honestly instead of manufactured figures.

Use existing TanStack Table and Query patterns.
Provide loading, empty, permission-denied, error, retry, and conflict states.

Do not convert database failures into an empty array that looks like
“No billing records.”

Use accessible labels and keyboard navigation. Status must not rely on
color alone. Respect reduced-motion preferences and the existing theme.

16. TYPESCRIPT AND APPLICATION STRUCTURE

Use strict TypeScript with concrete domain types.

Do not introduce:

- any.
- as any.
- as unknown as SomeType.
- Broad Record<string, any> models.
- @ts-ignore.
- Non-null assertions hiding missing financial or identity data.
- Unvalidated casts of API responses into domain types.

Legitimate generics are fine where they preserve actual type relationships.
Do not build a vague universal CRUD framework.

Generate Supabase database types from the schema and use a typed client.
Use inferred query result types for joins.

Validate external input with Zod at trust boundaries.
Accept unknown input, parse it, and narrow it.
Use discriminated unions for DHS claims versus partner invoices and for
commands/events with different required payloads.

Use explicit enums/unions for statuses, units, record types, and channels.
Use exhaustive handling for status presentation and transitions.

Use typed domain errors such as:
unauthorized,
forbidden,
validation_error,
duplicate_record,
version_conflict,
allocation_exceeded,
and invalid_transition.

Prefer a cohesive feature directory, for example src/features/billing,
adapted to repository conventions, with separate:
schemas/types,
API functions,
query keys,
queries/mutations,
financial helpers,
status/transition logic,
components,
and tests.

Keep business logic out of large JSX components.

Scope every query key to the organization and relevant filters.
Invalidate related summaries/details after successful mutations.
Do not optimistically show a financial action as completed before the server
confirms it.

Do not persist billing/health information to localStorage by default.
Use existing safe session behavior and clear tenant-specific cached views
when access or organization changes.

17. MIGRATION AND LEGACY SAFETY

Existing tables and automation code must be reviewed before migration.

Pay particular attention to:

- Existing globally unique claim_control_number.
- Required trip_id on old service lines.
- Default diagnosis values.
- Existing “included” duplicate index.
- Existing status constraints.
- Cascading deletes.
- Legacy generated-file and submission fields.

Do not reuse an internal patient identifier as a globally unique payer claim
number. These are different identifiers.

Do not force partner invoices into Medicaid-only required columns.
Do not invent clinical fields to satisfy old NOT NULL/default constraints.

Ensure historical financial records survive patient/payer deactivation and
ordinary operational record changes.

Keep existing automation code isolated and inactive for this manual feature.
No manual action may invoke submit-claims or a transmission worker.

Migration/backfill must not reinterpret legacy “accepted” as “paid.”
Preserve the old value and mark ambiguous legacy records for review.

Do not silently rewrite historical charges, service dates, or statuses.

18. TESTS AND ACCEPTANCE CRITERIA

Implement automated tests for at least:

1. A DHS claim is manually recorded with client, lines, authorization,
   external reference, and actual external submission date.

2. A Connectivity invoice is recorded without requiring DHS-specific fields.

3. A partner invoice contains multiple clients while preserving correct
   client attribution per line.

4. Received by payer does not mark money as received.

5. Under review/suspended does not display as paid or denied.

6. A rejection, corrected resubmission, and eventual payment retain all
   attempts without duplicating revenue.

7. A partially paid record remains partially paid.

8. One $1,000 payment allocated across several records counts as $1,000
   received, not $1,000 per record.

9. Allocation cannot exceed the available payment.

10. A $1,000 charge, $100 authorized posted adjustment, and $400 received
    produce a $500 open balance.

11. A fully adjusted record with zero receipts is not displayed as cash paid.

12. 80 × $1.54 calculates as $123.20.

13. A paid one-way-trip component does not incorrectly mark its separate
    mileage component as already billed.

14. Duplicate billing to DHS and Connectivity for the same service component
    is detected.

15. Cross-tenant reads, writes, joins, allocations, document access, and
    forged actor IDs are rejected.

16. Unauthorized or disabled users cannot mutate financial records even
    through a direct API/RPC request.

17. Simultaneous payment/recording requests are safe and idempotent.

18. Editing the operational trip after external submission does not change
    the historical submitted snapshot.

19. Historical entry dates remain distinct from actual submission/payment
    dates, including timezone/date-boundary tests.

20. Database/network errors render as errors rather than zero balances or
    empty records.

21. No manual workflow calls a payer, SFTP endpoint, transmission function,
    invoice-sending service, or 837P generator.

Use the existing test infrastructure where suitable. Add the smallest
appropriate missing tooling and document it rather than introducing an
unrelated test architecture.

19. DELIVERY

Implement in coherent stages:

- Schema, authorization, and transactional commands.
- Billing-record and external-submission workflows.
- Responses, payments, adjustments, and follow-ups.
- Dashboard, documents, filters, and exports.
- Tests and migration verification.

Keep the first release focused on reliable manual operations. Do not let
future EDI automation or a full accounting system expand this task.

At completion, provide:

- What was implemented.
- Files and migrations changed.
- Architecture/security decisions.
- Commands and tests actually run, with results.
- Required configuration or migration steps.
- Known limitations.
- A short walkthrough of a DHS claim and a Connectivity invoice.

Do not claim production readiness based only on a successful frontend build.
Do not claim tests passed unless they were run.

The finished feature should let our team confidently say:
“We know what we billed, who owes us, what happened to each submission,
what has actually been paid, and what requires follow-up.”

Start by inspecting the repository, then implement this manual tracking
workflow end to end.
