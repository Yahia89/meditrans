import { createRouter } from '@tanstack/react-router';
import { WorkspacePending } from './router/WorkspacePending';
import { routeTree } from './routeTree.gen';
import { parseLegacySearch, stringifyLegacySearch } from './router/search';
import type { AppRouterContext } from './router/context';

export const router = createRouter({
  routeTree,
  context: undefined! as AppRouterContext,
  parseSearch: parseLegacySearch,
  stringifySearch: stringifyLegacySearch,
  defaultPreload: false,
  // Cold Router mount has no prior match to retain: a 150ms threshold produced
  // blank frames after identity resolved. Page-code waits now stay in the shell.
  defaultPendingMs: 0,
  defaultPendingMinMs: 0,
  defaultPendingComponent: WorkspacePending,
});
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
