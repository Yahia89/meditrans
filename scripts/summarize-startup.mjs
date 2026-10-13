// Summarize sanitized repeated runs; never reads HAR, sessions or API bodies.
// Usage: node scripts/summarize-startup.mjs [measurement-directory] [before-prefix] [after-prefix]
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [directory = 'reports/startup/measurements', before = 'comparison-baseline', after = 'comparison-final'] = process.argv.slice(2);
const values = readdirSync(directory).filter(file => file.endsWith('.json'))
  .map(file => JSON.parse(readFileSync(resolve(directory, file), 'utf8')));
const stats = values => {
  const sorted = values.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  const round = value => Math.round(value * 10) / 10;
  return { median: round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2), min: round(sorted[0]), max: round(sorted.at(-1)) };
};
const summary = {};
for (const prefix of [before, after]) for (const cache of ['cold', 'warm']) {
  const runs = values.filter(run => run.label?.startsWith(`${prefix}-${cache}-`));
  summary[`${prefix}:${cache}`] = {
    runs: runs.length,
    labels: runs.map(run => run.label),
    shellMs: stats(runs.map(run => run.marks?.dashboardShellReadyMs)),
    dashboardDataMs: stats(runs.map(run => run.marks?.dashboardDataReadyMs)),
    loginMs: stats(runs.map(run => run.marks?.loginFormReadyMs)),
    routeReadyMs: stats(runs.map(run => run.marks?.customReadyMs)),
    fcpMs: stats(runs.map(run => run.paint?.fcpMs)),
    lcpMs: stats(runs.map(run => run.paint?.lcpMs)),
    cls: stats(runs.map(run => run.paint?.cls * 1000)), // milli-CLS preserves precision
    requests: stats(runs.map(run => run.requests.length)),
    apiExcludingPreflight: stats(runs.map(run => run.requests.filter(request => /^\/(rest|auth)\/v1\//.test(request.path) && request.method !== 'OPTIONS').length)),
    networkBytes: stats(runs.map(run => run.totals.networkEncodedBytes)),
    scriptNetworkBytes: stats(runs.map(run => run.requests.filter(request => request.type === 'Script').reduce((sum, request) => sum + (request.encodedDataLength || 0), 0))),
    longTasks: stats(runs.map(run => run.totals.longTaskCount)),
    pageErrors: runs.reduce((sum, run) => sum + run.totals.pageErrors, 0),
    consoleErrors: runs.reduce((sum, run) => sum + run.totals.consoleErrors, 0),
  };
}
console.log(JSON.stringify(summary, null, 2));
