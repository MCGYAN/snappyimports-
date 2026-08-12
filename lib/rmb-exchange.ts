export type ExchangeDirection = 'ghs_to_rmb' | 'rmb_to_ghs' | 'ngn_to_rmb' | 'tzs_to_rmb';

export type ExchangeRateBoard = {
  buy_rmb_rate: number;
  sell_rmb_rate: number;
  /** @deprecated use min_amount on corridor boards */
  min_amount_ghs?: number;
  max_amount_ghs?: number | null;
  min_amount?: number;
  max_amount?: number | null;
  notes: string | null;
  valid_until: string | null;
  updated_at?: string;
  is_live?: boolean;
  country_code?: string;
  currency_code?: string;
};

export {
  formatCorridorBuyRate as formatBuyRateForCountry,
  quoteLocalToRmb,
  type ExchangeCountryCode,
} from '@/lib/exchange-corridors';

import {
  formatCorridorBuyRate,
  quoteLocalToRmb,
  type ExchangeCountryCode,
} from '@/lib/exchange-corridors';

export function isRateValid(board: ExchangeRateBoard | null | undefined): boolean {
  if (!board) return false;
  if (board.is_live === false) return false;
  if (!(Number(board.buy_rmb_rate) > 0)) return false;
  if (!board.valid_until) return true;
  return new Date(board.valid_until).getTime() > Date.now();
}

/** Customer pays GHS to get RMB — rate is RMB per 1 GH¢ (e.g. 0.59). */
export function quoteGhsToRmb(ghsAmount: number, rate: number) {
  return quoteLocalToRmb(ghsAmount, rate, 'GH');
}

/** @deprecated Sell flow removed from storefront; kept for legacy rows. */
export function quoteRmbToGhs(rmbAmount: number, rate: number) {
  const amountFrom = Math.max(0, rmbAmount);
  const amountTo = rate > 0 ? amountFrom / rate : 0;
  return { amountFrom, amountTo, rate, currencyFrom: 'RMB', currencyTo: 'GHS' };
}

/** Format board rate for customers: 1 GH¢ = X RMB (Ghana default for posters). */
export function formatBuyRate(rmbPerGhs: number, digits = 2): string {
  return formatCorridorBuyRate(rmbPerGhs, 'GH', digits);
}

export function formatBuyRateFor(
  rmbPerLocal: number,
  country: ExchangeCountryCode = 'GH',
  digits = 2,
): string {
  return formatCorridorBuyRate(rmbPerLocal, country, digits);
}

export function createExchangeNumber(): string {
  return `EX-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
}

export const EXCHANGE_DUE_HOURS = Number(process.env.NEXT_PUBLIC_EXCHANGE_DUE_HOURS || 2);
