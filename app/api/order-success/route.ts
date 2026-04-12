import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Returns order + order_items for the order-success page.
 * SECURITY: Only returns the order if it was paid in the last 15 minutes,
 * to prevent enumeration (anyone with an order number could otherwise look up orders).
 * Uses service role so it works for guest orders (RLS blocks anon SELECT on guest orders).
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const orderNumber = searchParams.get('order');

        if (!orderNumber || typeof orderNumber !== 'string') {
            return NextResponse.json({ error: 'Missing order number' }, { status: 400 });
        }

        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                status,
                payment_status,
                total,
                subtotal,
                shipping_total,
                email,
                phone,
                created_at,
                updated_at,
                shipping_address,
                order_items (
                    id,
                    product_name,
                    variant_name,
                    quantity,
                    unit_price,
                    total_price,
                    metadata
                )
            `)
            .eq('order_number', orderNumber)
            .single();

        if (error || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Only allow viewing if order was paid and updated recently (success flow)
        if (order.payment_status !== 'paid') {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const updatedAt = order.updated_at ? new Date(order.updated_at).getTime() : 0;
        const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
        if (updatedAt < fifteenMinutesAgo) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json(order);
    } catch (err) {
        console.error('[order-success API]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
