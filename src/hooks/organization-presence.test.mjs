import assert from "node:assert/strict";
import test from "node:test";
import { derivePresenceStatus } from "./organization-presence.ts";

const now = Date.parse("2026-10-14T12:00:00Z");

test("recent online and away heartbeats preserve presence", () => {
  assert.equal(derivePresenceStatus("online", "2026-10-14T11:59:30Z", now), "online");
  assert.equal(derivePresenceStatus("away", "2026-10-14T11:58:00Z", now), "away");
});

test("identical heartbeat data becomes offline as the clock advances", () => {
  const heartbeat = "2026-10-14T11:59:30Z";
  assert.equal(derivePresenceStatus("online", heartbeat, now), "online");
  assert.equal(derivePresenceStatus("online", heartbeat, now + 120_000), "offline");
  assert.equal(derivePresenceStatus("away", heartbeat, now + 120_000), "offline");
});

test("missing heartbeats preserve valid server status while invalid status or timestamps are offline", () => {
  assert.equal(derivePresenceStatus("online", null, now), "online");
  assert.equal(derivePresenceStatus("away", null, now), "away");
  assert.equal(derivePresenceStatus(null, null, now), "offline");
  assert.equal(derivePresenceStatus("unknown", null, now), "offline");
  assert.equal(derivePresenceStatus("online", "invalid", now), "offline");
  assert.equal(derivePresenceStatus("offline", "2026-10-14T12:00:00Z", now), "offline");
});
