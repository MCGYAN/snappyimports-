'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ExchangeLookupPage() {
  const router = useRouter();
  const [exchangeNumber, setExchangeNumber] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <main className="store-page py-12">
      <div className="store-card mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-2xl font-bold text-brand-primary">Open buy invoice</h1>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(
              `/exchange/${encodeURIComponent(exchangeNumber.trim())}?phone=${encodeURIComponent(phone.trim())}`,
            );
          }}
        >
          <input
            required
            value={exchangeNumber}
            onChange={(e) => setExchangeNumber(e.target.value)}
            placeholder="EX-…"
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3"
          />
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3"
          />
          <button type="submit" className="w-full rounded-xl bg-brand-primary py-3 font-bold text-white">
            Open
          </button>
        </form>
      </div>
    </main>
  );
}
