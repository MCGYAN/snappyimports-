/**
 * Disable email confirmation so signup is instant (email + password).
 * Reads SUPABASE_ACCESS_TOKEN from .env.local. Never prints the token.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PROJECT_REF = 'zqckwcsyxlcxpioaqhwb';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'));
loadEnvFile(resolve(process.cwd(), '.env'));

const token = process.env.SUPABASE_ACCESS_TOKEN || '';
if (!token.startsWith('sbp_')) {
  console.error('SUPABASE_ACCESS_TOKEN missing in .env.local');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mailer_autoconfirm: true,
  }),
});

const text = await res.text();
if (!res.ok) {
  console.error('Failed to disable email confirmation:', res.status);
  try {
    console.error(JSON.parse(text).message || text.slice(0, 200));
  } catch {
    console.error(text.slice(0, 200));
  }
  process.exit(1);
}

console.log('OK: Email confirmation is off. Signup is instant.');
