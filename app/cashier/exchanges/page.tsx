'use client';

import { useEffect, useState } from 'react';

type SaleItem = {
  id: string;
  product: { id: string; name: string; sku: string };
  variant?: { id: string; name: string; sku: string; attributes: any } | null;
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
  taxPercent?: number | null;
  total: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  variants?: Array<{ id: string; name: string; price: number; attributes: any }>;
};

export default function CashierExchangesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [orderIdFilter, setOrderIdFilter] = useState('');
  const [returnItems, setReturnItems] = useState<Record<string, number>>({});
  const [replacementItems, setReplacementItems] = useState<
    Array<{
      productId: string;
      variantId?: string | null;
      quantity: number;
      discountType: 'PERCENT' | 'AMOUNT';
      discountValue: number;
    }>
  >([]);
  const [newTotal, setNewTotal] = useState(0);

  useEffect(() => {
    loadSales();
    loadProducts();
  }, [orderIdFilter]);

  useEffect(() => {
    if (selectedSale) {
      calculateNewTotal();
    }
  }, [returnItems, replacementItems, selectedSale]);

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

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to load products');
      const data = await res.json();
      setProducts(data);
    } catch (err: any) {
      console.error('Failed to load products', err);
    }
  };

  const calculateNewTotal = async () => {
    if (!selectedSale) return;

    // Calculate return value (net of tax, discount - same as original item total)
    let returnValue = 0;
    for (const [saleItemId, returnQty] of Object.entries(returnItems)) {
      if (returnQty > 0) {
        const item = selectedSale.items.find((i) => i.id === saleItemId);
        if (item) {
          // Use the item's total (which includes tax) divided by quantity to get unit total
          const unitTotal = Number(item.total) / item.quantity;
          returnValue += unitTotal * returnQty;
        }
      }
    }

    // Calculate replacement value with tax estimate
    let replacementSubtotal = 0;
    let replacementDiscount = 0;
    for (const repl of replacementItems) {
      if (repl.productId) {
        const product = products.find((p) => p.id === repl.productId);
        if (product) {
          const price = repl.variantId
            ? product.variants?.find((v) => v.id === repl.variantId)?.price || product.price
            : product.price;
          const itemSubtotal = Number(price) * repl.quantity;
          let itemDiscount = 0;
          if (repl.discountType === 'PERCENT') {
            itemDiscount = (itemSubtotal * repl.discountValue) / 100;
          } else {
            itemDiscount = repl.discountValue;
          }
          replacementSubtotal += itemSubtotal;
          replacementDiscount += itemDiscount;
        }
      }
    }

    // Apply tax (use original sale tax percent)
    const taxPercent = selectedSale.taxPercent ? Number(selectedSale.taxPercent) : 0;
    const replacementAfterDiscount = Math.max(0, replacementSubtotal - replacementDiscount);
    const replacementTax = (replacementAfterDiscount * taxPercent) / 100;
    const replacementValue = replacementAfterDiscount + replacementTax;

    // For exchange: Replacement total must be >= Returned value (not original total)
    // This ensures no cash refund - replacement must cover the returned items
    setNewTotal(replacementValue);
  };

  const handleReturnChange = (saleItemId: string, maxQty: number, value: string) => {
    const qty = Math.max(0, Math.min(maxQty, Number(value) || 0));
    setReturnItems((prev) => ({ ...prev, [saleItemId]: qty }));
  };

  const addReplacementItem = () => {
    setReplacementItems((prev) => [
      ...prev,
      { productId: '', variantId: null, quantity: 1, discountType: 'AMOUNT', discountValue: 0 },
    ]);
  };

  const updateReplacementItem = (index: number, field: string, value: any) => {
    setReplacementItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const removeReplacementItem = (index: number) => {
    setReplacementItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedSale) return;

    const returns = Object.entries(returnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([saleItemId, returnQuantity]) => ({ saleItemId, returnQuantity }));

    if (returns.length === 0 && replacementItems.length === 0) {
      setMessage('Please select items to return or add replacements');
      return;
    }

    // Calculate total returned value
    let totalReturnedValue = 0;
    for (const [saleItemId, returnQty] of Object.entries(returnItems)) {
      if (returnQty > 0) {
        const item = selectedSale.items.find((i) => i.id === saleItemId);
        if (item) {
          const unitTotal = Number(item.total) / item.quantity;
          totalReturnedValue += unitTotal * returnQty;
        }
      }
    }

    // Validate: Replacement total must be >= Returned value (no cash refund)
    // This ensures replacement items cover the value of returned items
    if (totalReturnedValue > 0 && newTotal < totalReturnedValue) {
      setMessage(
        `Exchange not allowed: Replacement total (Rs. ${newTotal.toFixed(2)}) must be equal to or greater than returned value (Rs. ${totalReturnedValue.toFixed(2)}). Please add more items.`
      );
      return;
    }

    // If no returns, replacement must be >= original total
    if (totalReturnedValue === 0 && replacementItems.length > 0) {
      const originalTotal = Number(selectedSale.total);
      if (newTotal < originalTotal) {
        setMessage(
          `Exchange not allowed: Replacement total (Rs. ${newTotal.toFixed(2)}) must be equal to or greater than original total (Rs. ${originalTotal.toFixed(2)}). Please add more items.`
        );
        return;
      }
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/sales/${selectedSale.id}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnItems: returns,
          replacementItems: replacementItems.filter((item) => item.productId),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process exchange');
      }

      setMessage('Exchange processed successfully. New order created.');
      setSelectedSale(null);
      setReturnItems({});
      setReplacementItems([]);
      setNewTotal(0);
      await loadSales();
    } catch (err: any) {
      setMessage(err.message || 'Failed to process exchange');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Returns & Exchanges</h1>
        <p className="mt-2 text-gray-600">
          Process returns and exchanges. New total must be equal to or greater than original total.
        </p>
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
          className={`p-3 rounded ${
            message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
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
                setReturnItems({});
                setReplacementItems([]);
                setNewTotal(Number(sale.total));
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
                <p className="text-sm font-medium text-gray-700 mt-1">
                  Original Total: Rs. {Number(selectedSale.total).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSale(null);
                  setReturnItems({});
                  setReplacementItems([]);
                  setNewTotal(0);
                }}
                className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
              >
                Back
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <h3 className="font-semibold">Return Items</h3>
              {selectedSale.items.map((item) => {
                const maxReturn = item.quantity - (item.returnedQuantity || 0);
                const returnQty = returnItems[item.id] || 0;
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
                          Qty: {item.quantity} • Returned: {item.returnedQuantity || 0} • Max
                          return: {maxReturn}
                        </div>
                      </div>
                      <div className="text-right">
                        <div>Rs. {Number(item.price).toFixed(2)}</div>
                      </div>
                    </div>
                    {maxReturn > 0 && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700">Return Qty:</label>
                        <input
                          type="number"
                          min="0"
                          max={maxReturn}
                          value={returnQty}
                          onChange={(e) =>
                            handleReturnChange(item.id, maxReturn, e.target.value)
                          }
                          className="w-20 border rounded px-2 py-1 text-sm"
                        />
                        {returnQty > 0 && (
                          <span className="text-sm text-red-600">
                            Return Value: Rs. {(Number(item.price) * returnQty).toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                    {maxReturn === 0 && (
                      <p className="text-xs text-gray-500">All items already returned</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Replacement Items</h3>
                <button
                  onClick={addReplacementItem}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                >
                  + Add Item
                </button>
              </div>
              {replacementItems.map((repl, idx) => (
                <div key={idx} className="border rounded p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">Product</label>
                      <select
                        value={repl.productId}
                        onChange={(e) => updateReplacementItem(idx, 'productId', e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                      >
                        <option value="">Select product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Rs. {Number(p.price).toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={repl.quantity}
                        onChange={(e) =>
                          updateReplacementItem(idx, 'quantity', Number(e.target.value))
                        }
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                  {repl.productId && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Discount Type</label>
                        <select
                          value={repl.discountType}
                          onChange={(e) =>
                            updateReplacementItem(idx, 'discountType', e.target.value)
                          }
                          className="w-full border rounded px-2 py-1 text-sm"
                        >
                          <option value="AMOUNT">Amount</option>
                          <option value="PERCENT">Percent</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Discount Value</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={repl.discountValue}
                          onChange={(e) =>
                            updateReplacementItem(idx, 'discountValue', Number(e.target.value))
                          }
                          className="w-full border rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => removeReplacementItem(idx)}
                          className="w-full px-2 py-1 border rounded text-sm text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">Returned Value:</span>
                <span className="font-semibold text-red-700">
                  Rs.{' '}
                  {(() => {
                    let totalReturned = 0;
                    for (const [saleItemId, returnQty] of Object.entries(returnItems)) {
                      if (returnQty > 0) {
                        const item = selectedSale.items.find((i) => i.id === saleItemId);
                        if (item) {
                          const unitTotal = Number(item.total) / item.quantity;
                          totalReturned += unitTotal * returnQty;
                        }
                      }
                    }
                    return totalReturned.toFixed(2);
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Replacement Total:</span>
                <span
                  className={`font-semibold text-lg ${
                    (() => {
                      let totalReturned = 0;
                      for (const [saleItemId, returnQty] of Object.entries(returnItems)) {
                        if (returnQty > 0) {
                          const item = selectedSale.items.find((i) => i.id === saleItemId);
                          if (item) {
                            const unitTotal = Number(item.total) / item.quantity;
                            totalReturned += unitTotal * returnQty;
                          }
                        }
                      }
                      return totalReturned === 0
                        ? newTotal >= Number(selectedSale.total)
                        : newTotal >= totalReturned;
                    })()
                      ? 'text-green-700'
                      : 'text-red-700'
                  }`}
                >
                  Rs. {newTotal.toFixed(2)}
                </span>
              </div>
              {(() => {
                let totalReturned = 0;
                for (const [saleItemId, returnQty] of Object.entries(returnItems)) {
                  if (returnQty > 0) {
                    const item = selectedSale.items.find((i) => i.id === saleItemId);
                    if (item) {
                      const unitTotal = Number(item.total) / item.quantity;
                      totalReturned += unitTotal * returnQty;
                    }
                  }
                }
                if (totalReturned > 0 && newTotal < totalReturned) {
                  return (
                    <p className="text-xs text-red-600 mt-1">
                      Replacement total must be equal to or greater than returned value (Rs.{' '}
                      {totalReturned.toFixed(2)})
                    </p>
                  );
                }
                if (totalReturned === 0 && newTotal < Number(selectedSale.total)) {
                  return (
                    <p className="text-xs text-red-600 mt-1">
                      Replacement total must be equal to or greater than original total (Rs.{' '}
                      {Number(selectedSale.total).toFixed(2)})
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={loading || (() => {
                  let totalReturned = 0;
                  for (const [saleItemId, returnQty] of Object.entries(returnItems)) {
                    if (returnQty > 0) {
                      const item = selectedSale.items.find((i) => i.id === saleItemId);
                      if (item) {
                        const unitTotal = Number(item.total) / item.quantity;
                        totalReturned += unitTotal * returnQty;
                      }
                    }
                  }
                  return totalReturned > 0
                    ? newTotal < totalReturned
                    : replacementItems.length > 0 && newTotal < Number(selectedSale.total);
                })()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Process Exchange'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

