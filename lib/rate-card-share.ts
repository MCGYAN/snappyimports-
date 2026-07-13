/** Client helpers for Buy RMB WhatsApp rate posters. */

import { formatBuyRate } from '@/lib/rmb-exchange';

export type RateCardShareInput = {
  buyRate: number;
  validUntil?: string | null;
  buyUrl?: string;
};

/** Clean 3-decimal poster number (e.g. 0.552). */
export function posterRateNumber(buyRate: number): string {
  return (Number(buyRate) || 0).toFixed(3);
}

export function buildRateShareCaption(input: RateCardShareInput): string {
  const rateLine = formatBuyRate(input.buyRate, 3);
  const lines = [
    'Snappy Imports Global · Buy RMB',
    `Today's rate: ${rateLine}`,
  ];
  if (input.validUntil) {
    const when = new Date(input.validUntil);
    if (!Number.isNaN(when.getTime())) {
      lines.push(`Valid until ${when.toLocaleString()}`);
    }
  }
  lines.push('Pay cedis. Get RMB in China.');
  if (input.buyUrl) {
    lines.push(input.buyUrl);
  }
  return lines.join('\n');
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function captureElementPng(
  element: HTMLElement,
  scale = 2,
): Promise<Blob> {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
    ),
  );

  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: element.offsetWidth,
    height: element.offsetHeight,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not create rate card image'));
          return;
        }
        resolve(blob);
      },
      'image/png',
      1,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[^\w.\-]+/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function shareRateCardFile(opts: {
  blob: Blob;
  filename: string;
  caption: string;
}): Promise<'shared' | 'downloaded_and_whatsapp' | 'whatsapp_only'> {
  const file = new File([opts.blob], opts.filename, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        text: opts.caption,
        title: 'Snappy Buy RMB rate',
      });
      return 'shared';
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      // Fall through to download + WhatsApp
    }
  }

  downloadBlob(opts.blob, opts.filename);
  window.open(whatsappShareUrl(opts.caption), '_blank', 'noopener,noreferrer');
  return 'downloaded_and_whatsapp';
}
