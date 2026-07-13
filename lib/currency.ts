/** Store display currency — Ghana Cedis */

export const STORE_CURRENCY = 'GHS';
export const STORE_CURRENCY_SYMBOL = 'GH¢';

export function formatStoreMoney(
  amount: number,
  currency: string = STORE_CURRENCY,
): string {
  const code = (currency || STORE_CURRENCY).toUpperCase();
  const symbol =
    code === 'GHS' || code === 'GH¢' || code === 'GHC'
      ? STORE_CURRENCY_SYMBOL
      : code === 'USD'
        ? '$'
        : `${code} `;
  return `${symbol}${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
