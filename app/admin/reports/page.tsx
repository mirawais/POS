'use client';

import { useEffect, useState } from 'react';
import { AdminHeader } from '@/components/layout/AdminHeader';

export default function ReportsPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orderIdFilter, setOrderIdFilter] = useState('');
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('last7days');
  const [summary, setSummary] = useState<{ totalSales: number; totalTax: number; totalDiscount: number; cashSales: number; cardSales: number; totalRefundAmount: number } | null>(null);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [selectedCashier, setSelectedCashier] = useState<string>('');
  const [viewMode, setViewMode] = useState<'sales' | 'products' | 'customers'>('sales');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isCashierDropdownOpen, setIsCashierDropdownOpen] = useState(false);

  const handleViewModeChange = (mode: 'sales' | 'products' | 'customers') => {
    setViewMode(mode);
    setOrderIdFilter('');
  };

  const applyDateFilter = (filter: string) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    switch (filter) {
      case 'today':
        setStartDate(today.toISOString().split('T')[0]);
        setEndDate(today.toISOString().split('T')[0]);
        break;
      case 'yesterday':
        start.setDate(start.getDate() - 1);
        const yesterday = new Date(start);
        yesterday.setHours(23, 59, 59, 999);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(yesterday.toISOString().split('T')[0]);
        break;
      case 'last7days':
        start.setDate(start.getDate() - 7);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(today.toISOString().split('T')[0]);
        break;
      case 'lastmonth':
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        const lastMonthEnd = new Date();
        lastMonthEnd.setDate(0);
        lastMonthEnd.setHours(23, 59, 59, 999);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(lastMonthEnd.toISOString().split('T')[0]);
        break;
      case 'custom':
        // Keep current dates, user can modify
        break;
      default:
        break;
    }
  };

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (orderIdFilter && viewMode === 'sales') params.append('orderId', orderIdFilter);
      if (selectedCashier) params.append('cashierId', selectedCashier);

      const response = await fetch(`/api/sales?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sales data');
      }
      const data = await response.json();
      setSales(data);

      // Calculate summary
      const totalSales = data.reduce((sum: number, sale: any) => sum + Number(sale.total), 0);
      const totalTax = data.reduce((sum: number, sale: any) => sum + Number(sale.tax), 0);
      const totalDiscount = data.reduce((sum: number, sale: any) => sum + Number(sale.discount || 0), 0);
      const cashSales = data.filter((sale: any) => sale.paymentMethod === 'CASH' || !sale.paymentMethod).reduce((sum: number, sale: any) => sum + Number(sale.total), 0);
      const cardSales = data.filter((sale: any) => sale.paymentMethod === 'CARD').reduce((sum: number, sale: any) => sum + Number(sale.total), 0);

      const totalRefundAmount = data.reduce((sum: number, sale: any) => {
        const refundTotal = sale.refunds?.reduce((rSum: number, r: any) => rSum + Number(r.total), 0) || 0;
        return sum + refundTotal;
      }, 0);

      setSummary({ totalSales, totalTax, totalDiscount, cashSales, cardSales, totalRefundAmount });
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateFilter !== 'custom') {
      applyDateFilter(dateFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, orderIdFilter, selectedCashier, viewMode]);

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCashiers(data.filter((u: any) => u.role === 'CASHIER'));
        }
      })
      .catch(err => console.error('Failed to fetch users', err));
  }, []);

  const printOrder = async (sale: any) => {
    const setting = await fetch('/api/invoice-settings')
      .then((r) => r.json())
      .catch(() => ({}));

    const logo = setting?.logoUrl
      ? `<img src="${setting.logoUrl}" style="max-width:150px;" />`
      : '';
    const header = setting?.headerText ? `<div>${setting.headerText}</div>` : '';
    const footer = setting?.footerText ? `<div>${setting.footerText}</div>` : '';

    const itemsHtml = (sale.items || [])
      .map((item: any) => {
        const netQty = item.quantity - (item.returnedQuantity || 0);
        // Item total = Quantity × Unit Price only (no tax)
        const itemTotal = Number(item.price) * item.quantity;
        return `<tr>
          <td>${item.product?.name || 'Unknown'}${item.variant ? ` (${item.variant.name})` : ''}</td>
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
            ${sale.type && sale.type !== 'SALE' ? `Type: ${sale.type}<br/>` : ''}
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

  const exportToCSV = () => {
    const headers = ['Order ID', 'Type', 'Date', 'Cashier', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total'];
    const rows = sales.map((sale) => [
      sale.orderId || sale.id,
      sale.type || 'SALE',
      new Date(sale.createdAt).toLocaleString(),
      sale.cashier?.name || sale.cashier?.email || sale.cashierId,
      sale.items?.length || 0,
      Number(sale.subtotal).toFixed(2),
      Number(sale.discount).toFixed(2),
      Number(sale.tax).toFixed(2),
      Number(sale.total).toFixed(2),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const today = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);
  const defaultStartDateStr = defaultStartDate.toISOString().split('T')[0];



  const productStats = useState(() => {
    // Calculate product stats whenever sales change
    if (!sales.length) return [];

    const stats = new Map<string, {
      id: string;
      name: string;
      sku: string;
      variantName: string | null;
      quantity: number;
      total: number;
      returned: number;
    }>();

    sales.forEach(sale => {
      sale.items.forEach((item: any) => {
        const key = `${item.productId}:${item.variantId || 'base'}`;
        const existing = stats.get(key);

        // Calculate net contribution of this item (Sales - Returns)
        // Note: item.total is the final line total. If returned, we should subtract proportional value?
        // Usually item.total is for the sale line. Returns are tracked separately in `returnedQuantity` but 
        // `item.total` remains the sale value. 
        // We should explicitly calculate "Revenue" as (Quantity - Returned) * Price approx, or 
        // just use item.total. However, if return happens, revenue decreases.
        // Let's assume item.total is the sale amount. If we want "Net Sales", we might need to deduct returns.
        // For simplicity and consistency with `Total Sales` summary which sums `sale.total`, we might just sum `item.total`.
        // BUT strict accounting says Net Sales = Gross - Returns.
        // The return logic in `app/api/sales` is complex (creates Refund record?).
        // Checking schema: `RefundItem` links to `SaleItem`. 
        // The `sales` fetch includes `items`. It doesn't seemingly include `refundItems` deeply nested in the current `fetchSales` (it includes `items.product`, `items.variant`).
        // IMPORTANT: `item.returnedQuantity` is available on `SaleItem`.
        // Let's just aggregate `quantity` and `item.total`.

        const qty = item.quantity || 0;
        const returned = item.returnedQuantity || 0;
        const amount = Number(item.total) || 0;

        if (existing) {
          existing.quantity += qty;
          existing.returned += returned;
          existing.total += amount;
          stats.set(key, existing);
        } else {
          stats.set(key, {
            id: item.productId,
            name: item.product?.name || 'Unknown',
            sku: item.product?.sku || '-',
            variantName: item.variant?.name || null,
            quantity: qty,
            returned: returned,
            total: amount
          });
        }
      });
    });

    return Array.from(stats.values()).sort((a, b) => b.total - a.total);
  });

  // Re-calculate when sales change requires a simplified useMemo pattern or Effect, 
  // but since we are inside a functional comp, let's just use a plain variable with useMemo
  // correcting the syntax above.

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Reports" />
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Sales Reports</h1>
            <p className="mt-2 text-gray-600">View and export sales history with filters.</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto bg-white border rounded p-1">
            <button
              onClick={() => handleViewModeChange('sales')}
              className={`flex-1 md:flex-none px-4 py-2 rounded text-sm font-medium whitespace-nowrap ${viewMode === 'sales' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Sales List
            </button>
            <button
              onClick={() => handleViewModeChange('products')}
              className={`flex-1 md:flex-none px-4 py-2 rounded text-sm font-medium whitespace-nowrap ${viewMode === 'products' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Product Report
            </button>

            <button
              onClick={() => handleViewModeChange('customers')}
              className={`flex-1 md:flex-none px-4 py-2 rounded text-sm font-medium whitespace-nowrap ${viewMode === 'customers' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Customers
            </button>
          </div>
        </div>

        {/* Summary Section */}
        <div className="p-4 border rounded bg-white">
          <h2 className="text-lg font-semibold mb-4">Sales Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Date Filter</label>
              <div className="relative">
                <button
                  onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-left flex justify-between items-center"
                >
                  <span className="block truncate">
                    {{
                      'today': 'Today',
                      'yesterday': 'Yesterday',
                      'last7days': 'Last 7 Days',
                      'lastmonth': 'Last Month',
                      'custom': 'Custom Date Range'
                    }[dateFilter] || dateFilter}
                  </span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isDateDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDateDropdownOpen(false)}></div>
                    <div className="absolute top-full left-0 w-full z-20 bg-white border rounded shadow-lg mt-1 max-h-60 overflow-y-auto">
                      {[
                        { val: 'today', label: 'Today' },
                        { val: 'yesterday', label: 'Yesterday' },
                        { val: 'last7days', label: 'Last 7 Days' },
                        { val: 'lastmonth', label: 'Last Month' },
                        { val: 'custom', label: 'Custom Date Range' }
                      ].map((opt) => (
                        <div
                          key={opt.val}
                          className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            setDateFilter(opt.val);
                            if (opt.val === 'custom') {
                              setStartDate(defaultStartDateStr);
                              setEndDate(today);
                            }
                            setIsDateDropdownOpen(false);
                          }}
                        >
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Cashier</label>
              <div className="relative">
                <button
                  onClick={() => setIsCashierDropdownOpen(!isCashierDropdownOpen)}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-left flex justify-between items-center"
                >
                  <span className="block truncate">
                    {selectedCashier ? (cashiers.find(c => c.id === selectedCashier)?.name || 'Unknown') : 'All Cashiers'}
                  </span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isCashierDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsCashierDropdownOpen(false)}></div>
                    <div className="absolute top-full left-0 w-full z-20 bg-white border rounded shadow-lg mt-1 max-h-60 overflow-y-auto">
                      <div
                        className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setSelectedCashier('');
                          setIsCashierDropdownOpen(false);
                        }}
                      >
                        All Cashiers
                      </div>
                      {cashiers.map((c) => (
                        <div
                          key={c.id}
                          className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            setSelectedCashier(c.id);
                            setIsCashierDropdownOpen(false);
                          }}
                        >
                          {c.name || c.email}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            {dateFilter === 'custom' && (
              <>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate || defaultStartDateStr}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate || today}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}
          </div>
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-blue-50 rounded">
              <div>
                <div className="text-sm text-gray-600">Total Sales</div>
                <div className="text-2xl font-bold text-blue-700">
                  Rs. {summary.totalSales.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Tax</div>
                <div className="text-2xl font-bold text-green-700">
                  Rs. {summary.totalTax.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Discount</div>
                <div className="text-2xl font-bold text-red-700">
                  Rs. {summary.totalDiscount.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Cash Sales</div>
                <div className="text-2xl font-bold text-yellow-700">
                  Rs. {summary.cashSales.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Card Sales</div>
                <div className="text-2xl font-bold text-purple-700">
                  Rs. {summary.cardSales.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Refunded</div>
                <div className="text-2xl font-bold text-orange-700">
                  Rs. {summary.totalRefundAmount.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border rounded bg-white space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                {viewMode === 'customers' ? 'Search Customer (Name or Phone)' : viewMode === 'products' ? 'Search Product (Name or SKU)' : 'Search Order ID'}
              </label>
              <input
                type="text"
                value={orderIdFilter}
                onChange={(e) => setOrderIdFilter(e.target.value)}
                placeholder={viewMode === 'customers' ? "Search Customer Name/Phone..." : viewMode === 'products' ? "Search Product Name/SKU..." : "Search order ID..."}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={exportToCSV}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                disabled={loading || sales.length === 0}
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {loading && <p className="text-gray-600">Loading sales data...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && sales.length === 0 && (
          <p className="text-gray-600">No sales data available for the selected filters.</p>
        )}

        {!loading && !error && sales.length > 0 && viewMode === 'products' && (
          <div className="border rounded bg-white overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-900">Product</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">SKU</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 text-right">Sold Qty</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 text-right">Returned</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 text-right">Net Qty</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(() => {
                    const stats = new Map<string, any>();
                    sales.forEach((sale: any) => {
                      (sale.items || []).forEach((item: any) => {
                        const key = `${item.productId}:${item.variantId || 'base'}`;
                        const existing = stats.get(key);
                        const qty = item.quantity || 0;
                        const returned = item.returnedQuantity || 0;
                        const amount = Number(item.total) || 0;

                        if (existing) {
                          existing.quantity += qty;
                          existing.returned += returned;
                          existing.total += amount;
                          stats.set(key, existing);
                        } else {
                          stats.set(key, {
                            id: item.productId,
                            name: item.product?.name || 'Unknown',
                            sku: item.product?.sku || '-',
                            variantName: item.variant?.name || null,
                            quantity: qty,
                            returned: returned,
                            total: amount
                          });
                        }
                      });
                    });
                    let list = Array.from(stats.values()).sort((a, b) => b.total - a.total);

                    if (orderIdFilter) {
                      const searchLower = orderIdFilter.toLowerCase();
                      list = list.filter(p =>
                        (p.name && p.name.toLowerCase().includes(searchLower)) ||
                        (p.sku && p.sku.toLowerCase().includes(searchLower))
                      );
                    }

                    return list.map((p: any) => (
                      <tr key={p.sku + p.variantName} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{p.name}</div>
                          {p.variantName && <div className="text-xs text-gray-500">{p.variantName}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{p.sku}</td>
                        <td className="px-4 py-3 text-right">{p.quantity}</td>
                        <td className="px-4 py-3 text-right text-red-600">{p.returned > 0 ? p.returned : '-'}</td>
                        <td className="px-4 py-3 text-right font-medium">{p.quantity - p.returned}</td>
                        <td className="px-4 py-3 text-right font-medium text-blue-700">Rs. {p.total.toFixed(2)}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y">
              {(() => {
                const stats = new Map<string, any>();
                sales.forEach((sale: any) => {
                  (sale.items || []).forEach((item: any) => {
                    const key = `${item.productId}:${item.variantId || 'base'}`;
                    const existing = stats.get(key);
                    const qty = item.quantity || 0;
                    const returned = item.returnedQuantity || 0;
                    const amount = Number(item.total) || 0;

                    if (existing) {
                      existing.quantity += qty;
                      existing.returned += returned;
                      existing.total += amount;
                      stats.set(key, existing);
                    } else {
                      stats.set(key, {
                        id: item.productId,
                        name: item.product?.name || 'Unknown',
                        sku: item.product?.sku || '-',
                        variantName: item.variant?.name || null,
                        quantity: qty,
                        returned: returned,
                        total: amount
                      });
                    }
                  });
                });
                let list = Array.from(stats.values()).sort((a, b) => b.total - a.total);

                if (orderIdFilter) {
                  const searchLower = orderIdFilter.toLowerCase();
                  list = list.filter(p =>
                    (p.name && p.name.toLowerCase().includes(searchLower)) ||
                    (p.sku && p.sku.toLowerCase().includes(searchLower))
                  );
                }

                return list.map((p: any) => (
                  <div key={p.sku + p.variantName} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        {p.variantName && <div className="text-xs text-gray-500">{p.variantName}</div>}
                        <div className="text-xs text-gray-400 mt-1">SKU: {p.sku}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-700">Rs. {p.total.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      <div className="text-center">
                        <div className="font-semibold text-gray-900">{p.quantity}</div>
                        <div>Sold</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-red-600">{p.returned}</div>
                        <div>Returned</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-green-700">{p.quantity - p.returned}</div>
                        <div>Net</div>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {!loading && !error && sales.length > 0 && viewMode === 'sales' && (
          <div className="space-y-4">
            {sales.map((sale) => (
              <div key={sale.id} className="border rounded bg-white">
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                    >
                      <div className="font-semibold text-lg flex items-center">
                        Order: {sale.orderId || sale.id}
                        {sale.type && sale.type !== 'SALE' && (
                          <span className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {sale.type}
                          </span>
                        )}
                        {/* Only show Refunded if it's a SALE (not Exchange/Refund type logic) */}
                        {(!sale.type || sale.type === 'SALE') && (sale.refunds?.length > 0 || sale.items?.some((i: any) => i.returnedQuantity > 0)) && (
                          <span className="ml-2 text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-medium border border-red-200">
                            Refunded
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {new Date(sale.createdAt).toLocaleString()} • Cashier:{' '}
                        {sale.cashier?.name || sale.cashier?.email || sale.cashierId}
                      </div>
                      <div className="text-sm text-gray-600">
                        {sale.items?.length || 0} item(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          printOrder(sale);
                        }}
                        className="mb-2 px-2 py-1 text-xs border rounded hover:bg-gray-50"
                      >
                        Print
                      </button>
                      <div className="font-semibold text-lg">Rs. {Number(sale.total).toFixed(2)}</div>
                      <div className="text-sm text-gray-600">
                        Subtotal: Rs. {Number(sale.subtotal).toFixed(2)}
                      </div>
                      {Number(sale.discount) > 0 && (
                        <div className="text-sm text-red-600">
                          Discount: -Rs. {Number(sale.discount).toFixed(2)}
                        </div>
                      )}
                      {Number(sale.tax) > 0 && (
                        <div className="text-sm text-gray-600">
                          Tax: Rs. {Number(sale.tax).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {expandedSale === sale.id && sale.items && sale.items.length > 0 && (
                  <div className="border-t p-4 bg-gray-50">
                    <div className="text-sm font-semibold mb-2">Items:</div>
                    <div className="space-y-2">
                      {sale.items.map((item: any) => {
                        const netQty = item.quantity - (item.returnedQuantity || 0);
                        return (
                          <div
                            key={item.id}
                            className="flex justify-between items-center text-sm border-b pb-2"
                          >
                            <div>
                              <div className="font-medium">
                                {item.product?.name || 'Unknown Product'}
                                {item.variant && (
                                  <span className="text-gray-600">
                                    {' '}
                                    ({item.variant.name || 'Variant'})
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                SKU: {item.product?.sku || 'N/A'} • Qty: {item.quantity}
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
                            </div>
                            <div className="text-right">
                              <div>Rs. {Number(item.total).toFixed(2)}</div>
                              {item.returnedQuantity > 0 && (
                                <div className="text-xs text-red-600">
                                  -Rs. {(Number(item.price) * item.returnedQuantity).toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && sales.length > 0 && viewMode === 'customers' && (
          <div className="border rounded bg-white overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-900">Customer Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Phone</th>
                  <th className="px-4 py-3 font-semibold text-gray-900 text-right">Orders</th>
                  <th className="px-4 py-3 font-semibold text-gray-900 text-right">Total Spent</th>
                  <th className="px-4 py-3 font-semibold text-gray-900 text-right">Last Visit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(() => {
                  const customers = new Map<string, any>();
                  const searchLower = orderIdFilter.toLowerCase();

                  sales.forEach((sale) => {
                    if (sale.customerName || sale.customerPhone) {
                      // Client-side filtering for customer search
                      if (orderIdFilter) {
                        const matchName = sale.customerName && sale.customerName.toLowerCase().includes(searchLower);
                        const matchPhone = sale.customerPhone && sale.customerPhone.includes(orderIdFilter);
                        if (!matchName && !matchPhone) return;
                      }

                      const key = (sale.customerName || '') + (sale.customerPhone || '');
                      // Only group if we have some data
                      if (!key) return;

                      const existing = customers.get(key);
                      if (existing) {
                        existing.orders += 1;
                        existing.spent += Number(sale.total);
                        if (new Date(sale.createdAt) > new Date(existing.lastVisit)) {
                          existing.lastVisit = sale.createdAt;
                        }
                        customers.set(key, existing);
                      } else {
                        customers.set(key, {
                          name: sale.customerName || 'N/A',
                          phone: sale.customerPhone || 'N/A',
                          orders: 1,
                          spent: Number(sale.total),
                          lastVisit: sale.createdAt
                        });
                      }
                    }
                  });

                  if (customers.size === 0) {
                    return <tr><td colSpan={5} className="px-4 py-3 text-gray-500 text-center">No customer data found in selected sales.</td></tr>;
                  }

                  return Array.from(customers.values())
                    .sort((a, b) => b.spent - a.spent)
                    .map((c, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                        <td className="px-4 py-3 text-right">{c.orders}</td>
                        <td className="px-4 py-3 text-right text-blue-700">Rs. {c.spent.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{new Date(c.lastVisit).toLocaleString()}</td>
                      </tr>
                    ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
