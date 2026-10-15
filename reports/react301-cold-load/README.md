# Directory correctness and cold loading repair

> Follow-up: the actual #301 loop has since been reproduced in Patient Details during Credits → dated trips navigation. See [confirmed cause and follow-up repair](../react301-followup/README.md). The findings below record the earlier directory-only investigation.

Scope: Patients, Drivers, and Employees in the existing React/Vite/TanStack Router application. No deployment, database change, dependency upgrade, commit, or push was performed. The pre-existing edit to `reports/directory-loading/README.md` was preserved.

## What is established

**The production #301 cause is not established.** The original Patients page did not reproduce #301 in the controlled production-preview or StrictMode development scenarios. The React decoder identifies #301 as a render-phase rerender loop, distinct from maximum-update-depth errors and failed chunks. See [React's decoder](https://react.dev/errors/301).

The original setter was observed directly by intercepting only the development module response and adding a counter/stack capture immediately before the unchanged call. Its chain was `PatientsPage → useMemo → mountMemo/updateMemo → setCurrentPage(1)`. With React StrictMode enabled, observed cumulative calls were 2 after mount, 4 after search, 4 after same-user token refresh, and 6 after clearing search. This is a confirmed render-purity defect and bounded behavior in the observed scenario; it is not evidence of the reported infinite loop. The opt-in diagnostic test and saved `baseline-setter-trace` JSON retain the synthetic stacks.

The surrounding render subtree was audited for another update chain. `DeferredForm` has a bounded one-way initialization guard; its close-while-suspended/reopen sequence passes. Form submit factories and Select/Checkbox callbacks are not immediate state-changing invocations. Form-library reset logic is guarded by value equality. Address autocomplete listener churn is a possible independent inefficiency, not an observed self-triggering loop. None of these inspections establishes an alternative cause for the reported crash.

Two independent cold-loading defects were reproduced against the original build:

- Delayed page code caused the existing workspace/sidebar/main/header nodes to become hidden with zero-size geometry while the route loader waited. During the subsequent base-list delay, the directory search controls were absent.
- Patients and Drivers moved their search controls upward **44 px** when optional trip totals completed because the status element disappeared.

Malformed URL limits also failed the original pagination checks. An independently induced render failure demonstrated that the original sticky page boundary prevented navigation to a healthy directory. Inducing this separate error tests recovery, not the origin of #301.

## Baseline and deployed build

The baseline is commit `1b28caa77cdafae417d3fb535f9ddff5c234b0b6`, archived outside the working tree and built with the installed lockfile dependencies. [Environment details](environment.json) include exact versions.

Public production assets were fetched on October 14, 2026. All eight inspected assets—entry, runtime, workspace, both CSS files, and three directory modules—were byte-identical to the fresh baseline build. Thus the previous report's historical “not deployed” statement is not current evidence. [Asset hashes and comparison](deployment-assets.json). This establishes the served asset generation, not the state of every user's browser cache or an authenticated production reproduction.

## Implementation

Correctness:

- Removed pagination setters from all three `useMemo` callbacks. Search, presence-filter, and page-size events reset pagination in the same event. A single guarded primitive page-size comparison handles external URL/Back/Forward changes without an effect chain or query-identity dependency.
- Supported limits are `5`, `10`, `25`, `50`, and `all`. Invalid limits fall back to five. Pure pagination clamps empty/shrunken results to a valid page; All uses the actual loaded collection length instead of `9999`.
- Form initial values are memoized by the editing snapshot, preserving custom Patients draft fields when totals/presence arrives. Ordinary refreshes do not key/remount the page. Actual identity changes retain the existing private-cache clearing and workspace reset.
- Cached rows are retained for transient refresh failures and hidden for authorization failures, including open record forms. Employee direct-bookmark behavior and the empty-state Upload admin guard follow the existing route/read policy; no permission matrix or RLS policy changed.

Loading:

- Route preloading starts the same cached lazy import without awaiting it at the workspace boundary. Directory-specific Suspense boundaries keep the workspace and route header visible while page code loads.
- A 150 ms initial pending threshold was tested and rejected: two production Firefox runs showed 10/9 blank animation frames spanning 150/133 ms after identity resolved. The final initial fallback is immediate with zero minimum display time. Ordinary directory navigation no longer waits at that boundary.
- Directory headers and controls remain available while base records load. Layout-matched skeletons replace the former full-page spinner. Pending, failed/retry, successful-empty, and cached-refresh states are distinct.
- Optional totals and presence share a reserved status area. Unknown/pending presence is distinct from offline and an unlinked account. Totals arriving before rows do not turn unresolved aggregates into zero.
- The independent `directory_trip_counts` queries, complete count pagination, export gating, stale totals, lazy forms/details/export code, and 30-second warm-cache reuse are preserved.

Recovery and prevention:

- Page boundaries reset on meaningful page/user/organization changes and provide explicit retry. Chunk failures have distinct copy and manual refresh; no automatic reload loop was added.
- Diagnostics retain a non-sensitive reference and category; development diagnostics include sanitized source/component frames. React's default caught-error logger is overridden so it does not separately log the raw error payload before the sanitized boundary handler.
- Scoped hooks lint remains enabled. A focused TypeScript AST regression catches setters inside memo calculations even when compiler-based lint fails to report them in a large component. This check fails all three original pages and passes the repaired versions.

## Evidence and validation

Browser fixtures use synthetic identities and records with remote requests intercepted. No private HAR credentials or production patient data were replayed. Screenshots, videos, stacks, and traces are synthetic. Production previews use freshly built assets and isolated ports, and test servers cannot silently reuse an already running preview. Readiness uses visible UI and request assertions; presence traffic is not treated as network-idle readiness.

The final production build uses entry `assets/index-D3DXa--B.js`; its HTML SHA-256 is `766cabbe70d80c956e6c0b4ba8bcd52d395333ea6fd25c6d91c4ef120828d3aa`. [Build provenance](build-verification.json). The lockfile is unchanged.

| Check | Observed result |
| --- | --- |
| `npm run typecheck` and `npm run build -- --manifest` | Passed; existing large-chunk warning remains |
| Focused ESLint on the 16 touched application modules, `--max-warnings 0`; `git diff --check` | Passed |
| `npm run test:startup` | 51 passed |
| `npm run test:directories` | 20 passed |
| `npm run test:compliance` | 32 passed |
| Trip browser-location/completion and driver-print tests | 38 passed |
| `npm run test:billing` | 42 passed; 5 database checks could not run because `supabase_db_futuretransportation` was stopped |
| Startup and Router production UI checks | 45 passed: 11 startup + 4 Router cases in each of Firefox, Chromium and WebKit |
| Final directory production Firefox suite | 54 passed; 1 baseline-only diagnostic intentionally skipped |
| Final directory production Chromium/WebKit selection | 21 passed in each engine (42 combined) |
| Directory StrictMode development Firefox selection | 14 passed |
| `npm run measure:startup -- dist` | Passed; graph estimates below |

[Validation logs](validation/) retain command output; [browser validation](browser-validation.json) links browser logs and exact commands. Final directory production coverage totals 96 passing executions across Firefox 155.0, system Chrome 154.0.8037.98, and WebKit 26.6. The shared Startup/Router browser checks used an earlier candidate before directory authorization retry handling. StrictMode and recorded geometry/video evidence use the build in [visual provenance](visual-build-verification.json), which differs from final source only in the one-line restored Employees empty-state Upload admin guard. Final production directory suites include that guard and its employee/admin regression cases. These generation differences are explicit in [browser validation](browser-validation.json). The full Firefox suite uses fresh synthetic browser contexts and covers every directory, both views, saved preferences, multi-page filters/limits, invalid bookmarks, empty/shrunken lists, failures/retries, form drafts, delayed identity, session/tenant/account transitions, restricted access, navigation/history, and induced render/chunk recovery. In the final authorization-failure case, the collection request fails once and cached rows/open drafts disappear within the 2-second assertion window.

Baseline controls were run against the archived original source/build using the same fixtures. The original development subset passed four scenarios without reproducing #301; the setter-trace diagnostic also passed. Original production probes produced nine expected failures (three geometry cases and six malformed limits) and three passes. An additional original boundary recovery case failed as expected. These failures establish the relevant before/after regressions; they are separate from the unavailable production crash reproduction. The static purity check also fails all three original pages.

Visual evidence and request behavior:

- [Per-frame geometry summary](geometry-summary.json) links each raw capture; the delayed code/list phases are deliberately gated and do not represent hosted latency measurements.
- Final Firefox visual captures sample 64 Patients frames, 76 Drivers frames, and 91 Employees frames, with zero hidden shell/header frames. Baseline hidden counts are respectively 29/59, 23/49 and 24/62. These are controlled samples, not exhaustive timing coverage.
- [Synthetic Patients video](final-visual/stability-patients-cold-co-99b79-serve-shell-header-geometry-firefox/video.webm), [Drivers video](final-visual/stability-drivers-cold-cod-282d6-serve-shell-header-geometry-firefox/video.webm), and [Employees video](final-visual/stability-employees-cold-c-c9c76-serve-shell-header-geometry-firefox/video.webm) sit alongside phase screenshots and Playwright traces. [Baseline captures](baseline-production/) retain the corresponding before evidence.
- Original shell/header geometry collapses during code loading; final captures retain a 255 px sidebar and 64 px header, with search available during the base-list wait. Main width remains stable. Content height legitimately shrinks from five skeleton cards to two fixture records; the tests do not claim identical content height.
- Optional totals move Patients/Drivers search by −44 px on the baseline and 0 px after the repair. Employees has no enrichment shift in either sample.
- Each navigation capture has exactly one document request. Immediate warm revisits make zero additional collection reads within the freshness window. Base rows and search are usable while totals remain pending; late enrichment preserves forms and page state.
- The rejected 150 ms initial threshold has two recordings with 10/9 blank frames (150/133 ms). The final zero threshold is checked independently from ordinary directory navigation.

| Local production graph (gzip bytes) | Baseline | Final | Increase |
| --- | ---: | ---: | ---: |
| Shared entry/workspace | 266,431 | 268,737 | 2,306 |
| Patients incremental graph | 74,728 | 75,099 | 371 |
| Drivers incremental graph | 73,754 | 74,234 | 480 |
| Employees incremental graph | 75,038 | 75,751 | 713 |

[Bundle comparison](bundle-comparison.json) records per-file inputs from fresh builds using the same environment and lockfile. Route figures deduct the shared shell graph and are not additive across all routes. The small increase pays for stable loading states, validation and safe diagnostics. All three forms and export still have independent lazy entries outside the shell. This is a code-size and request-behavior comparison, not a claim of improved production latency.

To repeat the focused suite, build once, then run `npm run test:directories:ui`. [Browser test instructions](../../tests/directories-ui/README.md) explain isolated ports, development mode, additional installed engines, baseline selection, and video/trace capture.

## Limits and manual verification

- The user authorized an existing signed-in Firefox test session. Firefox was installed but macOS denied access to its existing profile metadata (`EPERM`) and Accessibility inspection (`-1728`); no session credentials were extracted or browser privacy settings changed. The live check could not proceed through that session. The deterministic fixes and regression evidence must not be presented as a verified production #301 resolution.
- All now renders every row in the loaded collection. The pre-existing base-list API server cap is unchanged; this repair does not introduce complete server-side list pagination. Count pagination remains complete and separately tested.
- The local billing database container was stopped. Five database-dependent billing checks could not execute; the other 42 billing checks passed. No hosted SQL or RLS change was needed for this repair.
- Failed optional form `React.lazy` imports can remain rejected in the browser's module cache. Navigation away and explicit browser refresh remain available; page-code retry tests do not establish recovery of every optional form chunk.
- After separately authorized deployment, use an approved account in a fresh browser to open each directory directly and from Dashboard; search from a later page, try a malformed limit bookmark, revisit within 30 seconds, and edit a record while optional totals/presence finishes. Confirm one document navigation, usable rows before enrichment, stable controls, and no UI diagnostic errors. Capture a sanitized #301 component/setter trace if the reported crash recurs.

Relevant primary references: [pure memo calculations](https://react.dev/reference/react/useMemo), [Query v5 pending/disabled states](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries), [Router pending behavior](https://tanstack.com/router/latest/docs/guide/data-loading), and [React caught-error logging](https://react.dev/reference/react-dom/client/createRoot).
