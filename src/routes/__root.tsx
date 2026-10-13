import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import type { AppRouterContext } from '@/router/context';

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootLayout,
  notFoundComponent: () => <p role="alert" className="p-6">This address is unavailable. <a href="/">Return to your workspace</a></p>,
});
function RootLayout() {
  return <NuqsAdapter><Outlet /></NuqsAdapter>;
}
