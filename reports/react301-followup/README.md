# Patients credit-to-trip render loop

The React #301 cause is now reproduced. The previous directory-only tests missed the patient-detail credit calendar path. This follow-up preserves the earlier directory/loading repairs and fixes the additional loop in `PatientDetailsPage`.

## Confirmed chain

1. Open a patient's Credits tab and select a spending day. Its handler writes an ISO `date` query parameter and switches `section` to `trips`.
2. `PatientDetailsPage` imports `useRouteQueryState` under the alias `useQueryState`. That Router adapter calls its parser during each render. The old parser created a fresh `Date` object even when the URL string had not changed.
3. A remaining pagination `useMemo` depended on that object and called `setTripPage(1)`. Each render therefore scheduled another render-phase update, which created another `Date` and re-ran the memo.
4. React exhausted its rerender limit and the page boundary displayed `UI-RENDER-LOOP`. Setting the same scalar value does not stop this repeated render-phase update chain.

The affected signed-in Firefox session produced an actual render-loop diagnostic with `PatientDetailsPage` at the top of its component stack. [Sanitized live evidence](live-before.json) contains filenames and source positions only. Exact source maps map `patient-details-page-DGxEoEw7.js:1:16297` to `PatientDetailsPage` and the throw frame to React's production rerender guard. No record identifiers, form values, credentials, or patient payloads were captured.

Both [development StrictMode](../react301-cold-load/credits-before-development/) and an [unchanged production preview](../react301-cold-load/credits-before-production/) reproduced the credit-day and direct dated-bookmark failures. [Response-only instrumentation](../react301-cold-load/credits-before-setter-trace-confirmed/) immediately before the unchanged setter observed 56 calls: two with no selected date and 54 with the same serialized date; 52 of those dated calls observed a different Date identity. This confirms the changing dependency and setter chain, beyond locating a suspicious source pattern.

The public entry, workspace, Patients, Patient Details, and pagination modules were byte-identical to local pre-fix assets. [Asset verification](deployed-before.json). The user also supplied the successful deployment log for this generation. These checks rule out a stale directory module as the explanation for this reproduction.

## Repair

- Keep the URL date as a primitive string and derive its Date value in a pure memo. Invalid dates resolve to the ordinary month view; valid ISO and date-only inputs retain their existing timezone semantics.
- Remove the state-changing pagination memo. Month/status changes, credit-day selection, and clearing the day reset pagination in their own event handlers.
- Handle external patient/date changes through a guarded primitive comparison that resets pagination once. Back/Forward does not depend on Date-object identity, and no synchronization effect was added.
- Clamp trip pagination to six rows per page and a valid page after result shrinkage.
- Extend the existing render-purity guard and scoped hooks lint to Patient Details. The static check fails the original setter memo and passes the repaired source.

The shared Router adapter, query keys, account/organization boundaries, independent directory counts, lazy imports, and warm-cache behavior are unchanged by this follow-up.

## Validation

`npm run build -- --manifest` (including TypeScript), focused Patient Details ESLint, `git diff --check`, and all **21 directory unit/static tests** pass. The scoped source review found no remaining loop in the changed path.

The full synthetic flow is Patients → patient details → Credits → spending day → filtered trips → Trip Details → Back. Tests also exercise direct dated bookmarks, reloads, browser Back/Forward, clearing the selected date, 13-trip pagination, refresh while on page two, status/month resets, result shrinkage, and malformed dates. The five development StrictMode cases pass. The same five focused production cases pass in **Firefox, Chromium, and WebKit: 15/15**. [Browser summary](browser-validation.json) records exact commands, generations, logs and coverage.

The initial WebKit run completed the application flow but reported a native access-control error for mocked presence RPC calls during document teardown/reload. The final WebKit fixture fulfills only that already-synthetic presence endpoint inside the browser and records its calls; all other requests and native-error assertions remain intact. This verifies credit/trip navigation and does not validate live presence transport. The failed fixture runs are retained with that explanation.

[Firefox full-flow video](credits-after-production-firefox/credits-trip-Patient-credi-25ba2-ation-credit-calendar-click-firefox/video.webm) and its adjacent Playwright trace record the corrected flow using synthetic records. [Validation logs](validation/) retain the command output.

[Final build provenance](build-verification.json): entry `assets/index-DPgXjQkX.js`, Patient Details `assets/patient-details-page-DS5e2D1l.js`, HTML SHA-256 `81f989e293ed11bdb03c2d0dc6e533d48a98c0d6bfc947647c304763ccd16b72`. The lockfile is unchanged. [Chunk comparison](bundle-comparison.json): the lazy Patient Details chunk increases from 9,776 to 9,860 gzip bytes (+84); no runtime dependency or eager import was added.

Repeat the focused production checks after building with `npm run test:directories:ui -- credits-trip.spec.mjs`. For development, use `DIRECTORIES_DEV=1 DIRECTORIES_TEST_PORT=5191 npm run test:directories:ui -- credits-trip.spec.mjs`. Tests use isolated ports and refuse to reuse a stale preview.

## Runtime scope

The live session check was read-only. The temporary boundary listener was removed, and Firefox was returned to the working Patients list. Production records were not changed. Live screenshots used for inspection were temporary and are not included in repository artifacts; recorded before/after test artifacts contain synthetic records only.

The source correction is local until deployed. A local build and synthetic browser pass do not mean the hosted correction is live. After deployment, repeat Patients → patient → Credits → spending day → trip row → Trip Details → Back in the affected account, and open a dated patient-trip bookmark directly.

Primary references: React's [render-loop troubleshooting](https://react.dev/reference/react/useState#im-getting-an-error-too-many-re-renders) and [pure memo calculations](https://react.dev/reference/react/useMemo). They explain the mechanism; the runtime reproduction above establishes its occurrence here.
