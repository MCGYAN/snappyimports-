/**
 * Snappy Imports auth email templates (simple, fifth-grade reading level).
 *
 * Apply via Management API (needs personal access token):
 *   set SUPABASE_ACCESS_TOKEN=...
 *   node scripts/update-auth-email-templates.mjs
 *
 * Or paste into Supabase Dashboard → Authentication → Email Templates:
 *   https://supabase.com/dashboard/project/zqckwcsyxlcxpioaqhwb/auth/templates
 *
 * Also set URL config (required so links leave localhost):
 *   Site URL: https://snappyimports.vercel.app
 *   Redirect URLs: https://snappyimports.vercel.app/**
 *                https://snappyimports.vercel.app/auth/callback
 */

export const AUTH_EMAIL_TEMPLATES = {
  confirmation: {
    subject: 'Confirm your Snappy Imports account',
    content: `<h2 style="color:#0f2744;font-family:Arial,sans-serif;">Hi from Snappy Imports</h2>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">Thanks for signing up. One quick step left.</p>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">Tap the button below to confirm your email and open your account.</p>
<p style="margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="background:#0f2744;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;">Confirm my email</a></p>
<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#64748b;">If you did not create an account, you can ignore this message.</p>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#64748b;">Snappy Imports Global</p>`,
  },
  recovery: {
    subject: 'Reset your Snappy Imports password',
    content: `<h2 style="color:#0f2744;font-family:Arial,sans-serif;">Reset your password</h2>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">We got a request to change your password.</p>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">Tap below to pick a new one.</p>
<p style="margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="background:#0f2744;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;">Choose a new password</a></p>
<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#64748b;">If you did not ask for this, ignore this email. Your password stays the same.</p>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#64748b;">Snappy Imports Global</p>`,
  },
  magic_link: {
    subject: 'Your Snappy Imports sign-in link',
    content: `<h2 style="color:#0f2744;font-family:Arial,sans-serif;">Sign in to Snappy</h2>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">Tap the button below to sign in. This link works one time and expires soon.</p>
<p style="margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="background:#0f2744;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;">Sign me in</a></p>
<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#64748b;">If you did not ask for this, you can ignore it.</p>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#64748b;">Snappy Imports Global</p>`,
  },
  email_change: {
    subject: 'Confirm your new Snappy email',
    content: `<h2 style="color:#0f2744;font-family:Arial,sans-serif;">Confirm your new email</h2>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">Please confirm <strong>{{ .NewEmail }}</strong> as your new email for Snappy Imports.</p>
<p style="margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="background:#0f2744;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;">Confirm new email</a></p>
<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#64748b;">If you did not ask for this, ignore this email.</p>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#64748b;">Snappy Imports Global</p>`,
  },
  invite: {
    subject: 'You are invited to Snappy Imports',
    content: `<h2 style="color:#0f2744;font-family:Arial,sans-serif;">You are invited</h2>
<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#334155;">Someone invited you to create a Snappy Imports account.</p>
<p style="margin:28px 0;"><a href="{{ .ConfirmationURL }}" style="background:#0f2744;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;">Accept invite</a></p>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#64748b;">Snappy Imports Global</p>`,
  },
};

export const AUTH_URL_CONFIG = {
  siteUrl: 'https://snappyimports.vercel.app',
  uriAllowList:
    'https://snappyimports.vercel.app/**,https://snappyimports.vercel.app/auth/callback,http://localhost:3000/**,http://localhost:3000/auth/callback',
};
