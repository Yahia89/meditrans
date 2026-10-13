import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { preloadable } from './preloaded-component.ts';

test('preloading deduplicates imports and makes the first component render synchronous', async () => {
  let calls = 0;
  let resolve;
  const module = new Promise(done => { resolve = done; });
  const load = preloadable(() => { calls++; return module; });
  assert.equal(calls, 0, 'creating an optional component must not download it');
  const first = load();
  assert.equal(load(), first, 'concurrent route and intent preloads share one request');
  resolve({ default: ({ label }) => React.createElement('p', null, label) });
  await first;
  const markup = renderToStaticMarkup(React.createElement(React.Suspense,
    { fallback: React.createElement('span', null, 'PENDING') },
    React.createElement(load.Component, { label: 'Ready immediately' })));
  assert.match(markup, /Ready immediately/);
  assert.doesNotMatch(markup, /PENDING|Switched to client rendering/);
  assert.equal(calls, 1);
});

test('preload errors remain observable by the route error boundary', async () => {
  const failure = new Error('Synthetic chunk unavailable');
  let calls = 0;
  const load = preloadable(() => {
    calls++;
    return calls === 1 ? Promise.reject(failure) : Promise.resolve({ default: () => React.createElement('p', null, 'Recovered') });
  });
  await assert.rejects(load(), error => error === failure);
  await load();
  assert.equal(calls, 2, 'an explicit retry can re-request a failed preload');
  assert.match(renderToStaticMarkup(React.createElement(load.Component)), /Recovered/);
});
