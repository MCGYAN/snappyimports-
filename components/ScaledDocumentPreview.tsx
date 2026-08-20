'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const DESKTOP_PAGE_WIDTH = 794;

/**
 * Renders the desktop invoice/receipt layout at its real width, then scales it
 * down to fit the phone. Keeps the same structure as desktop and PDF
 * (including the horizontal payment footer).
 */
export default function ScaledDocumentPreview({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pageHeight, setPageHeight] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    const page = pageRef.current;
    if (!frame || !page) return;

    const update = () => {
      const nextScale = Math.min(1, frame.clientWidth / DESKTOP_PAGE_WIDTH);
      setScale(nextScale);
      setPageHeight(page.scrollHeight);
    };

    update();
    const resize = new ResizeObserver(update);
    resize.observe(frame);
    resize.observe(page);
    return () => resize.disconnect();
  }, [children]);

  return (
    <div ref={frameRef} className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className="relative w-full"
        style={{ height: pageHeight ? pageHeight * scale : undefined }}
      >
        <div
          ref={pageRef}
          className="origin-top-left bg-white p-5"
          style={{
            width: DESKTOP_PAGE_WIDTH,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
