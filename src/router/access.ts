import type { Page } from '../lib/pages.ts';
import type { MembershipRole } from '../lib/supabase';

export interface RouteAccess {
  userId: string | null;
  organizationId: string | null;
  role: MembershipRole | null;
  isSuperAdmin: boolean;
  canManageAudit: boolean;
}
const restrictions: Partial<Record<MembershipRole, readonly Page[]>> = {
  driver: ['dashboard', 'patients', 'patient-details', 'drivers', 'driver-details', 'employees', 'employee-details', 'upload', 'review_import', 'billing', 'notifications', 'founder', 'client-credits', 'broker-integrations', 'medicaid-billing', 'live-tracking', 'summary', 'companies', 'fees'],
  employee: ['founder', 'billing', 'medicaid-billing', 'live-tracking', 'summary', 'client-credits', 'broker-integrations', 'companies', 'fees'],
  dispatch: ['founder', 'employees', 'employee-details', 'upload', 'review_import', 'billing', 'notifications', 'medicaid-billing', 'client-credits', 'broker-integrations', 'companies', 'fees'],
  admin: ['founder', 'companies'],
  owner: ['founder', 'companies'],
};
export function getPageAccess(page: Page, access: RouteAccess): { allowed: true } | { allowed: false; fallback: Page } {
  if (page === 'accept-invite' || page === 'reset-password') return { allowed: true };
  // Preserve the requested bookmark while the signed-out component shows login.
  if (!access.userId) return { allowed: true };
  const fallback = access.role === 'driver' ? 'trips' : access.isSuperAdmin ? 'companies' : !access.role ? 'account' : 'dashboard';
  if (page === 'sts-inspection' || page === 'company') {
    return access.canManageAudit ? { allowed: true } : { allowed: false, fallback };
  }
  if (access.isSuperAdmin) return { allowed: true };
  if (page === 'account') return { allowed: true };
  if (!access.organizationId || !access.role || access.role === 'patient') return { allowed: false, fallback: 'account' };
  return restrictions[access.role]?.includes(page) ? { allowed: false, fallback } : { allowed: true };
}
