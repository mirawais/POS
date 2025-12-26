'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/notifications/ToastContainer';
import { Printer } from 'lucide-react';

type HeldBill = {
  id: string;
  data: {
    cart?: any[];
    cartDiscountType?: 'PERCENT' | 'AMOUNT';
    cartDiscountValue?: number;
    couponCode?: string;
    taxId?: string;
    label?: string;
  };
  createdAt: string;
};

export default function HeldBillsPage() {
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    loadHeldBills();
  }, []);

  const loadHeldBills = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/held-bills');
      if (!res.ok) throw new Error('Failed to load held bills');
      const data = await res.json();
      setHeldBills(data);
      localStorage.setItem('cached_held_bills', JSON.stringify(data));
    } catch (err: any) {
      // Try cache if offline or failed
      const cached = localStorage.getItem('cached_held_bills');
      if (cached) {
        setHeldBills(JSON.parse(cached));
        if (navigator.onLine) showError('Using cached held bills');
      } else {
        showError(err.message || 'Failed to load held bills');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = (bill: HeldBill) => {
    // Navigate to billing page - the billing page will need to handle loading via URL params or state
    // For now, we'll use sessionStorage to pass the bill ID
    sessionStorage.setItem('loadHeldBillId', bill.id);
    router.push('/cashier/billing');
  };

  const handleDelete = async (id: string, label?: string) => {
    if (!confirm(`Are you sure you want to delete "${label || 'this saved cart'}"?`)) return;
    try {
      const res = await fetch(`/api/held-bills?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete held bill');
      showSuccess('Saved cart deleted successfully');
      loadHeldBills();
    } catch (err: any) {
      showError(err.message || 'Failed to delete saved cart');
    }
  };

  const calculateCartTotal = (bill: HeldBill) => {
    const cart = bill.data?.cart || [];
    let subtotal = 0;
    cart.forEach((item: any) => {
      const price = item.variant?.price ?? item.product?.price ?? 0;
      subtotal += price * (item.quantity || 1);
    });
    return subtotal;
  };

  const getItemCount = (bill: HeldBill) => {
    const cart = bill.data?.cart || [];
    return cart.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
  };

  const printHeldBill = async (bill: HeldBill) => {
    try {
      // Fetch invoice settings
      const setting = await fetch('/api/invoice-settings').then((r) => r.json()).catch(() => ({}));

      // Fetch taxes for calculation
      const taxes = await fetch('/api/taxes').then((r) => r.json()).catch(() => ([]));

      // Calculate totals from cart data (products should be included in the cart items)
      const cart = bill.data?.cart || [];
      let subtotal = 0;
      const itemsHtml = cart.map((item: any) => {
        // Use product data from the cart item (should be included when saving)
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

      // Calculate discounts
      let discountTotal = 0;
      if (bill.data?.cartDiscountValue && bill.data.cartDiscountValue > 0) {
        if (bill.data.cartDiscountType === 'PERCENT') {
          discountTotal = (subtotal * bill.data.cartDiscountValue) / 100;
        } else {
          discountTotal = bill.data.cartDiscountValue;
        }
      }

      // Calculate coupon discount if applicable
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

      // Calculate tax
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

      // Get logo, header, footer from settings
      const logo = setting?.logoUrl ? `<img src="${setting.logoUrl}" style="max-width:150px;" />` : '';
      const header = setting?.headerText ? `<div>${setting.headerText}</div>` : '';
      const footer = setting?.footerText ? `<div>${setting.footerText}</div>` : '';

      // Build HTML
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
              ${setting?.customFields && Array.isArray(setting.customFields) && setting.customFields.length > 0
          ? setting.customFields.map((field: any) => `<div><strong>${field.label}:</strong> ${field.value}</div>`).join('')
          : ''}
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

      // Open print window
      const win = window.open('', `PRINT_HELD_BILL_${bill.id}_${Date.now()}`, 'height=650,width=400');
      if (!win) {
        showError('Please allow pop-ups to print');
        return;
      }

      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();

      // Close window after print
      setTimeout(() => {
        try {
          win.close();
        } catch (e) {
          // Ignore if window already closed
        }
      }, 1000);
    } catch (err: any) {
      showError(err.message || 'Failed to print held bill');
    }
  };

  // Cache for validated coupons
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
    } catch (e) {
      // Ignore
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Held Bills</h1>
        <p className="mt-2 text-gray-600">View and manage your saved carts (held bills).</p>
      </div>

      {loading && <p className="text-gray-600">Loading held bills...</p>}

      {!loading && heldBills.length === 0 && (
        <div className="p-8 border rounded bg-white text-center">
          <p className="text-gray-600">No held bills found. Save carts from the Billing page to see them here.</p>
        </div>
      )}

      {!loading && heldBills.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {heldBills.map((bill) => {
            const cartLabel = bill.data?.label;
            const itemCount = getItemCount(bill);
            const estimatedTotal = calculateCartTotal(bill);
            const savedDate = new Date(bill.createdAt);

            return (
              <div key={bill.id} className="border rounded bg-white p-4 space-y-3">
                <div>
                  {cartLabel ? (
                    <div className="font-semibold text-lg mb-1">{cartLabel}</div>
                  ) : (
                    <div className="font-semibold text-lg mb-1 text-gray-500">Unnamed Cart</div>
                  )}
                  <div className="text-sm text-gray-600">
                    Saved: {savedDate.toLocaleString()}
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Items:</span>
                    <span className="font-medium">{itemCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimated Total:</span>
                    <span className="font-medium">Rs. {estimatedTotal.toFixed(2)}</span>
                  </div>
                  {bill.data?.couponCode && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Coupon:</span>
                      <span className="font-medium">{bill.data.couponCode}</span>
                    </div>
                  )}
                  {bill.data?.cartDiscountValue && bill.data.cartDiscountValue > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Discount:</span>
                      <span className="font-medium">
                        {bill.data.cartDiscountType === 'PERCENT'
                          ? `${bill.data.cartDiscountValue}%`
                          : `Rs. ${bill.data.cartDiscountValue.toFixed(2)}`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <button
                    onClick={() => handleLoad(bill)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Load to Billing
                  </button>
                  <button
                    onClick={() => printHeldBill(bill)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-1"
                    title="Print"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(bill.id, cartLabel)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  >
                    Delete
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
