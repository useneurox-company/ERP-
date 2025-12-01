import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface ModulePermissions {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  view_all: boolean;
  hide_prices: boolean;
}

export interface UserPermissions {
  userId: string;
  roleId: string | null;
  roleName: string | null;
  isActive: boolean;
  permissions: Record<string, ModulePermissions>;
}

/**
 * Hook to fetch and use user permissions
 */
export function usePermissions() {
  // Get current user from localStorage
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const { data: permissions, isLoading, error } = useQuery<UserPermissions>({
    queryKey: ['permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('No user logged in');
      }

      const response = await apiRequest('GET', `/api/users/${user.id}/permissions`);
      return response;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  /**
   * Check if user has a specific permission for a module
   */
  const hasPermission = (module: string, action: keyof ModulePermissions): boolean => {
    if (!permissions || !permissions.permissions[module]) {
      return false;
    }
    return permissions.permissions[module][action] === true;
  };

  /**
   * Check if user can view all data in a module
   */
  const canViewAll = (module: string): boolean => {
    return hasPermission(module, 'view_all');
  };

  /**
   * Check if prices should be hidden for a module
   */
  const shouldHidePrices = (module: string): boolean => {
    if (!permissions || !permissions.permissions[module]) {
      return false;
    }
    return permissions.permissions[module].hide_prices === true;
  };

  /**
   * Check if prices should be hidden for any module
   */
  const shouldHidePricesAny = (): boolean => {
    if (!permissions) return false;

    for (const module in permissions.permissions) {
      if (permissions.permissions[module].hide_prices === true) {
        return true;
      }
    }
    return false;
  };

  /**
   * Check if user can perform an action on a module
   */
  const can = (module: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean => {
    const actionKey = `can_${action}` as keyof ModulePermissions;
    return hasPermission(module, actionKey);
  };

  /**
   * Get all permissions for a module
   */
  const getModulePermissions = (module: string): ModulePermissions | null => {
    if (!permissions || !permissions.permissions[module]) {
      return null;
    }
    return permissions.permissions[module];
  };

  return {
    permissions,
    isLoading,
    error,
    hasPermission,
    canViewAll,
    shouldHidePrices,
    shouldHidePricesAny,
    can,
    getModulePermissions,
    user,
    isActive: permissions?.isActive ?? false,
    roleName: permissions?.roleName ?? null,
  };
}