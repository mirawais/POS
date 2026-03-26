'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/notifications/ToastContainer';
import { signOut, useSession } from 'next-auth/react';
import { Printer, Receipt, Trash2, Ban } from 'lucide-react';
import ConfirmationModal from '@/components/ConfirmationModal';

const WASTE_REASONS = ['Kitchen Accident', 'Waiter Mishap', 'Rider Accident', 'Customer Refused', 'Other'] as const;
type WasteReason = typeof WASTE_REASONS[number];

type HeldBill = {
  id: string;
  tokenName?: string;
  data: {
    cart?: any[];
    cartDiscountType?: 'PERCENT' | 'AMOUNT';
    cartDiscountValue?: number;
    couponCode?: string;
    taxId?: string;
    label?: string;
    orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
    tableNumber?: string;
    tokenNumber?: string;
    tokenName?: string;
    customerName?: string;
    customerPhone?: string;
    address?: string;
    orderStatus?: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'BILLING_REQUESTED' | 'WASTED';
    kitchenNote?: string;
    deliveryDate?: string;
  };
  createdAt: string;
  deliveryDate?: string | null;
};

export default function HeldBillsPage() {
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { data: session } = useSession();
  const { showError, showSuccess, showToast } = useToast();

  const role = session?.user?.role;
  const isRestaurant = (session?.user as any)?.businessType === 'RESTAURANT';
  const isCloudKitchen = (session?.user as any)?.businessType === 'CLOUD_KITCHEN';

  // Modal State
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    id: '',
    label: ''
  });

  // Waste Modal State
  const [wasteModal, setWasteModal] = useState({ isOpen: false, billId: '' });
  const [selectedWasteReason, setSelectedWasteReason] = useState<WasteReason>('Kitchen Accident');
  const [wasting, setWasting] = useState(false);

  useEffect(() => {
    loadHeldBills();

    // 15s polling
    const interval = setInterval(() => {
      loadHeldBills(true); // silent refresh
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const loadHeldBills = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      // 1. Get Offline Queue (Unsynced items)
      const offlineQueue = JSON.parse(localStorage.getItem('offline_held_queue') || '[]');

      // 2. Try to fetch Server Data
      const res = await fetch('/api/held-bills');
      if (!res.ok) throw new Error('Failed to load held bills');
      const serverData = await res.json();

      // Check for READY orders to show toast
      if (isSilent) {
        serverData.forEach((bill: HeldBill) => {
          const oldBill = heldBills.find(b => b.id === bill.id);
          if (bill.data?.orderStatus === 'READY' && oldBill?.data?.orderStatus !== 'READY') {
            showSuccess(`Order ${bill.data?.label || bill.id} is READY!`);
          }

          // Check for rejected items
          const currentRejected = bill.data?.cart?.filter((i: any) => i.status === 'REJECTED') || [];
          const oldRejected = oldBill?.data?.cart?.filter((i: any) => i.status === 'REJECTED') || [];

          if (currentRejected.length > oldRejected.length) {
            const newlyRejected = currentRejected.find((i: any) => !oldRejected.some((oi: any) => oi.product.id === i.product.id && oi.variant?.id === i.variant?.id));
            if (newlyRejected) {
              showToast(`Table ${bill.data?.tableNumber || 'N/A'}: ${newlyRejected.product?.name} is unavailable`, 'error', 10000);
            }
          }
        });
      }

      // 3. Merge: Offline First + Server Data
      const combinedData = [...offlineQueue, ...serverData];

      setHeldBills(combinedData);
      localStorage.setItem('cached_held_bills', JSON.stringify(combinedData));
    } catch (err: any) {
      // 4. Fallback: Offline Mode
      console.log('Fetching failed, loading offline/cached data...');

      // User Suggestion: Show both Online (Cached) and Offline bills
      const offlineQueue = JSON.parse(localStorage.getItem('offline_held_queue') || '[]');
      const cached = JSON.parse(localStorage.getItem('cached_held_bills') || '[]');

      // Safety check: ensure 'b' and 'b.id' exist
      const cachedValid = cached.filter((b: any) => b && b.id);

      // Merge unique based on ID (Prioritize offline queue versions if they exist)
      const offlineIds = new Set(offlineQueue.filter((b: any) => b && b.id).map((b: any) => b.id.toString()));
      const uniqueCached = cachedValid.filter((b: any) => !offlineIds.has(b.id.toString()));

      const finalData = [...offlineQueue, ...uniqueCached];

      // Filter out locally deleted items
      const deletedIds = new Set(JSON.parse(localStorage.getItem('offline_deleted_held_bills') || '[]'));
      if (deletedIds.size > 0) {
        setHeldBills(finalData.filter(b => b && b.id && !deletedIds.has(b.id.toString())));
      } else {
        setHeldBills(finalData);
      }

      if (!navigator.onLine) {
        // Don't show error, banner handles status
      } else {
        showError('Offline mode: Showing cached data');
      }

      setHeldBills(finalData);

      if (finalData.length === 0 && (!cached || cached.length === 0)) {
        showError(err.message || 'Failed to load held bills');
      } else if (navigator.onLine) {
        showError('Using cached data (Server error)');
      }
    } finally {
      setLoading(false);
    }
  };

  const requestBilling = async (id: string) => {
    try {
      const res = await fetch('/api/held-bills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'BILLING_REQUESTED' }),
      });

      if (!res.ok) throw new Error('Failed to request billing');
      showSuccess('Billing request sent to cashier');
      loadHeldBills();
    } catch (err: any) {
      showError(err.message || 'Failed to request billing');
    }
  };

  const handleLoad = (bill: HeldBill) => {
    sessionStorage.setItem('loadHeldBillId', bill.id);
    router.push('/cashier/billing');
  };

  const handleDeleteClick = (id: string, label?: string) => {
    setDeleteModal({
      isOpen: true,
      id,
      label: label || 'this saved cart'
    });
  };

  const confirmDelete = async () => {
    const { id } = deleteModal;
    setDeleteModal(prev => ({ ...prev, isOpen: false }));

    // Check if it's an offline-only bill
    const isOffline = id.toString().startsWith('OFF-HELD-') || ((heldBills.find(b => b.id === id) as any)?.isOffline);

    if (isOffline) {
      // Local Delete
      try {
        const offlineQueue = JSON.parse(localStorage.getItem('offline_held_queue') || '[]');
        const updatedQueue = offlineQueue.filter((b: any) => b.id !== id);
        localStorage.setItem('offline_held_queue', JSON.stringify(updatedQueue));

        const cached = JSON.parse(localStorage.getItem('cached_held_bills') || '[]');
        const updatedCached = cached.filter((b: any) => b.id !== id);
        localStorage.setItem('cached_held_bills', JSON.stringify(updatedCached));

        setHeldBills(updatedCached);
        showSuccess('Offline cart deleted successfully');
      } catch (e) {
        showError('Failed to delete offline cart');
      }
      return;
    }

    // Server Delete (or Online-created bill being deleted locally)
    try {
      if (navigator.onLine) {
        const res = await fetch(`/api/held-bills?id=${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete held bill');
        showSuccess('Saved cart deleted successfully');
      } else {
        throw new Error('Offline'); // Force local fallback
      }
      loadHeldBills();
    } catch (err: any) {
      // Offline / Fallback Delete
      // If we failed to delete from server (e.g. offline), we should still remove it from view
      // so the user thinks it's done. 
      // NOTE: This doesn't actually delete from server if it comes back online later unless we queue it, 
      // but for "held bills" which are temporary, hiding it locally is often sufficient for UX.

      const cached = JSON.parse(localStorage.getItem('cached_held_bills') || '[]');
      const updatedCached = cached.filter((b: any) => b.id.toString() !== id.toString());
      localStorage.setItem('cached_held_bills', JSON.stringify(updatedCached));
      setHeldBills(updatedCached);

      // Also ensure it's removed from offline queue just in case
      const offlineQueue = JSON.parse(localStorage.getItem('offline_held_queue') || '[]');
      if (offlineQueue.some((b: any) => b.id.toString() === id.toString())) {
        const updatedQueue = offlineQueue.filter((b: any) => b.id.toString() !== id.toString());
        localStorage.setItem('offline_held_queue', JSON.stringify(updatedQueue));
      }

      // Track as deleted so it doesn't reappear from stale cache or future fetches before sync
      const deletedIds = JSON.parse(localStorage.getItem('offline_deleted_held_bills') || '[]');
      if (!deletedIds.includes(id.toString())) {
        deletedIds.push(id.toString());
        localStorage.setItem('offline_deleted_held_bills', JSON.stringify(deletedIds));
      }

      if (err.message === 'Offline') {
        showSuccess('Deleted from local list (Offline)');
      } else {
        showSuccess('Deleted locally (Server unreachable)');
      }
    }
  };

  const markAsServed = async (id: string) => {
    try {
      const res = await fetch('/api/held-bills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'SERVED' }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      showSuccess('Order marked as served');
      loadHeldBills();
    } catch (err: any) {
      showError(err.message || 'Failed to serve order');
    }
  };

  const handleWasteClick = (billId: string) => {
    setSelectedWasteReason('Kitchen Accident');
    setWasteModal({ isOpen: true, billId });
  };

  const confirmWaste = async () => {
    setWasting(true);
    try {
      const res = await fetch('/api/held-bills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: wasteModal.billId, status: 'WASTED', wasteReason: selectedWasteReason }),
      });
      if (!res.ok) throw new Error('Failed to mark as wasted');
      showSuccess(`Order marked as wasted: ${selectedWasteReason}`);
      setWasteModal({ isOpen: false, billId: '' });
      loadHeldBills();
    } catch (err: any) {
      showError(err.message || 'Failed to waste order');
    } finally {
      setWasting(false);
    }
  };

  const calculateCartTotal = (bill: HeldBill) => {
    const cart = bill.data?.cart || [];
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
    const cdv = bill.data?.cartDiscountValue ?? 0;
    if (cdv > 0) {
      cartDiscountTotal = bill.data?.cartDiscountType === 'PERCENT'
        ? (afterItemDiscount * cdv) / 100
        : cdv;
    }

    const totalDiscount = itemDiscountTotal + cartDiscountTotal;
    const total = Math.max(0, subtotal - totalDiscount);
    return { subtotal, itemDiscountTotal, cartDiscountTotal, totalDiscount, total };
  };

  const getItemCount = (bill: HeldBill) => {
    const cart = bill.data?.cart || [];
    return cart.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
  };

  const printHeldBill = async (bill: HeldBill) => {
    try {
      const setting = await fetch('/api/invoice-settings').then((r) => r.json()).catch(() => ({}));
      const taxes = await fetch('/api/taxes').then((r) => r.json()).catch(() => ([]));

      const cart = bill.data?.cart || [];
      let subtotal = 0;
      const itemsHtml = cart.map((item: any) => {
        const product = item.product;
        const variant = item.variant;
        const price = variant?.price ?? product?.price ?? item.price ?? 0;
        const quantity = item.quantity || 1;
        const itemTotal = Number(price) * quantity;
        subtotal += itemTotal;

        const productName = product?.name || 'Unknown';
        const variantName = variant?.name || null;

        return `<tr>
            <td>${productName}${variantName ? ` (${variantName})` : ''}</td>
            <td>${quantity}</td>
            <td>Rs. ${Number(price).toFixed(2)}</td>
            <td>Rs. ${itemTotal.toFixed(2)}</td>
          </tr>`;
      }).join('');

      let discountTotal = 0;
      if (bill.data?.cartDiscountValue && bill.data.cartDiscountValue > 0) {
        if (bill.data.cartDiscountType === 'PERCENT') {
          discountTotal = (subtotal * bill.data.cartDiscountValue) / 100;
        } else {
          discountTotal = bill.data.cartDiscountValue;
        }
      }

      let couponValue = 0;
      if (bill.data?.couponCode) {
        const validatedCoupon = await getValidatedCoupon(bill.data.couponCode);
        if (validatedCoupon) {
          const couponDiscountBase = Math.max(0, subtotal - discountTotal);
          if (validatedCoupon.type === 'PERCENT') {
            couponValue = (couponDiscountBase * validatedCoupon.value) / 100;
          } else {
            couponValue = validatedCoupon.value;
          }
        }
      }

      const totalDiscount = discountTotal + couponValue;
      const afterDiscount = Math.max(0, subtotal - totalDiscount);

      let taxAmount = 0;
      const taxMode = setting?.taxMode || 'EXCLUSIVE';
      if (bill.data?.taxId && bill.data.taxId !== 'none') {
        const selectedTax = taxes.find((t: any) => t.id === bill.data.taxId);
        if (selectedTax) {
          const taxPercent = Number(selectedTax.percent);
          if (taxMode === 'INCLUSIVE') {
            taxAmount = (afterDiscount * taxPercent) / (100 + taxPercent);
          } else {
            taxAmount = (afterDiscount * taxPercent) / 100;
          }
        }
      }

      const total = taxMode === 'INCLUSIVE' ? afterDiscount : afterDiscount + taxAmount;

      const logo = setting?.logoUrl ? `<img src="${setting.logoUrl}" style="max-width:150px;" />` : '';
      const header = setting?.headerText ? `<div>${setting.headerText}</div>` : '';
      const footer = setting?.footerText ? `<div>${setting.footerText}</div>` : '';

      const savedDate = new Date(bill.createdAt);
      const html = `
          <html>
            <head>
              <title>Held Bill - ${bill.data?.label || 'Unnamed Cart'}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th, td { padding: 4px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f5f5f5; }
                .total { font-weight: bold; }
              </style>
            </head>
            <body>
              <div style="text-align:center;">
                ${logo}
                ${header}
              </div>
              <div style="margin-top:8px;font-size:12px;">
                <strong>Held Bill / Saved Cart</strong><br/>
                Cart Name: ${bill.data?.label || 'Unnamed Cart'}<br/>
                Saved Date: ${savedDate.toLocaleString()}<br/>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              <div style="margin-top:8px;font-size:12px;">
                Subtotal: Rs. ${subtotal.toFixed(2)}<br/>
                ${setting?.showDiscount !== false && totalDiscount > 0 ? `Discount: Rs. ${totalDiscount.toFixed(2)}<br/>` : ''}
                ${bill.data?.couponCode ? `Coupon: ${bill.data.couponCode}<br/>` : ''}
                ${setting?.showTax !== false && taxAmount > 0 ? `Tax: Rs. ${taxAmount.toFixed(2)}<br/>` : ''}
                <strong class="total">Total: Rs. ${total.toFixed(2)}</strong>
              </div>
              <div style="text-align:center;margin-top:12px;font-size:12px;">
                <em>This is a saved cart and has not been processed as a sale.</em><br/>
                ${footer}
              </div>
            </body>
          </html>
        `;

      const win = window.open('', `PRINT_HELD_BILL_${bill.id}_${Date.now()}`, 'height=650,width=400');
      if (!win) {
        showError('Please allow pop-ups to print');
        return;
      }

      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();

      setTimeout(() => {
        try {
          win.close();
        } catch (e) { }
      }, 1000);
    } catch (err: any) {
      showError(err.message || 'Failed to print held bill');
    }
  };

  const [validatedCoupons, setValidatedCoupons] = useState<Map<string, any>>(new Map());

  const getValidatedCoupon = async (couponCode: string) => {
    if (validatedCoupons.has(couponCode)) {
      return validatedCoupons.get(couponCode);
    }
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(couponCode)}`);
      if (res.ok) {
        const coupon = await res.json();
        setValidatedCoupons(new Map(validatedCoupons.set(couponCode, coupon)));
        return coupon;
      }
    } catch (e) { }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isCloudKitchen ? 'Scheduled Orders' : isRestaurant ? 'Kitchen Orders' : 'Held Bills'}
          </h1>
          <p className="mt-2 text-gray-600">
            {isCloudKitchen ? 'View and manage your scheduled cloud kitchen orders.' : isRestaurant ? 'View and manage kitchen orders.' : 'View and manage your saved carts (held bills).'}
          </p>
        </div>
        <button
          onClick={() => loadHeldBills()}
          className="px-4 py-2 border rounded hover:bg-gray-50 flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <Printer className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!loading && heldBills.length === 0 && (
        <div className="p-12 border border-dashed rounded-lg bg-white text-center">
          <p className="text-gray-500 font-medium">No held bills found</p>
          <button
            onClick={() => router.push('/cashier/billing')}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            Go to Billing to save a cart
          </button>
        </div>
      )}

      {/* Offline Mode Banner */}
      {!loading && !navigator.onLine && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-center gap-2 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium">
            You are currently offline. Showing cached online carts and local offline carts.
          </p>
        </div>
      )}

      {!loading && heldBills.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {heldBills
            .filter(bill => {
              if (role === 'WAITER' && bill.data?.orderStatus === 'BILLING_REQUESTED') return false;
              if (bill.data?.orderStatus === 'WASTED') return false; // Hide wasted from active list
              return true;
            })
            .map((bill) => {
              const cartLabel = bill.data?.label;
              const itemCount = getItemCount(bill);
              const totals = calculateCartTotal(bill);
              const savedDate = new Date(bill.createdAt);

              return (
                <div key={bill.id} className="bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col h-full">
                  <div className="mb-4">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-gray-900 line-clamp-1">
                        {bill.tokenName || cartLabel || 'Unnamed Cart'}
                      </h3>
                    </div>
                    {isCloudKitchen && bill.data?.customerName && (
                      <p className="text-xs text-blue-700 font-semibold mt-0.5">👤 {bill.data.customerName}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {savedDate.toLocaleString()}
                    </p>
                  </div>

                  <div className="space-y-2 mb-6 flex-grow">
                    {/* Order Status Badge - Only for Restaurant */}
                    {isRestaurant && (
                      <div className="mb-3">
                        {(() => {
                          const status = bill.data?.orderStatus || 'PENDING';
                          let colorClass = 'bg-orange-100 text-orange-800 border-orange-200';
                          let label = 'PENDING';

                          if (status === 'PREPARING') {
                            colorClass = 'bg-blue-100 text-blue-800 border-blue-200';
                            label = 'PREPARING';
                          } else if (status === 'READY') {
                            colorClass = 'bg-green-100 text-green-800 border-green-200 animate-pulse';
                            label = 'READY';
                          } else if (status === 'SERVED') {
                            colorClass = 'bg-gray-100 text-gray-800 border-gray-200';
                            label = 'SERVED';
                          } else if (status === 'BILLING_REQUESTED') {
                            colorClass = 'bg-purple-100 text-purple-800 border-purple-200';
                            label = 'BILLING REQUESTED';
                          }

                          return (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
                              {label}
                            </span>
                          );
                        })()}
                      </div>
                    )}

                    {/* Restaurant Details */}
                    {isRestaurant && bill.data?.orderType && (
                      <div className="flex justify-between text-sm bg-gray-50 p-1 rounded">
                        <span className="text-gray-600 font-medium">
                          {bill.data.orderType === 'DINE_IN' ? 'Dine-in' : bill.data.orderType === 'TAKEAWAY' ? 'Takeaway' : 'Delivery'}
                        </span>
                        <span className="font-bold text-gray-900">
                          {bill.data.orderType === 'DINE_IN'
                            ? `Table: ${bill.data.tableNumber || 'N/A'}`
                            : bill.data.orderType === 'DELIVERY'
                              ? (bill.data.customerName || bill.tokenName || 'N/A')
                              : (bill.tokenName || bill.data.tokenNumber || 'N/A')}
                        </span>
                      </div>
                    )}

                    {isRestaurant ? (
                      <div className="mt-4 border-t pt-3">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 flex justify-between">
                          <span>Order Details</span>
                          <span className="text-gray-400">{itemCount} items</span>
                        </p>
                        <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {bill.data?.cart?.map((item: any, idx: number) => {
                            const status = item.status || 'PENDING';
                            let statusColor = 'bg-orange-100 text-orange-800 border-orange-200';
                            if (status === 'READY') statusColor = 'bg-green-100 text-green-800 border-green-200';
                            else if (status === 'SERVED') statusColor = 'bg-gray-100 text-gray-600 border-gray-200';
                            else if (status === 'PREPARING') statusColor = 'bg-blue-100 text-blue-800 border-blue-200';

                            return (
                              <li key={idx} className="flex justify-between items-start text-xs border-b border-gray-50 pb-1 last:border-0">
                                <span className="text-gray-800 font-medium leading-tight flex-1">
                                  <span className="font-black mr-1">{item.quantity}x</span> {item.product?.name}
                                  {item.variant?.name && <span className="text-[10px] text-gray-500 block font-normal">{item.variant.name}</span>}
                                </span>
                                <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-black border uppercase whitespace-nowrap ${statusColor}`}>
                                  {status.replace('_', ' ')}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : isCloudKitchen ? (
                      <div className="mt-2 space-y-1">
                         <p className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b pb-0.5 mb-1">Items</p>
                         {((bill.data as any)?.cart || []).filter((i: any) => i.status !== 'REJECTED').map((item: any, idx: number) => (
                           <div key={idx} className="text-sm text-gray-700 flex justify-between items-start gap-2">
                             <span className="font-medium">{item.quantity}x {item.product?.name || 'Product'}</span>
                             {item.variant && <span className="text-[10px] text-gray-500 italic ml-auto">({item.variant.name})</span>}
                           </div>
                         ))}
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Items:</span>
                        <span className="font-semibold text-gray-900">{itemCount}</span>
                      </div>
                    )}
                    {/* Cloud Kitchen: Delivery Date Display */}
                    {isCloudKitchen && (bill.deliveryDate || bill.data?.deliveryDate) && (
                      <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">📅 Delivery Scheduled</p>
                        <p className="text-sm font-semibold text-orange-900 mt-0.5">
                          {new Date(bill.deliveryDate || bill.data?.deliveryDate || '').toLocaleString()}
                        </p>
                      </div>
                    )}

                    {isCloudKitchen && totals.totalDiscount > 0 && (
                      <div className="flex justify-between text-sm text-amber-700">
                        <span>Discount:</span>
                        <span className="font-semibold">- Rs. {totals.totalDiscount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Estimated Total:</span>
                      <span className="font-semibold text-blue-600">Rs. {totals.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t mt-auto">
                    <button
                      onClick={() => handleLoad(bill)}
                      className="flex-grow px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-colors"
                    >
                      {isCloudKitchen ? 'Load to Cart' : 'Load Cart'}
                    </button>
                    <button
                      onClick={() => printHeldBill(bill)}
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      title="Print"
                    >
                      <Printer className="w-5 h-5 text-gray-600" />
                    </button>
                    {/* Delete and Waste Logic */}
                    {(() => {
                      const orderStatus = bill.data?.orderStatus || 'PENDING';

                      // Stages where food is NOT prepared (PENDING) -> Show Delete (Gray Trash2)
                      if (orderStatus === 'PENDING') {
                        return (
                          <button
                            onClick={() => handleDeleteClick(bill.id, cartLabel)}
                            className="p-2 border border-red-100 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                            title="Delete Order"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        );
                      }

                      // Stages where food IS prepared (PREPARING, READY, SERVED, BILLING_REQUESTED) -> Show Waste (Red Ban)
                      // Only for Restaurant clients
                      if (isRestaurant && ['PREPARING', 'READY', 'SERVED', 'BILLING_REQUESTED'].includes(orderStatus)) {
                        return (
                          <button
                            onClick={() => handleWasteClick(bill.id)}
                            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            title="Mark as Wasted/Void"
                          >
                            <Ban className="h-5 w-5" />
                          </button>
                        );
                      }

                      return null;
                    })()}
                  </div>
                  {bill.data?.orderStatus === 'READY' && ['WAITER', 'CASHIER'].includes(role || '') && (
                    <button
                      onClick={() => markAsServed(bill.id)}
                      className="mt-3 w-full py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm"
                    >
                      Mark as Served
                    </button>
                  )}

                  {['WAITER', 'CASHIER'].includes(role || '') && (bill.data?.orderStatus === 'SERVED' || bill.data?.cart?.every((i: any) => ['SERVED', 'REJECTED'].includes(i.status))) && (
                    <button
                      onClick={() => requestBilling(bill.id)}
                      className="mt-2 w-full py-2 bg-blue-700 text-white rounded-lg font-bold hover:bg-blue-800 transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <Receipt className="w-4 h-4" />
                      Generate Bill
                    </button>
                  )}

                  {/* Cloud Kitchen: Generate Bill -> Mark READY_FOR_PAYMENT and redirect */}
                  {isCloudKitchen && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/held-bills', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              id: bill.id,
                              status: 'READY_FOR_PAYMENT'
                            }),
                          });
                          if (res.ok) {
                            router.push('/cashier/ready-to-checkout');
                          } else {
                            alert('Failed to update order status');
                          }
                        } catch (err) {
                          console.error(err);
                          alert('Error moving order to checkout');
                        }
                      }}
                      className="mt-2 w-full py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <Receipt className="w-4 h-4" /> Generate Bill
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Delete Saved Cart"
        message={`Are you sure you want to delete "${deleteModal.label}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: '', label: '' })}
      />

      {/* Waste/Void Modal */}
      {wasteModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Mark Order as Wasted</h3>
            <p className="text-sm text-gray-500 mb-4">Select the reason for voiding this order.</p>
            <div className="space-y-2 mb-6">
              {WASTE_REASONS.map(reason => (
                <label key={reason} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="wasteReason"
                    value={reason}
                    checked={selectedWasteReason === reason}
                    onChange={() => setSelectedWasteReason(reason)}
                    className="text-red-600"
                  />
                  <span className="text-sm font-medium text-gray-800">{reason}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setWasteModal({ isOpen: false, billId: '' })}
                className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmWaste}
                disabled={wasting}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {wasting ? 'Processing...' : 'Confirm Waste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
