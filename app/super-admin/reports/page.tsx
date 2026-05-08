'use client';

import { useEffect, useState } from 'react';
import { Receipt, CreditCard, Banknote, Ticket, RefreshCcw, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function GlobalReportsPage() {
    const [sales, setSales] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [dateFilter, setDateFilter] = useState<string>('last7days');
    const [summary, setSummary] = useState<{
        totalSales: number;
        totalTax: number;
        fbrTax: number;
        nonFbrTax: number;
        totalDiscount: number;
        totalCouponDiscount: number;
        cashSales: number;
        cardSales: number;
        totalRefundAmount: number;
        netSale: number;
        ordersCount: number;
        wastedCount: number;
        wastedLoss: number;
    } | null>(null);

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
                setStartDate(start.toISOString().split('T')[0]);
                setEndDate(start.toISOString().split('T')[0]);
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
            default:
                break;
        }
    };

    const fetchSales = async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (selectedClientId !== 'all') params.append('clientId', selectedClientId);
            params.append('all', 'true');

            const response = await fetch(`/api/sales?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch sales data');

            const data = await response.json();
            setSales(data);

            const wastedSales = data.filter((s: any) => s.orderStatus === 'WASTED');
            const validSales = data.filter((s: any) => s.orderStatus !== 'WASTED' && s.type !== 'REFUND');

            const totalSales = validSales.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
            const totalTax = validSales.reduce((sum: number, sale: any) => sum + Number(sale.tax || 0), 0);
            const totalDiscountRaw = validSales.reduce((sum: number, sale: any) => sum + Number(sale.discount || 0), 0);
            const totalCouponDiscount = validSales.reduce((sum: number, sale: any) => sum + Number(sale.couponValue || 0), 0);
            const totalDiscount = totalDiscountRaw - totalCouponDiscount;

            const fbrTax = validSales
                .filter((s: any) => s.fbrInvoiceId && s.fbrInvoiceId.trim() !== '')
                .reduce((sum: number, s: any) => sum + Number(s.tax || 0), 0);
            const nonFbrTax = validSales
                .filter((s: any) => !s.fbrInvoiceId || s.fbrInvoiceId.trim() === '')
                .reduce((sum: number, s: any) => sum + Number(s.tax || 0), 0);

            const cashSales = validSales
                .filter((sale: any) => sale.paymentMethod === 'CASH' || !sale.paymentMethod)
                .reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
            const cardSales = validSales
                .filter((sale: any) => sale.paymentMethod === 'CARD')
                .reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);

            const totalRefundAmount = validSales.reduce((sum: number, sale: any) => {
                const refundTotal = sale.refunds?.reduce((rSum: number, r: any) => rSum + Number(r.total), 0) || 0;
                return sum + refundTotal;
            }, 0);

            const netSale = totalSales - totalDiscount - totalCouponDiscount - totalRefundAmount + totalTax;
            const wastedLoss = wastedSales.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);

            setSummary({
                totalSales,
                totalTax,
                fbrTax,
                nonFbrTax,
                totalDiscount,
                totalCouponDiscount,
                cashSales,
                cardSales,
                totalRefundAmount,
                netSale,
                ordersCount: validSales.length,
                wastedCount: wastedSales.length,
                wastedLoss,
            });
        } catch (err: any) {
            setError(err.message || 'An error occurred while fetching sales analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        if (dateFilter !== 'custom') applyDateFilter(dateFilter);
    }, [dateFilter]);

    useEffect(() => {
        fetchSales();
    }, [startDate, endDate, selectedClientId]);

    const exportToCSV = () => {
        const headers = ['Order ID', 'Client', 'Type', 'Date', 'Cashier', 'Payment Method', 'Tax', 'Discount', 'Total'];
        const rows = sales.map((sale) => [
            sale.orderId || sale.id,
            sale.client?.name || 'N/A',
            sale.type || 'SALE',
            new Date(sale.createdAt).toLocaleString(),
            sale.cashier?.name || sale.cashierId,
            sale.paymentMethod || 'CASH',
            Number(sale.tax || 0).toFixed(2),
            Number(sale.discount || 0).toFixed(2),
            Number(sale.total || 0).toFixed(2),
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
            <div>
                <h1 className="text-2xl font-bold">Global Sales Reports</h1>
                <p className="text-gray-600">Sales analytics only. Use `/super-admin/orders` for order listing and drill-down.</p>
            </div>

            <div className="p-4 border rounded bg-white">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm text-gray-700 mb-1">Filter by Client</label>
                        <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
                            <option value="all">All Clients (Combined)</option>
                            {clients.map((client) => (
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
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm text-gray-700 mb-1">Start</label>
                                <input type="date" value={startDate || defaultStartDateStr} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-700 mb-1">End</label>
                                <input type="date" value={endDate || today} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {summary && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="bg-white border rounded-xl p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Total Gross Sales</p>
                            <p className="text-2xl font-black mt-2">Rs. {summary.totalSales.toFixed(2)}</p>
                        </div>
                        <div className="bg-white border rounded-xl p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Net Sale</p>
                            <p className="text-2xl font-black mt-2 text-green-700">Rs. {summary.netSale.toFixed(2)}</p>
                        </div>
                        <div className="bg-white border rounded-xl p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Tax Collected</p>
                            <p className="text-2xl font-black mt-2 text-blue-700">Rs. {summary.totalTax.toFixed(2)}</p>
                        </div>
                        <div className="bg-white border rounded-xl p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Valid Orders</p>
                            <p className="text-2xl font-black mt-2">{summary.ordersCount}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white border rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-yellow-700"><Banknote size={16} /><span className="text-xs font-semibold uppercase">Cash Sales</span></div>
                            <p className="text-xl font-black mt-2">Rs. {summary.cashSales.toFixed(2)}</p>
                        </div>
                        <div className="bg-white border rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-purple-700"><CreditCard size={16} /><span className="text-xs font-semibold uppercase">Card Sales</span></div>
                            <p className="text-xl font-black mt-2">Rs. {summary.cardSales.toFixed(2)}</p>
                        </div>
                        <div className="bg-white border rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-red-700"><Ticket size={16} /><span className="text-xs font-semibold uppercase">Coupon Discount</span></div>
                            <p className="text-xl font-black mt-2">Rs. {summary.totalCouponDiscount.toFixed(2)}</p>
                        </div>
                        <div className="bg-white border rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-orange-700"><RefreshCcw size={16} /><span className="text-xs font-semibold uppercase">Refunded</span></div>
                            <p className="text-xl font-black mt-2">Rs. {summary.totalRefundAmount.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <Shield size={16} className="text-blue-600" />
                                FBR Tax Compliance
                            </h3>
                            {summary.nonFbrTax > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                                    <ShieldAlert size={12} />
                                    Non-Compliant
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                    <ShieldCheck size={12} />
                                    Fully Compliant
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3">
                            <div className="p-5 border-b md:border-b-0 md:border-r">
                                <p className="text-xs uppercase text-gray-500 font-semibold">Total Tax</p>
                                <p className="text-2xl font-black text-blue-700 mt-1">Rs. {summary.totalTax.toFixed(2)}</p>
                            </div>
                            <div className="p-5 border-b md:border-b-0 md:border-r">
                                <p className="text-xs uppercase text-emerald-600 font-semibold">FBR Verified</p>
                                <p className="text-2xl font-black text-emerald-700 mt-1">Rs. {summary.fbrTax.toFixed(2)}</p>
                            </div>
                            <div className="p-5">
                                <p className="text-xs uppercase text-orange-600 font-semibold">Unverified</p>
                                <p className="text-2xl font-black text-orange-700 mt-1">Rs. {summary.nonFbrTax.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    {summary.wastedCount > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <p className="text-sm font-bold text-red-700">Wastage Impact</p>
                            <p className="text-xs text-red-600 mt-1">Excluded from sales totals: {summary.wastedCount} orders</p>
                            <p className="text-xl font-black text-red-700 mt-2">Rs. {summary.wastedLoss.toFixed(2)}</p>
                        </div>
                    )}
                </>
            )}

            <div className="bg-white border rounded p-4">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-gray-700">Sales Data Export</p>
                        <p className="text-xs text-gray-500">Export filtered sales analytics data for offline reporting.</p>
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        disabled={loading || sales.length === 0}
                    >
                        <Receipt size={16} />
                        Export Global Sales CSV
                    </button>
                </div>
            </div>

            {loading && <p className="text-center py-10 text-gray-500">Loading global sales analytics...</p>}
            {error && <p className="text-center py-10 text-red-500">{error}</p>}
            {!loading && !error && sales.length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed">
                    <p className="text-gray-500">No sales records found for the selected criteria.</p>
                </div>
            )}
        </div>
    );
}
