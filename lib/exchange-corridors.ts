/** Buy RMB corridors: Ghana, Nigeria, Tanzania → Alipay RMB */

import type { BankAccount } from '@/lib/bank-details';
import { SNAPPY_BANK_ACCOUNTS } from '@/lib/bank-details';

export type ExchangeCountryCode = 'GH' | 'NG' | 'TZ';

export type ExchangeCorridorMeta = {
  code: ExchangeCountryCode;
  name: string;
  currencyCode: 'GHS' | 'NGN' | 'TZS';
  currencyLabel: string;
  /** Short unit label in rate lines, e.g. GH¢ */
  unitLabel: string;
  phoneHint: string;
  phoneExample: string;
  direction: 'ghs_to_rmb' | 'ngn_to_rmb' | 'tzs_to_rmb';
  /** Flag emoji-free label for UI */
  payVerb: string;
};

export const EXCHANGE_CORRIDORS: Record<ExchangeCountryCode, ExchangeCorridorMeta> = {
  GH: {
    code: 'GH',
    name: 'Ghana',
    currencyCode: 'GHS',
    currencyLabel: 'Ghana Cedis (GH¢)',
    unitLabel: 'GH¢',
    phoneHint: 'Ghana WhatsApp / phone (+233)',
    phoneExample: '055… or +233…',
    direction: 'ghs_to_rmb',
    payVerb: 'cedis',
  },
  NG: {
    code: 'NG',
    name: 'Nigeria',
    currencyCode: 'NGN',
    currencyLabel: 'Nigerian Naira (₦)',
    unitLabel: '₦',
    phoneHint: 'Nigeria WhatsApp / phone (+234)',
    phoneExample: '080… or +234…',
    direction: 'ngn_to_rmb',
    payVerb: 'naira',
  },
  TZ: {
    code: 'TZ',
    name: 'Tanzania',
    currencyCode: 'TZS',
    currencyLabel: 'Tanzanian Shillings (TZS)',
    unitLabel: 'TZS',
    phoneHint: 'Tanzania WhatsApp / phone (+255)',
    phoneExample: '07… or +255…',
    direction: 'tzs_to_rmb',
    payVerb: 'shillings',
  },
};

export const EXCHANGE_COUNTRY_CODES = Object.keys(EXCHANGE_CORRIDORS) as ExchangeCountryCode[];

export function isExchangeCountryCode(value: unknown): value is ExchangeCountryCode {
  return value === 'GH' || value === 'NG' || value === 'TZ';
}

export function parseExchangeCountryCode(
  value: unknown,
  fallback: ExchangeCountryCode = 'GH',
): ExchangeCountryCode {
  const raw = String(value || '')
    .trim()
    .toUpperCase();
  return isExchangeCountryCode(raw) ? raw : fallback;
}

export type CorridorRateBoard = {
  country_code: ExchangeCountryCode;
  currency_code: string;
  buy_rmb_rate: number;
  sell_rmb_rate: number;
  min_amount: number;
  max_amount: number | null;
  notes: string | null;
  valid_until: string | null;
  is_live: boolean;
  pay_accounts: BankAccount[];
  updated_at?: string;
};

export function normalizePayAccounts(raw: unknown): BankAccount[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const bank = String(row.bank || '').trim();
      const accountNumber = String(row.accountNumber || row.account_number || '').trim();
      if (!bank || !accountNumber) return null;
      const channelRaw = String(row.channel || 'bank').toLowerCase();
      const channel: BankAccount['channel'] = channelRaw === 'momo' ? 'momo' : 'bank';
      return {
        holder: String(row.holder || 'Snappy Sampson Enterprise').trim() || 'Snappy Sampson Enterprise',
        bank,
        accountNumber,
        branch: String(row.branch || '').trim() || undefined,
        registeredName: String(row.registeredName || row.registered_name || '').trim() || undefined,
        channel,
      } satisfies BankAccount;
    })
    .filter(Boolean) as BankAccount[];
}

export function defaultPayAccountsForCountry(code: ExchangeCountryCode): BankAccount[] {
  if (code === 'GH') return SNAPPY_BANK_ACCOUNTS;
  return [];
}

export function resolvePayAccounts(
  board: Pick<CorridorRateBoard, 'country_code' | 'pay_accounts'> | null | undefined,
  snapshot?: unknown,
): BankAccount[] {
  const fromSnapshot = normalizePayAccounts(snapshot);
  if (fromSnapshot.length) return fromSnapshot;
  const fromBoard = normalizePayAccounts(board?.pay_accounts);
  if (fromBoard.length) return fromBoard;
  return defaultPayAccountsForCountry(board?.country_code || 'GH');
}

export function corridorIsReady(
  board: CorridorRateBoard | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!board) {
    return { ok: false, reason: 'This country’s rate board is not set yet.' };
  }
  if (!board.is_live) {
    return {
      ok: false,
      reason: `${EXCHANGE_CORRIDORS[board.country_code].name} Buy RMB is not open on the site yet. Message Snappy on WhatsApp.`,
    };
  }
  if (!(Number(board.buy_rmb_rate) > 0)) {
    return { ok: false, reason: 'Today’s rate is not published for this country yet.' };
  }
  if (board.valid_until && new Date(board.valid_until).getTime() <= Date.now()) {
    return { ok: false, reason: 'Today’s rate for this country has expired.' };
  }
  const accounts = resolvePayAccounts(board);
  if (!accounts.length) {
    return {
      ok: false,
      reason: 'Local payment accounts for this country are not set yet. Message Snappy on WhatsApp.',
    };
  }
  return { ok: true };
}

export function formatLocalMoney(amount: number, country: ExchangeCountryCode, digits = 2): string {
  const meta = EXCHANGE_CORRIDORS[country];
  const n = Number(amount) || 0;
  const formatted = n.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (country === 'NG') return `₦${formatted}`;
  if (country === 'GH') return `GH¢${formatted}`;
  return `TZS ${formatted}`;
}

export function formatCorridorBuyRate(
  rmbPerLocal: number,
  country: ExchangeCountryCode,
  digits = 2,
): string {
  const n = Number(rmbPerLocal) || 0;
  const unit = EXCHANGE_CORRIDORS[country].unitLabel;
  return `1 ${unit} = ${n.toFixed(digits)} RMB`;
}

/** Customer pays local currency to get RMB — rate is RMB per 1 local unit. */
export function quoteLocalToRmb(
  localAmount: number,
  rate: number,
  country: ExchangeCountryCode,
) {
  const meta = EXCHANGE_CORRIDORS[country];
  const amountFrom = Math.max(0, localAmount);
  const amountTo = rate > 0 ? amountFrom * rate : 0;
  return {
    amountFrom,
    amountTo,
    rate,
    currencyFrom: meta.currencyCode,
    currencyTo: 'RMB' as const,
    country,
    direction: meta.direction,
  };
}
