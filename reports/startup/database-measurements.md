# Authenticated dashboard database profile

Initial read-only profiling succeeded on 2026-10-13 through the repository's verified linked Supabase CLI connection. The Supabase plugin's earlier permission denial remains true for that connector; it does not block the linked CLI route. The original observations below are preserved as the **before-migration state**. Profiling itself made no live data or schema changes; the subsequently authorized function migration is now applied, with separate [application and verification evidence](migration-application.md).

The supplied test account's primary organization has an admin membership. Before measuring, the session confirmed the matching `auth.uid()`, visible membership, `authenticated` role, read-only transaction, enabled row security and absence of `BYPASSRLS`. Every measured transaction used the same claims and role, a 15-second statement timeout, a 2-second lock timeout, and `ROLLBACK`. Identifiers and raw plans remain private.

| Query | PostgreSQL execution | Rows returned | Trip rows scanned | Access path |
|---|---:|---:|---:|---|
| Weekly performance RPC | 829.493 ms | 7 buckets | Hidden by Function Scan | Function Scan |
| Exact performance aggregate | 6.812 ms | 7 buckets | 45 | `idx_trips_org_id_pickup_time` |
| Current-week calendar RPC | 812.595 ms | 4 buckets | Hidden by Function Scan | Function Scan |
| Exact calendar aggregate | 3.667 ms | 4 buckets | 17 | `idx_trips_org_id_pickup_time` |
| Recent activity | 5.315 ms | 5 trips | 5 | `idx_trips_org_updated_at` |

The performance range was October 7–13 and the calendar range October 12–18, inclusive, in `America/Chicago`; SQL used half-open UTC bounds. These are single sequential observations with all root buffers served from shared cache, no shared disk reads and no temporary spills. They are SQL execution times, not browser or network timings.

At the initial profile, the deployed RPC body matched `20260930190614_dashboard_trip_buckets.sql`. It was `STABLE SECURITY INVOKER` with an empty `search_path`; `authenticated` could execute it and `anon` could not. RLS was enabled on trips, memberships and drivers. The existing trip, membership and driver access indexes were verified from the live catalog. The membership sequential scan examined only 15 rows once, with suitable indexes already available. The applied candidate preserves these access properties.

Three additional sequential read-only checks isolated the original delay. The baseline `pg_timezone_names` predicate took **787.874 ms**: its Function Scan discarded 1,089 names before finding `America/Chicago`. Native `timezone('America/Chicago', transaction_timestamp())` took **1.472 ms**, and a synthetic invalid name correctly raised SQLSTATE `22023`. The catalog validation explains the dominant RPC overhead. A new trip index is not justified by these plans.

A direct parser replacement needs care: PostgreSQL accepts abbreviations and POSIX specifications beyond the exact canonical-name catalog check. The implemented change uses a nested fast path for the already verified canonical default `America/Chicago`, retaining the catalog lookup for every other non-null name. It rejects null first and validates before aggregation, including when the range contains no trips. This avoids widening the accepted timezone names. Nested control flow also avoids relying on SQL boolean evaluation order.

Migration [20261013225316_dashboard_timezone_fast_path.sql](../../supabase/migrations/20261013225316_dashboard_timezone_fast_path.sql) was **applied with user authorization** to verified remote project `devszzjyobijwldayicb` and the local `futuretransportation` container. Only version `20261013225316` was applied remotely. The local container first needed the baseline RPC migration `20260930190614`. Source comparison verified that only the timezone-validation block changes: the signature, authenticated-user and membership checks, `SECURITY INVOKER`, empty search path, trip RLS, finite ordered timestamps, 62-day range cap, day/hour restriction, 2-day hourly cap and half-open aggregate body are unchanged. The deployed body matches the candidate and its ACL is unchanged; the migration contains no grant, policy or index changes.

The actual-function [rollback regression suite](../../supabase/tests/dashboard_trip_buckets_rollback.sql) passed **26/26 assertions** against each local baseline, candidate and restored candidate. Coverage includes the exact default, case sensitivity, null/empty/invalid names, parser-only offset rejection, another canonical zone, invalid input with no matching trips, default-zone nonmember/driver/employee access, range caps, DST and totals over 1,000 trips. These fixture writes were local and rolled back; they were not executed against live application data.

The [function rollback](rollback-dashboard-timezone-fast-path.sql) was exercised locally and verified to restore the exact previous definition and ACL without replaying old index or grant statements. The candidate was then restored and its 26 assertions passed again. No remote rollback was performed; the candidate remains applied.

The separate application stage repeated authenticated SQL measurements, with matching identity, read-only mode, row security and no `BYPASSRLS`. Its three-sample medians were **778.508→10.111 ms** for the performance RPC and **235.894→9.744 ms** for the calendar RPC. The before/after results contained identical seven performance and four calendar buckets. These repeated samples are distinct from the initial single observations in the table above. They measure SQL execution, not browser or network latency; all retained frontend comparisons predate the migration.

Security advisors remained at **23 findings before and after, zero new**. Existing findings, including the PostGIS `spatial_ref_sys` error and other warnings, remain. See [migration-application.md](migration-application.md) for the full applied-stage checks and sanitized results.

The live samples cover one admin, one organization and small current ranges. The local role tests provide additional fixture coverage, but neither establishes live driver/restricted-role latency, cold-cache behavior, concurrent load or large-tenant scaling. PL/pgSQL's Function Scan hides nested plans, and separately measured statements can have different cache or plan-initialization conditions.

The sanitized timings, buffers, plan shapes, role checks and index definitions are in [database-measurements.json](database-measurements.json). Raw SQL and plans are restricted to `/tmp/meditrans-db-profile/`. The reusable [database-profile.sql](database-profile.sql) is a `psql` template; linked CLI profiling used private SQL files without `psql` meta commands.

Method references: [Supabase observability](https://supabase.com/docs/guides/monitoring-and-debugging), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html), [timezone input forms](https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-TIMEZONES), [timezone catalog](https://www.postgresql.org/docs/current/view-pg-timezone-names.html).
