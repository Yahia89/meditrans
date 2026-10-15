/** Only the initial workspace module waits here; page code loads inside its shell. */
export function WorkspacePending() {
  return (
    <div role="status" aria-busy="true" className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
      Opening workspace…
    </div>
  );
}
