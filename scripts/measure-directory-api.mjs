// Read-only comparison using the authenticated request in a local HAR.
// Writes only timings, sizes, counts and parity booleans; never headers or rows.
// node scripts/measure-directory-api.mjs <har-path> <sanitized-output.json>
import { readFile, writeFile } from 'node:fs/promises';

const [harPath, outputPath] = process.argv.slice(2);
if (!harPath || !outputPath) throw new Error('Provide a HAR path and output JSON path.');
const har = JSON.parse(await readFile(harPath, 'utf8'));
const entry = har.log.entries.find(({ request }) => request.method === 'GET'
  && new URL(request.url).pathname === '/rest/v1/patients');
if (!entry) throw new Error('The HAR must contain an authenticated patients GET.');
const base = new URL(entry.request.url);
const orgFilter = base.searchParams.get('org_id');
if (!/^eq\.[0-9a-f-]{36}$/i.test(orgFilter ?? '')) throw new Error('Expected an organization filter.');
const headers = Object.fromEntries(entry.request.headers
  .filter(({ name }) => ['authorization', 'apikey'].includes(name.toLowerCase()))
  .map(({ name, value }) => [name, value]));
const report = { scope: 'Live API, same HAR identity; read-only; no browser timing',
  measuredAt: new Date().toISOString(), routes: {} };

async function measure(path, query, body, exactCount = false) {
  const url = new URL(path, base.origin);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  const start = performance.now();
  const response = await fetch(url, { method: body ? 'POST' : 'GET',
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(exactCount ? { Prefer: 'count=exact' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Read-only ${path} failed with HTTP ${response.status}.`);
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error(`Expected array response from ${path}.`);
  const total = exactCount ? Number(response.headers.get('content-range')?.split('/')[1]) : null;
  return { data, total, metrics: { ms: Math.round((performance.now() - start) * 10) / 10,
    status: response.status, rows: data.length, decodedBytes: Buffer.byteLength(text) } };
}

async function measureCounts(table) {
  const start = performance.now();
  const data = [];
  let total;
  let decodedBytes = 0;
  let pages = 0;
  do {
    const page = await measure('/rest/v1/rpc/directory_trip_counts',
      { order: 'entity_id.asc', offset: String(data.length), limit: '500' },
      { p_org_id: orgFilter.slice(3), p_directory: table }, true);
    if (!Number.isSafeInteger(page.total) || page.total < 0
      || (total !== undefined && total !== page.total)
      || (page.total > data.length && page.data.length === 0)) {
      throw new Error('Incomplete trip count response.');
    }
    total = page.total;
    data.push(...page.data);
    decodedBytes += page.metrics.decodedBytes;
    pages++;
  } while (data.length < total);
  return { data, metrics: { ms: Math.round((performance.now() - start) * 10) / 10,
    status: 200, rows: data.length, decodedBytes, pages } };
}

for (const table of ['patients', 'drivers', 'employees']) {
  const runs = [];
  for (let sample = 0; sample < 3; sample++) {
    const query = { org_id: orgFilter, order: 'created_at.desc' };
    const legacy = await measure(`/rest/v1/${table}`,
      { ...query, select: table === 'employees' ? '*' : '*,trips:trips(count)' });
    const start = performance.now();
    const [list, counts] = await Promise.all([
      measure(`/rest/v1/${table}`, { ...query, select: '*' }),
      table === 'employees' ? Promise.resolve(null) : measureCounts(table),
    ]);
    const listMatches = legacy.data.length === list.data.length && legacy.data.every((old, i) => {
      const { trips: _trips, ...record } = old;
      return JSON.stringify(record) === JSON.stringify(list.data[i]);
    });
    const totals = new Map(counts?.data.map(row => [row.entity_id, Number(row.total_trips)]));
    const countsMatch = !counts || legacy.data.every(row =>
      Number(row.trips?.[0]?.count ?? 0) === (totals.get(row.id) ?? 0));
    const run = { legacy: legacy.metrics, list: list.metrics, counts: counts?.metrics ?? null,
      parallelCompleteMs: Math.round((performance.now() - start) * 10) / 10, listMatches, countsMatch };
    runs.push(run);
    console.log(JSON.stringify({ table, sample: sample + 1, ...run }));
    if (!listMatches || !countsMatch) throw new Error(`Parity failed for ${table}.`);
  }
  const median = key => runs.map(key).sort((a, b) => a - b)[1];
  report.routes[table] = { runs, mediansMs: { legacy: median(run => run.legacy.ms),
    list: median(run => run.list.ms), complete: median(run => run.parallelCompleteMs) } };
}
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
