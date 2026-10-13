import { useCallback } from 'react';
import { useRouter, useSearch, type AnyRouter } from '@tanstack/react-router';
import { applySearchPatch, stringifyLegacySearch, type AppSearch, type RouteSearchKey, type SearchPatch } from './search';

type Setter<T> = (value: T | null | ((previous: T | null) => T | null)) => Promise<URLSearchParams>;
interface Parser<T> { parse?: (value: string) => T | null; serialize?: (value: T) => string; defaultValue?: T }
interface PendingUpdate { patch: SearchPatch; push: boolean; resolve: ((value: URLSearchParams) => void)[]; reject: ((reason: unknown) => void)[] }
const pendingUpdates = new WeakMap<AnyRouter, PendingUpdate>();

// Several existing callbacks update a detail ID, origin and page together. Batch
// those synchronous setters into one Router navigation/history entry.
function enqueue(router: AnyRouter, key: RouteSearchKey, value: string | null): Promise<URLSearchParams> {
  let pending = pendingUpdates.get(router);
  if (!pending) {
    pending = { patch: {}, push: false, resolve: [], reject: [] };
    pendingUpdates.set(router, pending);
    queueMicrotask(() => {
      const update = pendingUpdates.get(router)!;
      pendingUpdates.delete(router);
      const search = applySearchPatch(router.latestLocation.search as AppSearch, update.patch);
      void router.navigate({ to: '/', search, hash: previous => previous ?? "", replace: !update.push, resetScroll: update.push }).then(() => {
        const parameters = new URLSearchParams(stringifyLegacySearch(search));
        update.resolve.forEach(resolve => resolve(parameters));
      }).catch(error => update.reject.forEach(reject => reject(error)));
    });
  }
  pending.patch[key] = value;
  if (key === 'page') pending.push = true;
  return new Promise((resolve, reject) => { pending!.resolve.push(resolve); pending!.reject.push(reject); });
}
export function useRouteQueryState<T>(key: RouteSearchKey, options: Parser<T> & { defaultValue: T }): [T, Setter<T>];
export function useRouteQueryState<T = string>(key: RouteSearchKey, options?: Parser<T>): [T | null, Setter<T>];
export function useRouteQueryState<T = string>(key: RouteSearchKey, options: Parser<T> = {}): [T | null, Setter<T>] {
  const router = useRouter();
  const raw = useSearch({ from: '/', select: search => search[key] });
  const { parse, serialize, defaultValue } = options;
  const parsed = typeof raw === 'string' ? (parse ? parse(raw) : raw as T) : null;
  const value = parsed ?? defaultValue ?? null;
  const setter = useCallback<Setter<T>>(next => {
    const resolved = typeof next === 'function' ? (next as (previous: T | null) => T | null)(value) : next;
    return enqueue(router, key, resolved === null ? null : serialize ? serialize(resolved) : String(resolved));
  }, [router, key, serialize, value]);
  return [value, setter];
}
