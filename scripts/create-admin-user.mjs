/**
 * Create an admin user in Supabase Auth and add them to profiles with role admin.
 * Uses SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL from .env.local.
 *
 * Usage:
 *   node scripts/create-admin-user.mjs [email] [password]
 * With no args: uses ADMIN_EMAIL from .env.local and a generated password (printed at the end).
 *   node scripts/create-admin-user.mjs
 * Or set env vars:
 *   CREATE_ADMIN_EMAIL=admin@example.com CREATE_ADMIN_PASSWORD=yourpassword node scripts/create-admin-user.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const altPath = path.join(__dirname, '..', '.env');
  const p = fs.existsSync(envPath) ? envPath : fs.existsSync(altPath) ? altPath : null;
  if (!p) return {};
  return Object.fromEntries(
    fs
      .readFileSync(p, 'utf-8')
      .split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l.trim()))
      .map((l) => {
        const eq = l.indexOf('=');
        const key = l.slice(0, eq).trim();
        let val = l.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return [key, val];
      })
  );
}

function generatePassword(length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  let s = '';
  for (let i = 0; i < length; i++) s += chars[bytes[i] % chars.length];
  return s;
}

const env = { ...process.env, ...loadEnv() };
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

// Default email from .env ADMIN_EMAIL or fallback
const defaultEmail = (env.ADMIN_EMAIL || '').trim() || 'admin@example.com';
const email = process.argv[2] || env.CREATE_ADMIN_EMAIL || defaultEmail;
const password = process.argv[3] || env.CREATE_ADMIN_PASSWORD || generatePassword();
const isGeneratedPassword = !process.argv[3] && !env.CREATE_ADMIN_PASSWORD;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureAdminProfile(supabaseClient, userId, userEmail) {
  const { data: existing } = await supabaseClient.from('profiles').select('id, role').eq('id', userId).single();
  if (existing) {
    if (existing.role === 'admin') return { updated: false };
    const { error } = await supabaseClient.from('profiles').update({ role: 'admin', email: userEmail }).eq('id', userId);
    if (error) throw error;
    return { updated: true };
  }
  const { error } = await supabaseClient.from('profiles').insert({
    id: userId,
    email: userEmail,
    role: 'admin',
  });
  if (error) throw error;
  return { inserted: true };
}

async function main() {
  try {
    const { data: user, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      if (createError.message?.includes('already been registered')) {
        console.log('User already exists. Ensuring admin profile...');
        const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const existingUser = users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!existingUser) {
          console.error('Could not find user with email:', email);
          process.exit(1);
        }
        await ensureAdminProfile(supabase, existingUser.id, existingUser.email || email);
        console.log('Admin access granted for:', email);
        console.log('  Login at: /admin/login');
        return;
      }
      console.error('Failed to create user:', createError.message);
      process.exit(1);
    }

    await ensureAdminProfile(supabase, user.user.id, user.user.email || email);

    console.log('Admin user created successfully.');
    console.log('  Email:', email);
    if (isGeneratedPassword) {
      console.log('  Password:', password);
      console.log('  (Change this after first login if you want.)');
    }
    console.log('  Login at: /admin/login');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
