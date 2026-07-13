import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

// Simple in-memory cache
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes — products don't change frequently

export async function GET(request: Request) {
    if (!supabaseUrl || !supabaseKey) {
        console.warn('[Storefront API] Supabase credentials missing');
        return NextResponse.json([], { status: 200 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const featured = searchParams.get('featured') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');

    // Build a cache key from params
    const cacheKey = `${featured}-${limit}-${category || 'all'}`;

    // Check cache (only for featured/home requests — general shop is more dynamic)
    if (featured && cache && cache.data?.[cacheKey] && Date.now() - cache.timestamp < CACHE_TTL) {
        return NextResponse.json(cache.data[cacheKey], {
            headers: {
                'Cache-Control': 'public, max-age=60, s-maxage=900, stale-while-revalidate=1800',
                'X-Cache': 'HIT'
            }
        });
    }

    try {
        let query = supabase
            .from('products')
            .select(`
                id, name, slug, price, compare_at_price, quantity, description, metadata,
                categories(id, name, slug),
                product_images(url, position),
                product_variants(id, name, price, quantity)
            `)
            .order('created_at', { ascending: false });

        // Always filter active products
        query = query.eq('status', 'active');

        if (featured) {
            query = query.eq('featured', true).limit(limit);
        } else if (category) {
            query = query.limit(limit);
        } else {
            query = query.limit(limit);
        }

        let { data, error } = await query;

        if (error) {
            console.error('[Storefront API] Products error:', error);
            return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
        }

        // Home featured row: fall back to latest active products when none are flagged featured
        if (featured && (!data || data.length === 0)) {
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('products')
                .select(`
                    id, name, slug, price, compare_at_price, quantity, description, metadata,
                    categories(id, name, slug),
                    product_images(url, position),
                    product_variants(id, name, price, quantity)
                `)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (!fallbackError && fallbackData?.length) {
                data = fallbackData;
            }
        }

        // Cache the result
        if (!cache) cache = { data: {}, timestamp: Date.now() };
        cache.data[cacheKey] = data;
        cache.timestamp = Date.now();

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, max-age=60, s-maxage=900, stale-while-revalidate=1800',
                'X-Cache': 'MISS'
            }
        });
    } catch (err: any) {
        console.error('[Storefront API] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
