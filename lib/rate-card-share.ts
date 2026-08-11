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

/** Inline images as data URLs so html2canvas matches the on-screen preview. */
async function inlineImagesAsDataUrls(root: HTMLElement): Promise<() => void> {
  const images = Array.from(root.querySelectorAll('img'));
  const restores: Array<() => void> = [];

  await Promise.all(
    images.map(async (img) => {
      const original = img.getAttribute('src') || '';
      if (!original || original.startsWith('data:')) return;

      try {
        const res = await fetch(original, { cache: 'force-cache' });
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('read failed'));
          reader.readAsDataURL(blob);
        });
        if (!dataUrl) return;
        img.setAttribute('src', dataUrl);
        restores.push(() => img.setAttribute('src', original));
        if (!img.complete) {
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        }
      } catch {
        /* keep original src */
      }
    }),
  );

  return () => {
    for (const restore of restores) restore();
  };
}

/**
 * Capture a rate card DOM node to PNG.
 * Prefer a visible preview node. Off-screen transforms break logo rendering.
 */
export async function captureElementPng(
  element: HTMLElement,
  scale = 2,
): Promise<Blob> {
  const width = element.offsetWidth || Number.parseInt(element.style.width, 10) || 720;
  const height = element.offsetHeight || Number.parseInt(element.style.height, 10) || 720;

  const host = document.createElement('div');
  host.setAttribute('data-rate-card-capture-host', '1');
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'width:' + width + 'px',
    'height:' + height + 'px',
    'opacity:0',
    'pointer-events:none',
    'z-index:-1',
    'overflow:hidden',
  ].join(';');

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.margin = '0';
  clone.removeAttribute('class');
  host.appendChild(clone);
  document.body.appendChild(host);

  const restoreImages = await inlineImagesAsDataUrls(clone);

  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(clone, {
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
      foreignObjectRendering: false,
      imageTimeout: 15000,
    });

    return await new Promise<Blob>((resolve, reject) => {
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
  } finally {
    restoreImages();
    host.remove();
  }
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
