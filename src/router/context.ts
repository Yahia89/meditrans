import type { QueryClient } from '@tanstack/react-query';
import type { RouteAccess } from './access';
export interface AppRouterContext { queryClient: QueryClient; access: RouteAccess }
