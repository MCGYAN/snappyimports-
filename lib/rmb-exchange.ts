export type ExchangeDirection = 'ghs_to_rmb' | 'rmb_to_ghs';

export type ExchangeRateBoard = {
  buy_rmb_rate: number;
  sell_rmb_rate: number;
  min_amount_ghs: number;
  max_amount_ghs: number | null;
  notes: string | null;
  valid_until: string | null;
  updated_at?: string;
};

export function isRateValid(board: ExchangeRateBoard | null | undefined): boolean {
  if (!board) return false;
  if (!board.valid_until) return true;
  return new Date(board.valid_until).getTime() > Date.now();
}

/** Customer pays GHS to get RMB — rate is RMB per 1 GH¢ (e.g. 0.59). */
export function quoteGhsToRmb(ghsAmount: number, rate: number) {
  const amountFrom = Math.max(0, ghsAmount);
  const amountTo = rate > 0 ? amountFrom * rate : 0;
  return { amountFrom, amountTo, rate, currencyFrom: 'GHS', currencyTo: 'RMB' };
}

/** @deprecated Sell flow removed from storefront; kept for legacy rows. */
export function quoteRmbToGhs(rmbAmount: number, rate: number) {
  const amountFrom = Math.max(0, rmbAmount);
  const amountTo = rate > 0 ? amountFrom / rate : 0;
  return { amountFrom, amountTo, rate, currencyFrom: 'RMB', currencyTo: 'GHS' };
}

/** Format board rate for customers: 1 GH¢ = X RMB */
export function formatBuyRate(rmbPerGhs: number, digits = 2): string {
  const n = Number(rmbPerGhs) || 0;
  return `1 GH¢ = ${n.toFixed(digits)} RMB`;
}

export function createExchangeNumber(): string {
  return `EX-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
}

export const EXCHANGE_DUE_HOURS = Number(process.env.NEXT_PUBLIC_EXCHANGE_DUE_HOURS || 2);
