import { pages, type Page } from '../lib/pages.ts';

export type SearchValue = string | string[] | undefined;
export interface AppSearch extends Record<string, SearchValue> {
  page: Page;
  id?: string;
  driverId?: string;
  employeeId?: string;
  tripId?: string;
  modal?: 'create' | 'edit' | 'discharge';
  from?: Page;
  section?: string;
  date?: string;
  upload_id?: string;
  mode?: string;
  token?: string;
}
export const routeSearchKeys = ['page', 'id', 'driverId', 'employeeId', 'tripId', 'modal', 'from', 'section', 'date', 'upload_id', 'mode', 'token'] as const;
export type RouteSearchKey = typeof routeSearchKeys[number];
export const isPage = (value: unknown): value is Page => typeof value === 'string' && pages.includes(value as Page);

// Keep legacy URLs string based, including token/reset parameters and repeated
// unmigrated filters. Router's default JSON parser would change their types.
export function parseLegacySearch(search: string): Record<string, SearchValue> {
  const result: Record<string, SearchValue> = {};
  const parameters = new URLSearchParams(search);
  for (const key of new Set(parameters.keys())) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const values = parameters.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }
  return result;
}
export function stringifyLegacySearch(search: Record<string, unknown>): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;
    for (const item of Array.isArray(value) ? value : [value]) parameters.append(key, String(item));
  }
  const query = parameters.toString();
  return query ? `?${query}` : '';
}
export function validateAppSearch(input: Record<string, unknown>): AppSearch {
  const result: Record<string, SearchValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (typeof value === 'string' || (Array.isArray(value) && value.every(item => typeof item === 'string'))) result[key] = value;
  }
  for (const key of routeSearchKeys) {
    if (key !== 'page' && typeof result[key] !== 'string') delete result[key];
  }
  if (result.from && !isPage(result.from)) delete result.from;
  if (result.modal && !['create', 'edit', 'discharge'].includes(result.modal as string)) delete result.modal;
  if (result.date && Number.isNaN(Date.parse(result.date as string))) delete result.date;
  return { ...result, page: isPage(input.page) ? input.page : 'dashboard' } as AppSearch;
}
export type SearchPatch = Partial<Record<RouteSearchKey, string | null>>;
export function applySearchPatch(search: AppSearch, patch: SearchPatch): AppSearch {
  const next: Record<string, unknown> = { ...search };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return validateAppSearch(next);
}
