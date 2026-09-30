// Usage: node tests/web-workflow/bootstrap.mjs
// This only bootstraps an isolated browser and network fixtures. Drive UI with Argent.
import { chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { createWorkflowFixture, installWorkflowFixtures, ids } from "./fixtures.mjs";

let state = createWorkflowFixture();
const profile = await mkdtemp(path.join(tmpdir(), "meditrans-web-workflow-qa-"));
const context = await chromium.launchPersistentContext(profile, {
  channel: "chrome", headless: false, viewport: { width: 1440, height: 1000 },
  serviceWorkers: "block", args: ["--remote-debugging-port=9222", "--no-first-run", "--no-default-browser-check"],
});
await installWorkflowFixtures(context, () => state);
const errors = [];
const listen = page => {
  page.on("pageerror", error => errors.push(error.message));
};
context.pages().forEach(listen);
context.on("page", listen);

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const url = new URL(req.url, "http://127.0.0.1:9223");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const input = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  if (req.method === "POST" && url.pathname === "/reset") { state = createWorkflowFixture(input); errors.length = 0; }
  if (req.method === "POST" && url.pathname === "/control") {
    if (input.role) state.role = input.role;
    if (input.status) state.trip.status = input.status;
    if (input.nextRpcError) state.nextRpcError = input.nextRpcError;
    if (input.clearRequests) state.requests.length = 0;
  }
  if (req.method === "POST" && url.pathname === "/viewport") await context.pages()[0].setViewportSize({ width: input.width, height: input.height });
  if (url.pathname === "/requests") return res.end(JSON.stringify(state.requests.map(entry => ({ ...entry, body: entry.body?.p_signature_data ? { ...entry.body, p_signature_data: `[synthetic PNG: ${entry.body.p_signature_data.length} chars]` } : entry.body })), null, 2));
  const requestCounts = {};
  for (const request of state.requests) {
    const key = `${request.method} ${request.path}`;
    requestCounts[key] = (requestCounts[key] || 0) + 1;
  }
  res.end(JSON.stringify({ synthetic: true, role: state.role, status: state.trip.status, tripId: ids.trip, history: state.history, signature: { present: !!state.trip.signature_data, signer: state.trip.signed_by_name, declined: state.trip.signature_declined, reason: state.trip.signature_declined_reason }, requestCounts, errors, blockedRequests: state.blockedRequests }, null, 2));
});
server.listen(9223, "127.0.0.1", () => console.log(JSON.stringify({ ready: true, cdp: "chromium-cdp-9222", control: "http://127.0.0.1:9223", tripUrl: `http://localhost:5173/?page=trip-details&tripId=${ids.trip}`, profile })));
const cleanup = async () => { server.close(); await context.close(); await rm(profile, { recursive: true, force: true }); process.exit(0); };
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
