# Migration application and resolved test limits — 2026-10-13

The authorized migration `20261013225316_dashboard_timezone_fast_path.sql` is applied to the linked Supabase project **`devszzjyobijwldayicb`** and the local `supabase_db_futuretransportation` database. The frontend has not been deployed or pushed. All earlier SQL and Firefox execution blockers described in the startup handoff are resolved for the checks below.

## What was applied

The migration skips expensive timezone-catalog enumeration for the already accepted exact default `America/Chicago`. Other timezone names retain the existing validation. The function signature, output, authorization checks, `SECURITY INVOKER`, empty search path, RLS, date/granularity limits and EXECUTE privileges remain unchanged. No hosted business records, policies or indexes were changed.

The linked project and original deployed function were verified before the change. An isolated CLI workdir fetched the project's actual migration history and added only the reviewed candidate. The [dry run](database-validation/remote-dry-run.log) listed exactly that migration; the [application log](database-validation/remote-apply.log) confirms success; the [final dry run](database-validation/remote-final-dry-run.log) reports the remote database up to date. The recorded migration version/name and deployed function body were independently checked afterward.

Migration SHA-256: `30c26f5b582d79bc7bbf2c68240d66c4d97c1ad9b379d257f68630b71a81111b`.

## SQL regression results

Docker had previously been unavailable, so tests that execute real PostgreSQL functions and authorization rules could not run. Starting the existing local database made them available. The local snapshot also lacked the original dashboard RPC; its existing baseline migration `20260930190614` was applied locally first. That baseline was already deployed remotely and was not reapplied there.

| Check | Result | Evidence |
|---|---|---|
| Original dashboard function | **26/26 passed** | [baseline log](database-validation/dashboard-baseline.log) |
| Optimized dashboard function | **26/26 passed** | [candidate log](database-validation/dashboard-candidate.log) |
| Exact rollback, then restored candidate | **Exact function definition and ACL restored; 26/26 passed after restoring optimization** | [restored-candidate log](database-validation/dashboard-restored-candidate.log) |
| Manual billing SQL | **Passed; transaction rolled back** | [manual billing log](database-validation/billing-manual.log) |
| Billing authorization/storage RLS SQL | **Passed; transaction rolled back** | [access log](database-validation/billing-access.log) |
| Legacy billing database tests | **5/5 passed** | [Node test log](database-validation/billing-node.log) |

Dashboard tests cover complete totals above 1,000 trips, status buckets, midnight/DST, alternate/default/invalid timezones, range limits, cross-organization denial, driver-only visibility, employee exclusion and anonymous denial. Their synthetic writes roll back. Billing's Node harness commits temporary fixtures and then cleans them up; all 19 checked table counts and pre-existing synthetic ID sets were preserved, with zero new synthetic users or organizations left. Dashboard fixture users, organizations and drivers are also absent after testing.

The database container remains running and healthy. The [rollback SQL](rollback-dashboard-timezone-fast-path.sql) was tested locally and was not executed remotely.

## Hosted verification and timings

Post-deployment reads confirmed the supplied account's matching authenticated identity and visible admin membership, `row_security=on`, read-only transactions and no `BYPASSRLS`. The optimized function returned exactly the same seven performance buckets and four calendar buckets as the pre-migration snapshots. Its body matches the reviewed file, and its ACL, volatility and search-path settings match the original.

Three sequential PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)` samples were taken for each query before and after deployment, using the same authenticated identity, organization, ranges and timezone. These are SQL execution durations, excluding API transport and browser rendering.

| Range | Before median (min–max) | After median (min–max) |
|---|---:|---:|
| Performance, October 7–13 | **778.508 ms** (285.944–809.307) | **10.111 ms** (9.886–30.340) |
| Calendar, October 12–18 | **235.894 ms** (140.709–429.528) | **9.744 ms** (9.595–9.924) |

These small shared-cache samples cover one admin and one organization. They do not establish cold-database, concurrent-load, large-tenant or driver latency. Other-role and large-row-count correctness comes from local regression fixtures. The earlier browser measurements were captured before this migration and do not include its benefit.

Supabase security advisors returned the same **23 pre-existing findings before and after**, with **zero new findings**. Existing items include the PostGIS `public.spatial_ref_sys` RLS notice, a mutable-search-path function, callable security-definer functions and disabled leaked-password protection. Existing settings and policies were preserved; these findings remain available for a separate security review. This result is not a clean security-audit claim.

Sanitized checks, samples, buffers, cleanup results and advisory counts: [migration-application.json](migration-application.json). Raw identifiers and result snapshots remain private and are not committed. Migration workflow reference: [Supabase CLI database push](https://supabase.com/docs/reference/cli/supabase-db-push).

## Firefox and remaining owner steps

Firefox previously exited before tests with `Could not find profile folder`. A disposable child-process application-data directory now resolves that macOS launch issue. **18/18 Firefox checks passed**: 11 startup, 3 dashboard and 4 router. The wrapper removes its own temporary data afterward; no personal profile, browser binary or macOS privacy setting was changed. Run `npm run test:firefox:ui` to repeat the checks. [Firefox results and logs](firefox-validation.md).

The normal `npm run test:router:ui` command keeps its original Chromium/WebKit selection; Firefox uses the isolated wrapper. Browser checks use production assets with synthetic backend fixtures. Firefox live-account latency and standalone billing Firefox coverage were not claimed.

The remaining owner action is to deploy the web app from this branch using the existing `npm run deploy` command, which runs the build through `predeploy`. Use Node 24 and the committed lockfile. After deployment, smoke-check sign-in, Dashboard, Trips, Billing and a saved detail bookmark on the production URL, including refresh/back navigation. No additional migration or Firefox OS setup is required for this change. Hosting cache-policy improvements remain a separate optional change; compatible query bookmarks do not require a new rewrite rule.
