/**
 * Passive, sanitized startup measurements for production-preview browser QA.
 *
 *   node scripts/benchmark-startup.mjs --output test-results/startup-benchmark
 *
 * Drive all application navigation and login through Argent (chromium-cdp-9222).
 * This process does not authenticate, navigate, click, or intercept app traffic.
 *
 * Loopback-only controller (http://127.0.0.1:9223):
 *   POST /arm      { label, scenario?: "returning-session", cache: "cold"|"warm", scope: "navigation"|"interaction",
 *                    readySelector?: CSS selector }
 *   GET  /result   Current sanitized measurement, without writing a file.
 *   POST /save     Snapshot to <output>/<label>.json and append run to summary.
 *   POST /viewport { width, height }
 *   GET  /summary  Summary of saved runs in this process.
 *   POST /stop     Close isolated Chrome and remove its temporary profile.
 *
 * Example: arm cold run, use Argent open-url, await expected UI, then save.
 * Cold clears the HTTP cache, but preserves auth storage. Warm retains it.
 * Navigation measurements begin at document navigationStart; interaction runs
 * begin when armed. Readiness is observed in the rendered DOM, not networkidle.
 * Observe the same fixed post-ready interval for each comparison before saving.
 *
 * Privacy: request query strings, headers, bodies, cookies, storage, DOM text,
 * error messages/stacks, screenshots and traces are never exported. Static
 * assets, API table/RPC names, and known app route names are allowlisted; other
 * paths are collapsed. Auth only stays in a temporary isolated browser profile.
 */
import { chromium } from '@playwright/test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const output = path.resolve(option('--output', 'test-results/startup-benchmark'));
const cdpPort = Number(option('--cdp-port', '9222'));
const controlPort = Number(option('--control-port', '9223'));
if (![cdpPort, controlPort].every(port => Number.isInteger(port) && port > 1024 && port < 65536) || cdpPort === controlPort) {
  throw new Error('Provide distinct ports between 1025 and 65535.');
}
const knownRoutes = new Set([
  '/', '/dashboard', '/patients', '/patient-details', '/drivers', '/driver-details',
  '/employees', '/employee-details', '/upload', '/review-import', '/account-settings',
  '/billing-plans', '/notifications', '/founder-admin', '/trips', '/trip-details',
  '/credits', '/broker-integrations', '/driving-history', '/billing', '/live-operations',
  '/companies', '/fee-schedule', '/trips-summary', '/sts-inspection', '/company',
  '/login', '/auth/callback', '/reset-password', '/favicon.ico', '/logo.png',
]);
function sanitizedPath(rawUrl) {
  try {
    const pathname = new URL(rawUrl).pathname;
    if (/^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname)) return pathname;
    const api = pathname.match(/^\/(rest\/v1\/(?:rpc\/)?|auth\/v1\/)([a-zA-Z0-9_-]+)(?:\/|$)/);
    if (api) return `/${api[1]}${api[2]}`;
    if (knownRoutes.has(pathname)) return pathname;
    if (pathname.startsWith('/storage/v1/')) return '/storage/v1/[redacted]';
    return '/[other]';
  } catch { return '/[non-http]'; }
}
const round = value => Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
let currentRun = { label: 'unarmed', scenario: 'returning-session', cache: 'warm', scope: 'navigation', readySelector: null };
let armedAt = Date.now();
let network = new Map();
let pageErrors = 0;
let consoleErrors = 0;
const savedRuns = [];
const profile = await mkdtemp(path.join(tmpdir(), 'meditrans-startup-benchmark-'));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome', headless: false, viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    args: [`--remote-debugging-port=${cdpPort}`, '--remote-debugging-address=127.0.0.1', '--no-first-run', '--no-default-browser-check'],
  });
} catch (error) {
  await rm(profile, { recursive: true, force: true });
  throw error;
}

// Executed before app JS on every document. Do not collect element content.
function installMeasurement() {
  const KEY = '__futureNemtBenchmarkConfig';
  let stored;
  try { stored = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { /* opaque origin */ }
  let config = stored || { scope: 'navigation' };
  let startedAt = 0;
  let armedHref = null;
  let customWasVisible = false;
  let marks = {};
  let lcp = null;
  let cls = 0;
  let clsWindow = 0;
  let clsWindowStart = 0;
  let clsWindowEnd = 0;
  let longTasks = [];
  let interactions = new Map();
  const supported = PerformanceObserver.supportedEntryTypes || [];
  const observe = (type, callback, options = {}) => {
    if (!supported.includes(type)) return;
    new PerformanceObserver(list => list.getEntries().forEach(callback)).observe({ type, buffered: true, ...options });
  };
  observe('largest-contentful-paint', entry => { if (entry.startTime >= startedAt) lcp = entry.startTime - startedAt; });
  observe('layout-shift', entry => {
    if (entry.startTime < startedAt || entry.hadRecentInput) return;
    if (entry.startTime - clsWindowEnd > 1000 || entry.startTime - clsWindowStart > 5000) {
      clsWindow = 0; clsWindowStart = entry.startTime;
    }
    clsWindow += entry.value; clsWindowEnd = entry.startTime; cls = Math.max(cls, clsWindow);
  });
  observe('longtask', entry => {
    if (entry.startTime >= startedAt) longTasks.push({ startMs: entry.startTime - startedAt, durationMs: entry.duration });
  });
  observe('event', entry => {
    if (entry.startTime >= startedAt && entry.interactionId) {
      interactions.set(entry.interactionId, Math.max(interactions.get(entry.interactionId) || 0, entry.duration));
    }
  }, { durationThreshold: 16 });
  function visible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
      rect.top < innerHeight && rect.left < innerWidth && style.visibility !== 'hidden' && style.display !== 'none';
  }
  function mark(name, condition) {
    if (condition && marks[name] === undefined) marks[name] = performance.now() - startedAt;
  }
  function checkReadiness() {
    if (armedHref !== null && location.href === armedHref) {
      let appeared = false;
      if (config.readySelector && !customWasVisible) {
        try { appeared = visible(document.querySelector(config.readySelector)); } catch { /* invalid CSS */ }
      }
      if (!appeared) return;
    }
    armedHref = null;
    mark('loginFormReadyMs', visible(document.querySelector('input[type="password"]')));
    const activity = document.querySelector('#dashboard-activity');
    mark('dashboardShellReadyMs', visible(activity));
    const chart = activity?.querySelector('.recharts-surface');
    mark('chartReadyMs', visible(chart));
    // Match only known product copy and export only booleans/timing; no text.
    const paragraphs = [...(activity?.querySelectorAll('p') || [])];
    const empty = paragraphs.find(element => element.textContent?.trim() === 'No trip data for this period');
    const error = paragraphs.find(element => element.textContent?.trim() === 'Unable to load fleet performance. Please try again.');
    mark('chartEmptyReadyMs', visible(empty));
    mark('chartErrorReadyMs', visible(error));
    mark('dashboardDataReadyMs', visible(chart) || visible(empty));
    if (config.readySelector) {
      try { mark('customReadyMs', visible(document.querySelector(config.readySelector))); } catch { /* invalid CSS */ }
    }
  }
  let pending = false;
  const checkSoon = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; checkReadiness(); });
  };
  new MutationObserver(checkSoon).observe(document, { subtree: true, childList: true, attributes: true });
  document.addEventListener('DOMContentLoaded', checkSoon);
  addEventListener('resize', checkSoon);
  // A rendered element can gain dimensions without a DOM mutation.
  const interval = setInterval(checkReadiness, 100);
  setTimeout(() => clearInterval(interval), 120000);
  window.__futureNemtBenchmark = {
    reset(next) {
      config = next; startedAt = performance.now(); armedHref = location.href;
      try { customWasVisible = !!next.readySelector && visible(document.querySelector(next.readySelector)); } catch { customWasVisible = false; }
      marks = {}; lcp = null; cls = 0;
      clsWindow = 0; clsWindowStart = 0; clsWindowEnd = 0; longTasks = []; interactions = new Map();
      performance.clearResourceTimings();
      try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* opaque origin */ }
      // Deliberately wait for the next action/mutation; do not mark the previous screen ready.
    },
    snapshot() {
      checkReadiness();
      const navigation = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      return {
        durationMs: performance.now() - startedAt,
        scope: config.scope || 'navigation',
        marks,
        appMarks: Object.fromEntries(performance.getEntriesByType('mark')
          .filter(entry => /^future-nemt:(session-resolved|identity-ready|organization-ready|usable-shell|route-primary-data-ready|chart-ready)$/.test(entry.name))
          .map(entry => [entry.name, entry.startTime])),
        paint: { fcpMs: startedAt === 0 ? fcp?.startTime ?? null : null, lcpMs: lcp, cls },
        longTasks,
        // Diagnostic maximum, not a Web Vitals INP claim (no interaction => null).
        interactionCount: interactions.size,
        maximumObservedInteractionMs: interactions.size ? Math.max(...interactions.values()) : null,
        observerSupport: { lcp: supported.includes('largest-contentful-paint'), cls: supported.includes('layout-shift'), longtask: supported.includes('longtask'), event: supported.includes('event') },
        navigation: startedAt === 0 && navigation ? {
          type: navigation.type, ttfbMs: navigation.responseStart,
          domContentLoadedMs: navigation.domContentLoadedEventEnd, loadMs: navigation.loadEventEnd,
          transferSize: navigation.transferSize, encodedBodySize: navigation.encodedBodySize, decodedBodySize: navigation.decodedBodySize,
        } : null,
        resources: performance.getEntriesByType('resource').filter(entry => entry.startTime >= startedAt).map(entry => ({
          name: entry.name, initiatorType: entry.initiatorType, startMs: entry.startTime - startedAt,
          durationMs: entry.duration, transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize,
        })),
        viewport: { width: innerWidth, height: innerHeight },
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    },
  };
}
await context.addInitScript(installMeasurement);
const sessions = new Map();
async function attach(page) {
  page.on('pageerror', () => { pageErrors += 1; });
  page.on('console', message => { if (message.type() === 'error') consoleErrors += 1; });
  const session = await context.newCDPSession(page);
  sessions.set(page, session);
  await session.send('Network.enable');
  session.on('Network.requestWillBeSent', event => {
    const previous = network.get(event.requestId);
    // Redirect source bodies and locations are not retained.
    network.set(event.requestId, {
      path: sanitizedPath(event.request.url), method: event.request.method,
      type: event.type, startMs: round(event.wallTime * 1000 - armedAt),
      monotonicStart: event.timestamp, redirects: (previous?.redirects || 0) + (event.redirectResponse ? 1 : 0),
    });
  });
  session.on('Network.responseReceived', event => {
    const request = network.get(event.requestId);
    if (request) Object.assign(request, {
      status: event.response.status, mimeType: event.response.mimeType,
      fromDiskCache: !!event.response.fromDiskCache, fromServiceWorker: !!event.response.fromServiceWorker,
      responseMs: round((event.timestamp - request.monotonicStart) * 1000),
    });
  });
  session.on('Network.requestServedFromCache', event => {
    const request = network.get(event.requestId); if (request) request.servedFromCache = true;
  });
  session.on('Network.loadingFinished', event => {
    const request = network.get(event.requestId);
    if (request) Object.assign(request, { durationMs: round((event.timestamp - request.monotonicStart) * 1000), encodedDataLength: event.encodedDataLength, finished: true });
  });
  session.on('Network.loadingFailed', event => {
    const request = network.get(event.requestId);
    if (request) Object.assign(request, { durationMs: round((event.timestamp - request.monotonicStart) * 1000), failed: true, cancelled: !!event.canceled });
  });
  // The original about:blank page was created before addInitScript.
  await page.evaluate(installMeasurement);
}
await Promise.all(context.pages().map(attach));
context.on('page', page => { attach(page).catch(() => { pageErrors += 1; }); });
const activePage = () => context.pages().filter(page => !page.isClosed()).at(-1);

async function result() {
  const page = activePage();
  const measurement = await page.evaluate(() => window.__futureNemtBenchmark?.snapshot() || null);
  const requests = [...network.values()].map(({ monotonicStart: _internal, ...entry }) => entry);
  const requestCounts = {};
  for (const request of requests) {
    const key = `${request.method} ${request.path}`;
    requestCounts[key] = (requestCounts[key] || 0) + 1;
  }
  const resources = (measurement?.resources || []).map(({ name, ...entry }) => ({ path: sanitizedPath(name), ...entry }));
  const sum = (items, key) => items.reduce((total, item) => total + (item[key] || 0), 0);
  return {
    schemaVersion: 1, label: currentRun.label, scenario: currentRun.scenario, cache: currentRun.cache, scope: currentRun.scope,
    capturedAt: new Date().toISOString(), productionBuildExpected: true,
    evidence: 'Real Chromium observations; local preview asset transfer is not hosted compressed transfer.',
    notes: ['HTTP cache cold does not clear authentication or OS/DNS/TLS caches.', 'Readiness uses visible rendered UI; chart empty and error states are distinct.', 'LCP is the last observed candidate at snapshot time. Interaction maximum is diagnostic, not INP. Long-task excess over 50 ms is diagnostic, not Lighthouse TBT.', 'Cross-origin Resource Timing bytes may be zero without Timing-Allow-Origin; CDP transfer includes native network evidence.', 'No request query strings, headers, bodies, credentials, screenshots, DOM text, or error messages are exported.', 'Repeated endpoint counts are not proof of duplicate logical requests: differing queries and RPC parameters are deliberately omitted.'],
    ...measurement,
    resources,
    totals: {
      requests: requests.length,
      apiRequests: requests.filter(request => /^\/(rest|auth)\/v1\//.test(request.path)).length,
      repeatedEndpointRequests: Object.values(requestCounts).reduce((total, count) => total + Math.max(0, count - 1), 0),
      networkEncodedBytes: sum(requests, 'encodedDataLength'),
      resourceTransferredBytes: sum(resources, 'transferSize'),
      resourceEncodedBytes: sum(resources, 'encodedBodySize'),
      scriptEncodedBytes: sum(resources.filter(entry => entry.initiatorType === 'script' || /\.m?js$/.test(entry.path)), 'encodedBodySize'),
      networkScriptEncodedBytes: sum(requests.filter(entry => entry.type === 'Script'), 'encodedDataLength'),
      longTaskCount: measurement?.longTasks.length || 0,
      longTaskDurationMs: round(sum(measurement?.longTasks || [], 'durationMs')),
      longTaskExcessOver50Ms: round((measurement?.longTasks || []).reduce((total, entry) => total + Math.max(0, entry.durationMs - 50), 0)),
      pageErrors, consoleErrors,
    },
    requestCounts, requests,
  };
}
function summarize() {
  const groups = {};
  const median = values => {
    const valid = values.filter(value => typeof value === 'number').sort((a, b) => a - b);
    if (!valid.length) return null;
    const center = Math.floor(valid.length / 2);
    return round(valid.length % 2 ? valid[center] : (valid[center - 1] + valid[center]) / 2);
  };
  for (const run of savedRuns) (groups[`${run.scenario}:${run.scope}:${run.cache}`] ||= []).push(run);
  return Object.fromEntries(Object.entries(groups).map(([key, runs]) => [key, {
    runs: runs.length, labels: runs.map(run => run.label),
    medianFcpMs: median(runs.map(run => run.paint?.fcpMs)),
    medianLcpMs: median(runs.map(run => run.paint?.lcpMs)),
    medianDashboardDataReadyMs: median(runs.map(run => run.marks?.dashboardDataReadyMs)),
    medianChartReadyMs: median(runs.map(run => run.marks?.chartReadyMs)),
    medianCustomReadyMs: median(runs.map(run => run.marks?.customReadyMs)),
    medianRequests: median(runs.map(run => run.totals.requests)),
    medianNetworkEncodedBytes: median(runs.map(run => run.totals.networkEncodedBytes)),
    medianLongTaskDurationMs: median(runs.map(run => run.totals.longTaskDurationMs)),
  }]));
}
let stopping = false;
async function cleanup() {
  if (stopping) return;
  stopping = true;
  server.close();
  await context.close();
  await rm(profile, { recursive: true, force: true });
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  // Reject browser-origin cross-site calls to the local controller.
  if (req.headers.origin || req.headers['sec-fetch-site'] === 'cross-site') {
    res.writeHead(403); return res.end(JSON.stringify({ error: 'Controller accepts local CLI requests only.' }));
  }
  try {
    const url = new URL(req.url, `http://127.0.0.1:${controlPort}`);
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8192) throw new Error('Request too large.');
      chunks.push(chunk);
    }
    const input = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    if (req.method === 'GET' && url.pathname === '/result') return res.end(JSON.stringify(await result(), null, 2));
    if (req.method === 'GET' && url.pathname === '/summary') return res.end(JSON.stringify(summarize(), null, 2));
    if (req.method !== 'POST') { res.writeHead(404); return res.end('{}'); }
    if (url.pathname === '/arm') {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(input.label || '')) throw new Error('Use a non-sensitive alphanumeric run label.');
      if (input.scenario && !/^[a-zA-Z0-9_-]{1,100}$/.test(input.scenario)) throw new Error('Invalid scenario.');
      if (!['cold', 'warm'].includes(input.cache)) throw new Error('cache must be cold or warm.');
      if (!['navigation', 'interaction'].includes(input.scope || 'navigation')) throw new Error('scope must be navigation or interaction.');
      if (input.readySelector && (typeof input.readySelector !== 'string' || input.readySelector.length > 500)) throw new Error('Invalid readySelector.');
      const page = activePage();
      if (input.cache === 'cold') await sessions.get(page).send('Network.clearBrowserCache');
      currentRun = { label: input.label, scenario: input.scenario || 'returning-session', cache: input.cache, scope: input.scope || 'navigation', readySelector: input.readySelector || null };
      await page.evaluate(config => window.__futureNemtBenchmark.reset(config), currentRun);
      network = new Map(); pageErrors = 0; consoleErrors = 0; armedAt = Date.now();
      return res.end(JSON.stringify({ armed: true, ...currentRun, next: 'Use Argent to navigate or perform the intended UI action, wait for visible readiness, then POST /save.' }));
    }
    if (url.pathname === '/save') {
      if (currentRun.label === 'unarmed') throw new Error('Arm the run before saving.');
      const snapshot = await result();
      await mkdir(output, { recursive: true });
      await writeFile(path.join(output, `${currentRun.label}.json`), `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
      const index = savedRuns.findIndex(run => run.label === snapshot.label);
      if (index === -1) savedRuns.push(snapshot); else savedRuns[index] = snapshot;
      await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(summarize(), null, 2)}\n`, { mode: 0o600 });
      return res.end(JSON.stringify({ saved: true, file: path.join(output, `${currentRun.label}.json`), marks: snapshot.marks, totals: snapshot.totals }));
    }
    if (url.pathname === '/viewport') {
      if (![input.width, input.height].every(value => Number.isInteger(value) && value >= 300 && value <= 3000)) throw new Error('Invalid viewport.');
      await activePage().setViewportSize({ width: input.width, height: input.height });
      return res.end(JSON.stringify({ changed: true }));
    }
    if (url.pathname === '/stop') {
      res.end(JSON.stringify({ stopped: true }));
      await cleanup();
      return;
    }
    res.writeHead(404); res.end('{}');
  } catch (error) {
    // App/CDP errors can contain private URLs; never echo their messages.
    res.writeHead(400); res.end(JSON.stringify({ error: 'Controller action failed. Check request shape and browser readiness.' }));
  }
});
server.on('error', async () => { await cleanup(); process.exitCode = 1; });
server.listen(controlPort, '127.0.0.1', () => console.log(JSON.stringify({
  ready: true, cdp: `chromium-cdp-${cdpPort}`, controller: `http://127.0.0.1:${controlPort}`, output,
  navigation: 'Use Argent open-url. Login through Argent; no credentials belong in this script.',
})));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { cleanup().finally(() => { process.exitCode = 0; }); });
