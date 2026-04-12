import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * One-time secure endpoint to grant a user admin access.
 * Call after creating the user in Supabase Auth (Dashboard or signup).
 *
 * POST /api/admin/seed-admin
 * Headers: Authorization: Bearer <ADMIN_SEED_SECRET>
 * Body: { "email": "admin@example.com" }
 */
export async function POST(request: Request) {
    const secret = process.env.ADMIN_SEED_SECRET || process.env.CRON_SECRET;
    if (!secret) {
        return NextResponse.json(
            { error: 'Server not configured for admin seed (missing ADMIN_SEED_SECRET or CRON_SECRET)' },
            { status: 500 }
        );
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (token !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { email?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
        return NextResponse.json({ error: 'Body must include "email"' }, { status: 400 });
    }

    try {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (listError) {
            console.error('[seed-admin] listUsers error:', listError);
            return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
        }

        const user = users?.find((u) => u.email?.toLowerCase() === email);
        if (!user) {
            return NextResponse.json(
                { error: 'No user found with that email. Create the user in Supabase Auth first (Dashboard → Authentication → Users).' },
                { status: 404 }
            );
        }

        const { data: existing } = await supabaseAdmin
            .from('profiles')
            .select('id, role')
            .eq('id', user.id)
            .single();

        if (existing) {
            if (existing.role === 'admin') {
                return NextResponse.json({ message: 'User is already an admin', email, id: user.id });
            }
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ role: 'admin', email: user.email ?? email, updated_at: new Date().toISOString() })
                .eq('id', user.id);
            if (updateError) {
                console.error('[seed-admin] update error:', updateError);
                return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
            }
            return NextResponse.json({ message: 'User promoted to admin', email, id: user.id });
        }

        const { error: insertError } = await supabaseAdmin.from('profiles').insert({
            id: user.id,
            email: user.email ?? email,
            full_name: user.user_metadata?.full_name ?? null,
            role: 'admin',
        });

        if (insertError) {
            console.error('[seed-admin] insert error:', insertError);
            return NextResponse.json({ error: 'Failed to create admin profile' }, { status: 500 });
        }

        return NextResponse.json({ message: 'Admin created', email, id: user.id });
    } catch (err) {
        console.error('[seed-admin] error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
