# Validation — 2026-10-13

Validated the final handoff at `febad46`, including the GPS/ETA safeguard. The earlier billing and media checks used candidate `64a69c1`; the final safeguard only changes active GPS side effects. Regression infrastructure is committed in `1e704f1`. Browser suites served built assets through Vite preview. Their sessions, records and backend responses were synthetic. Live-account and database evidence is described separately below.

| Check | Result | Evidence and scope |
| --- | --- | --- |
| Non-database domain tests | **173/173 passed** | `/tmp/meditrans-handoff-domain-tests.log`; auth/cache isolation, routing, billing, trip completion/location provenance, compliance, inspections, driver exports, PDF and workbook behavior. |
| GPS/ETA safeguard | **24/24 focused tests passed** | `/tmp/meditrans-gps-lifecycle-final.log`; includes stalled lookup/SMS, continued GPS, identity switch and timeout checks. These tests are also included in the final 173-test run. |
| Startup browser regressions | **22/22 passed** | Chromium11 + WebKit11; `/tmp/meditrans-handoff-startup.log`. |
| Dashboard browser regressions | **6/6 passed** | Chromium3 + WebKit3; `/tmp/meditrans-handoff-dashboard.log`. |
| Router browser regressions | **8/8 passed** | Chromium4 + WebKit4; `/tmp/meditrans-handoff-router.log`. [Suite and scope](../../tests/router-ui/README.md). |
| Billing browser regressions | **60/60 passed** | Chrome, six phone-to-desktop viewports; `/tmp/meditrans-billing-final-rc.log`. |
| Billing geometry follow-up | **6/6 passed** | `/tmp/meditrans-billing-filter-final-rc.log`; waits for records, totals and web fonts before measuring. The original 1px scroll/geometry criterion remains unchanged. |
| TypeScript and scoped ESLint | **Passed** | Production build includes `npm run typecheck`; changed-code lint and `npm run lint:billing` passed. Scoped results do not assert repository-wide lint cleanliness. |
| Production build | **Passed** | `/tmp/meditrans-handoff-build.log`; Vite8 reported **858ms** for its build phase, excluding TypeScript time. Existing large-chunk warnings remain. |
| Development/HMR smoke | **Passed** | `/tmp/meditrans-vite8-dev.log`; ready in **383ms**. Argent verified a temporary CSS property updated and reverted without navigation. This is a local development check, not end-user latency. |

Startup coverage includes unresolved and failed membership checks, retry, expired sessions, confirmed absent drivers, disabled driver records, denied billing bookmarks, RLS-hidden organizations, membership removal, tenant/account cache isolation, stable token refresh and cross-tab logout. The 503 test asserts exactly two membership attempts: the shared Supabase client disables nested transport retries, leaving the existing Query policy in control. Existing billing 503 checks pass without increasing their 20-second timeout.

Dashboard checks cover shared credit reads, viewport-deferred chart loading, parallel module/data loading and honest error states. Router checks cover back/forward, detail links, filters/fragments, presence continuity, deferred imports and unsaved trip state through token refresh. Stale-deployment recovery requires an explicit refresh and newly published asset URLs; recovery from restoring an unchanged failed URL is not claimed for WebKit.

The domain total includes **7 PDF model/render tests and 6 workbook tests**; these are not additional counts. The actual PDF generator also produced two inspected, one-page synthetic reports, signed and missing-evidence, under `/tmp/meditrans-pdf-upgrade-smoke/`. Local logs and PDF artifacts are session evidence, not committed files.

The supplied account was used through Argent to view live Trips cards and timeline, load manual billing, and open and directly reload patient details. These were read-only workflow checks; normal authentication/presence requests still occurred. No financial or trip actions were submitted. No credentials, production records or authenticated traces are included here.

Authenticated, read-only PostgreSQL profiling also succeeded through the verified linked CLI connection; see [database evidence](database-measurements.md). This does not establish the proposed SQL change's correctness: the **26 SQL regression assertions were not executed**, because no disposable PostgreSQL/Docker environment was available. The prepared timezone migration and rollback remain **unapplied**. Browser fixtures do not prove deployed RLS behavior across all roles.

Firefox could not launch: the installed Playwright browser exited with `Could not find profile folder`, including a bounded `/tmp` retry. No Firefox test body ran. Re-run on a working host before release; Chromium/WebKit results do not substitute for it.

Reproduce the local checks with Node24 and the committed lockfile, without reusing stale preview servers:

```sh
npm ci
npm run build -- --manifest
node --test $(rg --files src -g '*.test.mjs' | rg -v '/billing-db\.test\.mjs$')
npm run test:startup:ui -- --project chromium --project webkit
npm run test:dashboard:ui -- --project chromium --project webkit
npm run test:router:ui
npm run test:billing:ui
```

The excluded billing database test also requires a disposable database. No deployment or production SQL mutation was performed. Performance comparisons belong in [measurements.md](measurements.md); passing regression checks alone does not establish a startup speedup.
