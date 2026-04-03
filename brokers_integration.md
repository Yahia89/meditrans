Best approach: do not model brokers as employees inside the provider org. Model them as a separate external party with assignment-based access.

That gives you a clean NEMT-style integration model:
• provider org owns the trip
• broker is an external partner
• broker only sees trips explicitly shared with them
• broker access can happen either through a portal or API
• same permission model powers both

The right architecture

Create a new concept in your system:

Broker Organization

Then create a relationship table like:
• broker_orgs
• provider_broker_links
• trip_broker_assignments

This is better than adding broker users as internal staff because brokers usually need:
• read-only or limited-write access
• visibility across many providers
• only the trips assigned to them
• auditability of what was shared and when

So the core rule becomes:

A broker sees only trips assigned to that broker, not all trips in the provider org.

What to build first

Build this in layers.

1. External access model

Add a separate principal type:
• internal users: owner, admin, dispatcher, driver
• external users: broker users

A broker user belongs to a broker org, not the provider org.

2. Sharing model

Add explicit trip sharing / assignment:
• trip belongs to provider org
• trip may optionally be linked to:
• broker org
• broker trip reference / confirmation number
• brokerage source
• shared fields policy

This lets you support:
• one broker per trip
• multiple brokers later if needed
• different brokers per provider

3. Broker permission scopes

Do not give brokers full trip access. Use field-level scopes.

Default broker-visible fields:
• trip status
• pickup and dropoff summary
• scheduled time
• member first name / masked last name if needed
• driver name
• vehicle info if needed
• current driver location during active trip
• ETA
• milestone events
• completion / cancel reason

Hidden by default:
• internal notes
• pricing / payroll
• billing fields
• org-only operational metadata
• full employee management
• internal dispatch comments

Product shape

You should support two broker-facing surfaces.

Option A: Broker Portal

This is the fastest and cleanest first release.

Brokers log in to your web app, but into a broker experience, not into the provider org as an employee.

They can:
• search their assigned trips
• view trip summary
• track active ride
• see driver ETA and current status
• optionally receive webhooks / notifications

This is easiest to support and fastest to monetize.

Option B: Broker API

After the portal works, expose API access.

Use the same backend authorization model as the portal, just exposed through:
• API keys
• OAuth client credentials later
• webhook subscriptions

This lets brokers pull:
• trip summary
• status
• tracking
• milestones

And receive push events:
• trip accepted
• driver assigned
• driver en route
• arrived
• picked up
• dropped off
• cancelled
• no show

Recommended rollout order

Do it in this order:

Phase 1

Broker portal with read-only access.

Features:
• broker org
• broker users
• trip assignment to broker
• broker trip list
• trip details page
• active trip tracking map
• audit log

Phase 2

Webhook subscriptions.

Let broker systems subscribe to events:
• trip.created
• trip.updated
• trip.status_changed
• trip.driver_location_updated
• trip.completed
• trip.cancelled

Phase 3

Broker API.

Endpoints like:
• GET /broker/trips
• GET /broker/trips/:id
• GET /broker/trips/:id/tracking
• GET /broker/trips/:id/events

Optional later:
• POST /broker/trips if you want brokers to create trips into provider capacity
• PATCH /broker/trips/:id for narrow updates like pickup time or notes

Data model I would use

Core tables:
• broker_orgs
• broker_users
• provider_broker_links
• trip_broker_assignments
• broker_api_keys
• broker_webhook_endpoints
• broker_event_deliveries

Important fields on trip_broker_assignments:
• trip_id
• provider_org_id
• broker_org_id
• broker_reference_number
• visibility_policy_id
• shared_at
• shared_by_user_id
• status
• last_location_shared_at

This keeps ownership and sharing separate.

Authorization model

This is the most important part.

Do not rely only on org_id anymore.

Add a policy layer like:
• internal staff can access trips where trip.org_id = user.org_id
• broker users can access trips only where:
• user belongs to broker_org_id
• trip has active assignment to that broker org

If you use Supabase RLS, this maps well.

Internal role check:
• trip.org_id = auth_org_id

Broker role check:
• exists in trip_broker_assignments
• matching broker_org_id
• active assignment

That way brokers are never “inside” the provider org.

Driver location sharing

Do not expose raw full-time location history by default.

For brokers, expose:
• current active location
• timestamp
• heading
• ETA
• trip status

Optional:
• breadcrumb history only during active trip
• expire after trip completion
• retention window like 24 to 72 hours unless required longer

For privacy and simplicity:
• share location only while trip is active
• stop sharing once trip is completed or cancelled
• log every broker tracking access

API design recommendation

Use a broker-specific namespace.

Example:
• /api/broker/v1/trips
• /api/broker/v1/trips/{id}
• /api/broker/v1/trips/{id}/tracking
• /api/broker/v1/events

Do not reuse internal dispatcher APIs directly. Wrap them behind a broker-safe adapter so you never accidentally leak internal fields.

Event model

Brokers care more about events than full polling.

You should publish milestones like:
• trip assigned
• accepted
• driver assigned
• driver en route
• arrived at pickup
• pickup complete
• arrived at dropoff
• trip complete
• cancelled
• no-show

And for live trips:
• location update every X seconds/minutes
• ETA updated
• geofence milestone triggered

This works for both portal UI and webhooks.

Operational controls you need

Every provider should be able to:
• link a broker org
• assign or unassign trips to that broker
• define what the broker can see
• revoke broker access instantly
• rotate broker API keys
• view access logs

Every broker should be able to:
• see only assigned trips
• filter by provider
• search by broker confirmation number
• subscribe to webhook events
• use API credentials if enabled

UI flow I would recommend

On trip details for provider staff:
• “Share with broker”
• choose broker org
• set broker reference number
• save

Then broker sees:
• trip summary
• map / live status
• assigned provider
• trip milestones
• notes intended for broker

Not shown:
• internal dispatch notes
• payroll
• full org settings
• employee management

Security and audit

You definitely want:
• audit log for every broker-visible action
• per-broker API keys
• IP allowlisting later for enterprise brokers
• webhook signing secret
• per-field redaction policy
• per-provider broker approval workflow

And rate limits:
• trip polling rate limits
• tracking endpoint throttling
• webhook retry queue

What not to do

Do not:
• create broker users as provider employees
• expose internal trip objects directly
• let brokers see all trips in an org
• use a single shared API key across brokers
• mix internal and external permissions in the same role enum only

That becomes unmanageable fast.

Best MVP

If you want the cleanest practical MVP:

Build:
• broker orgs
• broker users
• trip assignment table
• broker portal read-only
• live tracking page
• event timeline
• simple webhook on status changes

Skip initially:
• broker-created trips
• full bidirectional editing
• complicated custom schemas
• multi-broker per trip
• broker-specific write actions

Long-term scalable version

Your final system can become:
• provider dispatch workspace
• broker portal
• broker API gateway
• webhook/event platform
• white-labeled trip status sharing

That is how bigger NEMT platforms usually feel to customers.

Simple implementation plan

Week 1:
• add broker org + broker user models
• add trip assignment model
• add RLS / auth rules

Week 2:
• broker trip list + trip detail
• active trip status + map
• broker-safe serializer

Week 3:
• status webhooks
• broker API keys
• audit logs

Week 4:
• provider UI for linking brokers and assigning trips
• testing with one real broker workflow

The key idea to lock in is:

brokers are not employees; they are external organizations with explicit trip-scoped access.

That will keep the system clean now and make your API, portal, and future integrations much easier.

turn this into a concrete Supabase schema plus RLS plan next.
