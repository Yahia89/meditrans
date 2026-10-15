import { isChunkLoadError } from './chunk-errors.ts';

export type UiErrorKind = 'chunk-load' | 'render-loop' | 'update-depth' | 'render';

/** Keep locations useful to developers without retaining URLs, messages or payloads. */
export function safeStackFrames(stack: string | null | undefined): string[] {
  if (!stack) return [];
  return stack.split('\n').flatMap(line => {
    const frame = line.trim();
    if (!frame.startsWith('at ') && !/^[\w.$<>]*@(?:https?:|file:)/.test(frame)) return [];
    const name = /^(?:at )?([\w.$<>]+)/.exec(frame)?.[1] ?? 'anonymous';
    const source = /(?:https?:\/\/|file:\/\/\/|\/)[^\s)]+/.exec(frame)?.[0];
    const filename = source?.split(/[?#]/, 1)[0].split('/').at(-1);
    // The allowlist also excludes arbitrary values embedded in virtual filenames.
    const location = filename && /^[\w.-]+\.(?:[cm]?[jt]sx?)(?::\d+){0,2}$/.test(filename) ? filename : undefined;
    return [`${name}${location ? ` (${location})` : ''}`];
  }).slice(0, 40);
}

export function getErrorDiagnostic(error: unknown, componentStack?: string | null) {
  const kind: UiErrorKind = isChunkLoadError(error) ? 'chunk-load'
    : error instanceof Error && /Too many re-renders|Minified React error #301\b/.test(error.message) ? 'render-loop'
    : error instanceof Error && /Maximum update depth exceeded|Minified React error #185\b/.test(error.message) ? 'update-depth'
    : 'render';
  const frames = safeStackFrames(error instanceof Error ? error.stack : undefined);
  const components = safeStackFrames(componentStack);
  // A stable reference describes the safe source location, never the error message.
  let hash = 2166136261;
  for (const character of `${kind}:${frames.join('|')}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return { reference: `UI-${kind.toUpperCase()}-${(hash >>> 0).toString(16).toUpperCase()}`, kind, frames, components };
}
