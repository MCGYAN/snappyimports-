/** Client-side: capture a DOM node and save it as a PDF download. */

/** A4 proportions at 96dpi. Rendering at this fixed width means phones and
 *  desktops produce the exact same document. */
const RENDER_WIDTH_PX = 794;
const RENDER_PADDING_PX = 40;

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

export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

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

    if (fullHeightMm <= usableHeight) {
      // Everything fits on one official page
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        margin,
        margin,
        usableWidth,
        fullHeightMm,
      );
    } else {
      // Paginate by cropping clean, non-overlapping slices of the canvas so
      // no row is duplicated or cut across the page boundary region.
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
    }

    const safeName = filename.replace(/[^\w.\-]+/g, '_');
    pdf.save(safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`);
  } finally {
    stage.remove();
  }
}
