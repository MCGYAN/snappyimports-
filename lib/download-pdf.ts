/** Client-side: capture a DOM node and save it as a PDF download. */

import {
  INVOICE_A4_ATTR,
  INVOICE_FOOTER_ATTR,
  INVOICE_FOOTER_BOTTOM_PX,
  INVOICE_MODE_ATTR,
  INVOICE_PAGE_HEIGHT_PX,
  type InvoicePdfMode,
} from '@/lib/invoice-layout';

/** A4 proportions at 96dpi. Rendering at this fixed width means phones and
 *  desktops produce the exact same document. */
const RENDER_WIDTH_PX = 794;
const RENDER_PADDING_PX = 40;
const A4_CAPTURE_HEIGHT_PX = Math.round(RENDER_WIDTH_PX * (297 / 210));

let pdfLibrariesPromise:
  | Promise<
      [
        typeof import('html2canvas'),
        typeof import('jspdf'),
      ]
    >
  | undefined;

function loadPdfLibraries() {
  pdfLibrariesPromise ??= Promise.all([import('html2canvas'), import('jspdf')]);
  return pdfLibrariesPromise;
}

/** Warm the PDF code after a document list settles, before the customer taps Download. */
export function preloadPdfLibraries(): void {
  void loadPdfLibraries();
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
    ),
  );
}

/**
 * Copy the browser's computed typography/spacing onto the clone as inline
 * styles. html2canvas re-renders the DOM in its own sandbox and can lose
 * class-based line-height / margins, which makes the PDF look airier than the
 * on-screen invoice. Inline styles always survive the capture.
 */
function inlineComputedSpacing(source: HTMLElement, clone: HTMLElement): void {
  const sourceNodes = [source, ...Array.from(source.querySelectorAll<HTMLElement>('*'))];
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];

  sourceNodes.forEach((orig, i) => {
    const target = cloneNodes[i];
    if (!target) return;
    const cs = window.getComputedStyle(orig);

    target.style.marginTop = cs.marginTop;
    target.style.marginBottom = cs.marginBottom;
    target.style.marginLeft = cs.marginLeft;
    target.style.marginRight = cs.marginRight;
    target.style.paddingTop = cs.paddingTop;
    target.style.paddingBottom = cs.paddingBottom;
    target.style.paddingLeft = cs.paddingLeft;
    target.style.paddingRight = cs.paddingRight;
    target.style.fontSize = cs.fontSize;
    target.style.letterSpacing = cs.letterSpacing;

    const fontPx = parseFloat(cs.fontSize);
    target.style.lineHeight =
      cs.lineHeight === 'normal' && Number.isFinite(fontPx)
        ? `${Math.round(fontPx * 1.35)}px`
        : cs.lineHeight;
  });
}

function findInvoicePageRoot(node: HTMLElement): HTMLElement | null {
  if (node.hasAttribute(INVOICE_A4_ATTR) || node.hasAttribute(INVOICE_MODE_ATTR)) return node;
  return node.querySelector<HTMLElement>(`[${INVOICE_A4_ATTR}], [${INVOICE_MODE_ATTR}]`);
}

function getInvoiceCaptureMode(clone: HTMLElement): InvoicePdfMode | null {
  const pageRoot = findInvoicePageRoot(clone);
  if (!pageRoot) return null;
  const mode = pageRoot.getAttribute(INVOICE_MODE_ATTR);
  if (mode === 'multi') return 'multi';
  if (pageRoot.hasAttribute(INVOICE_A4_ATTR) || mode === 'single') return 'single';
  return null;
}

/**
 * html2canvas ignores flex footers. Pin payment details with absolute positioning
 * inside a fixed-height A4 page so short invoices match print layout.
 */
function prepareSinglePageInvoiceForCapture(clone: HTMLElement): boolean {
  if (getInvoiceCaptureMode(clone) !== 'single') return false;

  const pageRoot = findInvoicePageRoot(clone);
  if (!pageRoot) return false;

  pageRoot.style.position = 'relative';
  pageRoot.style.display = 'block';
  pageRoot.style.boxSizing = 'border-box';
  pageRoot.style.height = `${INVOICE_PAGE_HEIGHT_PX}px`;
  pageRoot.style.minHeight = `${INVOICE_PAGE_HEIGHT_PX}px`;
  pageRoot.style.maxHeight = `${INVOICE_PAGE_HEIGHT_PX}px`;
  pageRoot.style.overflow = 'hidden';

  const footer = pageRoot.querySelector<HTMLElement>(`[${INVOICE_FOOTER_ATTR}]`);
  if (footer) {
    footer.style.position = 'absolute';
    footer.style.left = '0';
    footer.style.right = '0';
    footer.style.bottom = `${INVOICE_FOOTER_BOTTOM_PX}px`;
    footer.style.marginTop = '0';
    footer.style.paddingBottom = `${INVOICE_FOOTER_BOTTOM_PX}px`;
    footer.style.background = '#ffffff';
    footer.style.zIndex = '10';
  }

  return true;
}

export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await loadPdfLibraries();

  // Clone into a fixed-width off-screen stage so the capture is independent
  // of the visitor's screen size (prevents wrapped/cut text on mobile).
  const stage = document.createElement('div');
  stage.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'box-sizing:border-box',
    `width:${RENDER_WIDTH_PX}px`,
    `padding:${RENDER_PADDING_PX}px`,
    'background:#ffffff',
    'z-index:-1',
  ].join(';');

  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.remove('hidden');
  clone.style.display = 'block';
  inlineComputedSpacing(element, clone);
  const captureMode = getInvoiceCaptureMode(clone);
  const singlePageInvoice = prepareSinglePageInvoiceForCapture(clone);
  stage.appendChild(clone);
  document.body.appendChild(stage);

  try {
    await waitForImages(stage);
    // Give the browser a frame to lay the clone out before capture
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(stage, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: RENDER_WIDTH_PX,
      windowWidth: RENDER_WIDTH_PX,
      ...(singlePageInvoice
        ? {
            height: A4_CAPTURE_HEIGHT_PX,
            windowHeight: A4_CAPTURE_HEIGHT_PX,
          }
        : {}),
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const fullHeightMm = (canvas.height * usableWidth) / canvas.width;

    if (singlePageInvoice) {
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        margin,
        margin,
        usableWidth,
        usableHeight,
      );
    } else if (captureMode === 'multi' || fullHeightMm > usableHeight) {
      const slicePxHeight = Math.floor((usableHeight / usableWidth) * canvas.width);
      let renderedPx = 0;
      let pageIndex = 0;

      while (renderedPx < canvas.height) {
        const currentSlicePx = Math.min(slicePxHeight, canvas.height - renderedPx);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSlicePx;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) break;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          renderedPx,
          canvas.width,
          currentSlicePx,
          0,
          0,
          canvas.width,
          currentSlicePx,
        );

        if (pageIndex > 0) pdf.addPage();
        const sliceHeightMm = (currentSlicePx * usableWidth) / canvas.width;
        pdf.addImage(
          sliceCanvas.toDataURL('image/png'),
          'PNG',
          margin,
          margin,
          usableWidth,
          sliceHeightMm,
        );

        renderedPx += currentSlicePx;
        pageIndex += 1;
      }
    } else {
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        margin,
        margin,
        usableWidth,
        fullHeightMm,
      );
    }

    const safeName = filename.replace(/[^\w.\-]+/g, '_');
    pdf.save(safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`);
  } finally {
    stage.remove();
  }
}
