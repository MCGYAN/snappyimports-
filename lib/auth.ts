import { supabaseAdmin } from './supabase-admin';
import {
  type AdminModule,
  type AdminPermissions,
  canAccessAdminDashboard,
  hasAdminModule,
  isOwnerRole,
  normalizeAdminPermissions,
} from './admin-permissions';

export interface AuthResult {
  authenticated: boolean;
  user?: any;
  role?: string;
  permissions?: AdminPermissions;
  error?: string;
}

export function getAuthToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (bearer) return bearer;
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/\bsb-access-token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

type VerifyOptions = {
  requireAdmin?: boolean;
  requireOwner?: boolean;
  requireModule?: AdminModule;
};

export async function verifyAuth(
  request: Request,
  options: VerifyOptions = {},
): Promise<AuthResult> {
  const token = getAuthToken(request);

  if (!token) {
    return { authenticated: false, error: 'Missing authorization token' };
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return { authenticated: false, error: 'Invalid or expired token' };
    }

    const needsProfile =
      options.requireAdmin || options.requireOwner || Boolean(options.requireModule);

    if (!needsProfile) {
      return { authenticated: true, user };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, admin_permissions')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { authenticated: false, error: 'Could not verify user role' };
    }

    const role = profile.role as string;
    const permissions = normalizeAdminPermissions(profile.admin_permissions);

    if (options.requireOwner) {
      if (!isOwnerRole(role)) {
        return { authenticated: false, error: 'Owner access required' };
      }
      return { authenticated: true, user, role, permissions };
    }

    if (options.requireAdmin || options.requireModule) {
      if (!canAccessAdminDashboard(role)) {
        return { authenticated: false, error: 'Admin or staff access required' };
      }
    }

    if (options.requireModule && !hasAdminModule(role, permissions, options.requireModule)) {
      return { authenticated: false, error: 'You do not have access to this feature' };
    }

    return { authenticated: true, user, role, permissions };
  } catch (err: any) {
    return { authenticated: false, error: err.message || 'Auth verification failed' };
  }
}

export async function verifyAdminToken(token: string): Promise<AuthResult> {
  if (!token) {
    return { authenticated: false, error: 'Missing token' };
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return { authenticated: false, error: 'Invalid or expired token' };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, admin_permissions')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { authenticated: false, error: 'Could not verify role' };
    }

    const role = profile.role as string;
    if (!canAccessAdminDashboard(role)) {
      return { authenticated: false, error: 'Admin or staff access required' };
    }

    return {
      authenticated: true,
      user,
      role,
      permissions: normalizeAdminPermissions(profile.admin_permissions),
    };
  } catch (err: any) {
    return { authenticated: false, error: err.message || 'Auth failed' };
  }
}
