# Directory loading regressions

Build the production app, then run:

```sh
npm run build
node tests/directories-ui/run-firefox.mjs
```

The runner creates a disposable Firefox application-data directory on macOS, matching the existing Firefox startup runner. It serves the production build on port 5188 (override with `DIRECTORIES_TEST_PORT`). Additional Playwright arguments may follow the runner command.

The nine checks cover all three directories: search, immediate cached revisits, preserved URL/history, deferred create/edit forms with correct initial values, and employee rendering while membership presence remains pending. The presence check also guards against duplicate employee reads and the former profile/invitation request chain. Client and driver cases hold back trip totals, verify that records remain searchable, distinguish pending/failed counts from real zero, prevent inaccurate exports, and exercise retry recovery.

All sessions and records are synthetic. Every remote request is intercepted; these checks make no real Supabase writes and do not measure hosted latency, RLS performance, or production permissions.
