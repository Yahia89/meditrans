Design and implement a new broker integration route/page in my TanStack Start web app, backed fully by Supabase. Assume a positive-path first version where a provider already has valid broker API credentials (for example MTM Link, and later other brokers like SafeRide Health facing broker connections). The goal is to let provider org admins connect a broker integration from inside the SaaS, enter API credentials/config, test the connection, save it securely, and then automatically sync dropped trips into our internal trips system with minimal manual work.

Build a broker integration page and flow with these requirements:

1. Route/page
   Create a dedicated route such as /app/settings/integrations/brokers or /app/brokers/integrations.
   The page should list existing broker connections for the current org and allow creating a new one.

2. Broker connection setup UI
   On the page, provide a clean setup form with:

- broker type/provider selector (start with MTM Link, but architecture must support more brokers later)
- connection name
- client id
- client secret
- scope
- org id/provider id
- optional webhook/shared secret fields
- optional environment selector (sandbox/production)
- optional sync window settings (current + future trips)
- button to test connection
- button to save connection
- clear connection status states: not connected, testing, connected, failed, syncing

3. Secure backend design
   Use Supabase as backend.
   Store broker connections per org, not globally.
   Secrets must not be exposed to the client after save.
   Use Supabase tables plus server-only actions / route handlers / edge functions as needed.
   Edge/server code should own:

- credential encryption/decryption or secret handling
- test connection
- sync jobs
- webhook ingestion
- pushing status updates back to broker later
  Design this as an adapter-based integration system, not MTM-specific hardcoding.

4. Data model
   Create a scalable schema for:

- broker_connections
- broker_sync_runs
- broker_trip_imports
- broker_trip_links
- broker_event_queue
  Include org_id on all relevant records.
  Trips in our internal system should support external linkage fields like:
- broker_name
- broker_trip_id
- broker_reference_number
- broker_connection_id
- external_status
- external_payload_snapshot
- synced_at
  Use RLS-safe org scoping.

5. Sync behavior
   After successful connection, allow automatic sync of broker-dropped trips into our SaaS.
   On sync:

- fetch current and future trips from broker
- normalize broker payloads into our internal trip model
- create new trips or update existing ones by broker_trip_id
- prevent duplicates
- preserve raw payload snapshots for debugging/audit
- log sync results
  Add a “Sync now” action on the page.
  Also support future scheduled sync via Supabase cron/edge functions, but prioritize manual sync first.

6. Internal trip mapping
   Map broker trips into our existing trip system so provider dispatchers can manage them normally after import.
   Support normalized fields such as:

- member/passenger name
- pickup/dropoff
- appointment time
- LOS / mobility requirements
- notes
- broker confirmation number
- trip status
- driver assignment fields if later updated internally
  The imported trip should become operationally usable in our platform immediately.

7. UX expectations
   The page should feel production-grade:

- broker cards/table of existing connections
- status badges
- last sync time
- counts of imported/updated/failed trips
- recent sync history
- recent errors with actionable messages
- empty state explaining the integration flow
- success state showing connection health
  Use TanStack Start patterns cleanly with strong TypeScript types.

8. Extensibility
   Architect the integration so more brokers can be added later with a common adapter interface, for example:

- authenticate/test
- fetch trips
- normalize trip
- ingest webhooks
- push status updates
  Start with MTM-first abstractions, but do not couple the UI/backend too tightly to one broker.

9. Broker visibility / future broker portal support, i believe through external links only for now , no need to over-engineer it for now.
   Design with the future in mind so brokers can later “tap in” and see trip stats, live status, and trip summaries for their assigned trips, without treating brokers as internal employees of the provider org.
   For now, just prepare the schema and service boundaries so future broker-facing access and broker trip summaries can be added without refactoring the core model.

10. Output required
    Generate:

- route/page component(s)
- server actions / API handlers
- Supabase schema/migrations
- TypeScript types
- adapter interface
- MTM starter adapter scaffold
- sync service
- minimal UI states
- comments explaining architecture decisions
- a recommended folder structure for TanStack Start + Supabase

Optimize for a real SaaS codebase: multi-tenant, secure, maintainable, and easy to expand into full broker integrations, trip syncing, and later broker-facing trip summaries/stat tracking.
