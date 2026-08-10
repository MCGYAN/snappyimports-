import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import {
  ADMIN_MODULE_KEYS,
  EMPTY_STAFF_PERMISSIONS,
  normalizeAdminPermissions,
  type AdminPermissions,
} from '@/lib/admin-permissions';

function parsePermissions(raw: unknown): AdminPermissions {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_STAFF_PERMISSIONS };
  return normalizeAdminPermissions(raw);
}

async function upsertStaffPassword(profileId: string, password: string) {
  const { error } = await supabaseAdmin.from('staff_login_secrets').upsert(
    {
      profile_id: profileId,
      password_plain: password,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id' },
  );
  return error;
}

async function deleteStaffPassword(profileId: string) {
  await supabaseAdmin.from('staff_login_secrets').delete().eq('profile_id', profileId);
}

export async function GET(req: Request) {
  const auth = await verifyAuth(req, { requireOwner: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, admin_permissions, created_at, updated_at')
    .eq('role', 'staff')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/team] list', error);
    return NextResponse.json({ error: 'Could not load team.' }, { status: 500 });
  }

  const ids = (data || []).map((row) => row.id);
  const passwordById = new Map<string, string>();

  if (ids.length > 0) {
    const { data: secrets, error: secretsError } = await supabaseAdmin
      .from('staff_login_secrets')
      .select('profile_id, password_plain')
      .in('profile_id', ids);

    if (secretsError) {
      console.error('[admin/team] secrets', secretsError);
      return NextResponse.json({ error: 'Could not load team passwords.' }, { status: 500 });
    }

    for (const row of secrets || []) {
      passwordById.set(row.profile_id, row.password_plain);
    }
  }

  const staff = (data || []).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    password: passwordById.get(row.id) || null,
    permissions: normalizeAdminPermissions(row.admin_permissions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json({ success: true, staff });
}

export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireOwner: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  let body: {
    email?: string;
    fullName?: string;
    password?: string;
    permissions?: AdminPermissions;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim();
  const password = String(body.password || '');
  const permissions = parsePermissions(body.permissions);

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (!ADMIN_MODULE_KEYS.some((k) => permissions[k])) {
    return NextResponse.json(
      { error: 'Turn on at least one feature for this staff member.' },
      { status: 400 },
    );
  }

  const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) {
    console.error('[admin/team] listUsers', listError);
    return NextResponse.json({ error: 'Could not check existing users.' }, { status: 500 });
  }

  const existingUser = listed.users?.find((u) => u.email?.toLowerCase() === email);
  let userId = existingUser?.id;

  if (existingUser) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', existingUser.id)
      .single();

    if (profile?.role === 'admin') {
      return NextResponse.json(
        { error: 'That email belongs to the owner account.' },
        { status: 400 },
      );
    }
    if (profile?.role === 'staff') {
      return NextResponse.json(
        { error: 'That person is already on the team. Edit their access instead.' },
        { status: 400 },
      );
    }

    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      { password, email_confirm: true },
    );
    if (updateAuthError) {
      console.error('[admin/team] updateUser', updateAuthError);
      return NextResponse.json({ error: 'Could not set staff password.' }, { status: 500 });
    }
  } else {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || undefined,
        invited_as: 'staff',
      },
    });

    if (createError || !created.user) {
      console.error('[admin/team] createUser', createError);
      return NextResponse.json(
        { error: createError?.message || 'Could not create staff account.' },
        { status: 500 },
      );
    }
    userId = created.user.id;
  }

  if (!userId) {
    return NextResponse.json({ error: 'Could not resolve staff user.' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existingProfile) {
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'staff',
        email,
        full_name: fullName || null,
        admin_permissions: permissions,
        updated_at: now,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[admin/team] profile update', updateError);
      return NextResponse.json({ error: 'Could not save staff profile.' }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      email,
      full_name: fullName || null,
      role: 'staff',
      admin_permissions: permissions,
      created_at: now,
      updated_at: now,
    });

    if (insertError) {
      console.error('[admin/team] profile insert', insertError);
      return NextResponse.json({ error: 'Could not create staff profile.' }, { status: 500 });
    }
  }

  const secretError = await upsertStaffPassword(userId, password);
  if (secretError) {
    console.error('[admin/team] save password', secretError);
    return NextResponse.json(
      { error: 'Staff created, but password could not be saved for viewing. Edit them and set it again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    staff: { id: userId, email, fullName: fullName || null, password, permissions },
    message: 'Staff account ready. Tell them their email and password. They sign in at /admin/login.',
  });
}

export async function PATCH(req: Request) {
  const auth = await verifyAuth(req, { requireOwner: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  let body: {
    id?: string;
    fullName?: string;
    permissions?: AdminPermissions;
    password?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const id = String(body.id || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'Staff id is required.' }, { status: 400 });
  }

  const { data: profile, error: findError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, email')
    .eq('id', id)
    .single();

  if (findError || !profile || profile.role !== 'staff') {
    return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.fullName === 'string') {
    updates.full_name = body.fullName.trim() || null;
  }

  if (body.permissions) {
    const permissions = parsePermissions(body.permissions);
    if (!ADMIN_MODULE_KEYS.some((k) => permissions[k])) {
      return NextResponse.json(
        { error: 'Turn on at least one feature, or remove this staff member.' },
        { status: 400 },
      );
    }
    updates.admin_permissions = permissions;
  }

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .eq('role', 'staff');

  if (updateError) {
    console.error('[admin/team] patch', updateError);
    return NextResponse.json({ error: 'Could not update staff.' }, { status: 500 });
  }

  const nextPassword = body.password ? String(body.password) : '';
  if (nextPassword) {
    if (nextPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: nextPassword,
    });
    if (pwError) {
      console.error('[admin/team] password', pwError);
      return NextResponse.json(
        { error: 'Permissions saved, but password reset failed.' },
        { status: 500 },
      );
    }

    const secretError = await upsertStaffPassword(id, nextPassword);
    if (secretError) {
      console.error('[admin/team] save password', secretError);
      return NextResponse.json(
        { error: 'Password updated for login, but could not save it for viewing on Team.' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const auth = await verifyAuth(req, { requireOwner: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = (searchParams.get('id') || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'Staff id is required.' }, { status: 400 });
  }

  if (id === auth.user?.id) {
    return NextResponse.json({ error: 'You cannot remove yourself.' }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', id)
    .single();

  if (!profile || profile.role !== 'staff') {
    return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      role: 'customer',
      admin_permissions: {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[admin/team] delete', error);
    return NextResponse.json({ error: 'Could not remove staff access.' }, { status: 500 });
  }

  await deleteStaffPassword(id);

  return NextResponse.json({ success: true });
}
