'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, LayoutDashboard } from 'lucide-react';

export default function GlobalReportsPage() {
    const [sales, setSales] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [orderIdFilter, setOrderIdFilter] = useState('');
    const [expandedSale, setExpandedSale] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<string>('last7days');
    const [summary, setSummary] = useState<{ totalSales: number; totalTax: number; totalDiscount: number; cashSales: number; cardSales: number; totalRefundAmount: number } | null>(null);
    const [viewMode, setViewMode] = useState<'sales' | 'products'>('sales');

    const fetchClients = async () => {
        try {
            const res = await fetch('/api/clients');
            if (res.ok) {
                const data = await res.json();
                setClients(data);
            }
        } catch (err) {
            console.error('Failed to fetch clients:', err);
        }
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
                // Keep current dates
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
            if (selectedClientId !== 'all') params.append('clientId', selectedClientId);

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
        fetchClients();
    }, []);

    useEffect(() => {
        if (dateFilter !== 'custom') {
            applyDateFilter(dateFilter);
        }
    }, [dateFilter]);

    useEffect(() => {
        fetchSales();
    }, [startDate, endDate, orderIdFilter, selectedClientId]);

    const exportToCSV = () => {
        const headers = ['Order ID', 'Client', 'Type', 'Date', 'Cashier', 'Items', 'Total'];
        const rows = sales.map((sale) => [
            sale.orderId || sale.id,
            sale.client?.name || 'N/A',
            sale.type || 'SALE',
            new Date(sale.createdAt).toLocaleString(),
            sale.cashier?.name || sale.cashierId,
            sale.items?.length || 0,
            Number(sale.total).toFixed(2),
        ]);

        const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `global-sales-report-${new Date().toISOString().split('T')[0]}.csv`;
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
                <div>
                    <h1 className="text-2xl font-bold">Global Sales Reports</h1>
                    <p className="text-gray-600">Cross-tenant analytics and reporting.</p>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-sm text-gray-700 mb-1">Filter by Client</label>
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full border rounded px-3 py-2 text-sm"
                        >
                            <option value="all">All Clients (Combined)</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                        </select>
                    </div>
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
                            <div className="text-2xl font-bold text-blue-700">Rs. {summary.totalSales.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-600">Total Tax</div>
                            <div className="text-2xl font-bold text-green-700">Rs. {summary.totalTax.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-600">Total Discount</div>
                            <div className="text-2xl font-bold text-red-700">Rs. {summary.totalDiscount.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-600">Cash Sales</div>
                            <div className="text-2xl font-bold text-yellow-700">Rs. {summary.cashSales.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-600">Card Sales</div>
                            <div className="text-2xl font-bold text-purple-700">Rs. {summary.cardSales.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-600">Total Refunded</div>
                            <div className="text-2xl font-bold text-orange-700">Rs. {summary.totalRefundAmount.toFixed(2)}</div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center gap-4">
                <input
                    type="text"
                    value={orderIdFilter}
                    onChange={(e) => setOrderIdFilter(e.target.value)}
                    placeholder="Search Order ID..."
                    className="border rounded px-4 py-2 text-sm w-full md:w-64"
                />
                <button
                    onClick={exportToCSV}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    disabled={loading || sales.length === 0}
                >
                    Export Global CSV
                </button>
            </div>

            {loading && <p className="text-center py-10 text-gray-500">Loading global reports...</p>}
            {error && <p className="text-center py-10 text-red-500">{error}</p>}

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
                <div className="grid grid-cols-1 gap-4">
                    {sales.map(sale => (
                        <div key={sale.id} className="bg-white p-4 border rounded shadow-sm">
                            <div className="flex justify-between items-start">
                                <div className="cursor-pointer" onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}>
                                    <div className="font-bold flex items-center gap-2">
                                        Order: {sale.orderId || sale.id}
                                        {(sale.refunds?.length > 0 || sale.items?.some((i: any) => i.returnedQuantity > 0)) && (
                                            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-medium border border-red-200">
                                                Refunded
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        Client: {sale.client?.name || 'Unknown'} • Date: {new Date(sale.createdAt).toLocaleString()}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        Cashier: {sale.cashier?.name || sale.cashierId} • Total Items: {sale.items?.length || 0}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-blue-600">Rs. {Number(sale.total).toFixed(2)}</div>
                                    <div className="text-xs text-gray-400 capitalize">{sale.paymentMethod || 'CASH'}</div>
                                </div>
                            </div>

                            {expandedSale === sale.id && (
                                <div className="mt-4 pt-4 border-t space-y-2">
                                    {sale.items.map((item: any) => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <span>
                                                {item.product?.name} x {item.quantity}
                                                {item.returnedQuantity > 0 && <span className="text-red-500 ml-2">(Ret: {item.returnedQuantity})</span>}
                                            </span>
                                            <span>Rs. {Number(item.total).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!loading && !error && sales.length === 0 && (
                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed">
                    <LayoutDashboard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No sales records found for the selected criteria.</p>
                </div>
            )}
        </div>
    );
}
