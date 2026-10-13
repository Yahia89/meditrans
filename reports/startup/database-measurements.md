# Authenticated dashboard database profile

Read-only profiling succeeded on 2026-10-13 through the repository's verified linked Supabase CLI connection. The Supabase plugin's earlier permission denial remains true for that connector; it does not block the linked CLI route. No live data, schema, policies, indexes or migrations changed.

The supplied test account's primary organization has an admin membership. Before measuring, the session confirmed the matching `auth.uid()`, visible membership, `authenticated` role, read-only transaction, enabled row security and absence of `BYPASSRLS`. Every measured transaction used the same claims and role, a 15-second statement timeout, a 2-second lock timeout, and `ROLLBACK`. Identifiers and raw plans remain private.

| Query | PostgreSQL execution | Rows returned | Trip rows scanned | Access path |
|---|---:|---:|---:|---|
| Weekly performance RPC | 829.493 ms | 7 buckets | Hidden by Function Scan | Function Scan |
| Exact performance aggregate | 6.812 ms | 7 buckets | 45 | `idx_trips_org_id_pickup_time` |
| Current-week calendar RPC | 812.595 ms | 4 buckets | Hidden by Function Scan | Function Scan |
| Exact calendar aggregate | 3.667 ms | 4 buckets | 17 | `idx_trips_org_id_pickup_time` |
| Recent activity | 5.315 ms | 5 trips | 5 | `idx_trips_org_updated_at` |

The performance range was October 7–13 and the calendar range October 12–18, inclusive, in `America/Chicago`; SQL used half-open UTC bounds. These are single sequential observations with all root buffers served from shared cache, no shared disk reads and no temporary spills. They are SQL execution times, not browser or network timings.

The deployed RPC body matches `20260930190614_dashboard_trip_buckets.sql`. It remains `STABLE SECURITY INVOKER` with an empty `search_path`; `authenticated` can execute it and `anon` cannot. RLS is enabled on trips, memberships and drivers. The existing trip, membership and driver access indexes were verified from the live catalog. The membership sequential scan examined only 15 rows once, with suitable indexes already available.

Three additional sequential read-only checks isolated the main delay. The deployed `pg_timezone_names` predicate took **787.874 ms**: its Function Scan discarded 1,089 names before finding `America/Chicago`. Native `timezone('America/Chicago', transaction_timestamp())` took **1.472 ms**, and a synthetic invalid name correctly raised SQLSTATE `22023`. The catalog validation explains the dominant RPC overhead. A new trip index is not justified by these plans.

A direct parser replacement needs care: PostgreSQL accepts abbreviations and POSIX specifications beyond the exact canonical-name catalog check. The smaller proposed follow-up is a nested fast path for the already verified canonical default `America/Chicago`, retaining the current catalog lookup for every other non-null name. Reject null first and validate before aggregation, including when the range contains no trips. This avoids widening the accepted timezone names. Nested control flow also avoids relying on SQL boolean evaluation order.

The implementation is prepared in [20261013225316_dashboard_timezone_fast_path.sql](../../supabase/migrations/20261013225316_dashboard_timezone_fast_path.sql) and is **unapplied**. Source comparison verified that only the timezone-validation block changes: the signature, authenticated-user and membership checks, `SECURITY INVOKER`, empty search path, trip RLS, finite ordered timestamps, 62-day range cap, day/hour restriction, 2-day hourly cap and half-open aggregate body are unchanged. `CREATE OR REPLACE` preserves existing EXECUTE grants; the migration contains no grant, policy or index changes.

The actual-function [rollback regression suite](../../supabase/tests/dashboard_trip_buckets_rollback.sql) now covers the exact default, case sensitivity, null/empty/invalid names, parser-only offset rejection, another canonical zone, invalid input with no matching trips, default-zone nonmember/driver/employee access, range caps, DST and totals over 1,000 trips. This SQL suite was **not executed**: local PostgreSQL tools and Docker are unavailable, and writing fixtures to the live project was outside this task. Run it in a disposable database before deployment, compare exact outputs and repeat the profiles. No predicted latency improvement is presented as deployed evidence.

If the follow-up is deployed and must be reversed, [rollback-dashboard-timezone-fast-path.sql](rollback-dashboard-timezone-fast-path.sql) restores the exact previous function definition without replaying the old migration's index or grant statements. The rollback file is also unapplied.

These samples cover one admin, one organization and small current ranges. They do not establish driver/restricted-role behavior, cold-cache latency, concurrent load or large-tenant scaling. PL/pgSQL's Function Scan hides nested plans, and separately measured statements can have different cache or plan-initialization conditions.

The sanitized timings, buffers, plan shapes, role checks and index definitions are in [database-measurements.json](database-measurements.json). Raw SQL and plans are restricted to `/tmp/meditrans-db-profile/`. The reusable [database-profile.sql](database-profile.sql) is a `psql` template; linked CLI profiling used private SQL files without `psql` meta commands.

Method references: [Supabase observability](https://supabase.com/docs/guides/monitoring-and-debugging), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html), [timezone input forms](https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-TIMEZONES), [timezone catalog](https://www.postgresql.org/docs/current/view-pg-timezone-names.html).
