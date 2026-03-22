import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query using useSyncExternalStore.
 * No useEffect needed — this is the React-recommended way to sync with browser APIs.
 *
 * @example
 * const isMobile = useMediaQuery("(max-width: 767px)");
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    // SSR fallback (always false)
    () => false,
  );
}
