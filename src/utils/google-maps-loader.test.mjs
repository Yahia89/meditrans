import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
let moduleId = 0;

afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
});

async function setup() {
  const scripts = [];
  class Script extends EventTarget {
    attributes = new Map();
    id = "";
    src = "";
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    remove() {
      const index = scripts.indexOf(this);
      if (index !== -1) scripts.splice(index, 1);
    }
  }
  const document = {
    head: { appendChild(script) { scripts.push(script); } },
    createElement(tag) {
      assert.equal(tag, "script");
      return new Script();
    },
    getElementById(id) { return scripts.find((script) => script.id === id) ?? null; },
    querySelector() {
      return scripts.find((script) => script.src.includes("maps.googleapis.com/maps/api/js")) ?? null;
    },
  };
  globalThis.window = {};
  globalThis.document = document;
  const { loadGoogleMaps } = await import(`./google-maps-loader.ts?test=${++moduleId}`);
  const complete = () => {
    const maps = { DirectionsService: class {} };
    window.google = { maps };
    window.initMap();
    return maps;
  };
  return { scripts, document, loadGoogleMaps, complete };
}

test("cold loading waits for initMap, then marks the shared script ready", async () => {
  const { scripts, loadGoogleMaps, complete } = await setup();
  let settled = false;
  const loading = loadGoogleMaps("test-key").then((maps) => { settled = true; return maps; });
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].id, "script-loader");
  assert.equal(scripts[0].src, "https://maps.googleapis.com/maps/api/js?key=test-key&v=weekly&libraries=geometry,places&loading=async&callback=initMap");
  scripts[0].dispatchEvent(new Event("load"));
  await Promise.resolve();
  assert.equal(settled, false, "loading=async must wait for initialization");
  const maps = complete();
  assert.equal(await loading, maps);
  assert.equal(scripts[0].getAttribute("data-state"), "ready");
  assert.equal(window.initMap, undefined);
});

test("reuses a loaded SDK without a key or a new script", async () => {
  const { scripts, loadGoogleMaps } = await setup();
  const maps = { DirectionsService: class {} };
  window.google = { maps };
  assert.equal(await loadGoogleMaps(), maps);
  assert.equal(scripts.length, 0);
});

test("concurrent cold requests share one initialization promise", async () => {
  const { scripts, loadGoogleMaps, complete } = await setup();
  const first = loadGoogleMaps("test-key");
  const second = loadGoogleMaps("test-key");
  assert.equal(first, second);
  assert.equal(scripts.length, 1);
  complete();
  await Promise.all([first, second]);
});

test("joins an existing in-flight script and preserves its callback", async () => {
  const { scripts, document, loadGoogleMaps, complete } = await setup();
  const script = document.createElement("script");
  script.id = "script-loader";
  script.src = "https://maps.googleapis.com/maps/api/js?key=test-key&libraries=places&loading=async&callback=initMap";
  document.head.appendChild(script);
  let originalCalls = 0;
  const original = () => { originalCalls++; script.setAttribute("data-state", "ready"); };
  window.initMap = original;
  window.google = { maps: {} };
  const loading = loadGoogleMaps();
  assert.equal(scripts.length, 1);
  const maps = complete();
  assert.equal(await loading, maps);
  assert.equal(originalCalls, 1);
  assert.equal(window.initMap, original);
  assert.equal(scripts[0], script);
});

test("keeps a callback installed by another component during initialization", async () => {
  const { loadGoogleMaps, complete } = await setup();
  const loading = loadGoogleMaps("test-key");
  const loaderCallback = window.initMap;
  let otherCalls = 0;
  const otherCallback = () => { loaderCallback(); otherCalls++; };
  window.initMap = otherCallback;
  complete();
  await loading;
  assert.equal(otherCalls, 1);
  assert.equal(window.initMap, otherCallback);
});

test("network failure removes only the injected script and permits retry", async () => {
  const { scripts, loadGoogleMaps, complete } = await setup();
  const loading = loadGoogleMaps("test-key");
  const failedScript = scripts[0];
  const rejected = assert.rejects(loading, /could not be loaded/);
  failedScript.dispatchEvent(new Event("error"));
  await rejected;
  assert.equal(scripts.length, 0);
  assert.equal(window.initMap, undefined);
  const retry = loadGoogleMaps("test-key");
  assert.notEqual(scripts[0], failedScript);
  complete();
  await retry;
});

test("timeout cleans up an injected script and permits retry", async () => {
  const { scripts, loadGoogleMaps, complete } = await setup();
  await assert.rejects(loadGoogleMaps("test-key", 5), /timed out/);
  assert.equal(scripts.length, 0);
  assert.equal(window.initMap, undefined);
  const retry = loadGoogleMaps("test-key");
  complete();
  await retry;
});

test("an existing script survives timeout and can finish on a later attempt", async () => {
  const { scripts, document, loadGoogleMaps, complete } = await setup();
  const script = document.createElement("script");
  script.id = "script-loader";
  document.head.appendChild(script);
  let calls = 0;
  const original = () => { calls++; };
  window.initMap = original;
  await assert.rejects(loadGoogleMaps("test-key", 5), /timed out/);
  assert.equal(scripts[0], script);
  assert.equal(script.getAttribute("data-state"), null);
  assert.equal(window.initMap, original);
  const retry = loadGoogleMaps("test-key");
  complete();
  await retry;
  assert.equal(calls, 1);
  assert.equal(scripts.length, 1);
});

test("an existing script survives network failure with its handlers intact", async () => {
  const { scripts, document, loadGoogleMaps } = await setup();
  const script = document.createElement("script");
  script.id = "script-loader";
  document.head.appendChild(script);
  let errors = 0;
  script.addEventListener("error", () => { errors++; script.setAttribute("data-state", "error"); });
  const original = () => {};
  window.initMap = original;
  const loading = loadGoogleMaps("test-key");
  const rejected = assert.rejects(loading, /could not be loaded/);
  script.dispatchEvent(new Event("error"));
  await rejected;
  assert.equal(scripts[0], script);
  assert.equal(errors, 1);
  assert.equal(window.initMap, original);
  await assert.rejects(loadGoogleMaps("test-key"), /existing.*failed/);
});

test("fails without an API key and does not inject a script", async () => {
  const { scripts, loadGoogleMaps } = await setup();
  await assert.rejects(loadGoogleMaps(), /API key/);
  assert.equal(scripts.length, 0);
});

test("fails outside the browser without leaving a pending request", async () => {
  const { loadGoogleMaps } = await setup();
  delete globalThis.window;
  delete globalThis.document;
  await assert.rejects(loadGoogleMaps("test-key"), /requires a browser/);
});
