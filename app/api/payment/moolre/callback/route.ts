import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendOrderConfirmation } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Moolre Callback Payload Structure (from their actual API):
 * {
 *   "status": 1,
 *   "code": "P01",
 *   "message": "Transaction Successful",
 *   "data": {
 *     "txtstatus": 1,
 *     "payer": "233535998837",
 *     "terminalid": "",
 *     "accountnumber": "10789906062911",
 *     "name": "",
 *     "amount": "2",
 *     "value": "2",
 *     "transactionid": "42252702",
 *     "externalref": "ORD-1770330034217-441",
 *     "thirdpartyref": "74658410493"
 *   },
 *   "secret": "c23bc2ab-...",
 *   "ts": "2026-02-05 22:21:16",
 *   "go": null
 * }
 */

export async function POST(req: Request) {
    console.log('[Callback] POST received at', new Date().toISOString(), '| App URL:', process.env.NEXT_PUBLIC_APP_URL || '(not set, using request origin)');
    if (process.env.NEXT_PUBLIC_APP_URL?.includes('localhost')) {
        console.warn('[Callback] WARNING: NEXT_PUBLIC_APP_URL contains localhost — Moolre cannot reach this. Set it to your production domain (e.g. https://www.sambatekgh.com) in Vercel.');
    }

    try {
        // Rate limiting
        const clientId = getClientIdentifier(req);
        const rateLimitResult = checkRateLimit(`callback:${clientId}`, RATE_LIMITS.callback);

        if (!rateLimitResult.success) {
            console.warn('[Callback] Rate limited:', clientId);
            return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
        }

        let body: any = {};
        const contentType = req.headers.get('content-type') || '';

        // Parse body
        try {
            if (contentType.includes('application/json')) {
                body = await req.json();
            } else if (contentType.includes('form')) {
                const formData = await req.formData();
                body = Object.fromEntries(formData.entries());
            } else {
                const rawText = await req.text();
                try {
                    body = JSON.parse(rawText);
                } catch {
                    try {
                        body = Object.fromEntries(new URLSearchParams(rawText).entries());
                    } catch {
                        console.warn('[Callback] Could not parse body');
                    }
                }
            }
        } catch (parseError) {
            console.error('[Callback] Body parsing failed');
            return NextResponse.json({ success: false, message: 'Invalid Request Body' }, { status: 400 });
        }

        console.log('[Callback] Body keys:', Object.keys(body).join(', '));
        console.log('[Callback] Data keys:', body.data ? Object.keys(body.data).join(', ') : 'no data object');

        // ============================================================
        // SECURITY: Callback secret — must match MOOLRE_CALLBACK_SECRET if set.
        // Check common field names (Moolre may use body.secret or another key)
        // ============================================================
        const dataForSecret = body.data || {};
        const possibleSecretFields = [
            body.secret,
            dataForSecret.secret,
            body.callback_secret,
            dataForSecret.callback_secret,
            body.webhook_secret,
            body.signature,
            body.token
        ];
        const receivedSecret = (possibleSecretFields.find(Boolean) ?? '').toString().trim();
        const expectedSecret = process.env.MOOLRE_CALLBACK_SECRET?.trim();
        const skipSecretCheck = process.env.MOOLRE_SKIP_CALLBACK_SECRET === 'true' || process.env.MOOLRE_SKIP_CALLBACK_SECRET === '1';
        const debugSecret = process.env.MOOLRE_CALLBACK_DEBUG === 'true' || process.env.MOOLRE_CALLBACK_DEBUG === '1';

        if (debugSecret) {
            console.log('[Callback] DEBUG: Received secret length=', receivedSecret.length, '| Full value to copy into Vercel MOOLRE_CALLBACK_SECRET:', JSON.stringify(receivedSecret));
        }

        if (skipSecretCheck) {
            console.warn('[Callback] MOOLRE_SKIP_CALLBACK_SECRET is set — accepting callback without secret verification. Remove this in production once secret is configured.');
        } else if (expectedSecret) {
            if (!receivedSecret || receivedSecret !== expectedSecret) {
                const recvPreview = receivedSecret ? `${receivedSecret.substring(0, 8)}... (len ${receivedSecret.length})` : '(empty)';
                console.error('[Callback] Secret mismatch! Expected starts with:', expectedSecret.substring(0, 8), '| Received:', recvPreview);
                if (!debugSecret) {
                    console.error('[Callback] Set MOOLRE_CALLBACK_DEBUG=true in Vercel, redeploy, then trigger a payment to log the exact secret Moolre sends. Copy that value into MOOLRE_CALLBACK_SECRET.');
                }
                return NextResponse.json({ success: false, message: 'Invalid callback signature' }, { status: 403 });
            }
            console.log('[Callback] Secret verified OK');
        } else {
            console.warn('[Callback] MOOLRE_CALLBACK_SECRET not set — callback origin cannot be verified.');
        }

        // ============================================================
        // EXTRACT FIELDS - Moolre nests payment data inside body.data
        // ============================================================
        const data = body.data || {};

        // Order reference: check body.data.externalref first, then top-level fallbacks
        const rawExternalRef =
            data.externalref ||
            data.external_reference ||
            data.orderRef ||
            body.externalref ||
            body.orderRef ||
            body.external_reference;

        // Strip retry suffix (e.g., "ORD-123-R1770000000" -> "ORD-123")
        let merchantOrderRef = rawExternalRef
            ? rawExternalRef.replace(/-R\d+$/, '')
            : (data.metadata?.original_order_number || body.metadata?.original_order_number);

        // Moolre's transaction reference
        const moolreReference =
            data.transactionid ||
            data.thirdpartyref ||
            body.reference ||
            'callback';

        const apiStatus = body.status;
        const txStatus = data.txtstatus;
        const messageStr = String(body.message || '').toLowerCase();

        console.log('[Callback] Order ref:', merchantOrderRef,
            '| Raw ref:', rawExternalRef,
            '| API status:', apiStatus,
            '| TX status:', txStatus,
            '| Message:', body.message,
            '| Moolre ref:', moolreReference);

        // If we couldn't extract the order ref, try looking it up by the stored external ref
        if (!merchantOrderRef && rawExternalRef) {
            const { data: orderByRef } = await supabaseAdmin
                .from('orders')
                .select('order_number')
                .contains('metadata', { moolre_external_ref: rawExternalRef })
                .single();

            if (orderByRef) {
                merchantOrderRef = orderByRef.order_number;
                console.log('[Callback] Found order via metadata lookup:', merchantOrderRef);
            }
        }

        if (!merchantOrderRef) {
            console.error('[Callback] Missing order reference. Body:', JSON.stringify(body).substring(0, 500));
            return NextResponse.json({ success: false, message: 'Missing order reference' }, { status: 400 });
        }

        // ============================================================
        // SECURITY: Strict success validation
        // Require BOTH api status AND transaction status to be success,
        // OR the message explicitly indicates success (as fallback only 
        // when both status fields are present and consistent).
        // ============================================================
        const apiOk = (apiStatus === 1 || apiStatus === '1');
        const txOk = (txStatus === 1 || txStatus === '1');
        const messageOk = messageStr.includes('successful') || messageStr.includes('success');

        // Require at least api status OR tx status to be explicitly successful
        // AND the message must not indicate failure
        const isSuccess = (apiOk || txOk) && !messageStr.includes('fail') && !messageStr.includes('error');

        if (isSuccess) {
            console.log(`[Callback] Payment SUCCESS for Order ${merchantOrderRef}`);

            // Check if order exists
            const { data: existingOrder, error: fetchError } = await supabaseAdmin
                .from('orders')
                .select('id, order_number, payment_status, total')
                .eq('order_number', merchantOrderRef)
                .single();

            if (fetchError || !existingOrder) {
                console.error('[Callback] Order not found:', merchantOrderRef);
                return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
            }

            // Already paid - idempotent
            if (existingOrder.payment_status === 'paid') {
                console.log('[Callback] Order already paid, skipping:', merchantOrderRef);
                return NextResponse.json({ success: true, message: 'Order already processed' });
            }

            // ============================================================
            // SECURITY: Verify amount matches — REJECT if mismatch
            // ============================================================
            const callbackAmount = data.amount ? parseFloat(data.amount) : (body.amount ? parseFloat(body.amount) : null);
            if (callbackAmount !== null) {
                const expectedAmount = Number(existingOrder.total);
                if (Math.abs(callbackAmount - expectedAmount) > 0.01) {
                    console.error('[Callback] AMOUNT MISMATCH — REJECTING! Expected:', expectedAmount, 'Got:', callbackAmount, 'Order:', merchantOrderRef);
                    return NextResponse.json({
                        success: false,
                        message: 'Payment amount does not match order total'
                    }, { status: 400 });
                }
            }

            // Mark order as paid via RPC
            const { data: orderJson, error: updateError } = await supabaseAdmin
                .rpc('mark_order_paid', {
                    order_ref: merchantOrderRef,
                    moolre_ref: String(moolreReference)
                });

            if (updateError) {
                console.error('[Callback] RPC Error:', updateError.message);
                return NextResponse.json({ success: false, message: 'Database update failed' }, { status: 500 });
            }

            if (!orderJson) {
                console.error('[Callback] Order not found after RPC:', merchantOrderRef);
                return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
            }

            console.log('[Callback] Order updated! ID:', orderJson.id, '| Status:', orderJson.status);

            // Update customer stats
            try {
                if (orderJson.email) {
                    await supabaseAdmin.rpc('update_customer_stats', {
                        p_customer_email: orderJson.email,
                        p_order_total: orderJson.total
                    });
                }
            } catch (statsError: any) {
                console.error('[Callback] Customer stats failed:', statsError.message);
            }

            // Send SMS + Email notifications
            try {
                console.log('[Callback] Sending notifications for:', orderJson.order_number);
                await sendOrderConfirmation(orderJson);
                console.log('[Callback] Notifications sent!');
            } catch (notifyError: any) {
                console.error('[Callback] Notification failed:', notifyError.message);
            }

            return NextResponse.json({ success: true, message: 'Payment verified and Order Updated' });

        } else {
            // Payment failed
            console.log(`[Callback] Payment FAILED for ${merchantOrderRef} | Status: ${apiStatus} | TX: ${txStatus}`);

            // Merge failure info into existing metadata (don't overwrite)
            const { data: failedOrder } = await supabaseAdmin
                .from('orders')
                .select('metadata')
                .eq('order_number', merchantOrderRef)
                .single();

            await supabaseAdmin
                .from('orders')
                .update({
                    payment_status: 'failed',
                    metadata: {
                        ...(failedOrder?.metadata || {}),
                        moolre_reference: moolreReference,
                        failure_reason: body.message || 'Payment failed',
                        failed_at: new Date().toISOString()
                    }
                })
                .eq('order_number', merchantOrderRef);

            return NextResponse.json({ success: false, message: 'Payment not successful' });
        }

    } catch (error: any) {
        console.error('[Callback] Critical Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    // Some payment providers send callbacks via GET with query parameters
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());

    if (params.externalref || params.status || params.transactionid) {
        console.log('[Callback] GET received with params:', JSON.stringify(params));

        const rawExternalRef = params.externalref || params.external_reference || params.orderRef;
        const merchantOrderRef = rawExternalRef ? rawExternalRef.replace(/-R\d+$/, '') : null;
        const status = params.status;
        const txtstatus = params.txtstatus;

        if (merchantOrderRef && (status === '1' || txtstatus === '1')) {
            try {
                const moolreReference = params.transactionid || params.thirdpartyref || 'callback-get';

                const { data: existingOrder } = await supabaseAdmin
                    .from('orders')
                    .select('id, order_number, payment_status, total')
                    .eq('order_number', merchantOrderRef)
                    .single();

                if (existingOrder && existingOrder.payment_status !== 'paid') {
                    const { data: orderJson, error: updateError } = await supabaseAdmin
                        .rpc('mark_order_paid', {
                            order_ref: merchantOrderRef,
                            moolre_ref: String(moolreReference)
                        });

                    if (!updateError && orderJson) {
                        console.log('[Callback GET] Order marked paid:', merchantOrderRef);

                        try {
                            if (orderJson.email) {
                                await supabaseAdmin.rpc('update_customer_stats', {
                                    p_customer_email: orderJson.email,
                                    p_order_total: orderJson.total
                                });
                            }
                            await sendOrderConfirmation(orderJson);
                        } catch (e: any) {
                            console.error('[Callback GET] Post-payment tasks failed:', e.message);
                        }
                    }
                }
            } catch (e: any) {
                console.error('[Callback GET] Error processing:', e.message);
            }
        }

        // Redirect to order success page
        const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, '');
        return Response.redirect(`${baseUrl}/order-success?order=${merchantOrderRef}&payment_success=true`, 302);
    }

    return NextResponse.json({ message: 'Moolre callback endpoint ready', timestamp: new Date().toISOString() });
}
