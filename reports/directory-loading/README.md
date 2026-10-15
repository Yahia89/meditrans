# Patients, Drivers, and Employees loading

Implemented on October 14, 2026. The new Supabase function is applied to the verified repository-linked application project. The frontend is built and verified locally, but is **not deployed**. No commit or push was made.

## What changed

- Patients and Drivers fetch their directory records without embedding trip counts. Records and search become usable independently of the totals request.
- `directory_trip_counts` groups `count(*)` under the caller's existing row-level security. It does not change table policies, data, or indexes. The frontend reads ordered pages with exact group counts so API row limits cannot silently turn missing totals into zero.
- Pending and failed totals have distinct states, with retry on failure. Initial exports wait for successful totals. Existing complete data can remain cached during background refreshes. Trip mutations and directory deletions invalidate the totals cache.
- Directory records and counts stay fresh for 30 seconds, allowing immediate revisits to reuse data. Existing account/organization changes clear private caches.
- Employees loads presence with one membership request keyed by `user_id`, replacing the profiles/invitations/duplicate-employees request chain. Realtime updates and stale-heartbeat handling remain active.
- Create/edit forms, spreadsheet export code, and driver details load when needed.

## Cause and baseline

The supplied HAR captures a Patients request taking **5,464 ms** for 37 records; this consumed 93.55% of its capture span. It contains no Drivers or Employees requests. All 32 app assets report zero time in this capture, so it is not a cold-download baseline. See [sanitized HAR analysis](har-baseline-sanitized.json).

The slow query used `select=*,trips:trips(count)`. Hosted `pg_stat_statements` confirmed the generated lateral query selects `trips_1.count`. PostgreSQL interprets that as `count(trips_1)`, a whole-row aggregate. Whole-row evaluation can detoast large fields even though the page only needs a number. The replacement counts rows without constructing the trip payload. References: [PostgreSQL composite-field notation](https://www.postgresql.org/docs/current/rowtypes.html), [whole-row executor implementation](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/executor/execExprInterp.c#L5044), and [PostgREST aggregate syntax](https://docs.postgrest.org/en/stable/references/api/aggregate_functions.html#the-count-aggregate).

An initial authenticated replay reproduced 6,337 ms for the legacy Patients request versus 266 ms without counts. Hosted SQL samples showed the exact legacy Patients shape taking 771 ms and 11,704 shared buffer hits, versus 111 ms and 814 hits for the grouped count query. These were single SQL samples, not controlled browser benchmarks. Existing relevant indexes were already present. See [SQL measurements](sql-measurements.json).

## Browser evidence

Final production build, local preview, Firefox, actual hosted Supabase, read-only HAR session:

| Route     | First visible records | Immediate revisit | Directory API response |
| --------- | --------------------: | ----------------: | ---------------------: |
| Patients  |              1,085 ms |             78 ms |                 147 ms |
| Drivers   |                399 ms |             62 ms |                 227 ms |
| Employees |                252 ms |             71 ms |                 155 ms |

Patients includes initial app/auth bootstrap; Drivers and Employees are subsequent navigations. The count RPCs completed in 201/180 ms and employee presence in 139 ms. Search worked on all three routes. Revisits generated **zero additional backend requests**, and there were no page errors. See [sanitized live browser measurements](live-browser-measurements.json).

The live browser blocked all mutations except the read-only count RPC, including an automatic presence heartbeat. No real screenshots, traces, names, tokens, or record bodies were saved in the evidence. This verifies a local frontend with the hosted backend, not deployment of the frontend or hosted write workflows. It is one browser run for one account, not a field percentile or all-role browser benchmark.

Three additional paired API samples verified identical records and trip totals for Patients and Drivers. They include the final exact-count request options. Network/warm-cache variation was substantial: Patients' new list responses ranged from 118 to 836 ms, while warmed legacy responses ranged from 200 to 966 ms. These small samples do **not** show that every request is faster; the change removes count work from the list's critical path. Employees' main list API is unchanged; its improvement comes from fewer supporting requests, cache reuse, and less startup JavaScript. All samples, including the slower new sample, are retained in [API measurements](live-api-measurements.json).

## JavaScript download estimates

Incremental static import graph for each route after subtracting the workspace shell, compressed locally with gzip:

| Route     |    Before |    After | Reduction |
| --------- | --------: | -------: | --------: |
| Patients  | 270,705 B | 74,728 B |    72.40% |
| Drivers   | 460,018 B | 73,754 B |    83.97% |
| Employees | 267,940 B | 75,038 B |    71.99% |

These are local production-bundle estimates, not measured hosted transfer times. [Full graph evidence](bundle-measurements.json).

## Validation and backend application

- Production build/typecheck passed; focused ESLint checks and `git diff --check` passed.
- Startup unit regressions: 48/48 passed.
- Directory data/cache/pagination/presence tests: 9/9 passed, including 1,001 count groups, a smaller server page cap, failed subsequent pages, and preservation of the previous complete cache.
- New Firefox directory suite: 9/9 passed, including delayed/failed totals, retry, export gating, search, cached revisits, presence, and deferred edit/create forms.
- Existing Firefox router regressions: 4/4 passed.
- Five synthetic screenshots were reviewed: [Patients pending](screenshots/patients-counts-pending.png), [Patients loaded](screenshots/patients-counts-loaded.png), [Drivers pending](screenshots/drivers-counts-pending.png), [Drivers loaded](screenshots/drivers-counts-loaded.png), and [Employees](screenshots/employees-presence-loaded.png).
- SQL regression suite: 56/56 passed locally with hosted SELECT policies mirrored inside a rollback transaction. It covers more than 1,000 trips, zero-trip entities, exact legacy count parity, roles, disabled users, foreign organizations, invalid arguments, and anonymous denial. The local container's starting policy definitions differed from hosted; the temporary mirror, function, and synthetic records were all rolled back. [Rollback verification](database-validation.txt).
- Migration `20261014181036_directory_trip_counts.sql` was applied through an isolated CLI workdir containing fetched hosted migration history plus only this candidate. [Dry run](remote-dry-run.txt) and [application](remote-apply.txt) confirm its scope. A final dry run reported the remote database up to date.
- Hosted metadata independently confirms `SECURITY INVOKER`, stable volatility, empty `search_path`, authenticated execution, and anonymous denial. [Migration verification](migration-verification.json).
- Hosted advisors stayed at 45 findings, with zero new or removed findings. [Comparison](advisors-comparison.json).

## Repeat and deploy

```sh
npm run build
npm run test:directories
npm run test:directories:ui
npm run test:firefox:ui -- router
```

`scripts/measure-directory-api.mjs <har-path> <output.json>` repeats the read-only API comparison using a still-valid HAR session. It emits only sanitized timings, sizes, row counts, and parity booleans. Keep the original HAR private.

The frontend deployment remains outstanding; the existing production frontend still uses its old queries. Its deployment command is `npm run deploy`. After deployment, check these three routes and their immediate revisits. [Function rollback](rollback-directory-trip-counts.sql) removes only the additive RPC and should be used after reverting any frontend that depends on it.
