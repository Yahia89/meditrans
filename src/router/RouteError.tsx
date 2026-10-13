import type { ErrorComponentProps } from '@tanstack/react-router';
import { isChunkLoadError } from '@/lib/chunk-errors';

export function RouteError({ error }: ErrorComponentProps) {
  const staleChunk = isChunkLoadError(error);
  return <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 className="text-xl font-semibold">{staleChunk ? 'A newer version is available' : 'Unable to open this page'}</h1>
    <p className="text-muted-foreground">{staleChunk ? 'Save or copy any unfinished work before refreshing to load the current version.' : 'Please refresh to try loading this page again.'}</p>
    <button className="rounded-md bg-slate-900 px-4 py-2 text-white" onClick={() => window.location.reload()}>Refresh page</button>
  </div>;
}
