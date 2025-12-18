'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/notifications/ToastContainer';

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
    } catch (err: any) {
      showError(err.message || 'Failed to load held bills');
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
