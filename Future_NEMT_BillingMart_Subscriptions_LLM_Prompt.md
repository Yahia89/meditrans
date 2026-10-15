# Future NEMT — BillingMart organization subscriptions

## Implementation brief

Implement a production-quality organization subscription and payment system for Future NEMT. Read this entire brief, inspect the current repository, then implement and test in coherent stages. Do not merely produce another plan or a mock UI.

The user has chosen BillingMart. Do not silently substitute Stripe, RevenueCat, or another processor. BillingMart's own use of other infrastructure is not a reason to integrate that infrastructure directly.

This is SaaS subscription billing: transport companies pay the software seller to use the CRM. It is NOT patient billing, Medicaid claim submission, Connectivity receivables, or the existing manual Billing & Payments module. Keep those financial domains and identifiers separate.

### Confirmed product requirements

- Default subscription: **USD $250 per organization per month**, including **320 trips per billing period**. There is no requested additional setup fee.
- Platform founder can set a different monthly price for each organization when inviting it or editing its company settings.
- Organization **owners and admins only** can manage their organization's payments, methods, invoices, receipts, and autopay preferences.
- Autopay is the intended default offered at enrollment; it must not be activated without the payer's valid recurring-payment authorization.
- An organization can choose manual payment instead. Manual means paying its recurring invoice deliberately, not pretending an automatic charge occurred.
- Renewal reminder email two days before payment is due.
- Automatic collection at renewal, followed by retries every 24 hours where the gateway permits retrying the failure.
- Three-day grace period for an unpaid renewal, followed by organization operational-access suspension.
- Successful-payment email with a simple receipt.
- Keep the existing organization subscription destination `?page=billing` working, including through any ongoing Router migration.
- Refresh the billing page, Companies, Founder Tool, and related dialogs: consistent outline icons, restrained borders, **no colored/glowing shadows**, no artificial security badges, no placeholders masquerading as live data.

### Proposed launch defaults — make these explicit in configuration and documentation

1. One trip means one completed one-way leg, counted once. A completed outbound-and-return journey is two legs. Separate billing procedure lines do not create additional usage. Cancelled/no-show/test records do not count. Verify the application's actual trip/leg model before implementing this.
2. The 320 allowance follows the organization's paid subscription period, not an unrelated calendar-month counter. No rollover by default.
3. Overage pricing and a hard trip cap have NOT been specified. Launch with tracked usage, warnings, and founder follow-up only. Do not invent overage charges or silently prevent a driver completing a journey at trip 321. Document quota enforcement as a separate commercial decision before advertising a hard cap.
4. New paid access begins after verified first payment (or an explicit founder-issued exemption). Creating an invitation does not charge anyone or start a hidden debt clock. No implicit free trial.
5. Price changes take effect at a future renewal, without midcycle proration by default. Preserve the price already promised in a renewal notice; defer a late price change or obtain explicit acceptance before charging a different amount.
6. Complimentary and test organizations are explicitly designated by a founder, not represented by fake successful payments or an accidental zero price.
7. Card payments are the initial supported rail unless BillingMart's merchant configuration explicitly supports another rail. Do not assume ACH has card-like finality or retry rules.
8. Operational suspension does not delete data or disable a person's entire authentication account. Billing recovery, support, sign-out, and switching to a different active organization remain available as appropriate.

Do not change these defaults silently. List them in the final implementation notes.

---

## 1. Inspect the repository and use its skills

Inspect current files rather than assuming the last branch state is unchanged:

- `package.json`, TypeScript configuration, current routing and navigation.
- `src/components/billing-page.tsx`.
- `src/components/admin/companies-page.tsx`.
- `src/components/founder-invite-form.tsx`.
- `src/hooks/usePermissions.ts`.
- Authentication, bootstrap, OrganizationContext, membership-disable handling.
- Current Supabase migrations, generated types, functions, grants, RLS, private Storage, Realtime and mobile-facing RPCs.
- `supabase/functions/send-invite/index.ts`: a Resend integration is present in the inspected repository. Reuse the existing verified email infrastructure where appropriate; do not assume its production credentials or sender domain are configured.
- Existing manual receivables feature under `src/features/billing`; do not repurpose it for SaaS subscriptions.
- Trip completion functions and the canonical leg/completion record.
- Repository instructions, `theme.md`, `banned_useEffect.md`, and relevant installed skills.

Read the applicable frontend-design skill and any actually available React, TypeScript, Supabase/PostgreSQL, security, payment-integration, and testing skills. Report which were used. Do not claim unavailable skills were used. User requirements for sober UI and no glow take precedence over generic decorative design suggestions.

The inspected billing page is a placeholder with $49 pricing, a 25-seat description, a made-up renewal date, Visa 4242, and sample invoices. Replace these with real persisted state or honest empty states. Its visible owner/admin restriction is not proof of backend authorization.

The inspected permissions helper still recognizes `VITE_FOUNDER_EMAIL` for frontend superadmin presentation. Never use a browser email comparison or a user-editable profile claim as financial authority. Inspect and secure the real server-side founder grant.

Do not migrate frameworks, add a second router, undo recent startup improvements, or bring payment SDK code into every route. Use the current stack and lazy-load subscription-specific UI.

---

## 2. BillingMart capability verification is the first implementation gate

Consult the current official documentation and authenticated sandbox where credentials have been securely configured:

- https://billingmart.com/developers/api
- https://billingmart.com/developers
- https://billingmart.com/developers/rest
- https://billingmart.com/developers/authentication
- https://billingmart.com/developers/api/clients
- https://billingmart.com/developers/api/invoices
- https://billingmart.com/developers/api/recurring
- https://billingmart.com/developers/api/payments
- https://billingmart.com/developers/api/actions
- https://billingmart.com/developers/api/webhooks
- https://api.billingmart.com/v1/openapi.json

Some documentation pages were available only through indexed text during research; the live OpenAPI document could not be fetched. Obtain the current schema during implementation rather than inventing missing details.

Create `docs/subscriptions/billingmart-capabilities.md` with supported / unsupported / unverified status, exact documented route/action, required scope, approval rules, and sandbox evidence for:

- Customer creation and safe organization-to-customer mapping.
- Hosted payment-method setup and management without our code handling raw card data.
- Saving a method separately from recurring-charge consent.
- Creating/activating a monthly recurring schedule.
- Modifying the future price and allowance-associated invoice description.
- Issuing invoices and returning the supported customer payment URL.
- Switching manual/autopay mode and revoking recurring consent.
- Recurring off-session charging and customer authentication-required flows.
- Exact retry schedule, retryable versus terminal outcomes, and disabling duplicate provider retries.
- Pausing future recurring issuance/charging and reactivating without unintended catch-up invoices.
- Signed payment/invoice webhooks and safe reconciliation queries.
- Receipt access, invoice/payment amounts, refunds and later reversals/returns.
- Account plan/API/send limits, merchant onboarding and processing fees.
- Hosted portal identity and organization scoping; especially owners/admins who manage multiple organizations, and access revocation after role removal.

Important source-derived constraints:

- The official developer overview describes API-key send requests as requiring a signed-in person's approval. A REST write is not automatically an unattended charge/send authority.
- The recurring update documentation says autopay cannot simply be set through that PATCH; it needs recorded consent. It also describes provider-native recurring invoice issuance and vaulted autopay. Determine the approved initial enrollment path and whether human setup is one-time rather than required every cycle.
- `POST /v1/invoices/{invoiceId}/payments` records an OUTSIDE payment; it is not a card charge endpoint. Never use it to fabricate a successful card payment.
- Workspace `/v1/billing` and `/v1/plan/*` concern OUR BillingMart subscription. They are not subscription endpoints for our Future NEMT organizations.
- REST POST idempotency is documented as lasting 24 hours and scoped to a credential. That is not a permanent guarantee against duplicate invoices across later days or credential changes.
- Webhook delivery retries and payment collection retries are separate mechanisms.

Do not invent Stripe-like setup sessions, customer portals, subscription endpoints, cancellation APIs, SDKs, or webhook payload fields. Internal adapter names are fine; every live provider implementation must map to documented supported operations.

Prefer **BillingMart-native recurring invoices and autopay** if a sandbox flow proves they satisfy the required policy. Use Supabase for product entitlements, usage, reminders where needed, reconciliation, and access policy.

If exact 24-hour payment retries require our scheduler, use it only through a documented, approved server-to-server collection operation and disable overlapping provider retries. If that operation is unavailable, document the precise missing capability for the BillingMart owner. Continue building the local model, UI, security, and tests, but keep unsupported live collection disabled. Do not bypass approval or consent using browser automation, a borrowed human session, or an AI/MCP agent.

Use a single typed BillingMart adapter, not a speculative multi-provider framework.

---

## 3. Merchant, customer and tenancy boundaries

Configure one real software-selling merchant/business, with its verified legal seller name, support email, receipt address, settlement account, environment, and merchant agreement. Do not assume the NEMT operating company is the legal software seller. Verify whether the configured entity is Future Software LLC or another approved seller before charging live.

Model each paying organization as its own BillingMart customer/client under that merchant. Do not provision each organization as an administrator of our merchant workspace.

Store explicit immutable mappings between our `org_id` and provider environment, workspace/business/customer identifiers. Every invoice, payment, method, recurring schedule, and portal request must be verified against those mappings server-side.

Do not match financial ownership using display names or email alone. Never allow caller-supplied provider IDs to determine the organization being charged without mapping checks.

Send only business billing contact data and subscription information to BillingMart. Do not send patient names, diagnoses, Medicaid IDs, service agreements, trip locations, medical appointment details, or patient-level trip logs. Keep usage aggregate-only outside our platform.

These are software subscription invoices, not healthcare service claims.

---

## 4. Payment data: use hosted vaulting, not custom card storage

All full card/CVV entry must take place in BillingMart's supported hosted payment surface or documented isolated hosted fields. Prefer a hosted redirect for launch unless an official embedded integration is actually documented.

Never place PAN, CVV, full bank details, or a homemade hashed/salted version of them in React state, our endpoints, Supabase, logs, analytics, screenshots, fixtures, or support notes. A hash of a card number is not a reusable payment credential.

Store only necessary provider references and display metadata: method reference, brand, last four, expiry if returned, and consent references/status/timestamps. Keep charging-capable references restricted even when they are not raw card numbers. Never store a CVV, even encrypted.

API keys and signing secrets must remain recoverable only in server-side secret management/Vault as needed. Hashing our copy of an outbound API key would make it unusable; restrict and encrypt it instead. No `VITE_*` provider secrets, no service-role secret in browser bundles.

Saving a card and authorizing automatic renewal are distinct permissions. Record who consented, their active organization role, exact displayed price/cadence/terms version, timestamp, provider consent reference, and revocation where supported. Do not toggle autopay locally until provider authorization succeeds.

Deleting/archiving a payment method must use supported provider operations. Prevent stale scheduled jobs charging a removed method or revoked mandate. Reconcile an already-in-flight charge rather than promising it was stopped.

Return/checkout success URLs never prove payment. Verify server-side provider state and webhook evidence. Bind any redirect state to the user, organization, environment, and intended operation. Allowlist return origins and validate provider-hosted URLs; do not build open redirects.

Remove the current unsubstantiated “256-bit SSL” and “PCI DSS Compliant” UI claims. Use accurate copy such as “Payment details are managed securely by our payment provider.” Hosted collection reduces exposure but does not by itself certify our compliance obligations.

---

## 5. Plans and founder controls

Create an immutable/versioned default plan, USD 25,000 minor units per month, 320 included completed legs. Store money as integer cents and currency explicitly; never derive trusted prices from the frontend.

A founder-editable organization subscription configuration should include:

- Plan/version.
- Explicit monthly-price override, with null meaning the default, not zero.
- Included-trip override when needed.
- Billing contact(s), currency and provider mapping.
- Intended collection mode and actual provider-confirmed consent state.
- First billing date, billing timezone, cycle anchor.
- Grace duration default 72 hours and documented retry policy.
- Current access/subscription state and next amount/date.
- Pending future price change/effective date.
- Explicit complimentary/test designation.
- Temporary access override with reason, issuer and expiry.
- Collection/recurring pause state and last provider synchronization result.

Add these to Founder Tool onboarding and Company edit/detail views. Default new organizations to the $250/320 plan but do not charge just because the founder creates or invites them.

Make organization creation, billing configuration and initial invite creation a controlled server command/transaction with an outbox for email/provider work. Do not leave a paid configuration half-created after a sequence of unrelated browser writes fails.

Founder-only price/waiver changes require a trusted server grant, audit trail, amount validation and recent authentication; require MFA for high-impact live administrative actions where configured. Do not bootstrap founder privileges from a mutable client profile field.

Organization owners/admins can view their agreed price but cannot modify it, their quota, grace expiry, paid-through date, exemption or provider mapping. Existing broad organization edit policies must not make new billing columns editable. Prefer separate protected subscription tables.

Use a future-effective revision for price changes, not a rewrite of old invoices. Show old/new amount and effective date, notify the payer, and honor their payment mandate. Do not charge a new amount after a two-day reminder promised the old one without valid notice/acceptance.

Complimentary access is not revenue and must not manufacture an invoice marked paid.

---

## 6. Subscription cycle and invoice ownership

Use one subscription per organization per environment. A subscription period has stable identifiers, start/end boundaries, amount and plan snapshots, allowance, and invoice reference.

Default to monthly anniversary billing from the first verified activation date. Respect calendar months, end-of-month clamping and the provider's actual scheduler semantics; never implement “monthly” as 30 days. Store provider-confirmed next run/period data and test 28th–31st, leap years, timezone changes and DST.

Use half-open period ranges `[start, end)` for usage. Store instants in UTC with a separate verified billing timezone, and preserve actual date-only provider fields as dates. Do not change billing dates when a staff member changes their display timezone.

Each invoice has a price snapshot, subtotal, verified applicable taxes, adjustments, total, currency, due instant/date, immutable external ID, collection state and document references. Amounts come from backend plan configuration and provider calculations. One monthly plan line uses quantity one, not 320 × $250.

Taxes, invoice legal details, cancellation terms and any merchant fee pass-through must be configured from verified business policy. Do not guess tax treatment or enable a surcharge automatically. Display the total before payment.

Use unique constraints on `(subscription_id, period_start, invoice_purpose, environment)` or equivalent to prevent duplicate obligations. Provider-native schedules and local cron must not both issue the same renewal invoice.

Separate provider payment success/capture, processing, invoice paid, merchant settlement/payout, refund and chargeback/return. Access can be granted on a verified successful collectible payment under the chosen rail policy; do not wait for an unrelated merchant bank payout, and do not grant access merely on authorization or a success redirect.

A partial payment does not satisfy the whole renewal unless an explicit supported credit or founder policy closes the balance.

---

## 7. Exact reminder, retry and three-day grace behavior

For a normal renewal due at instant T:

- T minus 48 hours: one reminder with the actual upcoming amount, due date/time, organization, collection mode and a secure billing link.
- T: attempt automatic collection if valid autopay consent exists; otherwise invoice remains due for manual payment.
- On a confirmed unpaid/failed renewal, grace runs to T plus 72 hours. Persist the original boundary. Every retry, login, resubmission or mode switch must NOT extend it.
- For retryable autopay failures, attempts are due at T+24h, T+48h and T+72h, at most one logical attempt per slot. The T+72h attempt is the final scheduled attempt. If it definitively fails and the invoice remains unpaid, operational access is suspended.
- The grace-expiry decision must reconcile any in-flight payment. A timeout is an unknown result, not a definitive decline. Do not initiate a second charge while a previous outcome is unresolved. Record a visible reconciliation exception and alert the founder rather than guessing.
- No repeated automatic retries after suspension by default. The payer can recover through a supported hosted Pay Now flow; future recurring issuance/charging must follow an explicitly tested pause policy so debt does not silently accumulate during suspended service.
- A payment before the cutoff cancels pending retries and suspension atomically in local state. Stale failure webhooks cannot overwrite success for the same settled invoice.

Retry only when the provider permits it. Declines requiring a new card or customer authentication need an action-required flow, not endless off-session attempts. A provider outage, API-key error, plan cap or platform approval delay is not proof the customer's card failed. Alert us and use an audited incident override where needed; do not mass-lock customers due to our integration outage.

Manual mode:
- Monthly invoice still exists with the same due date and 72-hour grace.
- Send a payment-due reminder, not “we will automatically charge you.”
- Do not make automatic card retries without authorization.
- At deadline, suspend if the verified obligation is still unpaid, subject to the same reconciliation rules.
- Switching to manual does not cancel an existing invoice or reset grace.

Do not backdate delinquency to an invitation or a fake historical UI date. Grandfather existing organizations until founder-approved live enrollment.

On late recovery, preserve the correct paid period: do not reset quota or add another month each time a late invoice is paid. If recovery is after the unpaid period has ended, reconcile past debt separately from purchasing a new active period. No automatic catch-up billing for old unissued periods without explicit authorization.

---

## 8. Emails and receipts

Use one designated sender for each email type. BillingMart may own invoice/receipt delivery while our existing transactional provider handles entitlement notices. Avoid duplicate confirmations from both systems.

Required messages:
- Subscription enrollment/terms confirmation.
- Renewal at T-48h; include agreed price, date, included trips and management link.
- Payment failure/action required; include remaining grace and next eligible attempt, without exposing sensitive decline details to ordinary staff.
- Final grace warning when appropriate.
- Suspension notice and recovery link to authorized billing contacts.
- Successful-payment confirmation with an itemized simple receipt.
- Price change, autopay enabled/disabled and cancellation confirmation.

Use a durable outbox with unique logical notification keys, retry/backoff and delivery-state tracking. A worker replay must not send the same receipt twice. Failed email delivery does not roll back a successful payment; it creates a follow-up job.

Receipts include verified seller details, organization billing name, invoice/receipt reference, period, amount/currency/tax, payment date, and masked method where available. No PHI or patient-level details. Use BillingMart's documented payment receipt endpoint/hosted receipt when available rather than inventing a PDF URL.

Two-day notice timing must be implemented, not approximated by a browser timer. If price/email details change after scheduling, re-evaluate the promised charge amount and notice policy.

Reuse the repository's existing Resend integration after reviewing sender verification and secrets. Do not add an email platform without a need.

---

## 9. Entitlements, suspension and recovery

Model commercial access separately from personal authentication, membership status and payment attempts:

`pending_activation | active | grace | suspended_nonpayment | cancelled | complimentary`

Maintain distinct provider states such as `processing`, `requires_action`, `failed`, `succeeded`, and `unknown`, mapped from verified documented provider statuses rather than invented response strings.

Persist authoritative entitlement state and paid/grace boundaries in protected Supabase data. Normal requests should read local entitlement state, not call BillingMart synchronously on every page load.

After the unpaid-renewal deadline:
- Deny normal organization operational access, not just the sidebar route.
- Owner/admin can still reach the minimal Subscription & Payments recovery page, update a method, pay outstanding invoices, view receipts, contact support and sign out.
- Other members see a neutral organization-suspended screen and cannot inspect billing details.
- Users can switch to another organization where they still have access.
- Do not delete clients, trip records, signatures, billing history or authentication accounts.
- Platform founder retains separate administrative recovery access.

Enforce this across Data API, RPCs, Edge Functions, Storage authorization, Realtime authorization and mobile APIs as appropriate. A valid old JWT must not bypass current database entitlements. Review existing permissive RLS policies: adding a new permissive policy can widen access rather than restrict it. Use a tested restrictive gate or refactor policies so the entitlement check is required, with deliberate recovery exceptions.

Protect service-role and security-definer paths explicitly; they can bypass ordinary RLS. Keep membership and tenant checks intact. Secure views and nested relationships, and index lookup predicates. Do not force a network call per row to determine access.

Realtime/cached data: stop subscriptions and evict protected application caches on suspension; recheck auth/entitlements when joining and refreshing. Already downloaded data cannot be remotely erased reliably. Do not promise instantaneous revocation of previously issued signed URLs; use suitably short TTLs and tested access behavior.

NEMT operational safety requires an explicit launch decision. Do not silently cut navigation or completion evidence collection in the middle of a passenger journey. Implement/document a narrow completion-only option for legs begun before suspension, with no new assignments or broad data access, but enable it only after the founder approves this exception. Do not silently soften the requested three-day lock or ship a broad indefinite bypass. Have this decision resolved before live enforcement.

Recovery must depend on verified full payment/credit of the relevant obligation or an audited temporary founder override, never frontend localStorage or a URL parameter. An older invoice payment must not accidentally clear a newer unpaid period. Reenable recurring autopay only where consent is still valid.

---

## 10. Usage meter for the included 320 trips

Keep SaaS usage separate from Medicaid billing units, billing_claim_lines, invoiced mileage, and patient credits.

Use the canonical completed one-way leg and its actual completion time. Ensure repeated status notifications, reopen/recomplete flows, webhook replays, resubmission, and import duplication cannot count the same leg twice. Corrections are auditable, not destructive counter edits.

Use a unique usage event key `(org_id, canonical_leg_id, usage_kind)` and period attribution, or an equivalently reliable database-derived aggregate with correction history. Deleted operational rows must not erase accrued financial usage silently. Treat backfilled pre-enrollment history separately.

Apply the same org/subscription check to all ways of completing or importing trips, including mobile and approved admin paths. Do not make the frontend authoritative for usage.

Display consumed, included, remaining and over-limit usage, period boundaries, and any approved allowance override. Alert at reasonable configured thresholds, such as 80% and 100%, without changing the charge amount. No surprise overage fees or automatic billing conversion.

Returning from a payment flow does not reset the meter. Only the applicable subscription period transition does.

---

## 11. Suggested data boundaries

Adapt to the repository rather than blindly introducing duplicate tables. Keep an isolated namespace such as `saas_*` / `organization_subscription_*`, distinct from receivables.

Logical records needed:

- Plan versions and immutable price definitions.
- Protected platform-admin grants.
- Organization subscription/configuration and future price revisions.
- Provider merchant/customer/schedule mappings, separately test/live.
- Subscription periods and invoice snapshots.
- Payment attempts with slot, idempotency key, provider reference and outcome.
- Payment events/refunds/reversals and reconciliation state.
- Masked payment-method summaries and consent references.
- Usage events/period aggregates.
- Webhook inbox with deduplication and processing state.
- Durable provider-action/email outbox and scheduled work.
- Entitlement overrides with issuer/reason/expiry.
- Append-only audit history.

Use exact integer minor units, explicit currency, dates/timestamptz appropriately, same-tenant foreign keys, unique constraints and version/concurrency checks. Do not expose provider secrets or whole customer payloads through organization `select('*')` queries.

Record the real actor server-side. Keep occurred_at and recorded_at distinct where external events arrive late. Do not hard-delete invoices/payments when an organization is archived.

---

## 12. Idempotency, webhooks and failure handling

Do not claim a database transaction can atomically include an external HTTP card charge. Use local transactional intent + an outbox/lease worker + provider idempotency + reconciliation.

For each logical operation, persist a stable operation key. Retry the same unknown HTTP operation with the same key and matching body; do not generate a fresh random key on every network retry. A new, permitted business retry after a definitive decline is a new attempt against the same invoice, not a new invoice.

Because BillingMart's documented POST replay window is 24 hours and credential-scoped, maintain longer-lived local uniqueness and reconciliation. After an ambiguous timeout across that window, query provider invoice/payment state before another charge. Credential rotation must not bypass local safeguards.

Prevent double-click Pay Now, retry workers and provider-native collection from charging simultaneously. Verify how BillingMart serializes manual portal and recurring collections; do not assume a local lock controls the external portal.

For incoming webhooks:
- Dedicated public endpoint exempt from Supabase-user JWT validation ONLY for the provider callback.
- Authenticate using the exact documented signature over raw bytes, timestamp tolerance and constant-time verification.
- The inspected webhook reference documents `X-BillingMart-Signature`, a timestamped HMAC-SHA256 format and a five-minute replay window. Verify the current serialization/schema and secret-rotation behavior before coding.
- Persist a verified inbox entry before acknowledging success, then process asynchronously/transactionally. Reject invalid signatures and limit body size.
- Deduplicate on the actual stable provider event identifier; do not invent a payload field. If no stable ID exists, agree a safe documented strategy with the provider.
- Resolve tenant/customer/invoice ownership from stored mappings, not a caller-controlled org_id field.
- Handle duplicated, delayed, out-of-order and missing events. Re-fetch canonical provider state when necessary.
- Never let an old decline overwrite a later payment for the same obligation.
- Unknown event types are recorded safely without granting access.

Use only documented event names. The inspected list includes invoice paid/partially-paid/overdue/voided and payment succeeded/declined/refunded/returned. Do not invent subscription.* or payment-method.* events without documentation.

Implement periodic reconciliation for missing events and fields with no events. Do not assume merchant settlement is delivered by webhook; the payment reference specifically describes settlement as polled.

A valid signed event is still not enough to activate the wrong organization: verify amount/currency, environment, invoice and period association, and remaining balance. Refunds/returns/disputes need reconciled financial state and an explicit access policy, not duplicate successful revenue.

---

## 13. Background scheduling and security

Use Supabase Cron/pg_cron and existing backend infrastructure for due work. A periodic durable scheduler (for example, every 5 minutes) can claim due reminders, reconciliation tasks and approved collection work; retry eligibility is based on stored instants, not how often the cron ticks.

Do not use browser setTimeout/setInterval for collection, grace expiry or renewal notices. Do not run one fragile in-memory timer per tenant.

Use transactional work claiming/leases, bounded batches, next_attempt_at, backoff, dead-letter state, and monitoring. Avoid holding a database transaction open across provider HTTP calls. Recover expired leases safely.

Authenticate scheduler invocation with a dedicated server-only credential or equivalent trusted job identity. A public Supabase publishable/anon key alone is not privileged job authentication. Rotate job and provider secrets without exposing them in logs.

During catch-up after downtime, do not fire all missed daily card attempts in a burst. Reconcile first, preserve the 72-hour policy, and schedule only a currently eligible attempt. Do not suspend paid users because an email job failed or BillingMart temporarily cannot be reached.

Provide separate kill switches for live collections and automatic suspension. A charges-off incident mode must not accidentally trigger mass unpaid suspensions. Surface integration errors to the founder rather than presenting them as customer card failures.

---

## 14. Permissions and audit

Separate capabilities rather than widening the existing “admin can do everything” function:

- `manage_own_org_subscription`: active owner/admin of that org.
- `view_own_org_invoices` and authorized receipt/method metadata access.
- `manage_platform_subscription_pricing`: trusted platform founder only.
- `grant_subscription_override`: founder only, reason and expiry required.
- `record_verified_offline_payment` / refund administration: founder only with evidence, not tenant self-service.

Server commands must validate Supabase identity, current membership/role/disabled state, requested organization, provider ownership and expected revision. Never accept arbitrary actor, price, paid status or method-owner fields from the browser.

Prevent ordinary organization admins from modifying plan amount, quotas, platform grants, test/live mode, access exemption, invoice-paid flags or provider merchant settings through direct database writes.

Founder support actions do not authorize charging a customer's saved card contrary to their consent. Refunds/cancellations are explicit commands with amount previews and appropriate confirmations. Do not make them accidental side effects of editing a company.

Audit every plan edit, mandate change, method-management request, charge attempt, manual payment entry, suspension, recovery and override. Avoid secrets/PHI in audit payloads. Record immutable factual events rather than allowing clients to rewrite the audit trail.

---

## 15. Organization billing UI

Build the real `?page=billing` screen, preserving its external URL compatibility:

- Current plan, effective price, included 320 trips or documented override.
- Usage meter with period and count definition.
- Real renewal date and upcoming invoice amount.
- Autopay/manual mode, consent status and clear pending/action-required UI.
- Masked provider-returned payment method, or an honest “No payment method.”
- Supported hosted Add/Manage Payment Method action.
- Pay Now for a verified outstanding invoice.
- Invoice/receipt history with status, amount/currency and safe download links.
- Grace deadline and next eligible retry when past due.
- Clear suspension/recovery instructions.
- Owner/admin billing contacts and notifications settings.
- Cancel-renewal flow with effective period end and confirmation; manual mode is not cancellation.

Never show sample Visa 4242, pretend invoices, invented renewal dates, “payment succeeded” from a redirect, or a local checkbox masquerading as provider consent. Test data belongs only in explicitly identified sandbox environments.

Owners/admins can manage only their own organization. Drivers/dispatchers/staff do not get financial-detail views, even if they can access operational data normally.

Return from a hosted flow should show “Confirming payment/setup…” until verified backend state arrives, with bounded polling and a clear recovery path. It must survive refresh and webhook arrival before or after return.

---

## 16. Founder UI and visual cleanup

Companies table/detail should show subscription state, effective monthly price, included trips/usage, collection mode, next renewal, grace end if relevant, and last confirmed payment. Keep platform-admin context distinct from entering an organization's operational workspace.

Add/edit-company forms need the monthly-price field defaulting to $250, included trips defaulting to 320, future effective date for price edits, and deliberate complimentary/test configuration. Make important changes confirmable and auditable.

Support a scoped manual refresh/reconcile action that retrieves provider state, not a button that manufactures paid status.

Visual rules for subscription page, founder onboarding, Companies and related dialogs:
- Use the icon family established by the current UI cleanup; consistent outline weight and sizes.
- Remove duplicate decorative shield/bolt badges, neon icon tiles, colored shadow rings, oversized soft glows, hover scaling and ornamental gradients.
- Prefer subtle neutral borders; minimal or no shadow.
- Keep readable type, compact factual tables, keyboard/focus states and responsive layouts.
- Do not change the production app icon or unrelated screens as part of this task.
- Use skeletons, honest empty states, disabled-with-explanation actions, error/retry states and accessible non-color-only statuses.

Remove unsupported “secure/compliant” marketing assertions rather than reproducing them with new icons.

---

## 17. TypeScript and maintainability

Use a cohesive `src/features/subscriptions` domain (or equivalent repository convention), separate from manual receivables.

Use concrete types, generated Supabase types, Zod at API/input boundaries and discriminated unions for commands/results and provider outcomes. A shape assertion is not runtime validation.

Do not introduce `any`, `as any`, `as unknown as`, speculative non-null assertions, broad untyped record bags, or ignored TypeScript errors. `unknown` is appropriate before parsing; legitimate generics are appropriate where they preserve a meaningful relationship.

Use explicit money/currency, IDs, environment and event-state types. A database/provider status must map through exhaustive checked logic, with safe handling for unknown external enum values. Do not force an API response into a desired union with a cast.

Use a typed BillingMart HTTP adapter with bounded timeouts, documented error envelopes, request IDs, retry classification, scope handling and redacted logs. Do not depend on an imaginary SDK. Generate from official OpenAPI where reliable and add runtime schema checks for the consumed fields.

Use TanStack Query with organization/user-scoped keys, targeted invalidation, request cancellation, and no optimistic “paid” state. Do not load all companies' billing data into the browser and filter locally. Avoid separate new state-management libraries.

Retain recent performance improvements: subscription entitlements come from a small local bootstrap/read, invoices load only on the billing route, and provider requests run server-side. Do not block every dashboard load on BillingMart or load unnecessary payment JS globally.

Keep backend calculation/authorization code shared where appropriate without importing privileged modules into frontend bundles.

---

## 18. Required tests

Automated unit/database/integration/UI coverage should include:

1. Default USD $250 / 320 plan and a founder-issued custom $300 plan both show and charge the server-approved amount, never a tampered client amount.
2. Owners/admins can manage only their organization's billing; dispatchers, drivers, unrelated users and disabled members cannot. A forged founder email or editable profile does not grant financial privileges.
3. Organizations cannot self-edit price, quotas, paid-through, exemption or provider references through the Data API.
4. Initial invitation causes no payment or delinquency; first access activates only after verified payment/exemption.
5. Saving a method without recurring consent does not activate autopay; revocation stops future eligible automatic attempts.
6. $250 is represented as 25,000 USD cents, not floating point; 320 is an allowance, not an invoice multiplier.
7. One invoice per period across cron retries, provider events, deployments and mode switches.
8. Duplicate checkout clicks, provider-native charge versus manual portal payment, retry-job concurrency, unknown timeouts and retries beyond the 24-hour replay window cannot double-charge.
9. Webhook authentication, stale/future timestamps, secret rotation, duplicates, out-of-order declines, cross-org mappings and test/live mismatches.
10. Fake return URL, $1 partial payment, authorization-only status or an unrelated old paid invoice cannot activate a full current subscription.
11. T-48h reminder, T initial charge, +24h/+48h/+72h eligible retries; suspension after final definitive failure without resetting grace.
12. Manual mode never auto-charges; due/grace behavior still applies.
13. Requires-action and terminal declines do not produce unsafe automatic retries.
14. Payment success just before/at grace expiry wins over stale suspend jobs after canonical reconciliation.
15. Suspended org loses operational access through direct REST/RPC/Edge/Storage/mobile/Realtime paths; recovery still works for authorized billing users; another active org stays accessible.
16. Any approved in-progress completion-only exception is narrowly bounded and cannot authorize new trips or broad data reads.
17. One completed leg counts once despite edits/replays; cancellations/no-shows/test imports do not inflate usage; period boundaries and reversals are auditable.
18. Usage >320 produces the configured warning-only policy, never an invented overage charge or hidden lock.
19. Price changes after reminders cannot silently charge an unannounced amount; old invoices retain immutable prices.
20. Month-end anchors, leap-year February, DST, organization timezone changes, late payments and cancelled renewals.
21. Refunds/returns/chargebacks and later invoice updates reconcile correctly without duplicate cash/revenue or accidental cross-period reactivation.
22. Job crashes/leases, provider outages, email failures, API plan caps and kill switches are visible and do not trigger a cascade of wrongful lockouts.
23. A receipt is sent once after real success; no credentials, PAN/CVV, raw gateway secrets or PHI enter payloads/logs/browser storage.
24. Production migrations do not charge or suspend existing customers until deliberately enrolled; complimentary/test tenants stay isolated.
25. Existing Medicaid/manual receivables, trip completion, invites, login/reset, organizational switching and other established tests remain functional.

Use sandbox fixtures without real client/health data. Run current typecheck, relevant lint, database tests, Playwright tests, and the production build. Report actual results and failures, not invented pass statements.

---

## 19. Rollout, operations and deliverables

Stages:
1. Inspect and document current implementation plus BillingMart capability map.
2. Implement protected schema, typed adapter, domain state machine and founder configuration in sandbox.
3. Implement hosted payment setup/manual pay and verified invoice/payment synchronization.
4. Implement approved recurring collection, notifications, usage, grace and access enforcement.
5. Test with time-controlled failures, replays and complete recovery.
6. Run shadow-mode entitlement decisions first. Enable live billing for one explicitly approved pilot organization, then expand.

Never charge, refund, cancel real subscriptions, change live merchant settings, register live webhooks or deploy production-suspension policies during this coding task without explicit authorization. Read-only inspection and local/sandbox implementation can proceed. Keep credentials in the user's secure environment rather than requesting them in chat.

Before live enrollment, resolve merchant identity/tax settings, account plan and processor fees, the approved hosted enrollment/consent flow, exact retry support, authorized billing contacts and the in-progress trip cutoff policy. Do not hide an unsupported requirement behind a checkbox.

Do not delete test organizations, existing financial records or unrelated features as cleanup. No automatic historical charges. Preserve trusted admin recovery if an integration has an outage.

Deliver:
- Actual implemented files and migrations.
- Current provider capability/approval matrix and precise unverified items.
- Architecture and permission/security explanation.
- Configuration/env example with placeholders only.
- Sandbox setup and test evidence.
- Founder and organization onboarding walkthroughs.
- Operational runbook for unknown payments, missed webhooks, failed reminders, past due, suspension, manual recovery, refunds and provider outages.
- Feature flags/kill switches, live rollout and rollback instructions.
- Tests actually run and remaining limitations.

Do not declare this complete merely because the UI has a card form and a “Paid” badge. The feature is complete when verified money events, recurring invoices, authorization, owner/admin management, tenant isolation, reminders, retries and recovery work together without duplicate charges or misleading state.

## Official reference notes

Research snapshot: October 13, 2026. Recheck versions and provider contracts at implementation.

- BillingMart pricing: https://billingmart.com/pricing . Public text states a free plan and 0% added platform take rate; processing rates depend on merchant agreement. Exact plan table prices/limits were not retrievable in this research. Do not treat the optional pass-through program's $10 monthly gateway fee as the universal platform cost.
- PCI SSC on recurring CVV storage: https://www.pcisecuritystandards.org/faqs/1280/ and https://www.pcisecuritystandards.org/faqs/1319/ . Do not store CVV after authorization.
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase scheduled Edge Functions: https://supabase.com/docs/guides/functions/schedule-functions
- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase column privileges: https://supabase.com/docs/guides/database/postgres/column-level-security

Proceed with repository inspection and sandbox implementation now. When a provider capability is genuinely unsupported or unspecified, implement the rest, isolate that integration boundary, and report the exact blocker rather than guessing or switching providers.
