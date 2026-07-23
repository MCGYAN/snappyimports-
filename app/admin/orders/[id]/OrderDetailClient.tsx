'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import FraudDetectionAlert from '@/components/FraudDetectionAlert';
import {
  ADMIN_FULFILLMENT_STAGES,
  deriveFulfillmentStage,
  FULFILLMENT_STAGES,
  fulfillmentIndex,
  normalizeFulfillmentStage,
} from '@/lib/order-journey';
import { SNAPPY_INVOICE_ISSUER } from '@/lib/bank-details';

interface OrderDetailClientProps {
  orderId: string;
}

type RiskLevel = 'low' | 'medium' | 'high';

interface FraudAnalysis {
  riskLevel: RiskLevel;
  reasons: string[];
}

export default function OrderDetailClient({ orderId }: OrderDetailClientProps) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  // Inject print styles
  useEffect(() => {
    const styleId = 'order-print-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = '@media print { body * { visibility: hidden; } .print-section, .print-section * { visibility: visible; } .print-section { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; } .no-print { display: none !important; } }';
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  const fetchOrderDetails = useCallback(async () => {
    try {
      setLoading(true);
      // Try to fetch by ID or order_number
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            variant_id,
            product_name,
            variant_name,
            sku,
            quantity,
            unit_price,
            total_price,
            metadata,
            products (
              product_images (url)
            )
          )
        `)
        .eq('id', orderId);

      let { data, error } = await query.single();

      if (error && error.code === 'PGRST116') {
        // Not found by ID, try order_number
        const { data: dataByNum, error: errorByNum } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              id,
              product_id,
              variant_id,
              product_name,
              variant_name,
              sku,
              quantity,
              unit_price,
              total_price,
              metadata,
              products (
                product_images (url)
              )
            )
          `)
          .eq('order_number', orderId)
          .single();

        if (dataByNum) {
          data = dataByNum;
          error = null;
        } else {
          error = errorByNum;
        }
      }

      if (error) throw error;
      setOrder(data);
      setTrackingNumber(data.metadata?.tracking_number || '');
      setAdminNotes(data.notes || '');

    } catch (err: any) {
      console.error('Error fetching order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  const handleUpdateStatus = async (newStatus?: string) => {
    try {
      setStatusUpdating(true);
      const statusToUpdate = newStatus || order.status;

      const { error } = await supabase
        .from('orders')
        .update({
          status: statusToUpdate,
          notes: adminNotes,
          metadata: {
            ...order.metadata,
            tracking_number: trackingNumber
          }
        })
        .eq('id', order.id);

      if (error) throw error;

      // Update local state
      setOrder({
        ...order,
        status: statusToUpdate,
        notes: adminNotes,
        metadata: { ...order.metadata, tracking_number: trackingNumber }
      });
      setPendingStatus('');

      // Send Notification (Email + SMS)
      // Only send if status changed OR tracking number was added/changed
      const statusChanged = statusToUpdate !== order.status;
      const trackingChanged = trackingNumber !== order.metadata?.tracking_number;

      if (statusChanged || (trackingChanged && trackingNumber)) {
        // Get auth token for notification API
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;

        fetch('/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          },
          body: JSON.stringify({
            type: 'order_status',
            payload: {
              email: order.email,
              name: customerName,
              orderId: orderId,
              orderNumber: order.order_number || orderId,
              status: statusToUpdate,
              trackingNumber: trackingNumber,
              phone: shippingAddress.phone || order.phone // Ensure phone is passed for SMS
            }
          })
        }).catch(err => console.error('Notification error:', err));
      }

      alert('Order updated successfully');
      setShowStatusMenu(false);
    } catch (err) {
      console.error('Error updating order:', err);
      alert('Failed to update order');
    } finally {
      setStatusUpdating(false);
    }
  };

  const [resendingNotification, setResendingNotification] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [updatingJourney, setUpdatingJourney] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [journeyStage, setJourneyStage] = useState('');

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [amendItem, setAmendItem] = useState<any>(null);
  const [amendVariants, setAmendVariants] = useState<any[]>([]);
  const [amendVariantId, setAmendVariantId] = useState('');
  const [amendReason, setAmendReason] = useState('');
  const [amending, setAmending] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  };

  const openAmend = async (item: any) => {
    if (!item?.product_id) {
      alert('This line has no linked product, so variants cannot be loaded. Re-add the product or contact support.');
      return;
    }
    setAmendItem(item);
    setAmendVariantId(item.variant_id || item.metadata?.variant_id || '');
    setAmendReason('');
    setLoadingVariants(true);
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, name, option1, option2, option3, price, quantity, sku')
        .eq('product_id', item.product_id)
        .order('name');
      if (error) throw error;
      setAmendVariants(data || []);
    } catch (err: any) {
      alert(err?.message || 'Could not load variants');
      setAmendItem(null);
    } finally {
      setLoadingVariants(false);
    }
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId: order.id,
          reason: cancelReason,
          confirmText: cancelConfirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Cancel failed');
        return;
      }
      setShowCancelModal(false);
      setCancelReason('');
      setCancelConfirm('');
      await fetchOrderDetails();
      alert('Order cancelled. The record was kept for history.');
    } finally {
      setCancelling(false);
    }
  };

  const handleAmendItem = async () => {
    if (!amendItem || !amendVariantId) return;
    setAmending(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/orders/amend-item', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId: order.id,
          orderItemId: amendItem.id,
          variantId: amendVariantId,
          reason: amendReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Amend failed');
        return;
      }
      const pc = data.priceChange;
      let msg = 'Variant updated.';
      if (pc?.samePrice) msg = 'Variant updated. Same price.';
      else if (pc?.balanceDue > 0) msg = `Variant updated. Customer still owes GH¢${pc.balanceDue.toFixed(2)}.`;
      else if (pc?.creditDue > 0) msg = `Variant updated. Credit due GH¢${pc.creditDue.toFixed(2)}.`;
      setAmendItem(null);
      await fetchOrderDetails();
      alert(msg);
    } finally {
      setAmending(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!order?.order_number) return;
    try {
      setVerifyingPayment(true);
      setVerifyMessage(null);
      const res = await fetch('/api/payment/moolre/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: order.order_number })
      });
      const data = await res.json();
      if (data.success && data.payment_status === 'paid') {
        setVerifyMessage('Payment verified. Order updated.');
        await fetchOrderDetails();
      } else {
        setVerifyMessage(data.message || 'Could not verify payment. Customer may not have completed payment yet.');
      }
    } catch (err: any) {
      setVerifyMessage(err?.message || 'Verification request failed.');
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleConfirmManualPayment = async () => {
    if (!order?.id) return;
    if (!confirm('Confirm that bank/MoMo payment was received for this order?')) return;
    try {
      setConfirmingPayment(true);
      setVerifyMessage(null);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/orders/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ orderId: order.id, note: adminNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Confirm failed');
      setVerifyMessage('Manual payment confirmed.');
      await fetchOrderDetails();
    } catch (err: any) {
      setVerifyMessage(err?.message || 'Could not confirm payment.');
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleUpdateJourney = async () => {
    if (!order?.id || !journeyStage) return;
    try {
      setUpdatingJourney(true);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/orders/fulfillment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ orderId: order.id, stage: journeyStage, note: adminNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      await fetchOrderDetails();
      setJourneyStage('');
      alert('Import journey updated');
    } catch (err: any) {
      alert(err?.message || 'Failed to update journey');
    } finally {
      setUpdatingJourney(false);
    }
  };

  const handleResendNotification = async () => {
    if (!order) return;

    try {
      setResendingNotification(true);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const shippingAddress = order.shipping_address || {};
      const customerName = (shippingAddress.firstName && shippingAddress.lastName)
        ? `${shippingAddress.firstName.trim()} ${shippingAddress.lastName.trim()}`
        : shippingAddress.full_name || shippingAddress.firstName || order.email?.split('@')[0] || 'Customer';

      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({
          type: 'order_status',
          payload: {
            email: order.email,
            name: customerName,
            orderNumber: order.order_number || order.id,
            status: order.status,
            trackingNumber: order.metadata?.tracking_number || '',
            phone: order.phone || shippingAddress.phone
          }
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send notification');
      }

      alert('Notification sent successfully! (Email + SMS if phone available)');
    } catch (err: any) {
      console.error('Error resending notification:', err);
      alert(`Failed to resend notification: ${err.message || 'Unknown error'}`);
    } finally {
      setResendingNotification(false);
    }
  };

  const statusOptions = ['pending', 'awaiting_payment', 'processing', 'shipped', 'delivered'];
  const statusLabel = (s: string) => {
    if (s === 'shipped') return 'Packaged';
    if (s === 'awaiting_payment') return 'Awaiting payment';
    if (s === 'cancelled') return 'Cancelled';
    return s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'Unknown';
  };
  const statusColors: any = {
    'pending': 'bg-amber-100 text-amber-700 border-amber-200',
    'processing': 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
    'shipped': 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
    'delivered': 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
    'cancelled': 'bg-red-100 text-red-700 border-red-200',
    'awaiting_payment': 'bg-gray-100 text-gray-700 border-gray-200'
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error || !order) return <div className="p-8 text-center text-red-500">{error || 'Order not found'}</div>;

  const currentStatus = order.status || 'pending';
  const shippingAddress = order.shipping_address || {};
  const customerName = (shippingAddress.firstName && shippingAddress.lastName)
    ? `${shippingAddress.firstName.trim()} ${shippingAddress.lastName.trim()}`
    : shippingAddress.full_name || shippingAddress.firstName || order.email?.split('@')[0] || 'Customer';

  const currentJourney = deriveFulfillmentStage(order);
  const journeyIndex = fulfillmentIndex(currentJourney);

  // Mock fraud analysis for now (or implement real logic later)
  const fraudAnalysis: FraudAnalysis = {
    riskLevel: 'low',
    reasons: []
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print styles injected via useEffect */}

      {/* Printable Order Slip */}
      <div className="print-section hidden print:block bg-white p-8">
        <div className="border-2 border-gray-800 p-6">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold">{SNAPPY_INVOICE_ISSUER.brand}</h1>
              <p className="text-sm text-gray-600">Order Packing Slip</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">{order?.order_number}</p>
              <p className="text-sm">{order ? new Date(order.created_at).toLocaleDateString() : ''}</p>
            </div>
          </div>

          {/* Ship To */}
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-2 bg-gray-200 px-2 py-1">SHIP TO:</h2>
            <div className="pl-2">
              <p className="font-bold text-lg">{customerName}</p>
              <p>{shippingAddress.phone || order?.phone}</p>
              <p>{shippingAddress.address || shippingAddress.address_line1}</p>
              <p>{shippingAddress.city}{(shippingAddress.region || shippingAddress.state) && `, ${shippingAddress.region || shippingAddress.state}`}</p>
            </div>
          </div>

          {/* Order Items */}
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-2 bg-gray-200 px-2 py-1">ORDER ITEMS:</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-400">
                  <th className="text-left py-2 px-2">Product</th>
                  <th className="text-left py-2 px-2">Variant</th>
                  <th className="text-center py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {order?.order_items?.map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="py-2 px-2 font-medium">{item.product_name}</td>
                    <td className="py-2 px-2 text-sm">
                      {item.variant_name
                        ? item.variant_name.includes('/') &&
                          item.variant_name.split('/')[0].trim().toLowerCase() ===
                            item.variant_name.split('/')[1]?.trim().toLowerCase()
                          ? `Color: ${item.variant_name.split('/')[0].trim()}`
                          : item.variant_name
                        : '—'}
                    </td>
                    <td className="py-2 px-2 text-center font-bold">{item.quantity}</td>
                    <td className="py-2 px-2 text-right">GH¢{item.unit_price?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Order Summary */}
          <div className="flex justify-between mb-6">
            <div>
              <p><span className="font-semibold">Shipping Method:</span> {order?.shipping_method || 'Standard'}</p>
              <p><span className="font-semibold">Payment:</span> {order?.payment_method} ({order?.payment_status})</p>
              {trackingNumber && <p><span className="font-semibold">Tracking #:</span> {trackingNumber}</p>}
            </div>
            <div className="text-right">
              <p>Subtotal: GH¢{order?.subtotal?.toFixed(2)}</p>
              <p>Shipping: GH¢{order?.shipping_total?.toFixed(2)}</p>
              <p className="font-bold text-lg border-t border-gray-400 pt-1 mt-1">Total: GH¢{order?.total?.toFixed(2)}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-gray-800 pt-4 text-center text-sm text-gray-600">
            <p>Thank you for shopping with {SNAPPY_INVOICE_ISSUER.brand}.</p>
            <p>Questions? Call or WhatsApp {SNAPPY_INVOICE_ISSUER.phones[0]}.</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 no-print">
        {/* Page Header with Print Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center space-x-4 min-w-0">
            <Link href="/admin/orders" className="text-gray-600 hover:text-gray-900">
              <i className="ri-arrow-left-line text-2xl"></i>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">{order?.order_number}</h1>
              <p className="text-sm text-gray-600">Order placed on {order ? new Date(order.created_at).toLocaleDateString() : ''}</p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <i className="ri-printer-line text-lg"></i>
            <span className="hidden sm:inline">Print Order</span>
            <span className="sm:hidden">Print</span>
          </button>
        </div>

        {/* Mobile: the one action that matters, before anything else */}
        {order.payment_status === 'awaiting_confirmation' && (
          <div className="lg:hidden mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-900">
              Customer says they paid GH¢{order.total?.toFixed(2)}.
            </p>
            <p className="mt-1 text-sm text-amber-700">
              Check your bank or MoMo, then confirm below.
            </p>
            {order.metadata?.payment_sent_note ? (
              <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-amber-900">
                Customer note: {order.metadata.payment_sent_note}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleConfirmManualPayment}
              disabled={confirmingPayment}
              className="mt-3 w-full rounded-xl bg-brand-primary py-3.5 font-bold text-white disabled:opacity-50"
            >
              {confirmingPayment ? 'Confirming…' : 'Confirm payment received'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {fraudAnalysis.riskLevel !== 'low' && (
              <FraudDetectionAlert
                riskLevel={fraudAnalysis.riskLevel}
                reasons={fraudAnalysis.reasons}
                orderId={orderId}
              />
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Order Items</h2>
                <span className="text-gray-600">{order.order_items?.length || 0} items</span>
              </div>

              <div className="space-y-4">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-20 h-20 bg-white rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center relative">
                      {item.products?.product_images?.[0]?.url ? (
                        <img
                          src={item.products.product_images[0].url}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <i className="ri-image-line text-2xl text-gray-300"></i>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{item.product_name}</h3>
                      <p className="text-sm text-gray-600 mb-1">
                        {item.variant_name
                          ? item.variant_name.includes('/') &&
                            item.variant_name.split('/')[0].trim().toLowerCase() ===
                              item.variant_name.split('/')[1]?.trim().toLowerCase()
                            ? `Color: ${item.variant_name.split('/')[0].trim()}`
                            : item.variant_name
                          : null}
                      </p>
                      <p className="text-xs text-gray-500">SKU: {item.sku || '—'}</p>
                      {order.status !== 'cancelled' &&
                        order.status !== 'shipped' &&
                        order.status !== 'delivered' && (
                          <button
                            type="button"
                            onClick={() => openAmend(item)}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-primary/20 bg-white px-3 py-1.5 text-xs font-bold text-brand-primary hover:bg-brand-primary/5"
                          >
                            <i className="ri-edit-line"></i>
                            Amend variant / color
                          </button>
                        )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 mb-1">GH¢{item.unit_price?.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span>GH¢{order.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Shipping</span>
                  <span>GH¢{order.shipping_total?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Tax</span>
                  <span>GH¢{order.tax_total?.toFixed(2)}</span>
                </div>
                {order.discount_total > 0 && (
                  <div className="flex justify-between text-brand-primary font-semibold">
                    <span>Discount</span>
                    <span>-GH¢{order.discount_total?.toFixed(2)}</span>
                  </div>
                )}
                {(order.metadata?.balance_due > 0 || order.metadata?.credit_due > 0) && (
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {order.metadata?.balance_due > 0 ? (
                      <p>Balance due after amendment: <strong>GH¢{Number(order.metadata.balance_due).toFixed(2)}</strong></p>
                    ) : null}
                    {order.metadata?.credit_due > 0 ? (
                      <p>Credit due after amendment: <strong>GH¢{Number(order.metadata.credit_due).toFixed(2)}</strong></p>
                    ) : null}
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t border-gray-200">
                  <span>Total</span>
                  <span>GH¢{order.total?.toFixed(2)}</span>
                </div>
              </div>

              {Array.isArray(order.metadata?.amendments) && order.metadata.amendments.length > 0 && (
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Amendment history</h3>
                  <div className="space-y-2">
                    {[...order.metadata.amendments].reverse().map((a: any, idx: number) => (
                      <div key={`${a.at}-${idx}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <p className="font-semibold">
                          {a.from?.variant_name || '—'} → {a.to?.variant_name || '—'}
                        </p>
                        <p>{a.reason}</p>
                        <p className="text-slate-400">{a.at ? new Date(a.at).toLocaleString('en-GB') : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Import journey</h2>
              <p className="mb-6 text-sm text-gray-500">
                China to Ghana milestones. Same path the customer sees.
              </p>
              <div className="space-y-4">
                {FULFILLMENT_STAGES.map((event, index) => {
                  const done = journeyIndex >= 0 && index < journeyIndex;
                  const active = event.key === currentJourney;
                  return (
                    <div key={event.key} className="flex items-start space-x-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                          active || done
                            ? 'border-brand-primary bg-brand-primary'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {done || active ? (
                          <i className="ri-check-line text-xl text-white"></i>
                        ) : (
                          <span className="h-3 w-3 rounded-full bg-gray-300"></span>
                        )}
                      </div>
                      <div className="flex-1 border-b border-gray-200 pb-6 last:border-0">
                        <p
                          className={`font-semibold ${
                            active ? 'text-brand-accent' : done ? 'text-gray-900' : 'text-gray-500'
                          }`}
                        >
                          {event.title}
                          {active ? (
                            <span className="ml-2 text-xs font-bold uppercase tracking-wide text-brand-accent">
                              Current
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">{event.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-brand-primary/15 bg-gradient-to-b from-brand-light/80 to-white shadow-sm">
              <div className="border-b border-brand-primary/10 px-5 py-4">
                <h2 className="text-lg font-bold text-gray-900">Update import journey</h2>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Tap a milestone, then confirm. Payment stages update on their own.
                </p>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-brand-primary/10">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-white">
                    <i className="ri-map-pin-line text-sm" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-brand-accent">
                      Now at
                    </p>
                    <p className="truncate text-sm font-semibold text-brand-primary">
                      {FULFILLMENT_STAGES.find((s) => s.key === currentJourney)?.title ||
                        currentJourney}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 px-4 py-4" role="radiogroup" aria-label="Import journey milestone">
                {ADMIN_FULFILLMENT_STAGES.map((key) => {
                  const stage = FULFILLMENT_STAGES.find((x) => x.key === key);
                  if (!stage) return null;
                  const stageIdx = fulfillmentIndex(key);
                  const isCurrent = currentJourney === key;
                  const isPast = journeyIndex > stageIdx && journeyIndex >= 0;
                  const isSelected = journeyStage === key;
                  const nextKey = ADMIN_FULFILLMENT_STAGES.find(
                    (k) => fulfillmentIndex(k) > journeyIndex,
                  );
                  const isNext = !journeyStage && key === nextKey;
                  const icons: Record<string, string> = {
                    sourcing: 'ri-shopping-bag-3-line',
                    en_route_ghana: 'ri-ship-2-line',
                    in_ghana: 'ri-flag-2-line',
                    ready: 'ri-store-2-line',
                    delivered: 'ri-checkbox-circle-line',
                  };

                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={isSelected || (!journeyStage && isCurrent)}
                      disabled={order.status === 'cancelled' || updatingJourney}
                      onClick={() => setJourneyStage(key)}
                      className={`group w-full rounded-xl border px-3.5 py-3 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSelected
                          ? 'border-brand-accent bg-brand-accent/10 shadow-sm ring-2 ring-brand-accent/25'
                          : isCurrent
                            ? 'border-brand-primary/30 bg-brand-primary/5'
                            : 'border-gray-200/80 bg-white hover:border-brand-primary/35 hover:bg-brand-light/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base transition-colors ${
                            isSelected
                              ? 'bg-brand-accent text-white'
                              : isPast || isCurrent
                                ? 'bg-brand-primary text-white'
                                : 'bg-gray-100 text-gray-500 group-hover:bg-brand-primary/10 group-hover:text-brand-primary'
                          }`}
                        >
                          <i
                            className={
                              isPast && !isSelected
                                ? 'ri-check-line'
                                : icons[key] || 'ri-circle-line'
                            }
                            aria-hidden
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-sm font-semibold ${
                                isSelected || isCurrent ? 'text-gray-900' : 'text-gray-700'
                              }`}
                            >
                              {stage.title}
                            </span>
                            {isCurrent ? (
                              <span className="rounded-md bg-brand-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-primary">
                                Current
                              </span>
                            ) : null}
                            {isNext && !isSelected ? (
                              <span className="rounded-md bg-brand-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-accent">
                                Suggested next
                              </span>
                            ) : null}
                            {isSelected && !isCurrent ? (
                              <span className="rounded-md bg-brand-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                Selected
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                            {stage.description}
                          </span>
                        </span>
                        <span
                          className={`mt-2 h-4 w-4 shrink-0 rounded-full border-2 ${
                            isSelected
                              ? 'border-brand-accent bg-brand-accent shadow-[inset_0_0_0_2px_white]'
                              : 'border-gray-300 bg-white'
                          }`}
                          aria-hidden
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-brand-primary/10 px-4 pb-5 pt-3">
                <button
                  type="button"
                  onClick={handleUpdateJourney}
                  disabled={
                    updatingJourney ||
                    !journeyStage ||
                    journeyStage === currentJourney ||
                    order.status === 'cancelled'
                  }
                  className="w-full rounded-xl bg-brand-primary py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {updatingJourney
                    ? 'Updating…'
                    : journeyStage && journeyStage !== currentJourney
                      ? `Move to ${
                          FULFILLMENT_STAGES.find((s) => s.key === journeyStage)?.title ||
                          'milestone'
                        }`
                      : 'Select a milestone to continue'}
                </button>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-semibold text-gray-900">
                    Tracking number
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Optional carrier / warehouse ref"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus(undefined)}
                  disabled={statusUpdating}
                  className="mt-3 w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:border-brand-primary/30 hover:bg-brand-light/30 disabled:opacity-50"
                >
                  {statusUpdating ? 'Saving...' : 'Save tracking number'}
                </button>

                {order.status !== 'cancelled' &&
                  currentJourney !== 'delivered' &&
                  currentJourney !== 'en_route_ghana' &&
                  currentJourney !== 'in_ghana' &&
                  currentJourney !== 'ready' && (
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(true)}
                      className="mt-3 w-full rounded-xl border border-red-200 bg-red-50/80 py-3 text-sm font-bold text-red-700 transition-colors hover:bg-red-100"
                    >
                      Cancel this order…
                    </button>
                  )}
                {order.status === 'cancelled' && (
                  <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                    Cancelled
                    {order.metadata?.cancel_reason ? `: ${order.metadata.cancel_reason}` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Customer</h2>
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-brand-primary/10 text-brand-primary rounded-full font-semibold uppercase">
                  {customerName.substring(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{customerName}</p>
                  <p className="text-sm text-gray-600">{order.email}</p>
                  <p className="text-sm text-gray-600">{shippingAddress.phone || order.phone}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Shipping Address</h2>
              <div className="text-gray-700 space-y-1">
                {/* Support both old field names (address_line1) and new (address) */}
                <p>{shippingAddress.address || shippingAddress.address_line1}</p>
                {(shippingAddress.address_line2) && <p>{shippingAddress.address_line2}</p>}
                <p>
                  {shippingAddress.city}
                  {(shippingAddress.region || shippingAddress.state) && `, ${shippingAddress.region || shippingAddress.state}`}
                </p>
                {shippingAddress.postal_code && <p>{shippingAddress.postal_code}</p>}
                {shippingAddress.country && <p className="font-semibold">{shippingAddress.country}</p>}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Info</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Method</span>
                  <span className="font-semibold text-gray-900 capitalize">{order.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap capitalize ${
                    order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {(order.payment_status || 'unknown').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  {/* Transaction ID might be in metadata depending on callback */}
                  <span className="text-gray-600">Transaction</span>
                  <span className="text-sm text-gray-900 font-mono truncate max-w-[150px]">
                    {order.metadata?.moolre_reference || order.payment_transaction_id || 'N/A'}
                  </span>
                </div>
                {order.payment_status !== 'paid' && (
                  <div className="pt-3 border-t border-gray-200 space-y-2">
                    {(order.payment_method === 'invoice' ||
                      order.payment_status === 'awaiting_confirmation' ||
                      order.metadata?.payment_channel === 'invoice') && (
                      <>
                        <p className="text-sm text-gray-600">
                          {order.payment_status === 'awaiting_confirmation'
                            ? 'Customer tapped “I’ve paid”. Confirm after you see the transfer.'
                            : 'Electronic invoice. Confirm when bank/MoMo payment lands.'}
                        </p>
                        {order.metadata?.payment_sent_note ? (
                          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                            Customer note: {order.metadata.payment_sent_note}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleConfirmManualPayment}
                          disabled={confirmingPayment}
                          className="w-full bg-brand-primary hover:bg-[#0d2747] text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
                        >
                          {confirmingPayment ? 'Confirming…' : 'Confirm payment received'}
                        </button>
                      </>
                    )}
                    {order.payment_method === 'moolre' && (
                      <>
                        <p className="text-sm text-gray-600">
                          If the customer already paid via MoMo, verify with Moolre.
                        </p>
                        <button
                          type="button"
                          onClick={handleVerifyPayment}
                          disabled={verifyingPayment}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center"
                        >
                          {verifyingPayment ? 'Verifying…' : 'Verify payment with Moolre'}
                        </button>
                      </>
                    )}
                    {verifyMessage ? (
                      <p className="text-sm text-gray-700">{verifyMessage}</p>
                    ) : null}
                    <Link
                      href={`/order/${encodeURIComponent(order.order_number)}?email=${encodeURIComponent(order.email || '')}`}
                      target="_blank"
                      className="block text-center text-sm font-semibold text-brand-primary hover:underline"
                    >
                      Open customer invoice page
                    </Link>
                  </div>
                )}

                {order.metadata?.delivery_booking ? (
                  <div className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
                    <p className="font-bold">Delivery booked</p>
                    <p>{order.metadata.delivery_booking.address}</p>
                    <p>
                      {[
                        order.metadata.delivery_booking.preferredDate,
                        order.metadata.delivery_booking.preferredTime,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Notifications</h2>
              <p className="text-sm text-gray-600 mb-4">
                Resend email and SMS notifications to the customer about the current order status.
              </p>
              <button
                onClick={handleResendNotification}
                disabled={resendingNotification}
                className="w-full bg-brand-primary hover:bg-brand-accent text-white py-3 rounded-lg font-semibold transition-colors whitespace-nowrap disabled:opacity-50 flex items-center justify-center"
              >
                {resendingNotification ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="ri-notification-3-line mr-2"></i>
                    Resend Notifications
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Phone: {order.phone || shippingAddress.phone || 'Not provided'}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Admin Notes</h2>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add internal notes about this order..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent/25 focus:border-brand-accent resize-none"
              />
              <button
                onClick={() => handleUpdateStatus()}
                disabled={statusUpdating}
                className="w-full mt-3 bg-gray-700 hover:bg-gray-800 text-white py-2 rounded-lg font-medium transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {statusUpdating ? 'Saving...' : 'Save note'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Cancel order</h3>
            <p className="mt-2 text-sm text-gray-600">
              This keeps the order record. It does not delete payment history. Type CANCEL to confirm.
            </p>
            {order.payment_status === 'paid' || order.payment_status === 'awaiting_confirmation' ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Warning: payment status is {order.payment_status}. Only cancel if you have handled money with the customer.
              </p>
            ) : null}
            <label className="mt-4 block text-sm font-semibold text-gray-900">
              Reason
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border-2 border-gray-300 px-3 py-2 text-sm"
                placeholder="Customer never paid / wrong product / deal rejected…"
              />
            </label>
            <label className="mt-3 block text-sm font-semibold text-gray-900">
              Type CANCEL
              <input
                value={cancelConfirm}
                onChange={(e) => setCancelConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border-2 border-gray-300 px-3 py-2 font-mono text-sm uppercase"
                placeholder="CANCEL"
              />
            </label>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-lg border-2 border-gray-300 py-2.5 text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={cancelling || cancelConfirm.trim().toUpperCase() !== 'CANCEL' || cancelReason.trim().length < 5}
                onClick={handleCancelOrder}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {cancelling ? 'Cancelling…' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {amendItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Amend variant</h3>
            <p className="mt-1 text-sm text-gray-600">{amendItem.product_name}</p>
            <p className="text-xs text-gray-500">
              Current: {amendItem.variant_name || 'None'} · GH¢{Number(amendItem.unit_price || 0).toFixed(2)}
            </p>

            {loadingVariants ? (
              <p className="mt-4 text-sm text-gray-500">Loading options…</p>
            ) : (
              <label className="mt-4 block text-sm font-semibold text-gray-900">
                New option
                <select
                  value={amendVariantId}
                  onChange={(e) => setAmendVariantId(e.target.value)}
                  className="mt-1 w-full rounded-lg border-2 border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {amendVariants.map((v) => {
                    const label = [v.option2, v.name || v.option1].filter(Boolean).join(' / ') || v.name || v.id;
                    return (
                      <option key={v.id} value={v.id}>
                        {label} · GH¢{Number(v.price || 0).toFixed(2)}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}

            {amendVariantId && (() => {
              const v = amendVariants.find((x) => x.id === amendVariantId);
              if (!v) return null;
              const qty = Math.max(1, Number(amendItem.quantity) || 1);
              const delta = Number(v.price) * qty - Number(amendItem.total_price || amendItem.unit_price * qty || 0);
              return (
                <p className="mt-2 text-sm text-brand-primary font-semibold">
                  {Math.abs(delta) < 0.009
                    ? 'Same price'
                    : delta > 0
                      ? `Customer would owe +GH¢${delta.toFixed(2)}`
                      : `Credit GH¢${Math.abs(delta).toFixed(2)}`}
                </p>
              );
            })()}

            <label className="mt-3 block text-sm font-semibold text-gray-900">
              Reason
              <textarea
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border-2 border-gray-300 px-3 py-2 text-sm"
                placeholder="Customer WhatsApp request / stock finished / wrong color…"
              />
            </label>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setAmendItem(null)}
                className="flex-1 rounded-lg border-2 border-gray-300 py-2.5 text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={amending || !amendVariantId || amendReason.trim().length < 5}
                onClick={handleAmendItem}
                className="flex-1 rounded-lg bg-brand-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {amending ? 'Saving…' : 'Save amendment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
