'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ADMIN_MODULE_KEYS,
  ADMIN_MODULES,
  EMPTY_STAFF_PERMISSIONS,
  type AdminPermissions,
} from '@/lib/admin-permissions';

type StaffRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  permissions: AdminPermissions;
};

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in required');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export default function AdminTeamPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<AdminPermissions>({
    ...EMPTY_STAFF_PERMISSIONS,
    orders: true,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<AdminPermissions>({
    ...EMPTY_STAFF_PERMISSIONS,
  });
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/team', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load team');
      setStaff(data.staff || []);
    } catch (e: any) {
      setError(e.message || 'Could not load team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePerm = (
    current: AdminPermissions,
    key: keyof AdminPermissions,
    setter: (p: AdminPermissions) => void,
  ) => {
    setter({ ...current, [key]: !current[key] });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, fullName, password, permissions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add staff');
      setSuccess(data.message || 'Staff added.');
      setEmail('');
      setFullName('');
      setPassword('');
      setPermissions({ ...EMPTY_STAFF_PERMISSIONS, orders: true });
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not add staff');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: StaffRow) => {
    setEditingId(row.id);
    setEditName(row.fullName || '');
    setEditPermissions({ ...EMPTY_STAFF_PERMISSIONS, ...row.permissions });
    setEditPassword('');
    setSuccess('');
    setError('');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/team', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          id: editingId,
          fullName: editName,
          permissions: editPermissions,
          password: editPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update staff');
      setSuccess('Staff access updated.');
      setEditingId(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not update staff');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string, label: string) => {
    if (
      !confirm(
        `Remove admin access for ${label}? They will no longer sign in to the dashboard.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/team?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not remove staff');
      setSuccess('Staff access removed.');
      if (editingId === id) setEditingId(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not remove staff');
    } finally {
      setSaving(false);
    }
  };

  const PermissionToggles = ({
    value,
    onChange,
  }: {
    value: AdminPermissions;
    onChange: (next: AdminPermissions) => void;
  }) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {ADMIN_MODULE_KEYS.map((key) => (
        <label
          key={key}
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
        >
          <input
            type="checkbox"
            checked={Boolean(value[key])}
            onChange={() => togglePerm(value, key, onChange)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-accent"
          />
          <span>
            <span className="block text-sm font-semibold text-brand-primary">
              {ADMIN_MODULES[key].label}
            </span>
            <span className="block text-xs text-slate-500">{ADMIN_MODULES[key].description}</span>
          </span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-primary">Team</h1>
        <p className="mt-1 text-sm text-slate-600">
          Add staff with their own login. Choose which dashboard features they can use.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      ) : null}

      <section className="liquid-glass-card space-y-4 p-5 md:p-6">
        <h2 className="text-lg font-bold text-brand-primary">Add staff</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Staff email"
              className="store-input"
              autoComplete="off"
            />
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name (optional)"
              className="store-input"
              autoComplete="off"
            />
          </div>
          <input
            required
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Temporary password (min 8 characters)"
            className="store-input"
            autoComplete="new-password"
            minLength={8}
          />
          <div>
            <p className="mb-2 text-sm font-semibold text-brand-primary">Features they can use</p>
            <PermissionToggles value={permissions} onChange={setPermissions} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Add staff'}
          </button>
          <p className="text-xs text-slate-500">
            Share the email and password with them. They sign in at /admin/login.
          </p>
        </form>
      </section>

      <section className="liquid-glass-card p-5 md:p-6">
        <h2 className="mb-4 text-lg font-bold text-brand-primary">Active staff</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-slate-500">No staff yet. Add someone above.</p>
        ) : (
          <ul className="space-y-4">
            {staff.map((row) => {
              const label = row.fullName || row.email || 'Staff';
              const isEditing = editingId === row.id;
              return (
                <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-brand-primary">{label}</p>
                      <p className="text-sm text-slate-500">{row.email}</p>
                      {!isEditing ? (
                        <p className="mt-2 text-xs text-slate-600">
                          Access:{' '}
                          {ADMIN_MODULE_KEYS.filter((k) => row.permissions[k])
                            .map((k) => ADMIN_MODULES[k].label)
                            .join(', ') || 'None'}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isEditing ? (
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-brand-primary hover:bg-slate-50"
                        >
                          Edit access
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleRemove(row.id, label)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Full name"
                        className="store-input"
                      />
                      <PermissionToggles value={editPermissions} onChange={setEditPermissions} />
                      <input
                        type="text"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="New password (optional)"
                        className="store-input"
                        autoComplete="new-password"
                        minLength={8}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={handleSaveEdit}
                          className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                        >
                          {saving ? 'Saving…' : 'Save changes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
