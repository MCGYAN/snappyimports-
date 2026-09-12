'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, FileSpreadsheet, Pencil, Plus, Save, Upload, Warehouse } from 'lucide-react';

type WarehouseForm = {
  warehouseName: string;
  contactName: string;
  phone: string;
  addressChinese: string;
  addressEnglish: string;
  entryNumbers: string;
  ghanaTrackingPhone: string;
  trackingWhatsapp: string;
  instructions: string;
  isActive: boolean;
};

type PackageForm = {
  id?: string;
  shippingMark: string;
  trackingNumber: string;
  description: string;
  cartons: string;
  cbm: string;
  goodsClass: string;
  customUsdPerCbm: string;
  receivedAt: string;
  loadedAt: string;
  estimatedArrivalAt: string;
  vessel: string;
  notes: string;
};

const EMPTY: WarehouseForm = {
  warehouseName: 'Snappy China Warehouse',
  contactName: '',
  phone: '',
  addressChinese: '佛山市里水镇五一村大道2号里德仓1号仓',
  addressEnglish: '',
  entryNumbers: '18620853884;18620788554',
  ghanaTrackingPhone: '',
  trackingWhatsapp: '',
  instructions:
    'Copy the shipping label and send it to your supplier. Put the shipping mark clearly on every carton.',
  isActive: false,
};

const EMPTY_PACKAGE: PackageForm = {
  shippingMark: '',
  trackingNumber: '',
  description: '',
  cartons: '1',
  cbm: '',
  goodsClass: 'normal',
  customUsdPerCbm: '',
  receivedAt: '',
  loadedAt: '',
  estimatedArrivalAt: '',
  vessel: '',
  notes: '',
};

type Preview = {
  summary: {
    fileName: string;
    sheetName: string;
    sourceRows: number;
    packageRows: number;
    ready: number;
    newPackages: number;
    updates: number;
    alreadyLoaded?: number;
    unknownMarks: number;
    duplicates: number;
    invalidClasses: number;
    skipped: number;
    transitDays?: number;
    imported?: number;
    updated?: number;
    errors?: number;
  };
  rows: any[];
  previewLimited?: boolean;
};

function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

async function authHeaders(contentType = true) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

function matchLabel(match: string) {
  if (match === 'matched') return 'New';
  if (match === 'update') return 'Update';
  if (match === 'already_loaded') return 'On file';
  if (match === 'duplicate') return 'Duplicate';
  if (match === 'invalid_class') return 'Class error';
  return 'Unknown mark';
}

function matchClass(match: string) {
  if (match === 'matched') return 'bg-emerald-50 text-emerald-700';
  if (match === 'update') return 'bg-blue-50 text-blue-700';
  if (match === 'already_loaded') return 'bg-slate-100 text-slate-700';
  if (match === 'duplicate') return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

export default function WarehouseFreightDesk() {
  const [form, setForm] = useState<WarehouseForm>(EMPTY);
  const [packageForm, setPackageForm] = useState<PackageForm>(EMPTY_PACKAGE);
  const [editingPackage, setEditingPackage] = useState(false);
  const [savingPackage, setSavingPackage] = useState(false);
  const [freightPackages, setFreightPackages] = useState<any[]>([]);
  const [packageSearch, setPackageSearch] = useState('');
  const [batches, setBatches] = useState<any[]>([]);
  const [expectedPackages, setExpectedPackages] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [transitDays, setTransitDays] = useState(45);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [warehouseResponse, packagesResponse] = await Promise.all([
        fetch('/api/admin/warehouse', { headers: await authHeaders() }),
        fetch('/api/admin/warehouse/packages', { headers: await authHeaders() }),
      ]);
      const result = await warehouseResponse.json();
      const packagesResult = await packagesResponse.json();
      if (!warehouseResponse.ok) throw new Error(result.error || 'Could not load warehouse setup.');
      if (!packagesResponse.ok) {
        throw new Error(packagesResult.error || 'Could not load freight packages.');
      }
      const warehouse = result.warehouse;
      setForm({
        warehouseName: warehouse?.warehouse_name || EMPTY.warehouseName,
        contactName: warehouse?.contact_name || '',
        phone: warehouse?.phone || '',
        addressChinese: warehouse?.address_chinese || EMPTY.addressChinese,
        addressEnglish: warehouse?.address_english || '',
        entryNumbers: warehouse?.entry_numbers || EMPTY.entryNumbers,
        ghanaTrackingPhone: warehouse?.ghana_tracking_phone || '',
        trackingWhatsapp: warehouse?.tracking_whatsapp || warehouse?.phone || '',
        instructions: warehouse?.instructions || EMPTY.instructions,
        isActive: Boolean(warehouse?.is_active),
      });
      setBatches(result.batches || []);
      setExpectedPackages(result.expectedPackages || []);
      setCustomers(result.customers || []);
      setFreightPackages(packagesResult.packages || []);
      setTransitDays(
        Number(packagesResult.defaultTransitDays || result.defaultTransitDays || 45) || 45,
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load warehouse setup.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers.slice(0, 30);
    return customers
      .filter((customer) =>
        [customer.shipping_mark, customer.full_name, customer.email, customer.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      )
      .slice(0, 50);
  }, [customerSearch, customers]);

  const visiblePackages = useMemo(() => {
    const query = packageSearch.trim().toLowerCase();
    const list = !query
      ? freightPackages.slice(0, 40)
      : freightPackages
          .filter((pkg) => {
            const linked = Array.isArray(pkg.shipping_packages)
              ? pkg.shipping_packages[0]
              : pkg.shipping_packages;
            return [
              pkg.shipping_mark_snapshot,
              pkg.supplier_tracking_number,
              pkg.description,
              pkg.customer_email,
              linked?.tracking_id,
            ]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(query));
          })
          .slice(0, 60);
    return list;
  }, [freightPackages, packageSearch]);

  const linkedShipping = (pkg: any) =>
    Array.isArray(pkg.shipping_packages) ? pkg.shipping_packages[0] : pkg.shipping_packages;

  const saveWarehouse = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/warehouse', {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save warehouse details.');
      setMessage('Warehouse details saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save warehouse details.');
    } finally {
      setSaving(false);
    }
  };

  const openNewPackage = () => {
    setPackageForm(EMPTY_PACKAGE);
    setEditingPackage(true);
    setMessage('');
    setError('');
  };

  const openEditPackage = (pkg: any) => {
    setPackageForm({
      id: pkg.id,
      shippingMark: pkg.shipping_mark_snapshot || '',
      trackingNumber: pkg.supplier_tracking_number || '',
      description: pkg.description || '',
      cartons: String(pkg.cartons || 1),
      cbm: pkg.cbm != null ? String(pkg.cbm) : '',
      goodsClass: pkg.goods_class || 'normal',
      customUsdPerCbm: pkg.custom_usd_per_cbm != null ? String(pkg.custom_usd_per_cbm) : '',
      receivedAt: toDateInput(pkg.received_at),
      loadedAt: toDateInput(pkg.loaded_at),
      estimatedArrivalAt: toDateInput(pkg.estimated_arrival_at),
      vessel: pkg.vessel || '',
      notes: pkg.notes || '',
    });
    setEditingPackage(true);
    setMessage('');
    setError('');
  };

  const savePackage = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPackage(true);
    setMessage('');
    setError('');
    try {
      const payload = {
        id: packageForm.id,
        shippingMark: packageForm.shippingMark,
        trackingNumber: packageForm.trackingNumber,
        description: packageForm.description,
        cartons: packageForm.cartons ? Number(packageForm.cartons) : null,
        cbm: packageForm.cbm ? Number(packageForm.cbm) : null,
        goodsClass: packageForm.goodsClass,
        customUsdPerCbm: packageForm.customUsdPerCbm
          ? Number(packageForm.customUsdPerCbm)
          : null,
        receivedAt: packageForm.receivedAt || null,
        loadedAt: packageForm.loadedAt || null,
        estimatedArrivalAt: packageForm.estimatedArrivalAt || null,
        vessel: packageForm.vessel,
        notes: packageForm.notes,
        transitDays,
      };
      const response = await fetch('/api/admin/warehouse/packages', {
        method: packageForm.id ? 'PATCH' : 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save package.');
      setMessage(
        result.wasExisting
          ? 'Package updated. Same tracking number was matched, so nothing was duplicated.'
          : 'Package created and sent toward Shipping.',
      );
      setEditingPackage(false);
      setPackageForm(EMPTY_PACKAGE);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save package.');
    } finally {
      setSavingPackage(false);
    }
  };

  const sendWorkbook = async (mode: 'preview' | 'apply') => {
    if (!file) {
      setError('Choose an .xlsx workbook first.');
      return;
    }
    setUploading(true);
    setMessage('');
    setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('mode', mode);
      body.set('transitDays', String(transitDays));
      const response = await fetch('/api/admin/warehouse/import', {
        method: 'POST',
        headers: await authHeaders(false),
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not process this workbook.');
      if (mode === 'apply') {
        setPreview((previous) =>
          previous
            ? {
                ...previous,
                summary: {
                  ...previous.summary,
                  ...(result.summary || {}),
                },
              }
            : {
                summary: result.summary,
                rows: Array.isArray(result.rows) ? result.rows : [],
                previewLimited: Boolean(result.previewLimited),
              },
        );
        setMessage(
          `${result.summary?.imported ?? 0} packages created. ${result.summary?.updated ?? 0} existing packages updated.`,
        );
        await load();
      } else {
        if (result.defaultTransitDays) setTransitDays(Number(result.defaultTransitDays) || 45);
        setPreview({
          summary: result.summary,
          rows: Array.isArray(result.rows) ? result.rows : [],
          previewLimited: Boolean(result.previewLimited),
        });
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not process this workbook.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-slate-500">Loading warehouse desk…</p>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <form onSubmit={saveWarehouse} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-brand-accent">
              <Warehouse size={22} />
            </span>
            <div>
              <h2 className="font-bold text-brand-primary">China warehouse address</h2>
              <p className="text-sm text-slate-500">Customers see this with their personal shipping mark.</p>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Published
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Warehouse name
            <input
              required
              value={form.warehouseName}
              onChange={(event) => setForm({ ...form, warehouseName: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Contact person
            <input
              value={form.contactName}
              onChange={(event) => setForm({ ...form, contactName: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Ghana tracking phone
            <input
              value={form.ghanaTrackingPhone}
              onChange={(event) => setForm({ ...form, ghanaTrackingPhone: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
              placeholder="+233 ..."
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            China tracking phone
            <input
              value={form.trackingWhatsapp}
              onChange={(event) => setForm({ ...form, trackingWhatsapp: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
              placeholder="+86 ..."
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Chinese address
            <textarea
              value={form.addressChinese}
              onChange={(event) => setForm({ ...form, addressChinese: event.target.value })}
              className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
              placeholder="佛山市里水镇五一村大道2号里德仓1号仓"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Do not include 入仓号 here. Entry numbers are added automatically on the customer label.
            </span>
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Warehouse entry numbers
            <input
              value={form.entryNumbers}
              onChange={(event) => setForm({ ...form, entryNumbers: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
              placeholder="18620853884;18620788554"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            English address for staff only
            <textarea
              value={form.addressEnglish}
              onChange={(event) => setForm({ ...form, addressEnglish: event.target.value })}
              className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Customers do not see the English address.
            </span>
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Customer instructions
            <textarea
              value={form.instructions}
              onChange={(event) => setForm({ ...form, instructions: event.target.value })}
              className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
            />
          </label>
        </div>
        <button
          disabled={saving}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-5 text-sm font-bold text-white disabled:opacity-60"
        >
          <Save size={17} />
          {saving ? 'Saving…' : 'Save warehouse'}
        </button>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-bold text-brand-primary">Customer shipping marks</h2>
            <p className="text-sm text-slate-500">Search a registered trader before checking a carton.</p>
          </div>
          <input
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 px-4 text-sm sm:w-72"
            placeholder="Search mark, name, email or phone"
          />
        </div>
        <div className="mt-4 max-h-80 divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200">
          {visibleCustomers.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No matching customer.</p>
          ) : (
            visibleCustomers.map((customer) => (
              <div key={customer.id} className="grid gap-2 p-3 sm:grid-cols-[12rem_1fr] sm:items-center">
                <p className="font-mono text-sm font-bold text-brand-primary">{customer.shipping_mark}</p>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {customer.full_name || customer.email}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {[customer.email, customer.phone].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        {!customerSearch && customers.length > 30 ? (
          <p className="mt-2 text-xs text-slate-500">Showing the 30 newest customers. Search to find anyone else.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-brand-primary">Manual package</h2>
            <p className="text-sm text-slate-500">
              Add one package by hand, or edit a package after CSV upload when a row needs a fix.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewPackage}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-bold text-white"
          >
            <Plus size={17} />
            Add package
          </button>
        </div>

        {editingPackage ? (
          <form onSubmit={savePackage} className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Shipping mark
              <input
                required
                disabled={Boolean(packageForm.id)}
                value={packageForm.shippingMark}
                onChange={(event) =>
                  setPackageForm({ ...packageForm, shippingMark: event.target.value.toUpperCase() })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal disabled:bg-slate-100"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Tracking number
              <input
                required
                disabled={Boolean(packageForm.id)}
                value={packageForm.trackingNumber}
                onChange={(event) =>
                  setPackageForm({ ...packageForm, trackingNumber: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal disabled:bg-slate-100"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              Description
              <input
                value={packageForm.description}
                onChange={(event) =>
                  setPackageForm({ ...packageForm, description: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              CBM
              <input
                required
                type="number"
                min="0.0001"
                step="any"
                value={packageForm.cbm}
                onChange={(event) => setPackageForm({ ...packageForm, cbm: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Cartons
              <input
                type="number"
                min="1"
                step="1"
                value={packageForm.cartons}
                onChange={(event) => setPackageForm({ ...packageForm, cartons: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Class
              <select
                value={packageForm.goodsClass}
                onChange={(event) =>
                  setPackageForm({ ...packageForm, goodsClass: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
              >
                <option value="normal">Normal</option>
                <option value="sensitive">Sensitive</option>
                <option value="heavy">Heavy</option>
                <option value="bulk">Bulk</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Custom USD / CBM
              <input
                type="number"
                min="1"
                step="any"
                disabled={packageForm.goodsClass !== 'custom'}
                value={packageForm.customUsdPerCbm}
                onChange={(event) =>
                  setPackageForm({ ...packageForm, customUsdPerCbm: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal disabled:bg-slate-100"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Received date
              <input
                type="date"
                value={packageForm.receivedAt}
                onChange={(event) =>
                  setPackageForm({ ...packageForm, receivedAt: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Loaded date
              <input
                type="date"
                value={packageForm.loadedAt}
                onChange={(event) =>
                  setPackageForm({ ...packageForm, loadedAt: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Arrival date override
              <input
                type="date"
                value={packageForm.estimatedArrivalAt}
                onChange={(event) =>
                  setPackageForm({ ...packageForm, estimatedArrivalAt: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Leave blank to use loaded date plus {transitDays} transit days when newly loaded.
              </span>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Vessel
              <input
                value={packageForm.vessel}
                onChange={(event) => setPackageForm({ ...packageForm, vessel: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              Notes
              <textarea
                value={packageForm.notes}
                onChange={(event) => setPackageForm({ ...packageForm, notes: event.target.value })}
                className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                disabled={savingPackage}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-accent px-5 text-sm font-bold text-white disabled:opacity-60"
              >
                <Save size={17} />
                {savingPackage ? 'Saving…' : packageForm.id ? 'Save changes' : 'Create package'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingPackage(false);
                  setPackageForm(EMPTY_PACKAGE);
                }}
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">Recent freight packages</p>
          <input
            value={packageSearch}
            onChange={(event) => setPackageSearch(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 px-4 text-sm sm:w-72"
            placeholder="Search mark, tracking or SHP"
          />
        </div>
        <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {visiblePackages.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No freight packages yet.</p>
          ) : (
            visiblePackages.map((pkg) => (
              <div
                key={pkg.id}
                className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {pkg.description || 'Warehouse package'}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {pkg.shipping_mark_snapshot}, {pkg.supplier_tracking_number}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {linkedShipping(pkg)?.tracking_id || 'Pending SHP'},{' '}
                    {pkg.cbm != null ? `${Number(pkg.cbm).toFixed(4)} CBM` : 'No CBM'},{' '}
                    {pkg.loaded_at ? 'Loaded' : pkg.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEditPackage(pkg)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-brand-primary"
                >
                  <Pencil size={15} />
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <FileSpreadsheet size={22} />
          </span>
          <div>
            <h2 className="font-bold text-brand-primary">Import warehouse workbook</h2>
            <p className="text-sm text-slate-500">
              Preview first. Same tracking number updates the existing package. New tracking numbers
              are added.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_12rem]">
          <div className="rounded-xl border border-dashed border-slate-300 p-5">
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setPreview(null);
                setMessage('');
                setError('');
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-primary file:px-4 file:py-2.5 file:font-bold file:text-white"
            />
            <p className="mt-2 text-xs text-slate-500">
              Required columns: shipping mark, tracking number and CBM. Class or Goods Class is
              optional. Blank class defaults to Normal.
            </p>
          </div>
          <label className="text-sm font-semibold text-slate-700">
            Transit days
            <input
              type="number"
              min={1}
              max={180}
              value={transitDays}
              onChange={(event) => setTransitDays(Number(event.target.value) || 45)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Used when a package is newly loaded and no arrival date is in the sheet.
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => void sendWorkbook('preview')}
          disabled={!file || uploading}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          <Upload size={17} />
          {uploading ? 'Reading workbook…' : 'Preview import'}
        </button>

        {preview ? (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['New packages', preview.summary.newPackages],
                ['Updates', preview.summary.updates],
                ['On file', preview.summary.alreadyLoaded || 0],
                ['Unknown marks', preview.summary.unknownMarks],
                ['Class errors', preview.summary.invalidClasses],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xl font-black text-brand-primary">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>

            <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Shipping mark</th>
                    <th className="px-3 py-2">Tracking</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Received</th>
                    <th className="px-3 py-2">Loaded</th>
                    <th className="px-3 py-2">CBM</th>
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Rate</th>
                    <th className="px-3 py-2">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(preview.rows || []).map((row) => (
                    <tr key={`${row.rowNumber}-${row.trackingNumber}`}>
                      <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.shippingMark}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.trackingNumber}</td>
                      <td className="max-w-52 truncate px-3 py-2">{row.description || 'Package'}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.receivedAt ? new Date(row.receivedAt).toLocaleDateString() : 'Missing'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.loadedAt ? new Date(row.loadedAt).toLocaleDateString() : 'Not loaded'}
                      </td>
                      <td className="px-3 py-2">
                        {row.cbm == null || Number.isNaN(Number(row.cbm))
                          ? '—'
                          : Number(row.cbm).toFixed(4)}
                      </td>
                      <td className="px-3 py-2 capitalize">{row.goodsClass}</td>
                      <td className="px-3 py-2">
                        {row.usdPerCbm ? `$${Number(row.usdPerCbm).toFixed(0)} / CBM` : 'Missing'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${matchClass(row.match)}`}
                        >
                          {matchLabel(row.match)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.previewLimited ? (
              <p className="text-xs text-slate-500">Showing the first 250 package rows.</p>
            ) : null}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              New and Update rows create or change packages. On file rows stay matched to the same
              tracking number and do not restart their countdown unless the loaded date changes.
              Unknown marks, duplicates and class errors are skipped for correction. For one wrong
              row after upload, use Edit above instead of re-uploading everything.
            </div>

            <button
              type="button"
              onClick={() => void sendWorkbook('apply')}
              disabled={uploading || preview.summary.ready === 0 || preview.summary.imported != null}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-accent px-5 font-bold text-white disabled:opacity-50"
            >
              <CheckCircle2 size={18} />
              {uploading ? 'Applying…' : `Apply ${preview.summary.ready} package rows`}
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-brand-primary">Expected at warehouse</h2>
            <p className="text-sm text-slate-500">
              Customers submitted these tracking numbers before warehouse arrival.
            </p>
          </div>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-800">
            {expectedPackages.length}
          </span>
        </div>
        {expectedPackages.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 py-8 text-center">
            <p className="text-sm font-semibold text-slate-600">No packages are currently expected</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {expectedPackages.map((pkg) => (
              <div key={pkg.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-semibold text-slate-900">{pkg.description || 'Incoming package'}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {pkg.supplier_tracking_number}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {pkg.shipping_mark_snapshot} {pkg.customer_email ? `(${pkg.customer_email})` : ''}
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(pkg.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {batches.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-brand-primary">Recent imports</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {batches.map((batch) => (
              <div key={batch.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-800">{batch.file_name}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(batch.created_at).toLocaleString()}. {batch.source_sheet}
                  </p>
                </div>
                <p className="text-xs font-semibold text-slate-600">
                  {batch.imported_rows} created. {batch.updated_rows || 0} updated.{' '}
                  {batch.unmatched_rows} unmatched. {batch.error_rows} errors.
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
