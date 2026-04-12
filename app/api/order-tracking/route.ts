import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Returns order + order_items for the order-tracking page.
 * SECURITY: Email is required. Order is returned only if the provided email
 * matches the order's email (case-insensitive). Uses service role so guest
 * orders are accessible when email is verified. Rate limited to prevent enumeration.
 */
export async function GET(req: Request) {
    try {
        const clientId = getClientIdentifier(req);
        const rateLimitResult = checkRateLimit(`order-tracking:${clientId}`, RATE_LIMITS.orderTracking);
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { status: 429 }
            );
        }

        const { searchParams } = new URL(req.url);
        const orderNumber = searchParams.get('order');
        const email = searchParams.get('email');

        if (!orderNumber || !email) {
            return NextResponse.json(
                { error: 'Order number and email are required' },
                { status: 400 }
            );
        }

        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                status,
                payment_status,
                total,
                email,
                created_at,
                shipping_address,
                metadata,
                order_items (
                    id,
                    product_name,
                    variant_name,
                    quantity,
                    unit_price,
                    metadata,
                    products (
                        product_images (url)
                    )
                )
            `)
            .eq('order_number', orderNumber)
            .single();

        if (error || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.email?.toLowerCase().trim() !== email.toLowerCase().trim()) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json(order);
    } catch (err) {
        console.error('[order-tracking API]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
