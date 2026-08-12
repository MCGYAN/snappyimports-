import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import {
  EXCHANGE_CORRIDORS,
  EXCHANGE_COUNTRY_CODES,
  normalizePayAccounts,
  parseExchangeCountryCode,
  type CorridorRateBoard,
} from '@/lib/exchange-corridors';

function mapBoard(row: any): CorridorRateBoard {
  const country = parseExchangeCountryCode(row.country_code);
  return {
    country_code: country,
    currency_code: row.currency_code || EXCHANGE_CORRIDORS[country].currencyCode,
    buy_rmb_rate: Number(row.buy_rmb_rate) || 0,
    sell_rmb_rate: Number(row.sell_rmb_rate) || 0,
    min_amount: Number(row.min_amount) || 0,
    max_amount: row.max_amount != null ? Number(row.max_amount) : null,
    notes: row.notes || null,
    valid_until: row.valid_until || null,
    is_live: Boolean(row.is_live),
    pay_accounts: normalizePayAccounts(row.pay_accounts),
    updated_at: row.updated_at,
  };
}

function publicBoard(board: CorridorRateBoard) {
  return board;
}

/** GET — ?country=GH|NG|TZ for one board, or all boards with ?all=1 (also default lists all + GH board) */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const countryParam = searchParams.get('country');
  const wantAll = searchParams.get('all') === '1' || !countryParam;

  if (wantAll) {
    const { data, error } = await supabaseAdmin
      .from('exchange_corridor_rates')
      .select('*')
      .order('country_code', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const boards = (data || []).map(mapBoard);
    const gh = boards.find((b) => b.country_code === 'GH') || null;

    if (countryParam) {
      const country = parseExchangeCountryCode(countryParam);
      const one = boards.find((b) => b.country_code === country) || null;
      return NextResponse.json({
        success: true,
        board: one ? publicBoard(one) : null,
        boards: boards.map(publicBoard),
      });
    }

    return NextResponse.json({
      success: true,
      board: gh ? publicBoard(gh) : null,
      boards: boards.map(publicBoard),
    });
  }

  const country = parseExchangeCountryCode(countryParam);
  const { data, error } = await supabaseAdmin
    .from('exchange_corridor_rates')
    .select('*')
    .eq('country_code', country)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      success: true,
      board: {
        country_code: country,
        currency_code: EXCHANGE_CORRIDORS[country].currencyCode,
        buy_rmb_rate: 0,
        sell_rmb_rate: 0,
        min_amount: 100,
        max_amount: null,
        notes: 'Contact Snappy for today’s rate',
        valid_until: null,
        is_live: false,
        pay_accounts: [],
      } satisfies CorridorRateBoard,
    });
  }

  return NextResponse.json({ success: true, board: publicBoard(mapBoard(data)) });
}

/** PUT — admin updates one corridor rate + accounts + live switch */
export async function PUT(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'exchange' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const country = parseExchangeCountryCode(body.country || body.country_code);
  if (!EXCHANGE_COUNTRY_CODES.includes(country)) {
    return NextResponse.json({ error: 'Invalid country.' }, { status: 400 });
  }

  const buy = Number(body.buy_rmb_rate);
  const sell = Number(body.sell_rmb_rate ?? body.buy_rmb_rate);
  if (!Number.isFinite(buy) || buy < 0) {
    return NextResponse.json({ error: 'Valid buy rate required.' }, { status: 400 });
  }

  const payAccounts = normalizePayAccounts(body.pay_accounts);
  const isLive = Boolean(body.is_live);

  if (isLive && payAccounts.length === 0) {
    return NextResponse.json(
      {
        error: `Add at least one ${EXCHANGE_CORRIDORS[country].name} receiving account before turning this country live.`,
      },
      { status: 400 },
    );
  }

  if (isLive && !(buy > 0)) {
    return NextResponse.json(
      { error: 'Publish a buy rate greater than zero before turning this country live.' },
      { status: 400 },
    );
  }

  const payload = {
    country_code: country,
    currency_code: EXCHANGE_CORRIDORS[country].currencyCode,
    buy_rmb_rate: buy,
    sell_rmb_rate: Number.isFinite(sell) ? sell : buy,
    min_amount: Number(body.min_amount ?? body.min_amount_ghs ?? 100),
    max_amount:
      body.max_amount != null && body.max_amount !== ''
        ? Number(body.max_amount)
        : body.max_amount_ghs != null && body.max_amount_ghs !== ''
          ? Number(body.max_amount_ghs)
          : null,
    notes: body.notes ? String(body.notes).slice(0, 500) : null,
    valid_until: body.valid_until || null,
    is_live: isLive,
    pay_accounts: payAccounts,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('exchange_corridor_rates')
    .upsert(payload, { onConflict: 'country_code' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Keep legacy Ghana board in sync for any old readers
  if (country === 'GH') {
    await supabaseAdmin.from('exchange_rate_board').upsert({
      id: 1,
      buy_rmb_rate: payload.buy_rmb_rate,
      sell_rmb_rate: payload.sell_rmb_rate,
      min_amount_ghs: payload.min_amount,
      max_amount_ghs: payload.max_amount,
      notes: payload.notes,
      valid_until: payload.valid_until,
      updated_at: payload.updated_at,
    });
  }

  return NextResponse.json({ success: true, board: mapBoard(data) });
}
