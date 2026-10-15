# Directory correctness and loading regressions

Build the production app, then run:

```sh
npm run build
npm run test:directories:ui
```

The default Firefox runner creates a disposable macOS application-data directory. Production preview uses port 5188 and **refuses to reuse an existing server**, preventing accidental verification of stale assets. Additional Playwright options follow the runner command.

```sh
# Additional installed engines (no browser download required by these commands)
DIRECTORIES_TEST_PORT=5190 npx playwright test --config playwright.directories.config.ts --project=chromium --project=webkit

# StrictMode Vite development checks
DIRECTORIES_DEV=1 DIRECTORIES_TEST_PORT=5191 node tests/directories-ui/run-firefox.mjs --grep 'saved .* preference|pagination handles|delayed organization|rapid directory'

# Record a bounded synthetic video/trace plus per-frame geometry JSON
DIRECTORIES_VIDEO=1 DIRECTORIES_TRACE=1 node tests/directories-ui/run-firefox.mjs --grep 'cold code and list phases'

# Patient credit calendar -> dated trip history -> trip details regression
DIRECTORIES_VIDEO=1 DIRECTORIES_TRACE=1 node tests/directories-ui/run-firefox.mjs --grep 'Patient credit trip|Patient trip malformed date'
```

`DIRECTORIES_SOURCE_ROOT` selects a separate source/build checkout; `DIRECTORIES_OUTPUT` selects an artifact folder. This supports identical fixtures against an immutable baseline and the candidate, on separate ports. The optional `DIRECTORIES_DIAGNOSTIC=1` test observes the original Patients pagination-memo setter in an **untouched baseline development build**, injecting only call counts and stack capture through a network-response transform. It does not create a loop or change setter values/dependencies; the candidate intentionally no longer contains this pattern.

Coverage includes multi-page pagination/search/limits and list/grid views, malformed URL limits, cold code/data phases, list/count/presence failures and retries, warm revisits, lazy forms, draft retention during enrichment, cached-data refresh failures, final-page collection shrink, login/session/organization/account changes, role restrictions, navigation/history, and separately induced render/chunk failures. Each controlled visual case captures the sidebar, main, header and search geometry across frames, plus images before/after base rows and optional totals. Assertions check visible geometry and retained shell identity, not an exact render count.

All sessions and records are synthetic. Remote requests and sockets are intercepted; tests cannot write real Supabase records and do not measure hosted latency, RLS performance or production permissions. Synthetic render/chunk injection tests validate recovery behavior and are **not** reproduction of the reported production React #301.

The separate `credits-trip.spec.mjs` follows the subsequently identified trigger through the real components: Patients, patient details, Credits, a spending day, filtered trip history, trip details, and Back. Before the patient-details repair, both the credit-day click and a direct dated bookmark produced the actual render loop in unchanged development and production builds. The repaired regression also covers browser Back/Forward, reload, clearing the day, pagination with 13 trips, refresh, filter resets, list shrink, and invalid dates. `PATIENT_DETAILS_DIAGNOSTIC=1` is an optional development-only observation of the original patient-details setter memo; use it only with an unfixed source checkout. It logs Date identity and setter stacks without changing state/dependencies, and deliberately fails if that original memo is absent.

For WebKit only, this credit-navigation fixture fulfills the already-synthetic `update_user_presence` endpoint inside the browser and records status/call metadata. Playwright's intercepted unload requests otherwise produce a native access-control error even with explicit valid CORS headers. Other fetches and all error assertions remain intact. These cases validate credit navigation; they do not validate presence unload transport.
