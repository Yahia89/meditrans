# Future NEMT — React #301 and first-visit directory flicker

## Scope and evidence

This is a targeted repair brief, not a request to migrate frameworks or undo performance work. Repository review baseline: `Yahia89/meditrans`, commit `1b28caa77cdafae417d3fb535f9ddff5c234b0b6` (October 14, 2026).

Confirmed by source inspection:

- The Patients, Drivers, and Employees components reset pagination with a setter inside `useMemo`.
- The Patients pattern also exists in parent `5140aa5042f477ba683b71759bc7364e466f4abb`; it was not introduced by the latest directory-optimization commit.
- `src/router.ts` sets `defaultPendingMs: 0`, `defaultPendingMinMs: 0`, and `defaultPendingComponent: () => null`.
- `src/routes/index.tsx` waits for `preloadPage(search.page)` in its loader and renders `WorkspacePage`, which contains the sidebar and main content.
- `WorkspacePage` has another Suspense fallback with an `h-64` spinner; directory pages replace their content with an `h-96` spinner for their first list request.
- `DirectoryTripTotalsStatus` returns `null` once totals are ready, changing its layout footprint.
- `ErrorBoundary` preserves its error state and offers full-page reload, without a route-change reset mechanism.
- Current source uses TanStack Router and Vite 8. Do not repeat the old migration advice.

React's official decoder defines error #301 as “Too many re-renders. React limits the number of renders to prevent an infinite loop.” Source inspection identifies a concrete misuse and plausible flicker mechanisms. It does not prove the exact runtime setter/call chain behind the supplied screenshot. Reproduce and document that before claiming the crash is fixed.

## Implementation prompt

You are working in the existing Future Transportation NEMT web CRM. Fix two reported production issues:

1. Patients can fail into the in-app “Page Error” boundary with minified React error #301.
2. Patients, Drivers, and Employees briefly flicker on their first/cold visit.

Preserve the recent startup improvements, typed Router migration, independent trip-count loading, warm query reuse, tenant isolation, and lazy feature loading. Implement and test the repairs, not just a proposal.

### 1. Establish the exact baseline

Read repository instructions and actually available relevant skills. Use the frontend-design skill for restrained, accessible loading/error states and any available React, TypeScript, testing, and Supabase guidance. Read `banned_useEffect.md`, but do not interpret it as permission to run side effects in `useMemo`. Event handlers, pure derivations, and reducers should own local UI changes. A genuinely necessary synchronization effect must be narrowly scoped and explained.

Inspect the latest local branch and uncommitted work. Do not reset unrelated changes. Verify the exact installed versions in the lockfile, not just package ranges.

Relevant history:

- `99c438c3eae10b14d70bb5550c8437c6064a4e45`: typed TanStack Router, query bookmarks preserved.
- `f0b24032e7cee9210e18cb18ac170333686d88bc`: fulfilled page/chart imports without extra suspension.
- `64a69c10ad5f28831597560d0433feea72c1608e`: Vite 8/runtime updates and bounded retries.
- `5140aa5042f477ba683b71759bc7364e466f4abb`: immediate parent of the directory optimization; map snippets restored to trip PDFs.
- `1b28caa77cdafae417d3fb535f9ddff5c234b0b6`: directory loading, independent counts, cached reads, and deferred forms/exports.

Verify which build is actually deployed before blaming a commit. Historical documentation that says “not deployed” is a report written at that time, not proof of current deployment. Compare build/assets or existing build metadata. Do not perform a production deployment as part of diagnosis.

Inspect these files and their dependencies:

- `src/components/patients-page.tsx`
- `src/components/drivers-page.tsx`
- `src/components/employees-page.tsx`
- `src/components/directory-trip-totals-status.tsx`
- `src/components/ui/deferred-form.tsx`
- `src/components/error-boundary.tsx`
- `src/components/dashboard-page.tsx`
- `src/components/app-sidebar.tsx`
- `src/router.ts`, `src/routes/index.tsx`, `src/routes/__root.tsx`
- `src/router/WorkspacePage.tsx`, `src/router/navigation.ts`, `src/router/search.ts`
- `src/router/page-loaders.ts`, `src/router/RouteError.tsx`
- `src/lib/preloaded-component.ts` and its tests
- `src/lib/directory-trip-counts.ts` and its tests
- `src/hooks/useOrganizationMembers.ts` and related presence utilities
- `src/App.tsx`, auth/organization providers, query-client configuration
- directory, startup, router, and Firefox browser tests

### 2. Reproduce the React error before declaring its cause

Use both a development build for a useful stack and a freshly built production preview for the observed minified behavior. Keep React StrictMode enabled in development. Distinguish #301 render-phase loops from maximum-update-depth effect loops and failed dynamic imports.

Capture the component stack and specific setter/update chain. A source hotspot is not sufficient evidence of the entire runtime cause.

Test direct entry and sidebar navigation into all three directories. Include cold and warm data, cold and warm code, first visit after login, session refresh, delayed organization resolution, rapid navigation, and nondefault saved Patients list/grid preference. Do not rely on one account and an already-warmed browser.

Use deterministic synthetic fixtures and an approved development/test account. Do not replay credentials from a private HAR, mutate production patient records, or store real health information in screenshots, traces, logs, or committed fixtures.

Check document navigation count and current asset generation so a stale preview server or a stale deployed bundle cannot masquerade as a successful fix. Do not use `networkidle` as the sole readiness signal for an app with presence and realtime traffic.

### 3. Remove side-effectful pagination memos in all three pages

Patients and Drivers currently contain this pattern:

```tsx
useMemo(() => {
  setCurrentPage(1);
}, [searchQuery]);
```

Employees contains the equivalent with `[searchQuery, statusFilter]`.

Remove these side-effectful memos. `useMemo` callbacks must calculate and return values; they must not schedule UI state changes or URL navigation.

Reset pagination atomically in the event that changes its inputs. A small typed reducer is appropriate if it simplifies the coupled state; otherwise use explicit handlers. For example:

```tsx
function handleSearchChange(nextSearch: string): void {
  setSearchQuery(nextSearch);
  setCurrentPage(1);
}
```

Handle presence filter and page-size changes similarly. Cover URL-driven changes/back-forward navigation deliberately; do not reset page state merely because a callback or query-result object received a new identity. For genuinely external changes, use a proven guarded synchronization pattern or a scoped state boundary rather than a network of mirroring effects.

Derive safe pagination from validated inputs. Never render NaN/Infinity, “page 1 of 0,” or an empty out-of-range page after filtering/deletion. Validate `limit` against the UI's supported choices; reject zero, negative, malformed, and unbounded numeric values. Preserve the explicit All behavior without treating a magic 9999 as a correctness guarantee for arbitrarily large datasets. Keep existing search, selected-row, and export semantics.

Do not mutate arrays or Sets in place. Use stable empty defaults and memoize expensive derived collections where warranted. Do not add blanket `useMemo`/`useCallback` wrappers to hide a logical cycle.

Audit the actual render subtree for additional immediate event-handler calls, navigation during render, state updates in callbacks incorrectly invoked while rendering, and non-idempotent synchronization.

Do not assume every guarded render-time setter is an infinite loop. The one-time guard in `DeferredForm` is not equivalent to an unconditional setter. Its open/close/suspend/retry behavior should be tested, not mechanically replaced.

If the screenshot's error is not reproduced by the pagination defect, continue tracing and report the exact limitation. Fix the demonstrated purity defect regardless, but do not misrepresent that cleanup as a verified production crash resolution.

### 4. Preserve the performance changes

Keep Patients/Drivers list reads independent from the `directory_trip_counts` RPC. Never restore `select=*,trips:trips(count)` as a shortcut. Rows and search must become usable before trip counts finish.

Preserve complete count pagination, zero-versus-unknown semantics, count retry, exports gated on complete totals, mutation-driven invalidation, and successful cached totals during a failed background refresh with an appropriate stale indication.

Keep Employees' linked-user presence model and bounded membership lookup. Do not reintroduce email-based identity matching or the old invitations/profiles/duplicate-employee query chain.

Retain lazy forms, driver details, spreadsheets, PDFs, maps, and other expensive optional features. No eager import of all pages to hide a first-load issue.

Keep existing user/org cache isolation and disabled-user restrictions. Never carry previous organization's data across a tenant switch with `keepPreviousData` or placeholder tricks.

No TanStack Start migration, framework downgrade, dependency-major upgrade, React Compiler adoption, new state-management library, or backend-policy rewrite is requested. Change a dependency only if a reproducible upstream incompatibility is proved and the minimal change is justified.

### 5. Trace the first-visit flicker as a separate problem

Instrument and capture the visual sequence for code loading, base-record loading, optional totals/presence, and background refresh. Determine which boundaries unmount or hide the shell/header/content and when. Inspect CSS/font requests only if the trace indicates an unstyled/font flash rather than a loading-state transition.

The existing source has:

```ts
defaultPendingMs: 0,
defaultPendingMinMs: 0,
defaultPendingComponent: () => null,
```

The single `/` route also awaits `preloadPage` while rendering `WorkspacePage`; the sidebar is inside that workspace. Another Suspense boundary then uses an `h-64` spinner, and the directory pages use an `h-96` first-data spinner.

Do not solve this just by hiding every fallback or delaying every successful response. Make loading ownership coherent:

- Preserve a mounted workspace shell/sidebar during ordinary same-organization navigation.
- Keep the route/page header and available controls stable where practical.
- Use a layout-matched directory skeleton for genuinely cold data, not a blank main area followed by two differently sized spinners.
- Show available rows without waiting for totals or presence.
- Show a small, nonblocking refresh indicator when usable cached rows exist.
- Show a deliberate empty state only after a successful, authorized, zero-row result.
- Show a real error/retry state for failed list reads, not “No clients.”

Preserve the current query URLs and bookmark/reset/invite compatibility. Make the smallest route/layout change that gives pending state an appropriate boundary; do not turn this repair into a wholesale path-routing migration.

Evaluate an optimistic pending threshold (for example, start testing around 150–200 ms) with a consistent fallback. Select values from behavior, not as hardcoded requirements. Keep minimum display time small and evidence-based. Do not add artificial waits to query functions or force every page to wait 500–1000 ms just to mask flicker.

The target is fewer visual substitutions and stable geometry, not pretending nothing is loading. A reduced-opacity crossfade is not a substitute for fixing unmounts/layout shifts, and it must not fade the entire page to blank on each navigation.

### 6. Use preloading carefully

`preloaded-component.ts` already caches pending and fulfilled imports and renders through `createElement`. Preserve stable component identity, concurrency-safe promise reuse, and explicit failed-import retry. Do not recreate lazy/preloadable wrappers inside render.

React's `use(promise)` may legally be conditional; do not “fix” that merely because conventional hooks have stricter call-order rules.

Consider intent-based preloading on sidebar focus/pointer intent. Begin authorized primary list requests alongside page-code fetching only where this avoids a measured waterfall. Use shared query definitions/keys so prefetch and mounted page consume the same cache.

Do not preload all patient/driver/employee data at login. Do not fetch private data before access is known. Do not eagerly fetch form code, exports, or optional counts because the user hovered briefly.

No code-only cache should retain patient records. Preserve tenant/account guard behavior when intent preloading overlaps sign-out or organization switching.

### 7. Make totals/presence enrichment stable and truthful

`DirectoryTripTotalsStatus` currently disappears when ready. Keep a stable footprint or move the indicator into a reserved stats/header area so its removal does not yank the page upward. Reserve sensible number widths and row/card dimensions without creating large empty panels.

For optional totals/presence states, distinguish loading, failed/unknown, stale-but-available, and confirmed zero/offline. Pending employee presence is not evidence that everyone is offline. Preserve an explicit “no linked account” case independently from network failure.

A totals/presence result must not recreate the page, clear search, close a form, reset pagination, or clear unrelated selection. Add tests for enrichment arriving while a user is searching, on page 2, or editing a record.

Use existing neutral styling, consistent outline icons, readable labels, `aria-busy`, accessible live statuses, and reduced-motion support. No new glow/shadow styling or unrelated visual redesign.

### 8. Error boundaries must allow safe recovery

The page-level ErrorBoundary currently remains failed until a full browser refresh. Add a deliberate retry and/or reset mechanism for a meaningful page/identity change so a Patients error does not poison navigation to Drivers/Employees.

Do not key the entire application by current URL, `Date.now()`, random values, query timestamps, or loading flags. That would reset drafts/providers and undermine the performance work.

Reset only the appropriate boundary/page. Preserve drafts on ordinary same-page background updates; clear private state on actual user/org changes.

Keep chunk-load/network errors distinguishable from render logic errors. Automatic infinite reload, retry, and cache-clearing loops are prohibited. One user-triggered retry is not evidence that the defect is fixed.

Show a useful user-facing message and a non-sensitive diagnostic reference. Keep detailed stacks in developer diagnostics without logging patient payloads, tokens, full sensitive URLs, or form contents. Local/private source maps may assist diagnosis; do not publish sensitive diagnostic artifacts indiscriminately.

### 9. TypeScript and query/state hygiene

Use concrete existing domain types and generated database types in touched code. Narrow unknown inputs at trust boundaries. Do not introduce `any`, double assertions, fake defaults, `@ts-ignore`, or non-null assertions as fixes for unresolved auth/org state.

Use explicit types for view mode, presence filters, pagination state/actions, and page-size parsing. Keep ordinary pure calculations pure. Do not silence dependency lint or use an empty dependency array to freeze live data.

Ensure query `enabled`, `isPending`, `isLoading`, `isFetching`, and error states are interpreted with the installed TanStack Query version. A disabled query can have no data without representing a successful empty directory. A background fetch with cached data must not replace all rows with a spinner.

For list-error handling, retain known cached data with a refresh-failure indicator when appropriate; fail closed on lost authorization, logout, or tenant change.

Extend applicable ESLint checks, especially rules-of-hooks, use-memo, and set-state-in-render, using capabilities actually present in the installed plugin. Validate the bad pattern is caught; add a focused AST/static test if the chosen rules miss it. Do not trigger a repository-wide cleanup unrelated to these pages.

### 10. Regression and visual tests

Extend the existing directory/browser infrastructure. Current tests cover basic rendering/search, cached revisits, delayed/failed totals, presence, and lazy forms, but they do not establish an absence of transient blank frames or all pagination/timing combinations.

Use fixtures with enough rows for multiple pages, not only two entries. Tests should fail before the relevant fix and pass after it whenever a reproducible path is found.

Required cases:

- Cold direct entry to each directory in a fresh context, and first sidebar entry from Dashboard.
- Immediate warm revisit without redundant list requests inside the existing freshness window.
- Fast code/slow data; slow code/fast cached data; both delayed; optional totals arriving before and after base rows; presence delayed/failed.
- Search from page 2+, clearing search, no results, changing supported page sizes, All, and malformed URL limits.
- Employees presence-filter changes while on later pages.
- Patients saved list/grid preference and both views on all affected pages.
- List request failure versus count-only failure; retry and background-refresh failure with usable cached data.
- List shrink/delete on the final page using a synthetic backend; no invalid page or render cycle.
- Totals/presence arriving while a form is open: draft and page state remain intact.
- Rapid Patients → Drivers → Employees navigation, browser Back/Forward, existing query bookmarks, and hash preservation.
- Session refresh on the same org, account/org switching, disabled membership, and restricted role with no stale cross-tenant content.
- Page boundary recovery/navigation away after an induced render failure, and a separately induced chunk failure.
- No #301, maximum-depth errors, hook-order violations, render-update warnings, unhandled rejections, or runaway network requests.
- No unexpected full document navigation during normal sidebar use.

Record a visual trace/video and measure shell/header/main-content geometry during navigation, not just screenshots after the route settles. A final screenshot and `toBeVisible()` alone cannot disprove flicker. Avoid brittle “exactly one React render” assertions; assert bounded stable behavior instead.

Use Firefox plus Chromium and WebKit where the available runtime supports them. Report any unavailable browser honestly. Keep StrictMode checks and production-preview checks distinct. Do not silently reuse a stale preview server; use a fresh build and isolated port.

### 11. Commands and performance verification

Check the current scripts before executing. The inspected manifest provides:

```sh
npm run typecheck
npm run build
npm run test:startup
npm run test:directories
npm run test:directories:ui
npm run test:startup:ui
npm run test:router:ui
npm run test:firefox:ui -- router
npm run measure:startup
```

Run affected functional tests plus focused lint. Preserve relevant billing, trip, and compliance tests when shared providers/boundaries are touched. Do not call deploy automatically.

Compare before/after production bundle and request behavior. Keep the independent-count design, short warm cache, noncritical lazy imports, and real initial-load improvements. No fake benchmark obtained by using a warm cache for the candidate and a cold cache for baseline.

Report browser/build/session/cache conditions and sample counts. Inspect rendering/interaction timing as well as network timing. If visual stability costs a small amount of additional code or time, state the tradeoff rather than concealing it.

### 12. Deliverables and finish criteria

Deliver:

1. The actual reproducible crash cause and setter/call chain, or an explicit statement of what remains unconfirmed.
2. Separate confirmed cause(s) of cold-visit flicker.
3. Focused implementation diff, grouped as correctness, loading stability, and tests.
4. Tests executed with actual results; identify unavailable/failed tests.
5. Synthetic before/after visual evidence and request/bundle comparison.
6. Any deployment/cache caveat and concise manual verification steps.

Do not claim the bug is fixed because TypeScript or Vite builds successfully. Do not claim all timing paths are covered because one test account passed once.

The final behavior should be: correct Patients/Drivers/Employees pages, stable first-visit loading, usable records before optional totals/presence, preserved warm revisit speed, truthful error/empty states, and intact tenant/security boundaries.

Start by reproducing and inspecting, then implement this targeted repair. Do not redesign the application or undo the recent performance improvements.

## Official references for the implementing agent

- React #301: https://react.dev/errors/301
- Pure memo calculations: https://react.dev/reference/react/useMemo
- Render-loop troubleshooting: https://react.dev/reference/react/useState#im-getting-an-error-too-many-re-renders
- Memo lint: https://react.dev/reference/eslint-plugin-react-hooks/lints/use-memo
- Render-state lint: https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-render
- Suspense and transitions: https://react.dev/reference/react/Suspense
- Router pending behavior: https://tanstack.com/router/latest/docs/guide/data-loading
- Query disabled/loading states: https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries

Use documentation compatible with the installed packages; do not copy experimental APIs from newer documentation into this repair.
