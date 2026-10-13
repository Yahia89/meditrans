import { useEffect, useMemo } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { OrganizationProvider, useOrganization } from '@/contexts/OrganizationContext';
import { canManageOrganizationAudit } from '@/features/compliance/access';
import { router } from './router';
import { ErrorBoundary } from '@/components/error-boundary';
import { preloadPage } from './router/page-loaders';
import { parseLegacySearch, validateAppSearch } from './router/search';

function hasStoredSession() {
  try { return !!localStorage.getItem('future-transport-auth'); }
  catch { return false; }
}
function RoutedApplication() {
  const queryClient = useQueryClient();
  const { user, profile, memberships, loading: authLoading, error: authError, refresh } = useAuth();
  const { currentOrganization, userRole, loading: orgLoading, error: orgError } = useOrganization();
  const founderEmail = import.meta.env.VITE_FOUNDER_EMAIL;
  const isSuperAdmin = !!user && !!(profile?.is_super_admin || (founderEmail && user.email === founderEmail));
  const organizationId = currentOrganization?.id ?? null;
  const userId = user?.id ?? null;
  const canManageAudit = canManageOrganizationAudit(organizationId, userId, memberships);
  const context = useMemo(() => ({ queryClient, access: { userId, organizationId, role: userRole, isSuperAdmin, canManageAudit } }),
    [queryClient, userId, organizationId, userRole, isSuperAdmin, canManageAudit]);
  const loading = authLoading || (!!user && orgLoading);
  const error = authError ?? orgError;

  useEffect(() => {
    // Code only: do not wait for identity to download the actual initial page.
    // No private query runs until the providers have validated workspace access.
    const page = validateAppSearch(parseLegacySearch(location.search)).page;
    if (hasStoredSession() || page === 'accept-invite' || page === 'reset-password') {
      void import('./router/WorkspacePage').catch(() => { /* route boundary handles failure */ });
      void preloadPage(page).catch(() => { /* route boundary handles an import retry */ });
    }
  }, []);
  useEffect(() => {
    if (!loading && !error) void router.invalidate();
  }, [context, loading, error]);

  if (loading) return <div role="status" className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-r-slate-700" /><p className="mt-4 text-muted-foreground">Loading...</p></div>
  </div>;
  if (error) return <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 className="text-xl font-semibold">Unable to load your workspace</h1>
    <p className="text-muted-foreground">Your session or company access could not be verified. Please try again.</p>
    <button className="rounded-md bg-slate-900 px-4 py-2 text-white" onClick={() => void refresh()}>Try again</button>
  </div>;
  return <ErrorBoundary fallbackTitle="Page Error"><RouterProvider router={router} context={context} /></ErrorBoundary>;
}
export default function App() {
  return <AuthProvider><OrganizationProvider><RoutedApplication /></OrganizationProvider></AuthProvider>;
}
