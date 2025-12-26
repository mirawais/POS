'use client';

import { useEffect, useState } from 'react';
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

  if (!isOnline) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded border h-64 text-center">
        <WifiOff size={48} className="text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">Feature Unavailable Offline</h2>
        <p className="text-gray-500 mt-2 max-w-sm">
          Return and Exchange processing requires an active internet connection to validate sales data and prevent errors.
        </p>
      </div>
    );
  }


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
          // Calculate effective paid price per unit: (LineTotal - LineDiscount + LineTax) / Qty
          // Based on debug data, item.total is Gross (before discount), so we must subtract discount.
          const itemWithFields = item as any; // Type assertion for discount/tax fields
          const lineNet = Number(item.total) - Number(itemWithFields.discount || 0) + Number(itemWithFields.tax || 0);
          const unitTotal = lineNet / item.quantity;
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

  // Modified printInvoice to use selectedSale if available, or invoiceData
  const printInvoice = async () => {
    const saleToPrint = selectedSale || invoiceData?.sale;
    const itemsToPrint = selectedSale?.items || invoiceData?.items || invoiceData?.sale?.items;

    if (!saleToPrint) {
      showError('No data to print');
      return;
    }

    // Fetch settings if not already cached/fetched (simplified)
    const setting = await fetch('/api/invoice-settings').then((r) => r.json()).catch(() => ({}));

    const win = window.open('', `PRINT_${Date.now()}`, 'height=650,width=400');
    if (!win) return;

    const logo = setting?.logoUrl ? `<img src="${setting.logoUrl}" style="max-width:150px;" />` : '';
    const header = setting?.headerText ? `<div>${setting.headerText}</div>` : '';
    const footer = setting?.footerText ? `<div>${setting.footerText}</div>` : '';

    const itemsHtml =
      itemsToPrint
        ?.map(
          (i: any) => {
            const itemTotal = Number(i.total);
            return `<tr><td>${i.product?.name || 'Unknown'}${i.variant ? ` (${i.variant.name})` : ''}</td><td>${i.quantity}</td><td>Rs. ${Number(i.price).toFixed(2)}</td><td>Rs. ${itemTotal.toFixed(2)}</td></tr>`;
          }
        )
        .join('') || '';

    const html = `
      <html>
        <head>
          <title>Invoice ${saleToPrint.orderId || 'N/A'}</title>
        </head>
        <body>
          <div style="text-align:center;">
            ${logo}
            ${header}
          </div>
          <div style="margin-top:8px;font-size:12px;">
            Order ID: ${saleToPrint.orderId || 'N/A'}<br/>
            Date: ${new Date(saleToPrint.createdAt).toLocaleString()}<br/>
            ${setting?.showCashier !== false ? `Cashier: ${saleToPrint.cashier?.name || saleToPrint.cashier?.email || 'Unknown'}<br/>` : ''}
            Type: ${saleToPrint.type || 'SALE'}<br/>
          </div>
          <table style="width:100%;font-size:12px;margin-top:8px;">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div style="margin-top:8px;font-size:12px;">
             <strong>Total: Rs. ${Number(saleToPrint.total).toFixed(2)}</strong>
          </div>
          <div style="text-align:center;margin-top:12px;font-size:12px;">${footer}</div>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    setTimeout(() => {
      try { win.close(); } catch (e) { }
    }, 1000);
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
        const item = selectedSale.items.find((i: any) => i.id === saleItemId);
        if (item) {
          // Calculate effective paid price per unit: (LineTotal - LineDiscount + LineTax) / Qty
          // Use 'any' cast to avoid TS errors if types are not fully defined in frontend
          const itemWithFields = item as any;
          const lineNet = Number(item.total) - Number(itemWithFields.discount || 0) + Number(itemWithFields.tax || 0);
          const unitTotal = lineNet / item.quantity;
          totalReturnedValue += unitTotal * returnQty;
        }
      }
    }

    // Validate: Replacement total must be >= Returned value (no cash refund)
    // This ensures replacement items cover the value of returned items
    if (totalReturnedValue > 0 && newTotal < totalReturnedValue) {
      setMessage(
        `Exchange not allowed: Replacement total (Rs. ${newTotal.toFixed(2)}) must be equal to or greater than actual paid value of returned items (Rs. ${totalReturnedValue.toFixed(2)}). Please add more items.`
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

      const data = await res.json();
      const newSale = data.newSale;

      setMessage(`Exchange processed successfully. New Order ID: ${newSale.orderId}`);

      // Select the new sale to show details and allow printing
      setReturnItems({});
      setReplacementItems([]);
      setNewTotal(0);
      setSelectedSale(newSale); // Switch view to new sale

      await loadSales(); // Refresh list
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
                                // Calculate effective paid price per unit: (LineTotal - LineDiscount + LineTax) / Qty
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
                          updateReplacementItem(idx, 'variantId', null); // Reset variant on product change
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
              <div className="flex justify-between items-center">
                <span className="font-medium">Returned Value:</span>
                <span className="font-semibold text-red-700">
                  Rs.{' '}
                  {(() => {
                    let totalReturned = 0;
                    for (const [saleItemId, returnQty] of Object.entries(returnItems)) {
                      if (returnQty > 0) {
                        const item = selectedSale.items.find((i: any) => i.id === saleItemId);
                        if (item) {
                          // Calculate effective paid price per unit: (LineTotal - LineDiscount + LineTax) / Qty
                          const itemWithFields = item as any;
                          const lineNet = Number(item.total) - Number(itemWithFields.discount || 0) + Number(itemWithFields.tax || 0);
                          const unitTotal = lineNet / item.quantity;
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
                  className={`font-semibold text-lg ${(() => {
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

