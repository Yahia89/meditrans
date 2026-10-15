export type DirectoryPageSize = "5" | "10" | "25" | "50" | "all";
export type DirectoryViewMode = "bento" | "list";

export function readSavedPatientsView(): DirectoryViewMode {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem("patients-view-mode") === "list" ? "list" : "bento";
  } catch {
    return "bento";
  }
}

export function savePatientsView(view: DirectoryViewMode): void {
  try {
    window.localStorage.setItem("patients-view-mode", view);
  } catch {
    // A blocked browser preference store must not prevent switching views.
  }
}
export type DirectoryPresenceFilter = "all" | "online" | "away" | "offline";
export type DirectoryPresence = Exclude<DirectoryPresenceFilter, "all"> | "loading" | "unknown" | "unlinked";

export function directoryPresence(userId: string | null | undefined, status: Exclude<DirectoryPresenceFilter, "all"> | undefined, pending: boolean): DirectoryPresence {
  if (!userId) return "unlinked";
  if (status) return status;
  return pending ? "loading" : "unknown";
}

export function parseDirectoryPageSize(value: string): DirectoryPageSize {
  return value === "10" || value === "25" || value === "50" || value === "all"
    ? value
    : "5";
}

export function parseDirectoryPresenceFilter(value: string): DirectoryPresenceFilter {
  return value === "online" || value === "away" || value === "offline" ? value : "all";
}

export function directoryPagination(pageSize: DirectoryPageSize, requestedPage: number, itemCount: number) {
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(itemCount / Number(pageSize)));
  const currentPage = Math.min(totalPages, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const startIndex = pageSize === "all" ? 0 : (currentPage - 1) * Number(pageSize);
  const endIndex = pageSize === "all" ? itemCount : Math.min(itemCount, startIndex + Number(pageSize));
  return { currentPage, totalPages, startIndex, endIndex };
}

/** A failed permission check must not keep showing data from a successful cache. */
export function isDirectoryAuthorizationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? error.code : undefined;
  const status = "status" in error ? error.status : undefined;
  return status === 401 || status === 403 || code === "42501"
    || code === "PGRST301" || code === "PGRST302" || code === "PGRST303";
}

/** Publish denied access immediately so cached rows and drafts are hidden. */
export function shouldRetryDirectoryRead(failureCount: number, error: unknown, maxRetries = 3): boolean {
  return !isDirectoryAuthorizationError(error) && failureCount < maxRetries;
}
