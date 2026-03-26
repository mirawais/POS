'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Receipt, ArrowLeft } from 'lucide-react';

// Helper: calculate net total with item + cart discounts
function calcNetTotal(data: any): { subtotal: number; totalDiscount: number; net: number } {
  const cart = data?.cart || [];
  let subtotal = 0;
  let itemDiscountTotal = 0;

  cart.forEach((item: any) => {
    if (item.status === 'REJECTED') return;
    const price = item.variant?.price ?? item.product?.price ?? 0;
    const qty = item.quantity || 1;
    const base = price * qty;
    subtotal += base;

    if (item.discountType && item.discountValue) {
      const disc = item.discountType === 'PERCENT'
        ? (base * item.discountValue) / 100
        : item.discountValue * qty;
      itemDiscountTotal += disc;
    }
  });

  const afterItemDiscount = Math.max(0, subtotal - itemDiscountTotal);
  let cartDiscountTotal = 0;
  const cdv = data?.cartDiscountValue ?? 0;
  if (cdv > 0) {
    cartDiscountTotal = data?.cartDiscountType === 'PERCENT'
      ? (afterItemDiscount * cdv) / 100
      : cdv;
  }

  const totalDiscount = itemDiscountTotal + cartDiscountTotal;
  const net = Math.max(0, subtotal - totalDiscount);
  return { subtotal, totalDiscount, net };
}

export default function ReadyToCheckoutPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/held-bills?status=READY_FOR_PAYMENT');
      if (res.ok) {
        setOrders(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isCloudKitchen = (session as any)?.user?.businessType === 'CLOUD_KITCHEN';

  if (!isCloudKitchen && session) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>This page is only for Cloud Kitchen clients.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
           <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Ready to Checkout</h1>
          <p className="text-gray-500 text-sm">Select an order to finalize payment.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
           {[1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-100 rounded-xl border border-gray-200 shadow-sm" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border-2 border-dashed border-gray-200 shadow-sm">
           <div className="p-4 bg-gray-50 rounded-full mb-4">
             <ShoppingCart className="w-12 h-12 text-gray-300" />
           </div>
           <h2 className="text-xl font-bold text-gray-700">No Orders in Queue</h2>
           <p className="text-gray-500 mt-2 text-center max-w-md">Scheduled orders will appear here after clicking 'Generate Bill' from the Scheduled Orders page.</p>
           <button
             onClick={() => router.push('/cashier/held-bills')}
             className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-all shadow-sm"
           >
             View Scheduled Orders
           </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order) => {
             const data = order.data || {};
             const label = data.label || 'Unnamed Order';
             const items = data.cart || [];
             const { subtotal, totalDiscount, net } = calcNetTotal(data);

             // Customer & Delivery info
             const customerName = data.customerName || order.customerName || null;
             const deliveryDateRaw = order.deliveryDate || data.deliveryDate || null;
             const deliveryDate = deliveryDateRaw ? new Date(deliveryDateRaw).toLocaleString() : null;

             return (
               <div key={order.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col border-l-4 border-l-emerald-500">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-xl text-gray-800 leading-tight">{label}</h3>
                      {customerName && (
                        <p className="text-xs text-blue-700 font-semibold mt-0.5">👤 {customerName}</p>
                      )}
                      {deliveryDate && (
                        <p className="text-xs text-orange-600 font-semibold mt-0.5">📅 {deliveryDate}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">READY</span>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-48 mb-4 pr-2 space-y-2 mt-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1 mb-2">Order Items</p>
                    {items.filter((i: any) => i.status !== 'REJECTED').map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start gap-3 group">
                        <span className="text-sm font-medium text-gray-700 leading-snug">
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] mr-1 font-black">{item.quantity}x</span>
                          {item.product?.name}
                          {item.variant && <span className="text-[10px] text-gray-400 italic block mt-0.5">({item.variant.name})</span>}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">Rs. {(item.quantity * (item.variant?.price || item.product?.price)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-1.5">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal</span>
                      <span>Rs. {subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-sm text-amber-700">
                        <span>Discount</span>
                        <span className="font-semibold">- Rs. {totalDiscount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-end pt-1">
                       <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Net Total</span>
                       <span className="text-2xl font-black text-blue-600">Rs. {net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>

                    <button
                      onClick={() => router.push(`/cashier/billing?loadHeldBillId=${order.id}&autoCheckout=true`)}
                      className="w-full mt-3 py-4 bg-emerald-600 text-white rounded-xl font-black text-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 active:scale-[0.98]"
                    >
                      <Receipt className="w-6 h-6" /> Finalize Payment
                    </button>
                  </div>
               </div>
             );
          })}
        </div>
      )}
    </div>
  );
}
