/**
 * Update Supabase Site URL + Snappy auth emails.
 * Free tier requires custom SMTP before templates can change.
 * Uses RESEND_API_KEY from .env.local when present.
 *
 * Secrets are read from env / .env.local and never printed.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PROJECT_REF = 'zqckwcsyxlcxpioaqhwb';
const SITE_URL = 'https://snappyimports.vercel.app';

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
const resendKey = process.env.RESEND_API_KEY || '';
const emailFrom = process.env.EMAIL_FROM || process.env.ADMIN_EMAIL || '';

if (!token.startsWith('sbp_')) {
  console.error('SUPABASE_ACCESS_TOKEN missing or invalid in .env.local');
  process.exit(1);
}

function extractEmail(from) {
  const m = String(from).match(/<([^>]+)>/);
  if (m) return m[1].trim();
  const bare = String(from).match(/[^\s<>]+@[^\s<>]+/);
  return bare ? bare[0] : '';
}

function extractSenderName(from) {
  const m = String(from).match(/^"?([^"<]+)"?\s*</);
  if (m && m[1].trim()) return m[1].trim();
  return 'Snappy Imports Global';
}

async function patchAuth(body, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`FAILED: ${label} (${res.status})`);
    // Never dump secrets; message only
    try {
      const j = JSON.parse(text);
      console.error(j.message || j.error || 'Request failed');
    } catch {
      console.error(text.slice(0, 300));
    }
    return false;
  }
  console.log(`OK: ${label}`);
  return true;
}

const confirmation = `<h2 style="color:#0f2744;font-family:Arial,sans-serif;">Hi from Snappy Imports</h2>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">Thanks for signing up. One quick step left.</p>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">Tap the button below to confirm your email and open your account.</p>
<p style="margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="background:#0f2744;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;">Confirm my email</a></p>
<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#64748b;">If you did not create an account, you can ignore this message.</p>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#64748b;">Snappy Imports Global</p>`;

const recovery = `<h2 style="color:#0f2744;font-family:Arial,sans-serif;">Reset your password</h2>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">We got a request to change your password.</p>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">Tap below to pick a new one.</p>
<p style="margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="background:#0f2744;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;">Choose a new password</a></p>
<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#64748b;">If you did not ask for this, ignore this email. Your password stays the same.</p>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#64748b;">Snappy Imports Global</p>`;

const magicLink = `<h2 style="color:#0f2744;font-family:Arial,sans-serif;">Sign in to Snappy</h2>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">Tap the button below to sign in. This link works one time and expires soon.</p>
<p style="margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="background:#0f2744;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;">Sign me in</a></p>
<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#64748b;">If you did not ask for this, you can ignore it.</p>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#64748b;">Snappy Imports Global</p>`;

const emailChange = `<h2 style="color:#0f2744;font-family:Arial,sans-serif;">Confirm your new email</h2>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">Please confirm <strong>{{ .NewEmail }}</strong> as your new email for Snappy Imports.</p>
<p style="margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="background:#0f2744;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;">Confirm new email</a></p>
<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#64748b;">If you did not ask for this, ignore this email.</p>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#64748b;">Snappy Imports Global</p>`;

const invite = `<h2 style="color:#0f2744;font-family:Arial,sans-serif;">You are invited</h2>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">Someone invited you to create a Snappy Imports account.</p>
<p style="margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="background:#0f2744;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;">Accept invite</a></p>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#64748b;">Snappy Imports Global</p>`;

const smtpEmail = extractEmail(emailFrom);
const smtpName = extractSenderName(emailFrom);

console.log('Updating auth URL config…');
const urlsOk = await patchAuth(
  {
    site_url: SITE_URL,
    uri_allow_list: `${SITE_URL}/**,${SITE_URL}/auth/callback,http://localhost:3000/**,http://localhost:3000/auth/callback`,
  },
  'Site URL + redirect allow list',
);

if (!resendKey) {
  console.error('RESEND_API_KEY missing. Free tier cannot change email templates without custom SMTP.');
  process.exit(urlsOk ? 2 : 1);
}
if (!smtpEmail) {
  console.error('EMAIL_FROM / ADMIN_EMAIL missing a usable email address for SMTP.');
  process.exit(urlsOk ? 2 : 1);
}

console.log('Configuring Resend SMTP for auth emails…');
const smtpOk = await patchAuth(
  {
    external_email_enabled: true,
    smtp_host: 'smtp.resend.com',
    smtp_port: '465',
    smtp_user: 'resend',
    smtp_pass: resendKey,
    smtp_admin_email: smtpEmail,
    smtp_sender_name: smtpName,
  },
  'Resend SMTP',
);

if (!smtpOk) process.exit(1);

console.log('Updating Snappy email templates…');
const templatesOk = await patchAuth(
  {
    mailer_subjects_confirmation: 'Confirm your Snappy Imports account',
    mailer_templates_confirmation_content: confirmation,
    mailer_subjects_recovery: 'Reset your Snappy Imports password',
    mailer_templates_recovery_content: recovery,
    mailer_subjects_magic_link: 'Your Snappy Imports sign-in link',
    mailer_templates_magic_link_content: magicLink,
    mailer_subjects_email_change: 'Confirm your new Snappy email',
    mailer_templates_email_change_content: emailChange,
    mailer_subjects_invite: 'You are invited to Snappy Imports',
    mailer_templates_invite_content: invite,
  },
  'Auth email templates',
);

if (!templatesOk) process.exit(1);
console.log('Done. Auth emails should now say Snappy and open the live site.');
