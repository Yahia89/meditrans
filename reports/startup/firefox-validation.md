# Firefox production-build validation — 2026-10-13

The earlier Firefox launch blocker is resolved for the tested suites. Playwright 1.63.0's existing managed Firefox 155.0 launched successfully on macOS 27.0.1 arm64 when its application data was isolated using a child-process `CFFIXED_USER_HOME` directory. No browser reinstall, real-profile change or macOS privacy-setting change was needed. The upstream diagnosis and reusable setup are in the [runner notes](../../tests/firefox-ui/README.md).

Command: `npm run test:firefox:ui`.

The tests used the existing production `dist` built from application revision `febad46`, with repository HEAD `c679b3f` at the start of this follow-up. The Firefox helper, npm script and Router project registration change test automation only. All sessions and backend responses were synthetic; these are browser correctness checks, not Firefox live-account or latency measurements.

| Suite | Result | Runner duration | Retained stdout/stderr |
| --- | --- | --- | --- |
| Startup/auth | **11/11 passed** | 9.5s | [startup.log](firefox/startup.log) |
| Dashboard | **3/3 passed** | 12.9s | [dashboard.log](firefox/dashboard.log) |
| Router | **4/4 passed** | 5.7s | [router.log](firefox/router.log) |

Startup covers sign-in and sign-out, slow/failed/hidden memberships, retry, expired-token refresh, absent/disabled drivers, forbidden billing access, account/tenant changes and multi-tab logout. Dashboard covers code/data overlap, deferred off-screen chart loading, shared credit reads and visible credit errors. Router covers history/filter/fragment preservation, presence continuity, an unsaved dialog draft across token refresh, deferred optional chunks and manual stale-deployment recovery.

The temporary application-data directory was removed after the successful run. No manual OS/browser action remains for these 18 checks; future runs can use the committed wrapper. Billing's standalone Firefox suite was outside this follow-up and was not run. Existing deployment, database and real-user performance acceptance remain separate from this result.
