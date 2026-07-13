'use client';

import { useRef, useState } from 'react';
import BuyRmbRateCard from '@/components/admin/BuyRmbRateCard';
import {
  buildRateShareCaption,
  captureElementPng,
  downloadBlob,
  shareRateCardFile,
  whatsappShareUrl,
} from '@/lib/rate-card-share';

type ShareBuyRmbRateProps = {
  buyRate: number;
  validUntil?: string | null;
};

export default function ShareBuyRmbRate({ buyRate, validUntil }: ShareBuyRmbRateProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'idle' | 'png' | 'share' | 'copy'>('idle');
  const [toast, setToast] = useState<string | null>(null);

  const buyUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/exchange` : '/exchange';

  const caption = buildRateShareCaption({
    buyRate,
    validUntil,
    buyUrl,
  });

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const ensureCard = () => {
    const el = cardRef.current?.querySelector('[data-rate-card]') as HTMLElement | null;
    if (!el) throw new Error('Rate card not ready');
    return el;
  };

  const makePng = async () => captureElementPng(ensureCard(), 2);

  const onDownload = async () => {
    setBusy('png');
    try {
      const blob = await makePng();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `snappy-buy-rmb-rate-${stamp}.png`);
      flash('Rate card saved. Attach it in your WhatsApp group.');
    } catch (err) {
      console.error(err);
      flash('Could not create the image. Try again.');
    } finally {
      setBusy('idle');
    }
  };

  const onShareWhatsApp = async () => {
    setBusy('share');
    try {
      const blob = await makePng();
      const stamp = new Date().toISOString().slice(0, 10);
      const result = await shareRateCardFile({
        blob,
        filename: `snappy-buy-rmb-rate-${stamp}.png`,
        caption,
      });
      if (result === 'shared') {
        flash('Shared. Pick your WhatsApp group and send.');
      } else if (result === 'downloaded_and_whatsapp') {
        flash('Image downloaded. WhatsApp opened with the caption. Attach the PNG and send.');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        flash('Share cancelled.');
      } else {
        console.error(err);
        window.open(whatsappShareUrl(caption), '_blank', 'noopener,noreferrer');
        flash('WhatsApp opened with the caption. Download the card to attach the image.');
      }
    } finally {
      setBusy('idle');
    }
  };

  const onCopyCaption = async () => {
    setBusy('copy');
    try {
      await navigator.clipboard.writeText(caption);
      flash('Caption copied.');
    } catch {
      flash('Could not copy. Select the text below instead.');
    } finally {
      setBusy('idle');
    }
  };

  const rateReady = Number(buyRate) > 0;
  const previewRate = rateReady ? buyRate : 0.552;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-brand-accent/30 bg-gradient-to-br from-brand-primary via-[#122a4a] to-brand-primary p-5 text-white shadow-lg shadow-brand-primary/20 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-brand-accent/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-36 w-36 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-accent">
              WhatsApp rate poster
            </p>
            <h2 className="mt-2 font-heading text-xl font-bold sm:text-2xl">
              Drop today&apos;s rate in the group in one tap
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Builds a branded card like your poster, plus a ready caption. On phone it can share
              image and text together. On desktop it downloads the PNG and opens WhatsApp.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!rateReady || busy !== 'idle'}
                onClick={() => setOpen(true)}
                className="rounded-xl bg-brand-accent px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                Open rate studio
              </button>
              <button
                type="button"
                disabled={!rateReady || busy !== 'idle'}
                onClick={onShareWhatsApp}
                className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                <i className="ri-whatsapp-fill text-lg" />
                {busy === 'share' ? 'Preparing…' : 'Post to WhatsApp'}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => rateReady && setOpen(true)}
            className="mx-auto shrink-0 overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-white/20 transition hover:scale-[1.02] lg:mx-0"
            aria-label="Preview rate card"
          >
            <BuyRmbRateCard buyRate={previewRate} validUntil={validUntil} size={220} />
          </button>
        </div>

        {toast ? (
          <p className="relative mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/95 ring-1 ring-white/15">
            {toast}
          </p>
        ) : null}
      </div>

      {/* Off-screen capture target (always mounted for one-tap share) */}
      <div
        ref={cardRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 -z-50"
        style={{ transform: 'translateY(-12000px)' }}
      >
        <BuyRmbRateCard buyRate={buyRate || 0} validUntil={validUntil} size={720} />
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
          <div
            className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
            aria-label="Rate poster studio"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
              <div>
                <h3 className="font-heading text-lg font-bold text-brand-primary">Rate poster studio</h3>
                <p className="text-xs text-slate-500">Preview, download, WhatsApp</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="grid gap-6 p-5 md:grid-cols-2 md:p-6">
              <div className="flex justify-center rounded-2xl bg-slate-50 p-4">
                <div className="overflow-hidden rounded-xl shadow-md ring-1 ring-black/5">
                  <BuyRmbRateCard buyRate={buyRate} validUntil={validUntil} size={320} />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Caption</p>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    {caption}
                  </pre>
                </div>

                <div className="mt-auto flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busy !== 'idle'}
                    onClick={onShareWhatsApp}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    <i className="ri-whatsapp-fill text-lg" />
                    {busy === 'share' ? 'Preparing poster…' : 'Post image + caption to WhatsApp'}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== 'idle'}
                    onClick={onDownload}
                    className="rounded-xl bg-brand-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {busy === 'png' ? 'Saving…' : 'Download PNG'}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== 'idle'}
                    onClick={onCopyCaption}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-brand-primary disabled:opacity-60"
                  >
                    {busy === 'copy' ? 'Copied…' : 'Copy caption only'}
                  </button>
                </div>

                <p className="text-xs leading-relaxed text-slate-500">
                  Tip: On desktop, attach the downloaded PNG in the WhatsApp group after the caption
                  opens. On phone, the share sheet can send both together.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
