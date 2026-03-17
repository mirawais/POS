'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { ShoppingCart, Search, Filter, Printer, ChevronDown, ChevronUp } from 'lucide-react';

export default function OrderReportPage() {
    const { data: session } = useSession();
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [orderIdFilter, setOrderIdFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [expandedSale, setExpandedSale] = useState<string | null>(null);
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchSales = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('startDate', startDate);
            params.append('endDate', endDate);
            if (orderIdFilter) params.append('orderId', orderIdFilter);

            const response = await fetch(`/api/sales?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch data');
            const data = await response.json();
            setSales(data);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSales();
    }, [startDate, endDate, orderIdFilter]);

    const filteredSales = sales.filter(s => statusFilter === 'ALL' || s.orderStatus === statusFilter);

    const getStatusBadge = (status: string) => {
        const styles: any = {
            'COMPLETED': 'bg-emerald-100 text-emerald-800 border-emerald-200',
            'WASTED': 'bg-red-100 text-red-800 border-red-200',
            'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'CANCELLED': 'bg-gray-100 text-gray-800 border-gray-200'
        };
        return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${styles[status] || 'bg-blue-100 text-blue-800 border-blue-200'}`}>{status}</span>;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <AdminHeader title="Order Management" />
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Order History</h1>
                    <p className="text-sm text-gray-500">Detailed list of all transactions and order statuses.</p>
                </div>

                <div className="p-4 border rounded-xl bg-white shadow-sm flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">Search Order</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input type="text" placeholder="Order ID..." value={orderIdFilter} onChange={(e) => setOrderIdFilter(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div className="w-full md:w-48">
                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">Status Filter</label>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white">
                            <option value="ALL">All Statuses</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="WASTED">Wasted</option>
                            <option value="PAID">Paid</option>
                        </select>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded-lg p-2 text-sm" />
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded-lg p-2 text-sm" />
                    </div>
                </div>

                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs font-bold text-gray-400 bg-gray-50 border-b uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Order Details</th>
                                    <th className="px-6 py-4">Date & Time</th>
                                    <th className="px-6 py-4">Platform/Type</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Amount</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredSales.map((sale) => (
                                    <React.Fragment key={sale.id}>
                                        <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer group" onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-800">#{sale.orderId || sale.id.slice(-6)}</div>
                                                <div className="text-[10px] text-gray-400 font-medium">By {sale.cashier?.name || 'Staff'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 font-medium">
                                                {new Date(sale.createdAt).toLocaleDateString()}
                                                <div className="text-[10px] text-gray-300 uppercase">{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-tighter border border-blue-100">
                                                    {sale.orderType || 'Retail'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">{getStatusBadge(sale.orderStatus)}</td>
                                            <td className="px-6 py-4 text-right font-black text-gray-900">Rs. {Number(sale.total).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-gray-400 group-hover:text-blue-600 transition-colors">
                                                    {expandedSale === sale.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedSale === sale.id && (
                                            <tr>
                                                <td colSpan={6} className="bg-gray-50/50 px-12 py-6 border-b">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        <div>
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Line Items ({sale.items?.length})</p>
                                                            <div className="space-y-2">
                                                                {sale.items?.map((item: any, idx: number) => (
                                                                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                                                        <div>
                                                                            <p className="font-bold text-gray-800 text-xs">{item.product?.name}</p>
                                                                            <p className="text-[10px] text-gray-400">Qty: {item.quantity} × Rs. {item.price}</p>
                                                                        </div>
                                                                        <p className="font-black text-blue-600 text-xs">Rs. {item.total}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col justify-between">
                                                            <div>
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Order Metadata</p>
                                                                <div className="grid grid-cols-2 gap-4 text-xs">
                                                                    <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                                                        <p className="text-gray-400 mb-1 uppercase font-bold text-[9px]">Payment</p>
                                                                        <p className="font-black text-gray-700 uppercase">{sale.paymentMethod || 'CASH'}</p>
                                                                    </div>
                                                                    <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                                                        <p className="text-gray-400 mb-1 uppercase font-bold text-[9px]">Customer</p>
                                                                        <p className="font-black text-gray-700 truncate">{sale.customerName || 'Walk-in'}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-all font-black text-xs uppercase tracking-widest shadow-lg">
                                                                <Printer size={16} /> Print Full Receipt
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                                {filteredSales.length === 0 && (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic font-medium">No orders matching your search were found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

import React from 'react';
