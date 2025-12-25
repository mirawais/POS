'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function ClientSalesPage() {
    const params = useParams();
    const router = useRouter();
    const clientId = params.clientId as string;
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [orderIdFilter, setOrderIdFilter] = useState('');
    const [expandedSale, setExpandedSale] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<string>('last7days');
    const [summary, setSummary] = useState<{ totalSales: number; totalTax: number; totalDiscount: number; cashSales: number; cardSales: number; totalRefundAmount: number } | null>(null);
    const [viewMode, setViewMode] = useState<'sales' | 'products'>('sales');

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
            if (orderIdFilter) params.append('orderId', orderIdFilter);

            // Critical: Append clientId for Super Admin scoping
            params.append('clientId', clientId);

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
        // Only fetch if clientId is available (should be always, but for safety)
        if (clientId) fetchSales();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate, orderIdFilter, clientId]);

    const printOrder = async (sale: any) => {
        // Invoice settings might be client specific. 
        // For Super Admin view, we fetch the specific client's settings.
        const setting = await fetch(`/api/invoice-settings?clientId=${clientId}`)
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
              Date: ${new Date(sale.createdAt).toLocaleString()}<br/>
              Cashier: ${sale.cashier?.name || sale.cashier?.email || 'Unknown'}<br/>
              Payment Method: ${sale.paymentMethod === 'CARD' ? 'Card' : 'Cash'}<br/>
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
              ${Number(sale.discount) > 0 ? `<div><span>Discount:</span><span>-Rs. ${Number(sale.discount).toFixed(2)}</span></div>` : ''}
              ${Number(sale.tax) > 0 ? `<div><span>Tax:</span><span>Rs. ${Number(sale.tax).toFixed(2)}</span></div>` : ''}
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-200 rounded-full"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold">Client Sales Report</h1>
                        <p className="text-gray-600">Viewing sales data for client ID: {clientId}</p>
                    </div>
                </div>
                <div className="flex bg-white border rounded p-1">
                    <button
                        onClick={() => setViewMode('sales')}
                        className={`px-4 py-2 rounded text-sm font-medium ${viewMode === 'sales' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Sales List
                    </button>
                    <button
                        onClick={() => setViewMode('products')}
                        className={`px-4 py-2 rounded text-sm font-medium ${viewMode === 'products' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Product Report
                    </button>
                </div>
            </div>

            <div className="p-4 border rounded bg-white">
                <h2 className="text-lg font-semibold mb-4">Sales Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm text-gray-700 mb-1">Date Filter</label>
                        <select
                            value={dateFilter}
                            onChange={(e) => {
                                setDateFilter(e.target.value);
                                if (e.target.value === 'custom') {
                                    setStartDate(defaultStartDateStr);
                                    setEndDate(today);
                                }
                            }}
                            className="w-full border rounded px-3 py-2 text-sm"
                        >
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="last7days">Last 7 Days</option>
                            <option value="lastmonth">Last Month</option>
                            <option value="custom">Custom Date Range</option>
                        </select>
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
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-blue-50 rounded">
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
                        <label className="block text-sm text-gray-700 mb-1">Order ID</label>
                        <input
                            type="text"
                            value={orderIdFilter}
                            onChange={(e) => setOrderIdFilter(e.target.value)}
                            placeholder="Search order ID..."
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
                                const list = Array.from(stats.values()).sort((a, b) => b.total - a.total);

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
                                            {(sale.refunds?.length > 0 || sale.items?.some((i: any) => i.returnedQuantity > 0)) && (
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
                                            className="mb-2 px-2 py-1 text-xs border rounded hover:bg-gray-50 bg-white"
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
        </div>
    );
}
