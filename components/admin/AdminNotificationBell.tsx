'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  data: { href?: string } | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Soft two-tone chime. No audio file required. */
function playNotificationChime(audioCtx: AudioContext | null) {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    master.connect(audioCtx.destination);

    const tones = [
      { freq: 880, start: 0, duration: 0.28 },
      { freq: 1174.7, start: 0.14, duration: 0.42 },
    ];

    for (const tone of tones) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);
      gain.gain.setValueAtTime(0.0001, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.7, now + tone.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.duration + 0.02);
    }
  } catch {
    // Browsers may block audio until the tab has been interacted with.
  }
}

export default function AdminNotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveAlert, setLiveAlert] = useState<AdminNotification | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const ensureAudio = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, data, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error) setItems((data || []) as AdminNotification[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel(`admin-notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as AdminNotification;
          setItems((current) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, 30));
          setLiveAlert(next);
          playNotificationChime(audioCtxRef.current || ensureAudio());
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ensureAudio, load, userId]);

  useEffect(() => {
    if (!liveAlert) return;
    const timer = window.setTimeout(() => setLiveAlert(null), 7000);
    return () => window.clearTimeout(timer);
  }, [liveAlert]);

  useEffect(() => {
    const unlock = () => {
      ensureAudio();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [ensureAudio]);

  useEffect(() => {
    return () => {
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const unread = items.filter((item) => !item.read_at).length;

  const markRead = async (id: string) => {
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read_at: readAt } : item)),
    );
    await supabase.from('notifications').update({ read_at: readAt }).eq('id', id);
  };

  const markAllRead = async () => {
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || readAt })));
    await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('user_id', userId)
      .is('read_at', null);
  };

  return (
    <div ref={rootRef} className="relative">
      {liveAlert ? (
        <Link
          href={liveAlert.data?.href || '/admin'}
          onClick={() => {
            void markRead(liveAlert.id);
            setLiveAlert(null);
          }}
          className="fixed right-4 top-20 z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-orange-200 bg-white p-4 shadow-2xl"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-brand-accent">
              <i className="ri-notification-3-line text-lg" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-brand-primary">{liveAlert.title}</p>
              {liveAlert.message ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{liveAlert.message}</p>
              ) : null}
              <p className="mt-2 text-xs font-semibold text-brand-accent">Open details</p>
            </div>
          </div>
        </Link>
      ) : null}

      <button
        type="button"
        onClick={() => {
          ensureAudio();
          setOpen((value) => !value);
        }}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-brand-primary transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-primary/5 hover:text-brand-accent"
        aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
      >
        <i className="ri-notification-3-line text-xl" />
        {unread > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="font-bold text-brand-primary">Activity</p>
              <p className="text-xs text-slate-500">Orders and payments update live</p>
            </div>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-brand-primary hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <i className="ri-notification-off-line text-2xl text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-600">No activity yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  New orders and payment updates will appear here.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const href = item.data?.href || '/admin';
                return (
                  <Link
                    key={item.id}
                    href={href}
                    onClick={() => {
                      setOpen(false);
                      if (!item.read_at) void markRead(item.id);
                    }}
                    className={`block border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 ${
                      item.read_at ? 'bg-white' : 'bg-orange-50/60'
                    }`}
                  >
                    <div className="flex gap-3">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          item.read_at ? 'bg-slate-200' : 'bg-brand-accent'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        {item.message ? (
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                            {item.message}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-slate-400">
                          {timeAgo(item.created_at)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
