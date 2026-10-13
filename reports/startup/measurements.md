# Startup measurements — 2026-10-13

The final client improves authenticated readiness and reduces dashboard requests. Its shell is **11.4% smaller by local gzip estimate**, including the new Router. The provisional 250 KiB shell target is **not met**: the final graph is 260.2 KiB, versus 293.7 KiB at baseline. Login readiness and secondary-route chunk counts have tradeoffs described below.

## Method and evidence boundaries

Baseline: original `d577707186a7f97997398273becfb41b8d84f45c`, rebuilt before source changes. Final dashboard application: `febad46`, including the final GPS/ETA concurrency safeguard. Login, secondary-route, refresh, interaction and milestone samples use the preceding `64a69c1` candidate; the safeguard changes active driving-workflow side effects, and GPS was inactive in those observations. Both sets are retained explicitly. The SQL proposal remains **unapplied**. Builds were served from immutable copies using the same local preview server/origin for authenticated comparisons. Chromium 154, 1440×1000 viewport, no CPU/network throttling. Supabase was live and the authorized account/organization was the same. No other test/build/profile workload ran during the final comparison.

Three cold and three warm dashboard/login runs per build; two cold and two warm runs for each secondary route. Cold clears HTTP cache while retaining authentication and system/DNS/TLS state; warm retains browser cache. Baseline runs precede final runs rather than being randomized. Backend/network/cache variability remains a confounder. Values are local medians and observed min–max, **not field p75, guaranteed speedups, or production-host benchmarks**.

The passive harness observes UI and sanitized CDP network metadata; Argent drives navigation/input. The dashboard shell mark observes the visible activity panel after access resolves; it is not full-content readiness. The separate dashboard-data mark requires the actual rendered chart (or the real empty-data state, never an error). Every dashboard comparison had a rendered chart. We waited 2.5 seconds after Argent confirmed it before snapshotting. Other routes use their explicit ready selectors and the same post-ready interval. Presence requests within that window are counted; later heartbeats are not startup duration. We do not use networkidle.

Only sanitized paths, table/RPC names, counts, timings, sizes and known milestone names are retained. Query parameters and response bodies are omitted, so repeated endpoint names cannot prove identical queries. Driver/credit deduplication is separately asserted with exact fixture request matching in browser tests.

## Returning authenticated dashboard

Milliseconds; values are median (min–max).

| Metric | Baseline cold | Final cold | Baseline warm | Final warm |
|---|---:|---:|---:|---:|
| Usable dashboard shell | 567.7 (443.7–926.7) | 337.9 (282–758.3) | 264.7 (251.8–573) | 158.3 (151.8–187) |
| Visible chart data readiness | 3,375.4 (1,033.1–3,729.5) | 658.2 (533.3–1,899.9) | 1,131.5 (764.9–17,919.2) | 353.7 (348.9–1,103.1) |
| FCP | 144 (136–160) | 148 (148–296) | 104 (84–108) | 88 (84–116) |
| Last observed LCP | 620 (492–976) | 384 (316–796) | 316 (288–624) | 204 (200–236) |
| All observed requests | 72 (70–72) | 54 (54–55) | 46 (46–47) | 34 (34–34) |
| API requests excluding OPTIONS | 27 (26–27) | 21 (21–21) | 27 (27–28) | 21 (21–21) |
| Total CDP encoded network bytes | 631,217 (631,215–631,269) | 601,671 (601,655–602,010) | 41,648 (41,638–42,601) | 33,756 (33,752–33,763) |
| JS CDP encoded network bytes | 433,732 (433,732–433,732) | 407,652 (407,652–407,652) | 2,148 (2,148–2,148) | 1,074 (1,074–1,074) |

The visible-shell proxy median improved **40.5% cold** and **40.2% warm**; it exceeds the provisional 25% target for that proxy, not an independently paired all-widget readiness metric. Chart medians improved from 3,375 to 658ms cold and 1,132 to 354ms warm, but SQL/network variation contributes to this larger change. Cold timing ranges overlap; the observations do not guarantee the same gain on every load.

Baseline warm run 1 had a real `dashboard_trip_buckets` HTTP500 after 12,003ms and then recovered through Query retry, making chart readiness17,919ms. It is retained, not discarded. Baseline warm runs 2/3 were1,132/765ms. No page errors occurred in either build; this was the baseline comparison's only console error. All six final dashboard runs had zero page/console errors.

CLS medians were baseline 0.0482 cold/0.0616 warm and final 0.0603 cold/0.0613 warm. Cold CLS slightly increased. Median long-task count was zero in all four groups; baseline cold had one 50ms task and final cold one 71ms task. Neither warm set had long tasks. These are diagnostics, not Lighthouse TBT or an INP score. Cold FCP is similar; warm median FCP was 104→88ms in this sample.

### Why the request path improved

Shared bootstrap removes the separate organizations fetch and repeated identity reads; stable session identities avoid refresh-driven repeats. Shared credit data removes identical alert reads. Onboarding uses bounded idle reads instead of exact-count prerequisites. Different calendar/performance ranges remain distinct RPC calls. In representative cold runs, driver GETs fell5→3, because operational driver lists and onboarding checks still legitimately use that table. It would be incorrect to claim every request to `drivers` or `trips` is redundant.

The visible chart import now overlaps its RPC. On the same CDP clock in `comparison-final-cold-3`, the plot starts at 319.9ms; RPCs start at 306.0/320.6ms and respond at 567.0/532.9ms. The module therefore downloads while data is in flight, before both responses. In `comparison-baseline-cold-3`, the plot starts at 725.5ms after the RPC responses at 723.8/708.8ms. CDP times are relative to harness arming, not navigation; no cross-clock timestamp comparison is used here. Fixture tests assert import-before-RPC-response directly. Rendering a fulfilled import also removes the measured extra React suspense fallback delay.

## Login and other routes

Milliseconds; median (min–max). Login has 3 runs per cell, other routes 2.

| Ready condition | Baseline cold | Final cold | Baseline warm | Final warm |
|---|---:|---:|---:|---:|
| Visible login form | 99.3 (84.7–179.5) | 108.8 (93.5–293) | 54.3 (48.5–60.5) | 62.1 (57.4–68.8) |
| Trip Scheduler after initial data | 846.1 (746–946.1) | 677.2 (543.3–811.1) | 541.7 (535.5–547.8) | 453.7 (443.3–464.1) |
| Loaded Billing records / real empty state | 678.1 (640.2–716.1) | 527.3 (449.3–605.2) | 383.4 (352.1–414.6) | 286.9 (285.7–288) |
| Patient primary details | 660.3 (634.8–685.8) | 444.2 (431–457.4) | 362 (359.1–365) | 266.2 (234.2–298.2) |

These route/login samples use candidate `64a69c1`. Readiness selectors were `input[type="password"]` for login, `main h1` after the Trip Scheduler data gate, `[aria-label="Billing records"], [data-slot="empty-title"]` for billing, and `main h1` after the patient detail data gate. Argent also waited for the expected screen text (Trip Scheduler, Add billing record, Personal Information) before the fixed observation interval.

Login is about 9.5ms slower cold and 7.8ms slower warm at the median; smaller bytes alone did not improve that screen. The patient-detail ready selector covers primary information, not every later history widget. Trips used the same cards view for timings; the timeline was separately verified. Billing used the manual agency-submission module, without submitting records or receipts.

| Route | Cold total requests, before→after | Cold network bytes, before→after | API requests excluding preflights, before→after |
|---|---:|---:|---:|
| Trips | 59 → 59 | 593,097.5 → 610,130.5 | 16 → 12 |
| Billing | 61 → 52 | 514,662 → 516,259.5 | 19 → 15 |
| Patient detail | 82 → 104 | 1,110,939 → 1,156,555 | 19 → 15 |

Secondary-route transfer did not shrink uniformly. Patient detail loads 22 more cold requests and about 4.1% more network bytes; warm requests are 64→90. Trips warm requests are 44→48. Rolldown keeps more small feature chunks separate outside the grouped shell/dashboard. These routes nevertheless reached their primary content earlier in this small sample. Further route grouping should be measured separately against cache reuse and optional-feature isolation.

## Refresh, interaction and application milestones

Forced refresh changed only the expiry timestamp in the isolated test browser's own saved session, leaving the SDK's normal refresh/persistence enabled. Each of the four baseline/final cold/warm checks made exactly **one successful token POST**. This is one sample per condition, not a repeated median claim.

| Refresh scenario | Baseline shell / chart | Final shell / chart |
|---|---:|---:|
| Cold |777 /2,207ms |597 /1,647ms |
| Warm |332 /865ms |331 /765ms |

A final dashboard→Trips sidebar click produced one Event Timing interaction of **48ms**, with no long task or error. This is a representative interaction diagnostic, **not INP**. Its custom route mark includes about 330ms of controller/discovery delay before the click, so the arm-to-ready707ms value is not presented as click latency.

The final warm-refresh document recorded all six application milestones: session 190ms, identity/organization 296ms, usable shell 315ms, primary dashboard data 434ms and chart 765ms. See `measurements/final-application-milestones.json`. Marks contain no record/user identifiers. Current in-app primary-data instrumentation covers the dashboard; other routes were measured through explicit external DOM readiness. Organization-switch/restricted-user/absent-driver scenarios use production-build synthetic regressions; the supplied admin account is not proof of real multi-role performance.

## Bundle graphs by stage

Gzip is computed locally per emitted JS file with the same script. It excludes CSS/fonts/API data and is not the historical Cloudflare response size. Shell includes the router's split workspace component required for the first usable page. Dashboard adds its static graph; chart adds the lazy plot. Dynamic maps, PDFs, workbooks, closed dialogs and production devtools remain outside the initial dashboard graph.

| Stage | Shell decoded / gzip bytes | Dashboard gzip | Dashboard + plot gzip | Shell / dashboard / plot graph chunks |
|---|---:|---:|---:|---|
| Baseline Vite7 |1,092,700 /300,776 |326,318 |429,013 |6 /11 /12 |
| Dependency/icon cleanup |739,640 /222,653 |277,840 |380,504 |4 /35 /36 |
| Shared bootstrap/dashboard |782,355 /236,447 |284,383 |387,085 |4 /30 /31 |
| Router on Vite7 |861,647 /275,413 |323,758 |426,059 |44 /70 /71 |
| Initial Vite8 default splitting |896,396 /278,683 |326,975 |423,920 |46 /72 /73 |
| Vite8 grouping candidate (`64a69c1`) |887,335 /266,355 |307,966 |404,887 |4 /5 /6 |
| Final GPS safeguard (`febad46`) |887,585 /266,427 |308,037 |404,957 |4 /5 /6 |

Cleanup initially reduced shell gzip 26%; the final result is 11.4% after including Router, runtime validation and compatible SDK updates. The final decoded shell is 18.8% smaller. Router increased required bytes; its benefits are navigation/access correctness and maintainability, not an independent speed claim. Final grouping reduces the default Vite8 shell graph 46→4 chunks and dashboard 72→5 while retaining dynamic boundaries. Dashboard+plot gzip improves5.6% from baseline.

Both fonts have actual roles: Inter is body text; Outfit is headings in `src/index.css`. The Google Fonts request already uses `display=swap`, preconnect and variable weights. Font coverage/appearance was retained; no unverified font deletion or subset claim is made. Self-hosting/subset optimization remains a separate measured opportunity. This means the historical 105,244 font bytes were not claimed as removed.

Vite reported 6.96s baseline,8.11s cleanup,6.26s Router/Vite7 and 880ms Vite8 candidate build phases; the final dev server reported 383ms ready. The handoff rebuild reported 858ms. These single local compiler observations exclude TypeScript time and are not browser-speed evidence.

## Historical HAR and retained runs

The raw HAR was unavailable. The user's sanitized findings reported 76 total entries,51 initial Supabase requests (24OPTIONS/27others),154ms HTML,554ms DOMContentLoaded,702ms load, repeated driver-ID/identical trip reads, and two **different-range** bucket RPCs of 965/947ms. The 6 early JS files had1,092,700 decoded bytes, matching the rebuilt baseline shell, and 304,390 compressed response bytes. Local gzip is 300,776 bytes for that same graph because server compression differs. The later31.569-second presence heartbeat was not startup readiness. Historical timings are not FCP/LCP/INP.

`comparison-baseline-*` and `comparison-final-*` are the controlled final dashboard set. `baseline-login-*`, `final-login-*`, `routes-*` and `refresh-*` are separate scenarios. `paired-baseline-*`, `optimized-*`, `interim-vite8-*` and `pre-gps-final-*` are retained exploratory observations and are excluded from final medians: intermediate code, cache/backend state and work scheduling differed. Some earliest exploratory files were removed by the old shared Playwright output directory; suites now have separate output directories. No missing samples are reconstructed. Stage bundle graphs remain reproducible, but a complete repeated browser latency series for every intermediate commit is unavailable.

Regenerate the dashboard aggregate with `node scripts/summarize-startup.mjs`; change its prefix arguments for the route/login scenarios. [comparison-summary.json](comparison-summary.json) contains all final aggregates. Per-run request start/response/end timings, paint observations and byte counts are in [measurements/](measurements/).

Database profiling is separate in [database-measurements.md](database-measurements.md): existing trip indexes are efficient for the sampled admin; expensive timezone catalog validation dominates that SQL sample. The prepared SQL optimization was **not applied** and contributes none of the measured frontend improvements. Firefox, production-host/physical-device performance, large-tenant/concurrent SQL performance and field Web Vitals remain unmeasured. See [validation.md](validation.md) for passed tests and explicit release gates.
