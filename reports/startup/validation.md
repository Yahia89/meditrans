# Validation — 2026-10-13

Validated application build `febad46`, including the GPS/ETA safeguard. The earlier billing and media checks used candidate `64a69c1`; the safeguard only changes active GPS side effects. Regression infrastructure is committed in `1e704f1`, with the subsequent Firefox runner in `8986540`. Browser suites served built assets through Vite preview with synthetic sessions, records and backend responses. Later authorized migration verification is listed separately; retained browser timings were collected before that SQL stage.

| Check | Result | Evidence and scope |
| --- | --- | --- |
| Non-database domain tests | **173/173 passed** | `/tmp/meditrans-handoff-domain-tests.log`; auth/cache isolation, routing, billing, trip completion/location provenance, compliance, inspections, driver exports, PDF and workbook behavior. |
| GPS/ETA safeguard | **24/24 focused tests passed** | `/tmp/meditrans-gps-lifecycle-final.log`; includes stalled lookup/SMS, continued GPS, identity switch and timeout checks. These tests are also included in the final 173-test run. |
| Startup browser regressions | **22/22 passed** | Chromium11 + WebKit11; `/tmp/meditrans-handoff-startup.log`. |
| Dashboard browser regressions | **6/6 passed** | Chromium3 + WebKit3; `/tmp/meditrans-handoff-dashboard.log`. |
| Router browser regressions | **8/8 passed** | Chromium4 + WebKit4; `/tmp/meditrans-handoff-router.log`. [Suite and scope](../../tests/router-ui/README.md). |
| Firefox follow-up | **18/18 passed** | Startup11, dashboard3, Router4 against production build `febad46`; [retained logs and runner details](firefox-validation.md). Synthetic correctness checks, not live-account performance. |
| Billing browser regressions | **60/60 passed** | Chrome, six phone-to-desktop viewports; `/tmp/meditrans-billing-final-rc.log`. |
| Billing geometry follow-up | **6/6 passed** | `/tmp/meditrans-billing-filter-final-rc.log`; waits for records, totals and web fonts before measuring. The original 1px scroll/geometry criterion remains unchanged. |
| TypeScript and scoped ESLint | **Passed** | Production build includes `npm run typecheck`; changed-code lint and `npm run lint:billing` passed. Scoped results do not assert repository-wide lint cleanliness. |
| Production build | **Passed** | `/tmp/meditrans-handoff-build.log`; Vite8 reported **858ms** for its build phase, excluding TypeScript time. Existing large-chunk warnings remain. |
| Development/HMR smoke | **Passed** | `/tmp/meditrans-vite8-dev.log`; ready in **383ms**. Argent verified a temporary CSS property updated and reverted without navigation. This is a local development check, not end-user latency. |
| Dashboard SQL regression | **26/26 passed on each tested definition** | Local baseline, candidate and restored candidate; rollback restored the exact definition and ACL. [Migration verification](migration-application.md). |
| Billing database follow-up | **Both SQL suites and 5/5 Node tests passed** | Verified local container; [retained logs and cleanup evidence](migration-application.md). All 19 compared table counts unchanged, with no leftover synthetic users or organizations. |

Startup coverage includes unresolved and failed membership checks, retry, expired sessions, confirmed absent drivers, disabled driver records, denied billing bookmarks, RLS-hidden organizations, membership removal, tenant/account cache isolation, stable token refresh and cross-tab logout. The 503 test asserts exactly two membership attempts: the shared Supabase client disables nested transport retries, leaving the existing Query policy in control. Existing billing 503 checks pass without increasing their 20-second timeout.

Dashboard checks cover shared credit reads, viewport-deferred chart loading, parallel module/data loading and honest error states. Router checks cover back/forward, detail links, filters/fragments, presence continuity, deferred imports and unsaved trip state through token refresh. Stale-deployment recovery requires an explicit refresh and newly published asset URLs; recovery from restoring an unchanged failed URL is not claimed for WebKit.

The domain total includes **7 PDF model/render tests and 6 workbook tests**; these are not additional counts. The actual PDF generator also produced two inspected, one-page synthetic reports, signed and missing-evidence, under `/tmp/meditrans-pdf-upgrade-smoke/`. The `/tmp` logs and PDFs are local session evidence; the later database and Firefox logs are retained with their linked reports.

The supplied account was used through Argent to view live Trips cards and timeline, load manual billing, and open and directly reload patient details. These were read-only workflow checks; normal authentication/presence requests still occurred. No financial or trip actions were submitted. No credentials, production records or authenticated traces are included here.

After user authorization, only migration `20261013225316` was applied remotely to verified project `devszzjyobijwldayicb`; the candidate and its missing baseline RPC were also installed in the local `futuretransportation` container. The remote function body matches the candidate, with unchanged `SECURITY INVOKER`, search path and ACL. Matching authenticated identity, read-only mode, row security and absence of `BYPASSRLS` were verified for post-migration reads; seven performance and four calendar buckets exactly matched the baseline. See [migration verification](migration-application.md) and the [historical database profile](database-measurements.md).

The local SQL checks cover authorization, timezones/DST, range caps and counts beyond 1,000 trips. Billing's `manual_billing_rollback.sql` and `billing_api_access_rollback.sql` suites exercise authenticated/anonymous table and storage RLS. The five legacy Node database tests use `postgres` with JWT claims and verify RPC business guards; they are not independent RLS proof. No live billing actions or external storage uploads were performed.

Remote security advisors remained at **23 findings before and after, zero new**; the existing PostGIS `spatial_ref_sys` error and other warnings remain unresolved. These checks do not establish every role's production behavior or a clean security-advisor report.

Firefox's earlier launch failure was resolved with an isolated child-process `CFFIXED_USER_HOME`; all 18 follow-up checks ran and passed. The helper removes its temporary application-data directory. Billing's Firefox suite and real-account Firefox latency remain untested; see [Firefox evidence](firefox-validation.md).

Reproduce the local checks with Node24 and the committed lockfile, without reusing stale preview servers:

```sh
npm ci
npm run build -- --manifest
node --test $(rg --files src -g '*.test.mjs' | rg -v '/billing-db\.test\.mjs$')
npm run test:startup:ui -- --project chromium --project webkit
npm run test:dashboard:ui -- --project chromium --project webkit
npm run test:router:ui
npm run test:billing:ui
npm run test:firefox:ui
```

The general Node command still excludes database tests so it can run without a container; the separate database follow-up above has now passed locally. The authorized function migration is applied, while application deployment/push remains for the user's `npm run deploy`. [Browser performance comparisons](measurements.md) remain pre-migration observations; the new SQL medians are not browser latency measurements.
