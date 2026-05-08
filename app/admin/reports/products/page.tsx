'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { Package, Search, Download } from 'lucide-react';

export default function ProductReportPage() {
    const { data: session } = useSession();
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchFilter, setSearchFilter] = useState('');
    const [dateFilter, setDateFilter] = useState<string>('last7days');
    const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

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
                break;
        }
    };

    const fetchSales = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const response = await fetch(`/api/sales?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch sales data');
            const data = await response.json();
            setSales(data.filter((s: any) => s.orderStatus !== 'WASTED'));
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (dateFilter !== 'custom') applyDateFilter(dateFilter);
    }, [dateFilter]);

    useEffect(() => {
        fetchSales();
    }, [startDate, endDate]);

    const productStats = (() => {
        const statsMap = new Map<string, any>();
        sales.forEach(sale => {
            sale.items?.forEach((item: any) => {
                const key = `${item.productId}:${item.variantId || 'base'}`;
                const existing = statsMap.get(key);
                const qty = item.quantity || 0;
                const returned = item.returnedQuantity || 0;
                const total = Number(item.total) || 0;

                if (existing) {
                    existing.quantity += qty;
                    existing.returned += returned;
                    existing.total += total;
                } else {
                    statsMap.set(key, {
                        name: item.product?.name || 'Unknown',
                        sku: item.product?.sku || '-',
                        variantName: item.variant?.name || null,
                        quantity: qty,
                        returned: returned,
                        total: total
                    });
                }
            });
        });

        let list = Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
        if (searchFilter) {
            const s = searchFilter.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s));
        }
        return list;
    })();

    const exportCSV = () => {
        const headers = ['Product', 'SKU', 'Sold Qty', 'Returned', 'Net Qty', 'Revenue'];
        const rows = productStats.map(p => [
            p.name + (p.variantName ? ` (${p.variantName})` : ''),
            p.sku,
            p.quantity,
            p.returned,
            p.quantity - p.returned,
            p.total.toFixed(2)
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `product-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="min-h-screen bg-gray-50 overflow-x-hidden">
            <AdminHeader title="Product Reports" />
            <div className="p-4 sm:p-6 space-y-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Product Performance</h1>
                    <p className="text-sm text-gray-500">Track best-sellers and individual product revenue.</p>
                </div>

                <div className="p-4 border rounded-xl bg-white shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1 uppercase tracking-wider">Date Filter</label>
                        <div className="relative">
                            <button
                                onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                                className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white text-left flex justify-between items-center"
                            >
                                <span>{{
                                    'today': 'Today',
                                    'yesterday': 'Yesterday',
                                    'last7days': 'Last 7 Days',
                                    'lastmonth': 'Last Month',
                                    'custom': 'Custom Date Range'
                                }[dateFilter] || dateFilter}</span>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {isDateDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsDateDropdownOpen(false)}></div>
                                    <div className="absolute top-full left-0 w-full z-20 bg-white border rounded-lg shadow-xl mt-1 overflow-hidden">
                                        {['today', 'yesterday', 'last7days', 'lastmonth', 'custom'].map((opt) => (
                                            <div key={opt} className="px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer capitalize" onClick={() => { setDateFilter(opt); setIsDateDropdownOpen(false); }}>{opt.replace('last', 'Last ')}</div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1 uppercase tracking-wider">Search Product</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Name or SKU..."
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex items-end">
                        <button onClick={exportCSV} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-black text-sm font-bold transition-colors">
                            <Download size={18} /> Export CSV
                        </button>
                    </div>
                </div>

                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-gray-100">
                        {productStats.map((p, i) => (
                            <div key={i} className="px-4 py-4 space-y-3">
                                <div>
                                    <p className="text-sm font-bold text-gray-900 break-words">{p.name}</p>
                                    {p.variantName && (
                                        <p className="text-[10px] text-blue-500 font-bold uppercase mt-0.5">{p.variantName}</p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">SKU</p>
                                        <p className="mt-1 font-mono text-gray-700 break-all">{p.sku}</p>
                                    </div>
                                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Qty Sold</p>
                                        <p className="mt-1 font-bold text-gray-800">{p.quantity}</p>
                                    </div>
                                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Returned</p>
                                        <p className="mt-1 font-bold text-red-500">{p.returned > 0 ? p.returned : '-'}</p>
                                    </div>
                                    <div className="rounded-lg bg-blue-50 px-3 py-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">Revenue</p>
                                        <p className="mt-1 font-black text-blue-700 break-words">Rs. {p.total.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {productStats.length === 0 && (
                            <div className="px-6 py-10 text-center text-gray-400 italic font-medium text-sm">
                                No product data found for this period.
                            </div>
                        )}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full table-fixed text-sm text-left">
                            <thead className="text-xs font-bold text-gray-400 bg-gray-50 border-b uppercase tracking-widest">
                                <tr>
                                    <th className="px-3 sm:px-6 py-4 w-[34%]">Product Analysis</th>
                                    <th className="px-3 sm:px-6 py-4 w-[20%]">SKU</th>
                                    <th className="px-3 sm:px-6 py-4 w-[14%] text-center">Qty Sold</th>
                                    <th className="px-3 sm:px-6 py-4 w-[14%] text-center">Returned</th>
                                    <th className="px-3 sm:px-6 py-4 w-[18%] text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {productStats.map((p, i) => (
                                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-3 sm:px-6 py-4">
                                            <div className="font-bold text-gray-800 break-words">{p.name}</div>
                                            {p.variantName && <div className="text-[10px] text-blue-500 font-bold uppercase">{p.variantName}</div>}
                                        </td>
                                        <td className="px-3 sm:px-6 py-4 text-gray-500 font-mono break-all">{p.sku}</td>
                                        <td className="px-3 sm:px-6 py-4 text-center font-bold text-gray-700">{p.quantity}</td>
                                        <td className="px-3 sm:px-6 py-4 text-center text-red-500 font-bold">{p.returned > 0 ? p.returned : '-'}</td>
                                        <td className="px-3 sm:px-6 py-4 text-right font-black text-blue-700 break-words">Rs. {p.total.toLocaleString()}</td>
                                    </tr>
                                ))}
                                {productStats.length === 0 && (
                                    <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400 italic font-medium">No product data found for this period.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
