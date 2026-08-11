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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function waitForImages(root: HTMLElement, ms = 4000): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : withTimeout(
              new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }),
              ms,
              'image load',
            ).catch(() => undefined),
    ),
  );
}

/**
 * Capture a rate card DOM node to PNG.
 * Renders a temporary on-screen clone so html2canvas does not hang on hidden nodes.
 */
export async function captureElementPng(
  element: HTMLElement,
  scale = 2,
): Promise<Blob> {
  const width =
    element.offsetWidth ||
    Number.parseInt(String(element.style.width).replace('px', ''), 10) ||
    720;
  const height =
    element.offsetHeight ||
    Number.parseInt(String(element.style.height).replace('px', ''), 10) ||
    720;

  const host = document.createElement('div');
  host.setAttribute('data-rate-card-capture-host', '1');
  // Keep it on-screen and tiny-opacity so browsers still paint images/fonts.
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${width}px`,
    `height:${height}px`,
    'opacity:0.01',
    'pointer-events:none',
    'z-index:2147483646',
    'overflow:hidden',
    'background:#ffffff',
  ].join(';');

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.margin = '0';
  clone.style.opacity = '1';
  // Drop crossOrigin so same-origin logo never trips CORS waits.
  clone.querySelectorAll('img').forEach((img) => {
    img.removeAttribute('crossorigin');
    img.decoding = 'sync';
  });

  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await waitForImages(clone, 3000);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const { default: html2canvas } = await import('html2canvas');
    const canvas = await withTimeout(
      html2canvas(clone, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: -window.scrollY,
        x: 0,
        y: 0,
        foreignObjectRendering: false,
        imageTimeout: 5000,
        removeContainer: true,
      }),
      12000,
      'Poster capture',
    );

    const blob = await withTimeout(
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error('Could not create rate card image'));
              return;
            }
            resolve(b);
          },
          'image/png',
          1,
        );
      }),
      5000,
      'PNG encode',
    );

    return blob;
  } finally {
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

/** True when the browser can hand image + caption to WhatsApp via the OS share sheet. */
export function canShareImageAndCaption(file: File): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  try {
    if (typeof navigator.canShare === 'function') {
      return (
        navigator.canShare({ files: [file], text: 'x' }) ||
        navigator.canShare({ files: [file] })
      );
    }
    // Older Web Share: attempt share; callers still catch failures.
    return true;
  } catch {
    return false;
  }
}

/**
 * Prefer OS share sheet so WhatsApp receives image + caption together.
 * wa.me links can only carry text, so download+caption is last-resort only.
 */
export async function shareRateCardFile(opts: {
  blob: Blob;
  filename: string;
  caption: string;
}): Promise<'shared' | 'downloaded_and_whatsapp' | 'whatsapp_only'> {
  const file = new File([opts.blob], opts.filename, { type: 'image/png' });

  if (canShareImageAndCaption(file)) {
    try {
      // Do not timeout while the share sheet is open. User may take time to pick WhatsApp.
      const payload: ShareData = {
        files: [file],
        text: opts.caption,
        title: 'Snappy Buy RMB rate',
      };
      if (navigator.canShare?.(payload)) {
        await navigator.share(payload);
      } else {
        await navigator.share({ files: [file], text: opts.caption });
      }
      return 'shared';
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      // Fall through only if share truly failed (unsupported target, etc.)
    }
  }

  downloadBlob(opts.blob, opts.filename);
  window.open(whatsappShareUrl(opts.caption), '_blank', 'noopener,noreferrer');
  return 'downloaded_and_whatsapp';
}
