'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { Truck, Utensils, ShoppingBag, AlertCircle, Receipt, CreditCard, Banknote, RefreshCcw, Ticket } from 'lucide-react';

export default function SalesReportPage() {
    const { data: session } = useSession();
    const isRestaurant = session?.user?.businessType === 'RESTAURANT';

    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [orderIdFilter, setOrderIdFilter] = useState('');
    const [dateFilter, setDateFilter] = useState<string>('last7days');
    const [summary, setSummary] = useState<{
        totalSales: number;
        totalTax: number;
        totalDiscount: number;
        totalCouponDiscount: number;
        cashSales: number;
        cardSales: number;
        totalRefundAmount: number;
        netSale: number;
        dineInSales: number;
        takeawaySales: number;
        deliverySales: number;
        wastageLoss: number;
        wastageCount: number;
    } | null>(null);
    const [cashiers, setCashiers] = useState<any[]>([]);
    const [selectedCashier, setSelectedCashier] = useState<string>('');
    const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
    const [isCashierDropdownOpen, setIsCashierDropdownOpen] = useState(false);

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
            if (orderIdFilter) params.append('orderId', orderIdFilter);
            if (selectedCashier) params.append('cashierId', selectedCashier);

            const response = await fetch(`/api/sales?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch sales data');
            const data = await response.json();
            setSales(data);

            const validSales = data.filter((s: any) => s.orderStatus !== 'WASTED');
            const wastedSales = data.filter((s: any) => s.orderStatus === 'WASTED');

            const totalSales = validSales.reduce((sum: number, sale: any) => sum + Number(sale.total), 0);
            const totalTax = validSales.reduce((sum: number, sale: any) => sum + Number(sale.tax), 0);
            const totalDiscountRaw = validSales.reduce((sum: number, sale: any) => sum + Number(sale.discount || 0), 0);
            const totalCouponDiscount = validSales.reduce((sum: number, sale: any) => sum + Number(sale.couponValue || 0), 0);
            const totalDiscount = totalDiscountRaw - totalCouponDiscount;

            const cashSales = validSales.filter((sale: any) => sale.paymentMethod === 'CASH' || !sale.paymentMethod).reduce((sum: number, sale: any) => sum + Number(sale.total), 0);
            const cardSales = validSales.filter((sale: any) => sale.paymentMethod === 'CARD').reduce((sum: number, sale: any) => sum + Number(sale.total), 0);

            const totalRefundAmount = validSales.reduce((sum: number, sale: any) => {
                const refundTotal = sale.refunds?.reduce((rSum: number, r: any) => rSum + Number(r.total), 0) || 0;
                return sum + refundTotal;
            }, 0);

            const netSale = totalSales - totalDiscount - totalCouponDiscount - totalRefundAmount + totalTax;

            const dineInSales = validSales.filter((s: any) => s.orderType === 'DINE_IN').reduce((sum: number, s: any) => sum + Number(s.total), 0);
            const takeawaySales = validSales.filter((s: any) => s.orderType === 'TAKEAWAY').reduce((sum: number, s: any) => sum + Number(s.total), 0);
            const deliverySales = validSales.filter((s: any) => s.orderType === 'DELIVERY').reduce((sum: number, s: any) => sum + Number(s.total), 0);
            const wastageLoss = wastedSales.reduce((sum: number, s: any) => sum + Number(s.total), 0);
            const wastageCount = wastedSales.length;

            setSummary({
                totalSales, totalTax, totalDiscount, totalCouponDiscount, cashSales, cardSales,
                totalRefundAmount, netSale, dineInSales, takeawaySales, deliverySales, wastageLoss, wastageCount
            });
        } catch (err: any) {
            setError(err.message || 'An error occurred while fetching sales data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (dateFilter !== 'custom') applyDateFilter(dateFilter);
    }, [dateFilter]);

    useEffect(() => {
        fetchSales();
    }, [startDate, endDate, orderIdFilter, selectedCashier]);

    useEffect(() => {
        fetch('/api/users')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setCashiers(data.filter((u: any) => u.role === 'CASHIER'));
                }
            });
    }, []);

    const today = new Date().toISOString().split('T')[0];
    const defaultStartDateStr = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0];

    return (
        <div className="min-h-screen bg-gray-50">
            <AdminHeader title="Sales Reports" />
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">Revenue Analytics</h1>
                        <p className="text-sm text-gray-500">Comprehensive breakdown of sales and modes.</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 border rounded-xl bg-white shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1 uppercase tracking-wider">Date Filter</label>
                            <div className="relative">
                                <button
                                    onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                                    className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                                <div
                                                    key={opt}
                                                    className="px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer capitalize"
                                                    onClick={() => {
                                                        setDateFilter(opt);
                                                        if (opt === 'custom') {
                                                            setStartDate(defaultStartDateStr);
                                                            setEndDate(today);
                                                        }
                                                        setIsDateDropdownOpen(false);
                                                    }}
                                                >
                                                    {opt.replace('last', 'Last ')}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1 uppercase tracking-wider">Cashier</label>
                            <div className="relative">
                                <button
                                    onClick={() => setIsCashierDropdownOpen(!isCashierDropdownOpen)}
                                    className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <span>{selectedCashier ? (cashiers.find(c => c.id === selectedCashier)?.name || 'Unknown') : 'All Cashiers'}</span>
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {isCashierDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsCashierDropdownOpen(false)}></div>
                                        <div className="absolute top-full left-0 w-full z-20 bg-white border rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
                                            <div className="px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedCashier(''); setIsCashierDropdownOpen(false); }}>All Cashiers</div>
                                            {cashiers.map((c) => (
                                                <div key={c.id} className="px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedCashier(c.id); setIsCashierDropdownOpen(false); }}>{c.name || c.email}</div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        {dateFilter === 'custom' && (
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-gray-600 mb-1 uppercase tracking-wider">Start</label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-gray-600 mb-1 uppercase tracking-wider">End</label>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {summary && (
                    <div className="space-y-6">
                        {/* Financial Summary Bar */}
                        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100 p-4">
                                <div className="px-6 py-2">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Gross Sales</p>
                                    <p className="text-xl font-bold text-gray-900">Rs. {summary.totalSales.toLocaleString()}</p>
                                </div>
                                <div className="px-6 py-2">
                                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Total Net Sale</p>
                                    <p className="text-xl font-bold text-green-700">Rs. {summary.netSale.toLocaleString()}</p>
                                </div>
                                <div className="px-6 py-2">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Tax Collected</p>
                                    <p className="text-xl font-bold text-gray-900">Rs. {summary.totalTax.toLocaleString()}</p>
                                </div>
                                <div className="px-6 py-2">
                                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1">Manual Discount</p>
                                    <p className="text-xl font-bold text-red-600">Rs. {summary.totalDiscount.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Primary Revenue Mode Grid */}
                        {isRestaurant && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="absolute right-[-10px] bottom-[-10px] text-blue-100 group-hover:text-blue-200 transition-colors rotate-12">
                                        <Utensils size={100} />
                                    </div>
                                    <div className="relative z-10">
                                        <p className="text-sm font-bold text-blue-600 mb-2 uppercase tracking-wide">Dine-in Revenue</p>
                                        <p className="text-3xl font-black text-blue-900">Rs. {summary.dineInSales.toLocaleString()}</p>
                                        <p className="text-xs text-blue-400 mt-2 font-medium">In-house dining figures</p>
                                    </div>
                                </div>

                                <div className="bg-orange-50/50 border border-orange-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="absolute right-[-10px] bottom-[-10px] text-orange-100 group-hover:text-orange-200 transition-colors rotate-12">
                                        <ShoppingBag size={100} />
                                    </div>
                                    <div className="relative z-10">
                                        <p className="text-sm font-bold text-orange-600 mb-2 uppercase tracking-wide">Takeaway Revenue</p>
                                        <p className="text-3xl font-black text-orange-900">Rs. {summary.takeawaySales.toLocaleString()}</p>
                                        <p className="text-xs text-orange-400 mt-2 font-medium">Self-pickup orders</p>
                                    </div>
                                </div>

                                <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="absolute right-[-10px] bottom-[-10px] text-emerald-100 group-hover:text-emerald-200 transition-colors rotate-12">
                                        <Truck size={100} />
                                    </div>
                                    <div className="relative z-10">
                                        <p className="text-sm font-bold text-emerald-600 mb-2 uppercase tracking-wide">Delivery Revenue</p>
                                        <p className="text-3xl font-black text-emerald-900">Rs. {summary.deliverySales.toLocaleString()}</p>
                                        <p className="text-xs text-emerald-400 mt-2 font-medium">Outbound rider deliveries</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Small Data Cards (UI Fix Section '1') */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center gap-4">
                                <div className="p-2 bg-red-50 rounded-lg text-red-500"><Ticket size={20} /></div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Coupon Discounts</p>
                                    <p className="text-sm font-black text-red-600">Rs. {summary.totalCouponDiscount.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center gap-4">
                                <div className="p-2 bg-orange-50 rounded-lg text-orange-500"><RefreshCcw size={20} /></div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Order Returns</p>
                                    <p className="text-sm font-black text-orange-600">Rs. {summary.totalRefundAmount.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center gap-4">
                                <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600"><Banknote size={20} /></div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Cash Revenue</p>
                                    <p className="text-sm font-black text-yellow-700">Rs. {summary.cashSales.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center gap-4">
                                <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><CreditCard size={20} /></div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Card Revenue</p>
                                    <p className="text-sm font-black text-purple-700">Rs. {summary.cardSales.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Wastage Alert Card */}
                        {isRestaurant && summary.wastageLoss > 0 && (
                            <div className="bg-red-50 border-2 border-red-200 p-6 rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 bg-red-100 rounded-xl text-red-600">
                                        <AlertCircle size={32} />
                                    </div>
                                    <div>
                                        <p className="text-lg font-black text-red-700">Inventory Wastage Loss</p>
                                        <p className="text-sm text-red-500 font-medium">Record of accidents, mishaps, or refusals.</p>
                                    </div>
                                </div>
                                <div className="text-center md:text-right">
                                    <p className="text-3xl font-black text-red-700">Rs. {summary.wastageLoss.toLocaleString()}</p>
                                    <p className="text-sm font-bold text-red-500 mt-1 uppercase tracking-wider">{summary.wastageCount} Orders Wasted</p>
                                </div>
                            </div>
                        )}

                        {/* Rider Performance Summary */}
                        {isRestaurant && (
                            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                                <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <Truck size={20} className="text-emerald-600" />
                                        Rider Logistics Performance
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-white border-b">
                                            <tr>
                                                <th className="px-6 py-4">Rider Identity</th>
                                                <th className="px-6 py-4 text-center">Efficiency Score</th>
                                                <th className="px-6 py-4 text-right">Avg. Response Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {(() => {
                                                const riderStats = new Map<string, { count: number; totalMinutes: number }>();
                                                sales.filter(s => s.orderType === 'DELIVERY' && s.riderName && s.deliveredAt && s.dispatchedAt).forEach(s => {
                                                    const name = s.riderName;
                                                    const diff = (new Date(s.deliveredAt).getTime() - new Date(s.dispatchedAt).getTime()) / (1000 * 60);
                                                    const existing = riderStats.get(name) || { count: 0, totalMinutes: 0 };
                                                    riderStats.set(name, { count: existing.count + 1, totalMinutes: existing.totalMinutes + diff });
                                                });

                                                const statsArray = Array.from(riderStats.entries());
                                                if (statsArray.length === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={3} className="px-6 py-10 text-center text-gray-400 italic font-medium">No logistics data found for the selected period.</td>
                                                        </tr>
                                                    );
                                                }

                                                return statsArray.map(([name, stat]) => (
                                                    <tr key={name} className="hover:bg-gray-50/50 transition-colors group even:bg-gray-50/30">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-xs">
                                                                    {name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="font-bold text-gray-700">{name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="inline-flex items-center px-4 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase letter-spacing-wider">
                                                                {stat.count} DELIVERED
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-gray-600 font-bold">
                                                            {Math.round(stat.totalMinutes / stat.count)} mins
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
