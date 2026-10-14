# Future Transportation: sanitized initial-load HAR findings

Source: the user-uploaded nemt.futrans.us HAR captured October 13, 2026. Analysis performed locally; no authenticated requests were replayed.
This report intentionally omits credentials, cookies, authorization headers, token payloads, member identifiers, private response bodies, and raw request query values.

## Limits of the evidence

- One Firefox 157.0.1 production-page capture, not a controlled multi-run performance benchmark.
- The trace includes a session refresh. It is not a signed-out login test or proof every visit needs a refresh.
- HAR page timings are not LCP, INP, FCP, JavaScript CPU time, or a reliable application-ready marker.
- Zero DNS/connect timings may reflect reused connections; this is not proof of a totally cold connection/cache.
- The last recorded request is a later presence heartbeat. Do not call the full recording duration the app load time.
- Server request durations include network and backend work. They do not isolate SQL execution or prove database compute is undersized.
- Repository source reviewed separately may not be the exact commit deployed in this capture.

## Recorded timing

| Observation | Recorded value |
|---|---:|
| Main HTML request | 154 ms |
| DOMContentLoaded / HAR onContentLoad | 554 ms |
| Window load / HAR onLoad | 702 ms |
| Session-refresh request | 357 ms; starts at 0.590 s |
| Profile/membership/driver reads begin | 1.095 s |
| Dashboard chunk starts | 1.346 s |
| Organizations request starts / completes | 1.367 s / 1.469 s |
| Dashboard bucket requests start | 1.681 s |
| Dashboard bucket request durations | 965 ms and 947 ms |
| PerformanceChartPlot chunk starts / completes | 2.721 s / 2.889 s |
| Later presence heartbeat starts | 31.569 s |

## Request counts

- 76 total entries; 75 begin in the first three seconds.
- 51 initial Supabase requests, including 24 OPTIONS requests and 27 non-OPTIONS requests.
- Three identical GET requests select the signed-in driver ID at approximately 1.095–1.096 seconds. A fourth driver lookup retrieves different profile fields.
- Two identical trip-data GETs occur at approximately 1.992 and 2.037 seconds. Their recorded response bodies have the same content.
- The two dashboard_trip_buckets RPC calls are NOT duplicates: one requests the performance range and one the calendar range.
- The presence calls separated by approximately 30 seconds are a heartbeat, not a demonstrated duplicate bug.
- No HTTP 4xx or 5xx responses are present. One 206 response and a redirect are not by themselves failures.
- Google Maps, PDF generation, and spreadsheet vendor chunks are not evident in this initial dashboard trace.

## JavaScript payloads

The Firefox content.size fields for these asset responses agree with their gzip Content-Length headers. The decoded text byte counts below were calculated separately from content.text. BodySize includes additional overhead in this export and was not treated as decoded JavaScript size.

| Asset | Encoded body bytes | Decoded JavaScript bytes |
|---|---:|---:|
| index-CojUyAhD.js | 85,477 | 273,691 |
| vendor-query-TiUIs87B.js | 10,455 | 34,897 |
| vendor-radix-DLak3P-M.js | 30,396 | 110,147 |
| vendor-icons-BpleB3Th.js | 73,767 | 316,868 |
| vendor-supabase-Cm3aEAp1.js | 43,273 | 164,090 |
| vendor-react-D8NtCtv_.js | 61,022 | 193,007 |
| dashboard-QXsFb9_K.js | 12,724 | 53,587 |
| credit-utils-Dw2Ce4G_.js | 796 | 2,415 |
| timezone-Dbhxa3es.js | 700 | 2,083 |
| vendor-date-C6A8HFHa.js | 10,197 | 34,483 |
| select-B81Sr_MW.js | 1,272 | 3,656 |
| PerformanceChartPlot-BfddGb8x.js | 103,174 | 341,411 |

- Six early shell JavaScript assets: 304,390 encoded bytes (297.3 KiB) and 1,092,700 decoded bytes.
- All twelve application JavaScript assets captured: 433,253 encoded bytes (423.1 KiB) and 1,530,335 decoded bytes.
- Icon vendor chunk: 73,767 encoded bytes / 316,868 decoded bytes. It is larger than the React vendor chunk in this trace.
- Chart plot chunk: 103,174 encoded bytes / 341,411 decoded bytes. It is requested only after the chart RPCs finish.
- Two font responses: 73,016 bytes (Inter) and 32,228 bytes (Outfit), totaling 105,244 bytes.

## Delivery/cache observations

- Hashed JavaScript assets have Cache-Control: max-age=14400 (four hours), gzip content encoding, and Cloudflare MISS in this sample.
- HTML has Cache-Control: max-age=600 and Cloudflare DYNAMIC.
- The document includes GitHub-origin response headers, while the public connection is served through Cloudflare. Verify the deployment before changing rewrite/header configuration.
- Most requests use HTTP/3. Protocol migration is not an obvious first intervention from this trace.

## Evidence-led priorities

1. Share user/driver identity reads and eliminate the confirmed identical trip fetch.
2. Shorten session/profile/membership/organization staging without weakening authentication or tenant boundaries.
3. Profile dashboard_trip_buckets with representative authenticated/RLS context; preserve timezone and count correctness.
4. Start visible-chart code and data together rather than serializing the code behind the response. Defer off-screen charts instead.
5. Inspect the icon/manual-chunk import graph; do not assume installed package count equals initial download size.
6. Keep existing lazy page/PDF/map boundaries. Test cold and warm visits with actual application-ready marks.

No source code, infrastructure settings, or database records were modified by this analysis.
