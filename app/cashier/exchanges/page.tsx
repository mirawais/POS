'use client';

import { useEffect, useState, useMemo } from 'react';
import { WifiOff } from 'lucide-react';

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

  const totalReturned = useMemo(() => {
    let total = 0;
    if (!selectedSale) return 0;
    for (const [saleItemId, returnQty] of Object.entries(returnItems)) {
      if (returnQty > 0) {
        const item = selectedSale.items.find((i: any) => i.id === saleItemId);
        if (item) {
          const itemWithFields = item as any;
          const lineNet = Number(item.total) - Number(itemWithFields.discount || 0) + Number(itemWithFields.tax || 0);
          const unitTotal = lineNet / item.quantity;
          total += unitTotal * returnQty;
        }
      }
    }
    return total;
  }, [returnItems, selectedSale]);

  const differenceValue = useMemo(() => {
    if (!selectedSale) return 0;
    // Difference is Replacement Total - Returned Value
    // If positive, customer pays. If negative, it's credit/adjusted.
    return newTotal - totalReturned;
  }, [newTotal, totalReturned, selectedSale]);

  // Printing State
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [fbrLoading, setFbrLoading] = useState(false);
  const [fbrInvoiceId, setFbrInvoiceId] = useState<string | null>(null);
  const { showError, showSuccess } = { showError: setMessage, showSuccess: setMessage }; // Simple adapter for now, or import useToast if available
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

  // Rule of Hooks: Move conditional check inside JSX return

  const [lastExchangeInfo, setLastExchangeInfo] = useState<{
    newSaleId: string;
    originalOrderId: string;
    returnedItems: any[];
    returnedValue: number;
    difference: number;
  } | null>(null);

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
    } catch (err) {
      console.error('Failed to load products', err);
    }
  };

  const calculateNewTotal = async () => {
    if (!selectedSale) return;

    let returnValue = 0;
    for (const [saleItemId, returnQty] of Object.entries(returnItems)) {
      if (returnQty > 0) {
        const item = selectedSale.items.find((i) => i.id === saleItemId);
        if (item) {
          const itemWithFields = item as any;
          const lineNet = Number(item.total) - Number(itemWithFields.discount || 0) + Number(itemWithFields.tax || 0);
          const unitTotal = lineNet / item.quantity;
          returnValue += unitTotal * returnQty;
        }
      }
    }

    let replacementSubtotal = 0;
    let replacementDiscount = 0;
    for (const repl of replacementItems) {
      if (repl.productId) {
        const product = products.find((p) => p.id === repl.productId);
        if (product) {
          const price = repl.variantId
            ? product.variants?.find((v) => v.id === repl.variantId)?.price || product.price
            : product.price;
          const itemTotal = price * repl.quantity;
          replacementSubtotal += itemTotal;

          if (repl.discountType === 'PERCENT') {
            replacementDiscount += (itemTotal * repl.discountValue) / 100;
          } else {
            replacementDiscount += repl.discountValue;
          }
        }
      }
    }

    const netReplacement = Math.max(0, replacementSubtotal - replacementDiscount);
    setNewTotal(netReplacement);
  };

  const handleReturnChange = (saleItemId: string, maxQty: number, value: string) => {
    const qty = Math.max(0, Math.min(maxQty, Number(value) || 0));
    setReturnItems((prev) => ({ ...prev, [saleItemId]: qty }));
  };

  const addReplacementItem = () => {
    setReplacementItems((prev) => [
      ...prev,
      { productId: '', quantity: 1, discountType: 'AMOUNT', discountValue: 0 },
    ]);
  };

  const removeReplacementItem = (index: number) => {
    setReplacementItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateReplacementItem = (index: number, field: string, value: any) => {
    setReplacementItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const printInvoice = async () => {
    if (!selectedSale) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/sales/${selectedSale.id}/print`);
      if (!res.ok) throw new Error('Failed to get print data');
      const data = await res.json();
      let html = data.html;

      // Inject exchange details if this invoice is the newly created replacement sale
      if (lastExchangeInfo && selectedSale.id === lastExchangeInfo.newSaleId) {
        const exchangeHtml = `
          <div style="margin-top: 15px; padding: 10px; border: 1px dashed #444; font-size: 11px; font-family: sans-serif; background-color: #f9f9f9;">
            <div style="font-weight: bold; margin-bottom: 5px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 3px;">Exchange Adjustment</div>
            <div style="margin-bottom: 3px;"><strong>Prev Order Ref:</strong> ${lastExchangeInfo.originalOrderId}</div>
            <div style="margin-top: 5px; font-weight: bold;">Returned Items:</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 3px;">
              ${lastExchangeInfo.returnedItems.map(item => `
                <tr>
                  <td style="padding: 2px 0;">${item.name}${item.variantName ? ` (${item.variantName})` : ''} x ${item.quantity}</td>
                  <td style="text-align: right; padding: 2px 0;">Rs. ${item.value.toFixed(2)}</td>
                </tr>
              `).join('')}
            </table>
            <div style="margin-top: 8px; border-top: 1px solid #ccc; padding-top: 5px; display: flex; justify-content: space-between;">
              <span><strong>Amount Adjusted:</strong></span>
              <span><strong>Rs. ${lastExchangeInfo.returnedValue.toFixed(2)}</strong></span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span><strong>Total Replacement:</strong></span>
              <span>Rs. ${Number(selectedSale.total).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 13px; border-top: 1px solid #444; padding-top: 4px;">
              <span><strong>${lastExchangeInfo.difference >= 0 ? 'PAYABLE' : 'ADJUSTED NET'}:</strong></span>
              <span><strong>Rs. ${Math.abs(lastExchangeInfo.difference).toFixed(2)}</strong></span>
            </div>
          </div>
        `;
        html = html.replace('</body>', `${exchangeHtml}</body>`);
      }

      const win = window.open('', '_blank', 'height=600,width=400');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to print');
    } finally {
      setLoading(false);
    }
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

      const data = await res.json();
      const newSale = data.newSale;
      const originalSaleData = data.originalSale;

      // Extract returned items info for the invoice
      const returnedItemsDetails = returns.map(r => {
        const originalItem = originalSaleData.items.find((i: any) => i.id === r.saleItemId);
        const itemLineNet = Number(originalItem.total) - Number(originalItem.discount || 0) + Number(originalItem.tax || 0);
        const unitTotal = itemLineNet / originalItem.quantity;
        return {
          name: originalItem.product.name,
          variantName: originalItem.variant?.name,
          quantity: r.returnQuantity,
          value: unitTotal * r.returnQuantity
        };
      });

      setLastExchangeInfo({
        newSaleId: newSale.id,
        originalOrderId: originalSaleData.orderId,
        returnedItems: returnedItemsDetails,
        returnedValue: totalReturned,
        difference: differenceValue
      });

      setMessage(`Exchange processed successfully. New Order ID: ${newSale.orderId}`);
      setReturnItems({});
      setReplacementItems([]);
      setNewTotal(0);
      setSelectedSale(newSale);
      await loadSales();
    } catch (err: any) {
      setMessage(err.message || 'Failed to process exchange');
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
            Return and Exchange processing requires an active internet connection to validate sales data and prevent errors.
          </p>
        </div>
      ) : (
        <>
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
              className={`p-3 rounded ${message.includes('successfully') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
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
                  <div className="flex gap-2">
                    <button
                      onClick={printInvoice}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Print
                    </button>
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
                                Return Value: Rs. {
                                  (() => {
                                    const _item = item as any;
                                    const lineNet = Number(_item.total) - Number(_item.discount || 0) + Number(_item.tax || 0);
                                    const unitTotal = lineNet / _item.quantity;
                                    return (unitTotal * returnQty).toFixed(2);
                                  })()
                                }
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
                            onChange={(e) => {
                              updateReplacementItem(idx, 'productId', e.target.value);
                              updateReplacementItem(idx, 'variantId', null);
                            }}
                            className="w-full border rounded px-2 py-1 text-sm"
                          >
                            <option value="">Select product...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Rs. {Number(p.price).toFixed(2)})
                              </option>
                            ))}
                          </select>
                          {repl.productId && (() => {
                            const prod = products.find(p => p.id === repl.productId);
                            if (prod && prod.variants && prod.variants.length > 0) {
                              return (
                                <div className="mt-2">
                                  <label className="block text-xs text-gray-700 mb-1">Variant</label>
                                  <select
                                    value={repl.variantId || ''}
                                    onChange={(e) => updateReplacementItem(idx, 'variantId', e.target.value)}
                                    className="w-full border rounded px-2 py-1 text-sm bg-gray-50"
                                  >
                                    <option value="">Select variant...</option>
                                    {prod.variants.map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {v.name} {v.attributes ? `(${Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ')})` : ''} - Rs. {Number(v.price).toFixed(2)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              );
                            }
                            return null;
                          })()}
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
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Original Paid Amount:</span>
                    <span className="font-medium text-gray-900">Rs. {Number(selectedSale.total).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Returned Value:</span>
                    <span className="font-medium text-red-600">Rs. {totalReturned.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Replacement Total:</span>
                    <span className="font-medium text-blue-600">Rs. {newTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="font-semibold text-gray-700">Final Difference:</span>
                    <span
                      className={`font-bold text-lg ${differenceValue >= 0 ? 'text-green-700' : 'text-amber-700'
                        }`}
                    >
                      {differenceValue >= 0 ? 'Payable: ' : 'Adjusted: '} Rs. {Math.abs(differenceValue).toFixed(2)}
                    </span>
                  </div>
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
                        : (replacementItems.length > 0 && newTotal < Number(selectedSale.total)) || (replacementItems.length === 0 && Object.entries(returnItems).every(([_, q]) => q === 0));
                    })()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Processing...' : 'Process Exchange'}
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
