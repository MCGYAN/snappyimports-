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
    'Snappy Imports Global. Buy RMB',
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

async function waitForImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) return;
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        // Force decode when already cached but not painted yet
        if (typeof img.decode === 'function') {
          img.decode().then(done).catch(done);
        }
      });
    }),
  );
}

/** Inline <img> sources as data URLs so html2canvas never clips remote/cached assets. */
async function inlineImagesAsDataUrls(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith('data:')) return;
      try {
        const res = await fetch(src, { cache: 'force-cache' });
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        if (dataUrl) img.src = dataUrl;
      } catch {
        // Keep original src; capture may still work same-origin
      }
    }),
  );
}

export async function captureElementPng(
  element: HTMLElement,
  scale = 2,
): Promise<Blob> {
  await waitForImages(element);
  await inlineImagesAsDataUrls(element);
  // Let the browser paint inlined images before snapshot
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const { default: html2canvas } = await import('html2canvas');
  const width = element.offsetWidth || element.clientWidth;
  const height = element.offsetHeight || element.clientHeight;

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0,
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
