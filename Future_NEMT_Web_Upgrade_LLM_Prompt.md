# Future Transportation CRM: initial-load optimization and staged upgrades

You are working on the existing `Yahia89/meditrans` web application. Implement the following plan in coherent, reviewable stages. This is an existing production NEMT/waiver transportation CRM, not a greenfield app.

## Objective and architecture decision

Improve the first usable page, authenticated startup, dashboard readiness, and subsequent navigation. Reduce genuinely redundant code and dependencies while preserving dispatch, trips, permissions, billing tracking, imports, exports, maps, and authentication.

Keep React, Vite, Supabase, and TanStack Query. Optimize the current SPA first. Then migrate its custom page navigation to the current stable React TanStack Router if the verified baseline still matches the inspected code. Do NOT migrate to TanStack Start, introduce SSR/RSC, move the database, replace Supabase Auth, or change hosting as part of this implementation.

TanStack Start 1.0 was announced stable on October 13, 2026. Stability is not a reason by itself to introduce another server/rendering architecture. Start remains a later option if a benchmark or a concrete requirement demonstrates value from authenticated server rendering, server functions, or public server-rendered routes.

Work on a branch. Preserve uncommitted user work and production data. Do not deploy, apply live database migrations, change DNS/cache/WAF settings, or create financial transactions without explicit authorization. Do not modify the native iOS/Android project.

## 1. Verify the local state and use relevant skills

Read repository instructions, actual available skills, package.json, the lockfile, tsconfig files, build configuration, and tests. Read relevant frontend/React/performance/TypeScript/Supabase skills where present. Do not invent skills or install a framework just to match a skill. Respect the project's effect conventions without deleting legitimate subscription/lifecycle effects.

Treat the attached `package(20261013-213648).json` as the user's latest supplied manifest. Compare it with the local branch and lockfile; do not overwrite newer work with the reviewed remote snapshot.

Inspect these known areas, adjusting paths if the local branch has evolved:

- src/main.tsx and src/App.tsx.
- src/lib/pages.ts, app-sidebar, and navigation helpers.
- src/contexts/auth-context.tsx.
- src/contexts/OrganizationContext.tsx.
- src/contexts/OnboardingContext.tsx.
- src/hooks/useDriverLocation.ts, usePresence, usePermissions, useAuditAccess.
- src/components/dashboard.tsx and dashboard child components.
- PerformanceChart.tsx, PerformanceChartPlot.tsx, UpcomingSchedule.tsx.
- DashboardHeader, LowBalanceAlerts, notification and credit hooks.
- src/lib/supabase.ts and generated Supabase types.
- supabase/migrations/20260930190614_dashboard_trip_buckets.sql.
- All related RLS policies, existing indexes, query invalidations, and subscriptions.
- vite.config.ts, postcss.config.mjs, index.html, index.css, deployment scripts.

Important observed facts to confirm, not blindly assume:

- App.tsx currently uses nuqs to navigate through `?page=...` and related query parameters.
- main.tsx mounts NuqsAdapter, QueryClientProvider, and React StrictMode. The reviewed entrypoint does not mount a TanStack Router provider.
- The supplied manifest includes `@tanstack/router@^0.0.1-beta.53` and `@tanstack/router-devtools@^1.140.0`. The reviewed source search found those names in manifests, not active routing code.
- Many pages and dialogs already use React.lazy. Preserve this work.
- The chart plot is lazy-loaded, but its render/import waits until chart data is available.
- Vite's manualChunks places both icon libraries into a common vendor-icons chunk and groups Radix modules together.
- Both the Tailwind Vite plugin and the Tailwind PostCSS plugin are configured; autoprefixer is also present.
- Auth loads profile, driver fallback fields, and memberships; organizations are fetched in a subsequent stage.
- Onboarding runs several count/upload queries. It must not become a prerequisite for normal authenticated navigation.

## 2. Establish a meaningful baseline before changing architecture

Inspect the attached HAR locally and treat it as sensitive. It contains authentication material and private response bodies. Never commit it, replay requests with its credentials, paste its contents into a public issue, or publish it in CI artifacts. Produce only a sanitized timing/size summary.

The reviewed production HAR contains:

- 76 entries, with 75 beginning in the first three seconds.
- 51 initial Supabase requests: 24 OPTIONS preflights and 27 other requests.
- Main HTML request: 154 ms; DOMContentLoaded: 554 ms; window load: 702 ms.
- One session-refresh request: 357 ms, beginning about 590 ms after navigation.
- Three identical driver-ID reads around 1.095 seconds, plus a fourth driver lookup for different profile fields.
- Two identical trip-data reads at about 1.992 and 2.037 seconds.
- Two dashboard_trip_buckets requests lasting 965 and 947 ms. Their parameters differ: performance and calendar ranges. They are not duplicate calls simply because their endpoint is the same.
- PerformanceChartPlot starts downloading about 2.721 seconds after navigation and finishes about 2.889 seconds.
- A later presence heartbeat begins at 31.569 seconds. That is NOT initial load time.
- Six early application JS assets total 304,390 gzip body bytes and 1,092,700 decoded JS bytes.
- vendor-icons: 73,767 gzip / 316,868 decoded bytes.
- vendor-react: 61,022 gzip / 193,007 decoded bytes.
- PerformanceChartPlot: 103,174 gzip / 341,411 decoded bytes.
- Inter and Outfit font responses total 105,244 bytes.
- Hashed assets have a four-hour cache lifetime and Cloudflare MISS in this particular trace.
- No Maps/PDF/spreadsheet vendor load is evident on this initial dashboard trace; do not blame those features without additional evidence.

HAR timing is not LCP, FCP, INP, main-thread execution time, or application-ready time. Some connections may be reused. The deployed build may differ from the current source commit. Verify all conclusions against a fresh baseline.

Benchmark a production build, not only `vite dev`. Reuse existing Playwright/test infrastructure. Record cold-cache and warm-cache cases for:

1. Signed-out login screen.
2. Returning authenticated user with a valid session.
3. Returning user requiring a refresh.
4. Dashboard, Trips, Billing, and a client-detail deep link.
5. Organization switching and a restricted/driver user.

Add low-overhead performance marks for session resolved, identity ready, organization ready, usable shell, route primary data ready, and chart ready. Use event names without patient names, IDs, access tokens, or financial payloads. Keep auth errors distinct from a slow request.

Capture FCP/LCP/CLS and representative interaction latency, long tasks, request counts, request start/end timing, compressed transfer sizes, decoded bundle sizes, and bundle import graphs. Test Chromium plus the user's Firefox workflow; include representative Safari/WebKit correctness checks.

Do not wait for `networkidle` as the sole readiness signal in an app with presence/realtime traffic. Do not count a blank skeleton as the usable dashboard. Report median and variability across repeated comparable runs; do not claim field p75 from a handful of local tests.

## 3. Low-risk simplification and dependency inventory

Create a keep/update/remove/defer inventory based on actual imports, lockfile resolutions, generated bundles, and capability requirements. Installed package size is not the same as initial downloaded JavaScript.

Remove old `@tanstack/router` and old router-devtools only after verifying they have no live imports. This is unused-dependency cleanup, not yet a completed router migration.

Use one Tailwind integration: retain `@tailwindcss/vite` for this Vite app. Remove duplicate Tailwind PostCSS processing and autoprefixer unless another verified pipeline needs them. Keep other PostCSS configuration only if it does real work. Verify generated CSS, focus states, dialogs, dark mode, print styles, and production visuals before deleting direct dependencies.

Audit the aggregate `radix-ui` package versus individual `@radix-ui/react-*` imports. Choose a consistent import strategy without rewriting accessible components or claiming every Radix package is a second UI framework. Check actual duplicate versions and bundle effects.

Audit Lucide and Phosphor usage. Prefer one icon family for shared shell/UI, choosing the smallest practical migration consistent with the existing design. Use static imports and avoid dynamic icon registries that retain entire catalogs. Inspect the manual chunk first: forcing all retained icons from lazy routes into a shared eager chunk can undermine route-level splitting. One icon library is not a guaranteed specific byte saving; measure.

Keep React Hook Form plus Zod, TanStack Query, Table, and Virtual where used. They solve different problems. Keep clsx, class-variance-authority, and tailwind-merge unless actual usage proves otherwise; replacing tiny focused helpers with homemade abstractions is not the priority.

Retain Maps, clustering, PDF, signature, CSV, and XLSX capabilities behind their route/action boundaries. PapaParse and SheetJS are not automatically redundant. Inspect the old xlsx dependency through official SheetJS installation guidance and advisories: a routine npm update may not reach the vendor's maintained release. Upgrade or replace it in a separate import/export regression-tested change, not by deleting workbook support.

Verify devtools exclusion in emitted production assets. React Query Devtools normally excludes itself in production; do not report its installed dependency as proven production bloat. Do not remove StrictMode to hide duplicate fetching; the supplied capture is a production trace.

Do not replace the package manager, React form library, chart library, UI kit, and backend simultaneously. Do not use blanket `npm audit fix --force` or blindly upgrade every major.

## 4. Shorten auth/organization bootstrap safely

Define one owner for session lifecycle and one shared identity/bootstrap data contract. Preserve exactly one Supabase client and one QueryClient unless existing architecture proves a justified exception.

Deduplicate driver identity/profile reads. Multiple hooks must consume shared data/query results rather than independently reading the same signed-in driver. Cache a confirmed null driver result too. Preserve users who are admins/owners AND have a driver record; do not gate solely on the role label.

Keep location watches and ETA/SMS-related side effects out of a general identity hook. Start them only in the appropriate authorized workflow/capability, with a single lifecycle owner and reliable cleanup. Preserve legitimate web driver and manager trip-completion functionality.

Flatten profile/membership/organization loading where justified. Options include an RLS-protected nested select or a small typed bootstrap RPC returning minimal authorized identity, memberships, organization summaries, and driver association. Do not create a giant bootstrap endpoint that also waits for every dashboard widget.

Use explicit fields rather than select('*') for shell data. Never return integration credentials, full patient records, financial documents, or unnecessary organization secrets to bootstrap the UI.

Use stable user/org IDs as request identities. Avoid refetching organizations merely because token refresh created a new User object. Deduplicate concurrent initialization with keyed promises or Query, not a global boolean that silently discards a different user's refresh. Guard against stale responses after sign-out, user changes, and org switches.

Keep auth callbacks non-blocking and compatible with the installed Supabase SDK. Do not recreate previous lock/deadlock bugs or disable refresh/persistence to improve a stopwatch result. Verify any auth option and old suppression against the new SDK's actual types before changing it.

Show a lightweight non-sensitive shell during resolution, but keep protected data, routes, and actions blocked until the relevant authenticated membership/capability is known. An unknown membership must not briefly appear as an empty organization or an authorization success.

Move server state currently duplicated in effects/context toward shared Query data where it reduces duplication. Context can remain for session lifecycle, selected organization, and derived access. Do not replace every context with a store or ban effects needed for external subscriptions.

Scope Query data to user, organization, and meaningful parameters. Cancel/remove sensitive queries on sign-out and prevent prior-tenant placeholder data on switching. Use narrow invalidation after permission changes. Do not persist private dashboard data in localStorage to fake a faster startup.

## 5. Improve dashboard loading and database work

Prioritize usable navigation and essential operational data before historical analytics, onboarding history, and nonurgent alerts. Do not delay safety-critical trip/location information merely because it is expensive.

Make onboarding summaries nonblocking. If a badge only needs presence/absence or a threshold, do not run a full exact count unnecessarily. If exact counts are visible and required, keep them accurate and consider one small authorized summary RPC rather than four separate HTTP requests. Preserve aggregate correctness above API row limits.

Find the two identical trip reads. Share their canonical query/selector where semantics match. Distinguish whole-request equality from merely using the same table. Do not merge different user permissions, projections, date ranges, or status filters blindly.

Profile dashboard_trip_buckets separately from network transport. Inspect representative authenticated query plans, buffers, row estimates, RLS predicate costs, and existing indexes. The migration already references an org_id/pickup_time index; verify it rather than creating a duplicate blindly. Admin/service-role execution is not a valid substitute for the user's RLS query plan.

Preserve SECURITY INVOKER, tenant filtering, date-range limits, timezone/DST correctness, and exact count semantics. Never bypass RLS, cache private results globally, or return only the first 1,000 trips to make the chart faster.

If performance/calendar ranges overlap and need identical bucket semantics, evaluate sharing a bounded superset response and slicing it in memory. Compare the extra data/SQL work before choosing this. Two distinct ranges must not receive the same cache key. Avoid one slow mega-dashboard RPC that blocks every widget.

Use explicit query freshness per data class. Keep live operational queries appropriately fresh; summary/static configuration can have longer staleTime. Coalesce realtime invalidations and suspend unnecessary polling when the relevant screen is hidden, with correct revalidation on return. Do not disable all focus/reconnect updates globally.

Chart waterfall: keep Recharts out of the shared shell. For a visible chart, initiate the plot-module import and its data request concurrently once access is resolved; do not wait for data before starting the import. For an off-screen chart, load at near-viewport visibility with a sized placeholder. Avoid permanent deferral, arbitrary timers, and preloading every lazy page. If a small decorative chart is the only consumer of a heavy library, consider a simpler renderer only after feature parity and bundle measurement.

Keep page-level lazy imports already implemented. Audit root/static imports and barrel exports for accidentally pulling lazy features into shared chunks. Preload code for the actual initial route during session resolution where safe; data requests still require validated access.

## 6. Migrate navigation to current React TanStack Router

Treat this as a structural migration from custom nuqs-based navigation, NOT an in-place upgrade of an active beta router. Do it after the first measurable performance changes so gains/regressions can be attributed.

Verify current package peer dependencies/engines and use compatible stable versions of:
- @tanstack/react-router
- @tanstack/router-plugin
- @tanstack/react-router-devtools for development, if used

Do not assume all packages publish identical patch numbers. Avoid deprecated @tanstack/router installation advice.

Prefer file-based routes with the Vite router plugin's automatic route code splitting. Place the router plugin before the React plugin according to current documentation. Keep the root layout small; do not import all pages through the root or eagerly split/load every loader.

Keep existing page components and migrate the navigation layer around them. Introduce a typed router context containing the shared QueryClient and resolved auth/organization access. Replace duplicated effect-based page restrictions with typed route access checks while keeping database enforcement.

Use shared queryOptions and Router/Query prefetch integration so loaders and components observe the same cache instead of fetching twice or maintaining two independent server-state stores. Prefetch based on intent and access, not every sidebar item indiscriminately.

Inventory every existing query URL before migration: page, id, driverId, employeeId, tripId, modal, from, section, date, invite/reset parameters, and any billing filters. Preserve bookmarks, back/forward, modals, browser refresh, section navigation, and password/invite callbacks.

Plan canonical paths and a compatibility handler for old `?page=...` URLs. Verify production deep-link fallback first: current scripts deploy static dist through gh-pages and the HAR shows GitHub-origin headers behind Cloudflare. A dev server fallback is not proof that `/billing` will refresh correctly in production. Do not rewrite missing JS assets to HTML. Do not change OAuth/reset fragment handling accidentally.

Use browser-history paths only with a verified static-host fallback. Otherwise retain compatible query navigation during the transition rather than silently adding a server runtime or breaking links.

Migrate route-owned search state to typed Router search validation. nuqs can temporarily remain for unmigrated filters via its supported Router adapter, but do not let both systems independently own the same URL keys/history writes. Remove nuqs only after its last real consumer is migrated. Replacing it is simplification, not the main speed intervention.

## 7. Upgrade the toolchain in a separate stage

Read current official release, migration, engine, and peer-dependency requirements at implementation time. The October 13 research found Vite's supported branches at 8.3 for regular patches, with important/security fixes for 7.3 and 8.2. The user manifest says ^7.2.4, but the lockfile determines what is installed.

Take compatible dependency updates in small groups. Keep React and React DOM aligned. Update Supabase/Query within supported compatible releases and test behavior, not only compilation.

Target current stable Vite 8.x after baseline and plugin compatibility are established. If a verified blocker prevents it, use the supported Vite 7.3 patch line temporarily and document the blocker. Use a supported Node LTS satisfying all engines. Do not switch to experimental bundled dev mode as the solution to production startup.

Vite 8 changes the bundler to Rolldown. Revisit rollupOptions/manualChunks/onlyExplicitManualChunks using the installed version's migration docs. Do not paste a Vite 7 chunk workaround into Vite 8 and assume equivalent output. Start with default route boundaries, then add measured grouping only if it improves startup/caching. Specifically guard against optional PDF/map/chart helpers becoming shell dependencies.

Benchmark toolchain build/dev speed separately from browser startup. Faster builds do not prove a faster user experience.

## 8. Assets, deployment, and caching

Check both fonts' actual usage and subsets. Preserve design and language coverage. Reduce unused weights, self-host appropriate WOFF2 assets if practical, or consolidate a redundant font. Use swap/fallback metrics and reserve layout space. Do not preload every font/route/image.

The HAR's icon vendor is a measured priority. Compare default bundler chunking against the forced vendor-icons/vendor-radix groups. Retain named code splitting only where it preserves actual route isolation and improves measured transfer/parse work.

For content-hashed static assets, propose long immutable caching with the appropriate cache rule/header for the real host. Keep entry HTML revalidated so it references the current asset hashes. Verify rollback and stale-tab chunk loading; handle stale deployment errors without infinite reload loops or lost unsaved work.

Do not publicly cache authenticated HTML, Supabase responses, billing records, or patient files. Do not disable CORS/auth headers, RLS, WAF, or bot protection to improve metrics. Do not add a same-origin proxy or service worker solely to hide preflights unless independently justified and secured. The recorded preflights are not API errors.

Keep public optional telemetry from becoming a rendering prerequisite. Do not remove a Cloudflare challenge because it appears in the trace; its presence alone does not prove it caused the bottleneck.

## 9. Type safety, tests, and acceptance

Use concrete domain types, generated Supabase types, validated runtime boundaries, discriminated auth/access states, and exhaustive route/status handling. Avoid any, as any, double casts, guessed row types, non-null assertions for unresolved orgs, and new suppression comments. Use legitimate generics and satisfies where useful. Do not loosen tsconfig or remove typecheck from the build.

Preserve existing billing, compliance, trip-completion, timezone, driver-print, and browser-location tests. Add startup/navigation coverage for sign-in, refresh, sign-out, multi-tab changes, organization switching, disabled membership, restricted users, old/new deep links, forms with unsaved work, and stale-deployment recovery.

Test query failures, slow organization resolution, expired tokens, confirmed no-driver profiles, empty datasets, large datasets above row limits, and dashboard error states. Failures must not look like zero balances or an empty company.

Test that initial dashboard loads do not fetch PDF/XLSX/Maps libraries; opening the relevant feature must still work. Test chart code/data parallelism on a visible chart and near-viewport loading for off-screen charts.

Provisional optimization goals, not guarantees:
- No repeated identical initial driver-ID/trip queries.
- One shared bootstrap data path; zero cross-tenant stale-data flashes.
- Visible chart-module loading no longer waits behind the completed chart RPC.
- Meaningful reduction in shared-shell JS, aiming below 250 KiB compressed from the approximately 297 KiB baseline, without shifting required bytes into an extra waterfall.
- Measurable improvement in the same-condition authenticated route-ready median, initially targeting at least 25%; report actual results and tradeoffs.
- No regression in full-content readiness, operational freshness, accessibility, or core workflows.
- Track Core Web Vitals against their documented thresholds, but do not claim a production field score from local lab runs.

Create a before/after table per stage. Explain exactly which code, request, cache, or SQL change produced each observed improvement. If database execution access or real performance tooling is unavailable, report that limitation and supply a test procedure; do not fabricate success.

## 10. Deliverables and decision gate for Start

Deliver:
1. Baseline report and sanitized HAR findings.
2. Dependency decision matrix with resolved versions and verified compatibility.
3. Separate commits/stages for dependency cleanup, bootstrap sharing, dashboard optimization, Router migration, and Vite upgrade.
4. Any additive SQL migrations and authorization regression tests, not automatically applied to production.
5. Deployment fallback/cache instructions matching the actual host.
6. Before/after measurements, commands actually run, and test results.
7. Known limitations and rollback instructions.

Keep future Start work out of the main implementation. Revisit it only with a concrete requirement and an isolated prototype showing value beyond the optimized SPA. Any later authenticated SSR design must handle cookie sessions, safe per-request Supabase/Query instances, cache isolation, client-only map/signature features, and hydration. Start SPA mode can stay static; request-time SSR/server functions cannot execute on static GitHub Pages alone.

Finish by stating what was removed, what remains, what got faster, and what remains unmeasured. Do not call a router migration or a successful build a performance improvement without measurements.

## Official references to verify before implementation

- https://tanstack.com/blog/tanstack-start-1-0
- https://tanstack.com/router/latest/docs/guide/code-splitting
- https://tanstack.com/router/latest/docs/guide/automatic-code-splitting
- https://tanstack.com/router/latest/docs/guide/external-data-loading
- https://tanstack.com/router/latest/docs/guide/authenticated-routes
- https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls
- https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults
- https://tanstack.com/query/latest/docs/framework/react/devtools
- https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode
- https://vite.dev/releases
- https://vite.dev/guide/migration
- https://tailwindcss.com/docs/upgrade-guide
- https://supabase.com/docs/guides/database/postgres/row-level-security-performance
- https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- https://docs.sheetjs.com/docs/getting-started/installation/frameworks/
- https://nuqs.dev/docs/adapters
- https://web.dev/articles/vitals
