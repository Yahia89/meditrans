import { createFileRoute, redirect } from '@tanstack/react-router';
import { RouteError } from '@/router/RouteError';
import { WorkspacePage } from '@/router/WorkspacePage';
import { getPageAccess } from '@/router/access';
import { preloadPage } from '@/router/page-loaders';
import { validateAppSearch } from '@/router/search';

// GitHub Pages has no verified deep-path fallback. Keep existing query URLs
// while Router owns validation, history, access and the split route component.
export const Route = createFileRoute('/')({
  validateSearch: validateAppSearch,
  beforeLoad: ({ context, search, location }) => {
    const result = getPageAccess(search.page, context.access);
    if (!result.allowed) throw redirect({ to: '/', search: { ...search, page: result.fallback, modal: undefined }, hash: location.hash, replace: true });
  },
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ deps, context }) => {
    if (context.access.userId || deps.page === 'accept-invite' || deps.page === 'reset-password') {
      // Start code early, but keep the mounted workspace visible. The page's
      // Suspense/error boundary owns this promise and its explicit retry.
      void preloadPage(deps.page).catch(() => { /* observed by preloadable.Component */ });
    }
    return null;
  },
  component: WorkspacePage,
  errorComponent: RouteError,
});
