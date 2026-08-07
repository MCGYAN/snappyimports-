/**
 * Admin dashboard module permissions.
 * Owner (role=admin) has every module. Staff only get toggled modules.
 */

export const ADMIN_MODULES = {
  orders: {
    label: 'Orders',
    description: 'Orders, payments, and POS',
  },
  exchange: {
    label: 'Buy RMB',
    description: 'RMB exchange desk',
  },
  products: {
    label: 'Products',
    description: 'Products, categories, and inventory',
  },
  customers: {
    label: 'Customers',
    description: 'Customers and reviews',
  },
} as const;

export type AdminModule = keyof typeof ADMIN_MODULES;

export type AdminPermissions = Partial<Record<AdminModule, boolean>>;

export const ADMIN_MODULE_KEYS = Object.keys(ADMIN_MODULES) as AdminModule[];

export const EMPTY_STAFF_PERMISSIONS: AdminPermissions = {
  orders: false,
  exchange: false,
  products: false,
  customers: false,
};

const PATH_MODULE_RULES: { prefix: string; module: AdminModule | 'owner' | null }[] = [
  { prefix: '/admin/team', module: 'owner' },
  { prefix: '/admin/notifications', module: 'owner' },
  { prefix: '/admin/analytics', module: 'owner' },
  { prefix: '/admin/coupons', module: 'owner' },
  { prefix: '/admin/test-sms', module: 'owner' },
  { prefix: '/admin/orders', module: 'orders' },
  { prefix: '/admin/pos', module: 'orders' },
  { prefix: '/admin/exchange', module: 'exchange' },
  { prefix: '/admin/products', module: 'products' },
  { prefix: '/admin/categories', module: 'products' },
  { prefix: '/admin/inventory', module: 'products' },
  { prefix: '/admin/customers', module: 'customers' },
  { prefix: '/admin/customer-insights', module: 'customers' },
  { prefix: '/admin/reviews', module: 'customers' },
];

export function normalizeAdminPermissions(raw: unknown): AdminPermissions {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: AdminPermissions = { ...EMPTY_STAFF_PERMISSIONS };
  for (const key of ADMIN_MODULE_KEYS) {
    out[key] = Boolean(src[key]);
  }
  return out;
}

export function isOwnerRole(role: string | null | undefined): boolean {
  return role === 'admin';
}

export function isStaffRole(role: string | null | undefined): boolean {
  return role === 'staff';
}

export function canAccessAdminDashboard(role: string | null | undefined): boolean {
  return isOwnerRole(role) || isStaffRole(role);
}

export function hasAdminModule(
  role: string | null | undefined,
  permissions: unknown,
  module: AdminModule,
): boolean {
  if (isOwnerRole(role)) return true;
  if (!isStaffRole(role)) return false;
  return Boolean(normalizeAdminPermissions(permissions)[module]);
}

export function requiredModuleForPath(pathname: string): AdminModule | 'owner' | null {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/admin';
  if (path === '/admin' || path === '/admin/login') return null;

  for (const rule of PATH_MODULE_RULES) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      return rule.module;
    }
  }
  if (path.startsWith('/admin')) return 'owner';
  return null;
}

export function canAccessAdminPath(
  role: string | null | undefined,
  permissions: unknown,
  pathname: string,
): boolean {
  if (!canAccessAdminDashboard(role)) return false;
  if (isOwnerRole(role)) return true;

  const required = requiredModuleForPath(pathname);
  if (required === null) return true;
  if (required === 'owner') return false;
  return hasAdminModule(role, permissions, required);
}

export function menuItemModule(path: string): AdminModule | 'owner' | null {
  return requiredModuleForPath(path);
}
