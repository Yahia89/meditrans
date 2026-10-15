import assert from 'node:assert/strict';
import test from 'node:test';
import { getErrorDiagnostic, safeStackFrames } from './error-diagnostics.ts';

test('boundary diagnostics distinguish render loops, effect depth and failed chunks', () => {
  for (const [message, kind] of [
    ['Too many re-renders. React limits the number of renders to prevent an infinite loop.', 'render-loop'],
    ['Minified React error #301; visit https://react.dev/errors/301?args[]=private', 'render-loop'],
    ['Maximum update depth exceeded', 'update-depth'],
    ['Minified React error #185;', 'update-depth'],
    ['Failed to fetch dynamically imported module: https://example.invalid/page.js?token=private', 'chunk-load'],
    ['error loading dynamically imported module', 'chunk-load'],
    ['Synthetic unexpected render failure', 'render'],
  ]) assert.equal(getErrorDiagnostic(new Error(message)).kind, kind);
});

test('diagnostic frames and stable references exclude error messages, URLs and sensitive query values', () => {
  const error = new Error('Synthetic private patient payload or token');
  error.stack = `Error: Synthetic private patient payload or token
    at PatientsPage (https://example.invalid/src/components/patients-page.tsx?token=secret-token#private:120:9)
    at renderWithHooks (https://example.invalid/assets/react-runtime.js:900:12)
    at suspicious (https://example.invalid/assets/private%20patient.js:5:1)`;
  const diagnostic = getErrorDiagnostic(error, '\n    at PatientsPage (http://localhost:5173/src/components/patients-page.tsx:10:2)');
  assert.deepEqual(diagnostic.frames, ['PatientsPage (patients-page.tsx)', 'renderWithHooks (react-runtime.js:900:12)', 'suspicious']);
  assert.deepEqual(diagnostic.components, ['PatientsPage (patients-page.tsx:10:2)']);
  assert.match(diagnostic.reference, /^UI-RENDER-[A-F0-9]+$/);
  assert.doesNotMatch(JSON.stringify(diagnostic), /private|token|https?:|localhost|example\.invalid|payload/);
  error.message = 'A different sensitive message';
  assert.equal(getErrorDiagnostic(error).reference, diagnostic.reference);
});

test('Firefox frames, null stacks and unexpected values remain bounded and safe', () => {
  assert.deepEqual(safeStackFrames('PatientsPage@https://example.invalid/assets/patients-page.js:11:4'), ['PatientsPage (patients-page.js:11:4)']);
  assert.deepEqual(safeStackFrames(null), []);
  assert.equal(getErrorDiagnostic({ patient: 'private' }).kind, 'render');
  assert.equal(safeStackFrames(Array(100).fill('at Page (http://localhost/page.js:1:2)').join('\n')).length, 40);
});
