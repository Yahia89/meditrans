import type { ErrorComponentProps } from '@tanstack/react-router';
import { isChunkLoadError } from '@/lib/chunk-errors';
import { getErrorDiagnostic } from '@/lib/error-diagnostics';

export function RouteError({ error, reset }: ErrorComponentProps) {
  const staleChunk = isChunkLoadError(error);
  const diagnostic = getErrorDiagnostic(error);
  return <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 className="text-xl font-semibold">{staleChunk ? 'This page could not load' : 'Unable to open this page'}</h1>
    <p className="text-muted-foreground">{staleChunk ? 'Check your connection and try again. If this continues, save any unfinished work and refresh to load the current version.' : 'Try again to reopen this page.'}</p>
    <p className="text-xs text-muted-foreground">Reference: {diagnostic.reference}</p>
    {!staleChunk && <button className="rounded-md border px-4 py-2" onClick={reset}>Try again</button>}
    <button className="rounded-md bg-slate-900 px-4 py-2 text-white" onClick={() => window.location.reload()}>Refresh page</button>
  </div>;
}
