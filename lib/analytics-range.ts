export const ANALYTICS_MAX_MONTHS = 3;
export const ANALYTICS_PAGE_SIZE = 50;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function daysAgoIsoDay(days: number) {
  return isoDay(new Date(Date.now() - days * 86_400_000));
}

export function latestAllowedStart(to: string) {
  const d = new Date(`${to}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() - ANALYTICS_MAX_MONTHS);
  return isoDay(d);
}

/** Returns an error message, or null when the range is usable. */
export function validateAnalyticsRange(from: string, to: string): string | null {
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) return 'Choose a start and end date.';
  if (to < from) return 'End date must be on or after the start date.';
  if (from < latestAllowedStart(to)) {
    return `Choose a range of ${ANALYTICS_MAX_MONTHS} months or less.`;
  }
  return null;
}

export function parseAnalyticsRange(searchParams: URLSearchParams) {
  const from = String(searchParams.get('from') || '');
  const to = String(searchParams.get('to') || '');
  const error = validateAnalyticsRange(from, to);
  if (error) return { error } as const;
  return {
    from: `${from}T00:00:00.000Z`,
    to: `${to}T23:59:59.999Z`,
  } as const;
}

export type RangePreset = { id: string; label: string; range: () => { from: string; to: string } };

export const RANGE_PRESETS: RangePreset[] = [
  { id: '7d', label: '7 days', range: () => ({ from: daysAgoIsoDay(6), to: isoDay(new Date()) }) },
  { id: '30d', label: '30 days', range: () => ({ from: daysAgoIsoDay(29), to: isoDay(new Date()) }) },
  {
    id: 'month',
    label: 'This month',
    range: () => {
      const now = new Date();
      return {
        from: isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
        to: isoDay(now),
      };
    },
  },
  {
    id: 'last-month',
    label: 'Last month',
    range: () => {
      const now = new Date();
      return {
        from: isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))),
        to: isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))),
      };
    },
  },
  {
    id: '3m',
    label: '3 months',
    range: () => {
      const to = isoDay(new Date());
      return { from: latestAllowedStart(to), to };
    },
  },
];
