'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { Users, Search, Download, Calendar } from 'lucide-react';

export default function CustomerReportPage() {
    const { data: session } = useSession();
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchFilter, setSearchFilter] = useState('');
    const [dateFilter, setDateFilter] = useState<string>('lastmonth');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
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
            case 'last7days':
                start.setDate(start.getDate() - 7);
                setStartDate(start.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
                break;
            case 'lastmonth':
                start.setMonth(start.getMonth() - 1);
                setStartDate(start.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
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

            const response = await fetch(`/api/sales?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch data');
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

    const customerStats = (() => {
        const statsMap = new Map<string, any>();
        sales.forEach(sale => {
            if (sale.customerName || sale.customerPhone) {
                const key = (sale.customerName || '').toLowerCase() + (sale.customerPhone || '');
                const existing = statsMap.get(key);
                const total = Number(sale.total) || 0;

                if (existing) {
                    existing.orders += 1;
                    existing.spent += total;
                    if (new Date(sale.createdAt) > new Date(existing.lastVisit)) {
                        existing.lastVisit = sale.createdAt;
                    }
                } else {
                    statsMap.set(key, {
                        name: sale.customerName || 'N/A',
                        phone: sale.customerPhone || 'N/A',
                        orders: 1,
                        spent: total,
                        lastVisit: sale.createdAt
                    });
                }
            }
        });

        let list = Array.from(statsMap.values()).sort((a, b) => b.spent - a.spent);
        if (searchFilter) {
            const s = searchFilter.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(s) || c.phone.includes(s));
        }
        return list;
    })();

    const exportCSV = () => {
        const headers = ['Customer Name', 'Phone', 'Orders', 'Total Spent', 'Last Visit'];
        const rows = customerStats.map(c => [c.name, c.phone, c.orders, c.spent.toFixed(2), new Date(c.lastVisit).toLocaleString()]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customer-report.csv`;
        a.click();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <AdminHeader title="Customer Insights" />
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Customer History</h1>
                    <p className="text-sm text-gray-500">Analyze shopping patterns and loyalty metrics.</p>
                </div>

                <div className="p-4 border rounded-xl bg-white shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1 uppercase tracking-wider">Timeframe</label>
                        <div className="relative">
                            <button onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)} className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white text-left flex justify-between items-center text-gray-700">
                                <span className="flex items-center gap-2 font-medium"><Calendar size={14} /> {dateFilter.replace('last', 'Last ').replace('7days', '7 Days')}</span>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {isDateDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsDateDropdownOpen(false)}></div>
                                    <div className="absolute top-full left-0 w-full z-20 bg-white border rounded-lg shadow-xl mt-1 overflow-hidden">
                                        {['today', 'last7days', 'lastmonth'].map(opt => (
                                            <div key={opt} className="px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer capitalize font-medium text-gray-700" onClick={() => { setDateFilter(opt); setIsDateDropdownOpen(false); }}>{opt.replace('last', 'Last ').replace('7days', '7 Days')}</div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1 uppercase tracking-wider">Find Customer</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input type="text" placeholder="Name or Phone..." value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>
                    <div className="flex items-end">
                        <button onClick={exportCSV} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-black text-sm font-bold transition-transform active:scale-95">
                            <Download size={18} /> Download List
                        </button>
                    </div>
                </div>

                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs font-bold text-gray-400 bg-gray-50/50 border-b uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Customer Name</th>
                                    <th className="px-6 py-4">Contact</th>
                                    <th className="px-6 py-4 text-center">Visits</th>
                                    <th className="px-6 py-4 text-right">Lifetime Spent</th>
                                    <th className="px-6 py-4 text-right">Most Recent</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {customerStats.map((c, i) => (
                                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-black text-[10px]">
                                                    {c.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-gray-800">{c.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 font-medium">{c.phone}</td>
                                        <td className="px-6 py-4 text-center font-bold text-gray-700">{c.orders}</td>
                                        <td className="px-6 py-4 text-right font-black text-emerald-600">Rs. {c.spent.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right text-gray-400 text-xs font-medium">{new Date(c.lastVisit).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                                {customerStats.length === 0 && (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic font-medium">No customer matching your criteria was found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
