'use client';

import { useEffect, useState } from 'react';

type SaleItem = {
  id: string;
  product: { id: string; name: string; sku: string };
  variant?: { id: string; name: string; sku: string; attributes: any } | null;
  quantity: number;
  returnedQuantity: number;
  price: number;
  discount: number;
  tax: number;
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
  couponCode?: string | null;
  couponValue?: number | null;
  paymentMethod?: string | null;
  fbrInvoiceId?: string | null;
};

export default function CashierOrdersPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [orderIdFilter, setOrderIdFilter] = useState('');

  useEffect(() => {
    loadSales();
  }, [orderIdFilter]);

  const loadSales = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (orderIdFilter) params.append('orderId', orderIdFilter);
      const res = await fetch(`/api/sales?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load sales');
      const data = await res.json();
      setSales(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  const printOrder = async (sale: Sale) => {
    const setting = await fetch('/api/invoice-settings')
      .then((r) => r.json())
      .catch(() => ({}));

    const logo = setting?.logoUrl
      ? `<img src="${setting.logoUrl}" style="max-width:150px;" />`
      : '';
    const header = setting?.headerText ? `<div>${setting.headerText}</div>` : '';
    const footer = setting?.footerText ? `<div>${setting.footerText}</div>` : '';

    const itemsHtml = sale.items
      .map((item) => {
        const netQty = item.quantity - (item.returnedQuantity || 0);
        // Item total = Quantity × Unit Price only (no tax)
        const itemTotal = Number(item.price) * item.quantity;
        return `<tr>
          <td>${item.product.name}${item.variant ? ` (${item.variant.name})` : ''}</td>
          <td>${item.quantity}${item.returnedQuantity > 0 ? ` (Returned: ${item.returnedQuantity})` : ''}</td>
          <td>Rs. ${Number(item.price).toFixed(2)}</td>
          <td>Rs. ${itemTotal.toFixed(2)}</td>
        </tr>`;
      })
      .join('');

    const html = `
      <html>
        <head>
          <title>Order ${sale.orderId}</title>
          <style>
            body { font-family: sans-serif; margin: 0; padding: 10px; }
            .invoice-header, .invoice-footer { text-align: center; margin-bottom: 10px; }
            .invoice-details { font-size: 12px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #eee; padding: 5px; text-align: left; }
            .totals { margin-top: 10px; font-size: 12px; text-align: right; }
            .totals div { display: flex; justify-content: space-between; }
            .totals strong { font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            ${logo}
            ${header}
          </div>
          <div class="invoice-details">
            Order ID: ${sale.orderId}<br/>
            ${sale.fbrInvoiceId ? `FBR Invoice ID: ${sale.fbrInvoiceId}<br/>` : ''}
            Date: ${new Date(sale.createdAt).toLocaleString()}<br/>
            ${setting?.showCashier !== false ? `Cashier: ${sale.cashier?.name || sale.cashier?.email || 'Unknown'}<br/>` : ''}
            Payment Method: ${sale.paymentMethod === 'CARD' ? 'Card' : 'Cash'}<br/>
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
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="totals">
            <div><span>Subtotal:</span><span>Rs. ${Number(sale.subtotal).toFixed(2)}</span></div>
            ${setting?.showDiscount !== false && Number(sale.discount) > 0 ? `<div><span>Discount:</span><span>-Rs. ${Number(sale.discount).toFixed(2)}</span></div>` : ''}
            ${setting?.showTax !== false && Number(sale.tax) > 0 ? `<div><span>Tax:</span><span>Rs. ${Number(sale.tax).toFixed(2)}</span></div>` : ''}
            <div><strong><span>Total:</span><span>Rs. ${Number(sale.total).toFixed(2)}</span></strong></div>
          </div>
          <div class="invoice-footer">
            ${footer}
          </div>
        </body>
      </html>
    `;

    const win = window.open('', 'PRINT', 'height=650,width=400');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="mt-2 text-gray-600">View order details and history.</p>
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

      {error && <div className="p-3 rounded bg-red-50 text-red-700">{error}</div>}

      {loading && <p className="text-gray-600">Loading orders...</p>}

      {!loading && !error && !selectedSale && (
        <div className="space-y-3">
          {sales.map((sale) => (
            <div
              key={sale.id}
              className="p-4 border rounded bg-white cursor-pointer hover:bg-gray-50"
              onClick={() => setSelectedSale(sale)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">Order: {sale.orderId}</div>
                  <div className="text-sm text-gray-600">
                    {new Date(sale.createdAt).toLocaleString()} • {sale.items.length} item(s)
                  </div>
                  <div className="text-sm text-gray-600">
                    Cashier: {sale.cashier?.name || sale.cashier?.email || 'Unknown'}
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
                  Date: {new Date(selectedSale.createdAt).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">
                  Cashier: {selectedSale.cashier?.name || selectedSale.cashier?.email || 'Unknown'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => printOrder(selectedSale)}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                >
                  Print
                </button>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                >
                  Back
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <h3 className="font-semibold">Items</h3>
              {selectedSale.items.map((item) => {
                const netQty = item.quantity - (item.returnedQuantity || 0);
                return (
                  <div key={item.id} className="border rounded p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">
                          {item.product.name}
                          {item.variant && (
                            <span className="text-gray-600"> ({item.variant.name})</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          SKU: {item.product.sku || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Quantity: {item.quantity}
                          {item.returnedQuantity > 0 && (
                            <span className="text-red-600">
                              {' '}
                              (Returned: {item.returnedQuantity})
                            </span>
                          )}
                          {netQty !== item.quantity && (
                            <span className="text-blue-600"> • Net: {netQty}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Unit Price: Rs. {Number(item.price).toFixed(2)}
                          {item.discount > 0 && (
                            <span className="text-green-600">
                              {' '}
                              • Discount: Rs. {Number(item.discount).toFixed(2)}
                            </span>
                          )}
                          {item.tax > 0 && (
                            <span className="text-blue-600">
                              {' '}
                              • Tax: Rs. {Number(item.tax).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">Rs. {Number(item.total).toFixed(2)}</div>
                        {item.returnedQuantity > 0 && (
                          <div className="text-xs text-red-600">
                            -Rs. {(Number(item.price) * item.returnedQuantity).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-700">Subtotal:</span>
                <span className="font-medium">Rs. {Number(selectedSale.subtotal).toFixed(2)}</span>
              </div>
              {Number(selectedSale.discount) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount:</span>
                  <span>-Rs. {Number(selectedSale.discount).toFixed(2)}</span>
                </div>
              )}
              {selectedSale.couponCode && (
                <div className="flex justify-between text-amber-700">
                  <span>Coupon ({selectedSale.couponCode}):</span>
                  <span>-Rs. {Number(selectedSale.couponValue || 0).toFixed(2)}</span>
                </div>
              )}
              {Number(selectedSale.tax) > 0 && (
                <div className="flex justify-between text-blue-700">
                  <span>Tax:</span>
                  <span>Rs. {Number(selectedSale.tax).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                <span>Total:</span>
                <span>Rs. {Number(selectedSale.total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
