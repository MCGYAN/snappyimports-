import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import { escapeHtml, isValidEmail } from '@/lib/sanitize';
import { sendOrderConfirmation, sendOrderStatusUpdate, sendWelcomeMessage, sendContactMessage, sendPaymentLink, sendEmail, emailLayout } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        // Rate limiting
        const clientId = getClientIdentifier(request);
        const rateLimitResult = checkRateLimit(`notification:${clientId}`, RATE_LIMITS.notification);

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': rateLimitResult.resetIn.toString()
                    }
                }
            );
        }

        const body = await request.json();
        const { type, payload } = body;

        if (!type || !payload) {
            return NextResponse.json({ error: 'Type and payload required' }, { status: 400 });
        }

        // ============================================================
        // SECURITY: Authentication requirements
        // Admin-only types require admin auth token
        // 'order_created' requires a valid order to exist (verified below)
        // 'contact' is public but rate-limited
        // ============================================================
        const adminOnlyTypes = [
            'campaign',
            'customer_email',
            'order_updated',
            'order_status',
            'payment_link',
            'welcome',
        ];
        const requiresAdminAuth = adminOnlyTypes.includes(type);

        if (requiresAdminAuth) {
            // Customer emails need Customers access. Campaigns stay owner-only.
            // Order messages need the Orders module.
            const auth =
                type === 'campaign'
                    ? await verifyAuth(request, { requireOwner: true })
                    : type === 'customer_email'
                      ? await verifyAuth(request, { requireModule: 'customers' })
                      : await verifyAuth(request, { requireModule: 'orders' });
            if (!auth.authenticated) {
                return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
            }
        }

        // ============================================================
        // order_created — verify the order exists in the database
        // ============================================================
        if (type === 'order_created') {
            // Verify the order actually exists before sending confirmation
            if (!payload.order_number && !payload.id) {
                return NextResponse.json({ error: 'Missing order identifier' }, { status: 400 });
            }

            const orderRef = payload.order_number || payload.id;
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderRef);
            const query = supabaseAdmin
                .from('orders')
                .select('id, order_number, created_at');
            const { data: order, error: orderError } = isUuid
                ? await query.eq('id', orderRef).single()
                : await query.eq('order_number', orderRef).single();

            if (orderError || !order) {
                return NextResponse.json({ error: 'Order not found' }, { status: 404 });
            }

            // Verify the order was created recently (within last 10 minutes)
            const orderAge = Date.now() - new Date(order.created_at).getTime();
            if (orderAge > 10 * 60 * 1000) {
                return NextResponse.json({ error: 'Order confirmation can only be sent for recent orders' }, { status: 400 });
            }

            await sendOrderConfirmation(payload);
            return NextResponse.json({ success: true, message: 'Order confirmation sent' });
        }

        if (type === 'order_updated') {
            const { order, status } = payload;
            if (!order || !status) {
                return NextResponse.json({ error: 'Missing order or status' }, { status: 400 });
            }
            await sendOrderStatusUpdate(order, status);
            return NextResponse.json({ success: true, message: 'Status update sent' });
        }

        // Handle order_status from admin panel
        if (type === 'order_status') {
            const { email, name, orderNumber, status, trackingNumber, phone } = payload;

            if (!orderNumber || !status) {
                return NextResponse.json({ error: 'Missing orderNumber or status' }, { status: 400 });
            }

            // Fetch full order data
            const { data: fullOrder } = await supabaseAdmin
                .from('orders')
                .select('id, order_number, email, phone, shipping_address, metadata')
                .eq('order_number', orderNumber)
                .single();

            const orderData = fullOrder || {
                order_number: orderNumber,
                email: email,
                phone: phone,
                shipping_address: { firstName: name, phone: phone },
                metadata: { tracking_number: trackingNumber }
            };

            if (!orderData.phone && phone) {
                orderData.phone = phone;
            }

            await sendOrderStatusUpdate(orderData, status);
            return NextResponse.json({ success: true, message: 'Status update sent' });
        }

        if (type === 'welcome') {
            if (!payload.email) {
                return NextResponse.json({ error: 'Missing email' }, { status: 400 });
            }
            await sendWelcomeMessage(payload);
            return NextResponse.json({ success: true, message: 'Welcome message sent' });
        }

        // ============================================================
        // contact — public but strictly validated and rate-limited
        // ============================================================
        if (type === 'contact') {
            const { name, email, subject, message } = payload;
            if (!name || !email || !subject || !message) {
                return NextResponse.json({ error: 'All contact fields required' }, { status: 400 });
            }
            if (!isValidEmail(email)) {
                return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
            }
            // Length limits to prevent abuse
            if (name.length > 100 || subject.length > 200 || message.length > 5000) {
                return NextResponse.json({ error: 'Input too long' }, { status: 400 });
            }
            await sendContactMessage(payload);
            return NextResponse.json({ success: true, message: 'Contact message sent' });
        }

        if (type === 'payment_link') {
            if (!payload.id || !payload.order_number) {
                return NextResponse.json({ error: 'Missing order details' }, { status: 400 });
            }
            await sendPaymentLink(payload);
            return NextResponse.json({ success: true, message: 'Payment link sent' });
        }

        // ============================================================
        // campaign — owner only. Recipients are loaded server-side.
        // ============================================================
        if (type === 'campaign') {
            const { subject, message } = payload;

            if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'missing_api_key') {
                return NextResponse.json(
                    { error: 'Email is not configured. Add RESEND_API_KEY on the server.' },
                    { status: 500 },
                );
            }
            if (!subject || !String(subject).trim()) {
                return NextResponse.json({ error: 'Email subject required' }, { status: 400 });
            }
            if (!message || !String(message).trim()) {
                return NextResponse.json({ error: 'Message content required' }, { status: 400 });
            }
            if (String(subject).length > 200 || String(message).length > 5000) {
                return NextResponse.json({ error: 'Subject or message too long' }, { status: 400 });
            }

            const { data: customers, error: customersError } = await supabaseAdmin
                .from('customers')
                .select('email, full_name, secondary_email');

            if (customersError) {
                console.error('[Campaign] Failed to load customers:', customersError);
                return NextResponse.json(
                    { error: 'Could not load customer emails.' },
                    { status: 500 },
                );
            }

            const seenEmails = new Set<string>();
            const recipients: { email: string; name: string }[] = [];

            for (const customer of customers || []) {
                const emails = [customer.email, customer.secondary_email]
                    .filter(Boolean)
                    .map((email: string) => String(email).toLowerCase().trim());

                for (const email of emails) {
                    if (!isValidEmail(email) || seenEmails.has(email)) continue;
                    seenEmails.add(email);
                    recipients.push({
                        email,
                        name: customer.full_name || 'Valued Customer',
                    });
                    break;
                }
            }

            if (recipients.length === 0) {
                return NextResponse.json(
                    { error: 'No customers with a valid email address were found.' },
                    { status: 400 },
                );
            }

            const safeSubject = escapeHtml(String(subject).trim());
            const safeMessage = escapeHtml(String(message).trim());
            const results = { email: 0, errors: 0, firstError: '' as string };

            // Send in small parallel waves so Resend rate limits are respected
            const WAVE = 5;
            for (let i = 0; i < recipients.length; i += WAVE) {
                const wave = recipients.slice(i, i + WAVE);
                const settled = await Promise.allSettled(
                    wave.map(async (recipient) => {
                        const recipientName = escapeHtml(recipient.name || 'Valued Customer');
                        const brandedHtml = emailLayout(
                            `
<h2 style="margin:0 0 16px;color:#111827;font-size:22px;text-align:center;">${safeSubject}</h2>
<p style="color:#374151;font-size:14px;line-height:1.7;margin:16px 0;">Hi ${recipientName},</p>
<p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">${safeMessage.replace(/\n/g, '</p><p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">')}</p>
`,
                            safeSubject,
                        );
                        await sendEmail({
                            to: recipient.email,
                            subject: String(subject).trim(),
                            html: brandedHtml,
                        });
                    }),
                );

                for (const result of settled) {
                    if (result.status === 'fulfilled') {
                        results.email++;
                    } else {
                        results.errors++;
                        if (!results.firstError) {
                            results.firstError =
                                result.reason instanceof Error
                                    ? result.reason.message
                                    : 'Send failed';
                        }
                        console.error('[Campaign] Send failed:', result.reason);
                    }
                }
            }

            if (results.email === 0) {
                return NextResponse.json(
                    {
                        error:
                            results.firstError ||
                            'Could not send any emails. Check Resend settings and try again.',
                    },
                    { status: 500 },
                );
            }

            return NextResponse.json({
                success: true,
                sent: results.email,
                failed: results.errors,
                message:
                    results.errors > 0
                        ? `Sent ${results.email} emails. ${results.errors} failed.`
                        : `Sent ${results.email} emails.`,
            });
        }

        // ============================================================
        // customer_email — email one or more customers from admin Customers
        // ============================================================
        if (type === 'customer_email') {
            const { recipients, subject, message } = payload;

            if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
                return NextResponse.json({ error: 'Recipients required' }, { status: 400 });
            }
            if (!subject || !String(subject).trim()) {
                return NextResponse.json({ error: 'Subject required' }, { status: 400 });
            }
            if (!message || !String(message).trim()) {
                return NextResponse.json({ error: 'Message required' }, { status: 400 });
            }
            if (String(subject).length > 200 || String(message).length > 5000) {
                return NextResponse.json({ error: 'Subject or message too long' }, { status: 400 });
            }

            const seenEmails = new Set<string>();
            const results = { email: 0, errors: 0 };
            const safeSubject = escapeHtml(subject);
            const safeMessage = escapeHtml(message);

            for (const recipient of recipients) {
                try {
                    if (!recipient?.email || !isValidEmail(recipient.email)) {
                        results.errors++;
                        continue;
                    }
                    const emailKey = String(recipient.email).toLowerCase().trim();
                    if (seenEmails.has(emailKey)) continue;
                    seenEmails.add(emailKey);

                    const recipientName = escapeHtml(recipient.name || 'Valued Customer');
                    const brandedHtml = emailLayout(`
<h2 style="margin:0 0 16px;color:#111827;font-size:22px;text-align:center;">${safeSubject}</h2>
<p style="color:#374151;font-size:14px;line-height:1.7;margin:16px 0;">Hi ${recipientName},</p>
<p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">${safeMessage.replace(/\n/g, '</p><p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">')}</p>
`, safeSubject);

                    await sendEmail({
                        to: recipient.email,
                        subject: String(subject).trim(),
                        html: brandedHtml,
                    });
                    results.email++;
                } catch (err: any) {
                    console.error(`[Customer email] Failed for ${recipient?.email}:`, err.message);
                    results.errors++;
                }
            }

            if (results.email === 0) {
                return NextResponse.json(
                    { error: 'Could not send email. Check the address and Resend settings.' },
                    { status: 500 },
                );
            }

            return NextResponse.json({
                success: true,
                message:
                    results.email === 1
                        ? 'Email sent.'
                        : `Sent ${results.email} emails.${results.errors > 0 ? ` (${results.errors} failed)` : ''}`,
            });
        }

        return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });

    } catch (error: any) {
        console.error('Notification API Error:', error);
        const message = error?.message || 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
