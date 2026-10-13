import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { parseLegacySearch, stringifyLegacySearch } from './router/search';
import type { AppRouterContext } from './router/context';

export const router = createRouter({
  routeTree,
  context: undefined! as AppRouterContext,
  parseSearch: parseLegacySearch,
  stringifySearch: stringifyLegacySearch,
  defaultPreload: false,
  defaultPendingMs: 0,
  defaultPendingMinMs: 0,
  defaultPendingComponent: () => null,
});
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
