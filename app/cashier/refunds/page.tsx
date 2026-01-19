'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

type SaleItem = {
  id: string;
  product: { id: string; name: string; sku: string };
  variant?: { id: string; name: string; sku: string } | null;
  quantity: number;
  returnedQuantity: number;
  price: number;
  total: number;
};

type Sale = {
  id: string;
  orderId: string;
  createdAt: string;
  cashier: { name: string; email: string };
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

export default function CashierRefundsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [orderIdFilter, setOrderIdFilter] = useState('');
  const [refundItems, setRefundItems] = useState<Record<string, number>>({});
  const [refundReason, setRefundReason] = useState('');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Rule of Hooks: moved conditional render below remaining hooks


  useEffect(() => {
    loadSales();
  }, [orderIdFilter]);

  const loadSales = async () => {
    try {
      const params = new URLSearchParams();
      if (orderIdFilter) params.append('orderId', orderIdFilter);
      const res = await fetch(`/api/sales?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load sales');
      const data = await res.json();
      setSales(data);
    } catch (err: any) {
      setMessage(err.message || 'Failed to load sales');
    }
  };

  const handleRefundChange = (saleItemId: string, maxQty: number, value: string) => {
    const qty = Math.max(0, Math.min(maxQty, Number(value) || 0));
    setRefundItems((prev) => ({ ...prev, [saleItemId]: qty }));
  };

  const calculateRefundTotal = () => {
    if (!selectedSale) return 0;
    let total = 0;
    for (const [saleItemId, refundQty] of Object.entries(refundItems)) {
      if (refundQty > 0) {
        const item = selectedSale.items.find((i) => i.id === saleItemId);
        if (item) {
          const unitPrice = Number(item.total) / item.quantity;
          total += unitPrice * refundQty;
        }
      }
    }
    return total;
  };

  const handleSubmit = async () => {
    if (!selectedSale) return;

    const items = Object.entries(refundItems)
      .filter(([_, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => ({ saleItemId, quantity }));

    if (items.length === 0) {
      setMessage('Please select items to refund');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: selectedSale.id,
          items,
          reason: refundReason || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process refund');
      }

      setMessage('Refund processed successfully. Items restored to stock.');
      setSelectedSale(null);
      setRefundItems({});
      setRefundReason('');
      await loadSales();
    } catch (err: any) {
      setMessage(err.message || 'Failed to process refund');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!isOnline ? (
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded border h-64 text-center">
          <WifiOff size={48} className="text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Feature Unavailable Offline</h2>
          <p className="text-gray-500 mt-2 max-w-sm">
            Refunds require an active internet connection to validate sales data and prevent errors.
          </p>
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold">Refunds</h1>
            <p className="mt-2 text-gray-600">Process refunds and restore items to stock.</p>
          </div>


          <div className="p-4 border rounded bg-white">
            <label className="block text-sm text-gray-700 mb-2">Search Order ID</label>
            <input
              type="text"
              value={orderIdFilter}
              onChange={(e) => setOrderIdFilter(e.target.value)}
              placeholder="Enter order ID..."
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {message && (
            <div
              className={`p-3 rounded ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}
            >
              {message}
            </div>
          )}

          {!selectedSale && (
            <div className="space-y-3">
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-4 border rounded bg-white cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    setSelectedSale(sale);
                    setRefundItems({});
                    setRefundReason('');
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">Order: {sale.orderId}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(sale.createdAt).toLocaleString()} • {sale.items.length} item(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">Rs. {Number(sale.total).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {sales.length === 0 && <p className="text-gray-600">No orders found.</p>}
            </div>
          )}

          {selectedSale && (
            <div className="space-y-4">
              <div className="p-4 border rounded bg-white">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="font-semibold text-lg">Order: {selectedSale.orderId}</h2>
                    <p className="text-sm text-gray-600">
                      {new Date(selectedSale.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedSale(null);
                      setRefundItems({});
                      setRefundReason('');
                    }}
                    className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                  >
                    Back
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  <h3 className="font-semibold">Select Items to Refund</h3>
                  {selectedSale.items.map((item) => {
                    const maxRefund = item.quantity - (item.returnedQuantity || 0);
                    const refundQty = refundItems[item.id] || 0;
                    const unitPrice = Number(item.total) / item.quantity;
                    return (
                      <div key={item.id} className="border rounded p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium">
                              {item.product.name}
                              {item.variant && (
                                <span className="text-gray-600"> ({item.variant.name})</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              Qty: {item.quantity} • Refunded: {item.returnedQuantity || 0} • Max
                              refund: {maxRefund}
                            </div>
                          </div>
                          <div className="text-right">
                            <div>Rs. {Number(item.price).toFixed(2)}</div>
                          </div>
                        </div>
                        {maxRefund > 0 && (
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-700">Refund Qty:</label>
                            <input
                              type="number"
                              min="0"
                              max={maxRefund}
                              value={refundQty}
                              onChange={(e) =>
                                handleRefundChange(item.id, maxRefund, e.target.value)
                              }
                              className="w-20 border rounded px-2 py-1 text-sm"
                            />
                            {refundQty > 0 && (
                              <span className="text-sm text-red-600">
                                Refund: Rs. {(unitPrice * refundQty).toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                        {maxRefund === 0 && (
                          <p className="text-xs text-gray-500">All items already refunded</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-gray-700 mb-1">Refund Reason (Optional)</label>
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Enter refund reason..."
                    className="w-full border rounded px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>

                <div className="mb-4 p-3 bg-gray-50 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Refund:</span>
                    <span className="font-semibold text-lg text-red-700">
                      Rs. {calculateRefundTotal().toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={loading || calculateRefundTotal() === 0}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Processing...' : 'Process Refund'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

