export type WarehouseLabelSource = {
  shippingMark?: string | null;
  traderPhone?: string | null;
  addressChinese?: string | null;
  entryNumbers?: string | null;
  ghanaTrackingPhone?: string | null;
  chinaTrackingPhone?: string | null;
};

function cleanText(value?: string | null): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/** Remove trailing 入仓号 / entry-number fragments so we can rebuild the line cleanly. */
export function stripEntryNumbersFromChineseAddress(address?: string | null): string {
  return cleanText(address)
    .replace(/入仓号[:：]?\s*[\d;\s,，]+$/u, '')
    .replace(/Contact:\s*[\d;\s+,]+$/i, '')
    .trim();
}

export function formatTraderPhoneForLabel(phone?: string | null): string {
  const raw = cleanText(phone);
  if (!raw) return '';

  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length >= 12) {
    const local = digits.slice(3);
    return `+233 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`.trim();
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+233 ${digits.slice(1, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return raw;
}

export function buildChineseAddressLine({
  shippingMark,
  addressChinese,
  entryNumbers,
}: Pick<WarehouseLabelSource, 'shippingMark' | 'addressChinese' | 'entryNumbers'>): string {
  const mark = cleanText(shippingMark);
  const address = stripEntryNumbersFromChineseAddress(addressChinese);
  const entries = cleanText(entryNumbers).replace(/\s*;\s*/g, ';').replace(/\s+/g, '');

  if (!mark && !address) return '';
  if (!entries) return [mark, address].filter(Boolean).join(' ');
  return `${[mark, address].filter(Boolean).join(' ')}入仓号${entries}`;
}

export function buildCustomerShippingLabel(source: WarehouseLabelSource): string {
  const mark = cleanText(source.shippingMark);
  const phone = formatTraderPhoneForLabel(source.traderPhone);
  const addressLine = buildChineseAddressLine(source);
  const ghana = cleanText(source.ghanaTrackingPhone);
  const china = cleanText(source.chinaTrackingPhone);

  const lines: string[] = [];
  if (ghana) lines.push(`Ghana tracking: ${ghana}`);
  if (china) lines.push(`China tracking: ${china}`);
  if (ghana || china) lines.push('');
  if (addressLine) lines.push(addressLine);
  lines.push('');
  lines.push('唛头');
  lines.push(mark || 'Shipping mark pending');
  lines.push('（电话）：');
  lines.push(`(电话):${phone || 'Add your telephone in Profile Settings'}`);

  return lines.join('\n');
}
