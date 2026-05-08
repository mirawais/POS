'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { BarChart3, TrendingUp, CreditCard, Users, ShoppingCart, Wallet } from 'lucide-react';

type SaleRow = {
    id: string;
    orderId?: string;
    createdAt: string;
    total: number | string;
    tax?: number | string;
    paymentMethod?: string;
    orderStatus?: string;
    type?: string;
    items?: Array<{
        quantity?: number;
        total?: number | string;
        product?: { name?: string };
    }>;
};

type CustomerRow = {
    id: string;
};

const formatCurrency = (value: number) =>
    `Rs. ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function ReportsDashboardPage() {
    const [sales, setSales] = useState<SaleRow[]>([]);
    const [customers, setCustomers] = useState<CustomerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError(null);
                const [salesRes, customersRes] = await Promise.all([
                    fetch('/api/sales'),
                    fetch('/api/customers'),
                ]);

                if (!salesRes.ok || !customersRes.ok) {
                    throw new Error('Failed to load analytics data');
                }

                const salesData = await salesRes.json();
                const customersData = await customersRes.json();
                setSales(Array.isArray(salesData) ? salesData : []);
                setCustomers(Array.isArray(customersData) ? customersData : []);
            } catch (err: any) {
                setError(err?.message || 'Failed to load analytics data');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    const metrics = useMemo(() => {
        const validSales = sales.filter((s) => s.orderStatus !== 'WASTED' && s.type !== 'REFUND');
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOf7Days = new Date(startOfToday);
        startOf7Days.setDate(startOfToday.getDate() - 6);

        const todaySales = validSales.filter((s) => new Date(s.createdAt) >= startOfToday);
        const last7Sales = validSales.filter((s) => new Date(s.createdAt) >= startOf7Days);

        const todayRevenue = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);
        const weekRevenue = last7Sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
        const weekTax = last7Sales.reduce((sum, s) => sum + Number(s.tax || 0), 0);
        const avgOrderValue = last7Sales.length ? weekRevenue / last7Sales.length : 0;

        const cashRevenue = last7Sales
            .filter((s) => !s.paymentMethod || s.paymentMethod === 'CASH')
            .reduce((sum, s) => sum + Number(s.total || 0), 0);
        const cardRevenue = last7Sales
            .filter((s) => s.paymentMethod === 'CARD')
            .reduce((sum, s) => sum + Number(s.total || 0), 0);

        const days: Array<{ key: string; label: string; total: number; orders: number }> = [];
        for (let i = 6; i >= 0; i -= 1) {
            const d = new Date(startOfToday);
            d.setDate(startOfToday.getDate() - i);
            const next = new Date(d);
            next.setDate(d.getDate() + 1);
            const daySales = validSales.filter((s) => {
                const created = new Date(s.createdAt);
                return created >= d && created < next;
            });
            days.push({
                key: d.toISOString().slice(0, 10),
                label: d.toLocaleDateString(undefined, { weekday: 'short' }),
                total: daySales.reduce((sum, s) => sum + Number(s.total || 0), 0),
                orders: daySales.length,
            });
        }
        const maxDayRevenue = Math.max(...days.map((d) => d.total), 1);

        const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
        for (const sale of last7Sales) {
            for (const item of sale.items || []) {
                const name = item.product?.name || 'Unknown Item';
                const existing = productMap.get(name) || { name, qty: 0, revenue: 0 };
                existing.qty += Number(item.quantity || 0);
                existing.revenue += Number(item.total || 0);
                productMap.set(name, existing);
            }
        }
        const topProducts = Array.from(productMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        const recent = [...validSales]
            .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
            .slice(0, 6);

        return {
            todayRevenue,
            weekRevenue,
            weekTax,
            avgOrderValue,
            totalOrdersWeek: last7Sales.length,
            totalCustomers: customers.length,
            cashRevenue,
            cardRevenue,
            trend: days,
            maxDayRevenue,
            topProducts,
            recent,
        };
    }, [sales, customers]);

    return (
        <div className="min-h-screen bg-gray-50">
            <AdminHeader title="Reports Dashboard" />
            <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Business Insights</h1>
                        <p className="text-sm text-gray-500">Live snapshot from sales, customers, and order activity.</p>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Today Revenue</p>
                            <TrendingUp size={18} className="text-emerald-600" />
                        </div>
                        <p className="mt-3 text-2xl font-black text-gray-900">{loading ? '...' : formatCurrency(metrics.todayRevenue)}</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Last 7 Days</p>
                            <BarChart3 size={18} className="text-blue-600" />
                        </div>
                        <p className="mt-3 text-2xl font-black text-gray-900">{loading ? '...' : formatCurrency(metrics.weekRevenue)}</p>
                        <p className="mt-1 text-xs text-gray-500">Tax: {formatCurrency(metrics.weekTax)}</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Average Order Value</p>
                            <Wallet size={18} className="text-violet-600" />
                        </div>
                        <p className="mt-3 text-2xl font-black text-gray-900">{loading ? '...' : formatCurrency(metrics.avgOrderValue)}</p>
                        <p className="mt-1 text-xs text-gray-500">{metrics.totalOrdersWeek} orders in 7 days</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Cash vs Card</p>
                            <CreditCard size={18} className="text-amber-600" />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-gray-700">Cash: <span className="font-black text-gray-900">{formatCurrency(metrics.cashRevenue)}</span></p>
                        <p className="mt-1 text-sm font-semibold text-gray-700">Card: <span className="font-black text-gray-900">{formatCurrency(metrics.cardRevenue)}</span></p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Customers</p>
                            <Users size={18} className="text-cyan-600" />
                        </div>
                        <p className="mt-3 text-2xl font-black text-gray-900">{loading ? '...' : metrics.totalCustomers.toLocaleString()}</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Orders (7 Days)</p>
                            <ShoppingCart size={18} className="text-rose-600" />
                        </div>
                        <p className="mt-3 text-2xl font-black text-gray-900">{loading ? '...' : metrics.totalOrdersWeek.toLocaleString()}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="xl:col-span-2 rounded-2xl border bg-white p-5 shadow-sm">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">7-Day Revenue Trend</h2>
                        <div className="mt-5 grid grid-cols-7 gap-2 items-end min-h-[180px]">
                            {metrics.trend.map((d) => (
                                <div key={d.key} className="flex flex-col items-center gap-2">
                                    <div className="text-[10px] font-semibold text-gray-500">{d.orders}</div>
                                    <div className="w-full rounded-md bg-gray-100 flex items-end h-28">
                                        <div
                                            className="w-full rounded-md bg-blue-500"
                                            style={{ height: `${Math.max((d.total / metrics.maxDayRevenue) * 100, 6)}%` }}
                                            title={`${d.label}: ${formatCurrency(d.total)}`}
                                        />
                                    </div>
                                    <div className="text-[11px] font-semibold text-gray-600">{d.label}</div>
                                </div>
                            ))}
                        </div>
                        <p className="mt-3 text-xs text-gray-500">Numbers above bars show daily order count.</p>
                    </div>

                    <div className="rounded-2xl border bg-white p-5 shadow-sm">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Top Products (7 Days)</h2>
                        <div className="mt-4 space-y-3">
                            {metrics.topProducts.map((p) => (
                                <div key={p.name} className="rounded-lg border border-gray-100 px-3 py-2">
                                    <p className="text-sm font-bold text-gray-900 break-words">{p.name}</p>
                                    <div className="mt-1 flex items-center justify-between text-xs">
                                        <span className="font-semibold text-gray-500">Qty: {p.qty}</span>
                                        <span className="font-black text-blue-700">{formatCurrency(p.revenue)}</span>
                                    </div>
                                </div>
                            ))}
                            {!loading && metrics.topProducts.length === 0 && (
                                <p className="text-sm text-gray-500">No product sales in selected period.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Recent Transactions</h2>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {metrics.recent.map((sale) => (
                            <div key={sale.id} className="rounded-lg border border-gray-100 px-3 py-3">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-bold text-gray-900">#{sale.orderId || sale.id.slice(-6)}</p>
                                    <span className="text-xs font-semibold text-gray-500">{sale.paymentMethod || 'CASH'}</span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">{new Date(sale.createdAt).toLocaleString()}</p>
                                <p className="mt-2 text-base font-black text-gray-900">{formatCurrency(Number(sale.total || 0))}</p>
                            </div>
                        ))}
                        {!loading && metrics.recent.length === 0 && (
                            <p className="text-sm text-gray-500">No recent transactions found.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
