/** Local Performance Timeline only. Names never contain user, tenant or record data. */
export type StartupMilestone =
  | "session-resolved"
  | "identity-ready"
  | "organization-ready"
  | "usable-shell"
  | "route-primary-data-ready"
  | "chart-ready";

export function markStartup(milestone: StartupMilestone) {
  if (typeof performance === "undefined") return;
  const name = `future-nemt:${milestone}`;
  // Keep one entry per milestone per document, including StrictMode mounts.
  if (performance.getEntriesByName(name, "mark").length === 0) performance.mark(name);
}
