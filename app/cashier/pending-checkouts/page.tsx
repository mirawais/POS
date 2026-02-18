'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/notifications/ToastContainer';
import { useSession } from 'next-auth/react';
import { Receipt, Search, ShoppingCart, RefreshCcw } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

type PendingBill = {
    id: string;
    data: {
        cart?: any[];
        label?: string;
        orderType?: 'DINE_IN' | 'TAKEAWAY';
        tableNumber?: string;
        orderStatus?: string;
    };
    createdAt: string;
};

export default function PendingCheckoutsPage() {
    const [pendingBills, setPendingBills] = useState<PendingBill[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { data: session } = useSession();
    const { showError, showSuccess } = useToast();

    const isRestaurant = (session?.user as any)?.businessType !== 'GROCERY';
    const role = session?.user?.role;

    useEffect(() => {
        if (role === 'WAITER') {
            router.push('/cashier/billing');
            return;
        }
        loadPendingBills();
    }, [role]);

    const loadPendingBills = async (isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            const res = await fetch('/api/held-bills?status=BILLING_REQUESTED');
            if (!res.ok) throw new Error('Failed to load pending bills');
            const data = await res.json();

            setPendingBills(data);
        } catch (err: any) {
            showError(err.message || 'Failed to load pending bills');
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    const handleLoad = (bill: PendingBill) => {
        sessionStorage.setItem('loadHeldBillId', bill.id);
        router.push('/cashier/billing');
    };

    const calculateTotal = (bill: PendingBill) => {
        const cart = bill.data?.cart || [];
        return cart.reduce((sum, item) => {
            const price = item.variant?.price ?? item.product?.price ?? 0;
            return sum + (price * (item.quantity || 1));
        }, 0);
    };

    if (role === 'WAITER') return null;

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Receipt className="text-blue-600" />
                        Pending Checkouts
                    </h1>
                    <p className="text-gray-500 text-sm">Review and finalize orders requested for billing</p>
                </div>
                <button
                    onClick={() => loadPendingBills()}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors shadow-sm"
                >
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {!loading && pendingBills.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                        <Receipt className="text-gray-300 w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-700">No Pending Checkouts</h2>
                    <p className="text-gray-500 mt-1 max-w-xs mx-auto">All billing requests have been cleared.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingBills.map((bill) => {
                        const total = calculateTotal(bill);
                        return (
                            <div key={bill.id} className="bg-white border-2 border-blue-50 rounded-2xl shadow-sm hover:shadow-md transition-all p-5 flex flex-col h-full border-t-[6px] border-t-blue-500">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg">
                                            {bill.data?.label || 'Unnamed Order'}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200 uppercase tracking-wider">
                                                BILLING REQUESTED
                                            </span>
                                            {bill.data?.tableNumber && (
                                                <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full border border-gray-200">
                                                    Table: {bill.data.tableNumber}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6 flex-grow">
                                    <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                                        <span className="text-gray-500">Items:</span>
                                        <span className="font-semibold text-gray-900">
                                            {bill.data?.cart?.reduce((s, i) => s + (i.quantity || 1), 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Subtotal:</span>
                                        <span className="font-bold text-blue-600 text-lg">
                                            Rs. {formatPrice(total)}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleLoad(bill)}
                                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 active:scale-95"
                                >
                                    <ShoppingCart className="w-5 h-5" />
                                    Load to Checkout
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
