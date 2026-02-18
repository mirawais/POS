'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle, ChefHat, RefreshCw, LogOut, AlertCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/components/notifications/ToastContainer';
import { signOut } from 'next-auth/react';

type OrderItem = {
    product: { id: string; name: string };
    variant?: { id: string; name: string };
    quantity: number;
    status?: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'BILLING_REQUESTED' | 'REJECTED';
    addedAt?: string;
};

type KitchenOrder = {
    id: string;
    data: {
        orderType?: 'DINE_IN' | 'TAKEAWAY';
        tableNumber?: string;
        tokenNumber?: string;
        orderStatus?: 'PENDING' | 'PREPARING' | 'READY';
        cart: OrderItem[];
        kitchenNote?: string;
    };
    createdAt: string;
};

export default function KitchenPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showError, showSuccess } = useToast();
    const [orders, setOrders] = useState<KitchenOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    // Permission Check
    useEffect(() => {
        if (status === 'loading') return;
        if (!session || !['KITCHEN', 'ADMIN', 'SUPER_ADMIN', 'RESTAURANT_ADMIN'].includes(session.user?.role || '')) {
            // Permission check handled by API as well
        }
    }, [session, status, router]);

    // Fetch Orders
    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/kitchen/orders');
                if (res.ok) {
                    const data = await res.json();
                    setOrders(data);
                }
            } catch (e) {
                console.error('Failed to fetch kitchen orders', e);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, [refreshKey]);

    const updateStatus = async (id: string, currentStatus: string) => {
        let newStatus = '';
        if (currentStatus === 'PENDING') newStatus = 'PREPARING';
        else if (currentStatus === 'PREPARING') newStatus = 'READY';
        else return;

        // Optimistic Update
        setOrders(prev => prev.map(o => o.id === id ? { ...o, data: { ...o.data, orderStatus: newStatus as any } } : o));

        try {
            const res = await fetch('/api/kitchen/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus }),
            });

            if (!res.ok) throw new Error('Failed to update status');

            if (newStatus === 'READY') {
                showSuccess('Current items marked as READY');
                setTimeout(() => setRefreshKey(k => k + 1), 2000);
            }
        } catch (e) {
            showError('Failed to update status');
            setRefreshKey(k => k + 1);
        }
    };

    const updateItemStatus = async (orderId: string, item: OrderItem, newStatus: string) => {
        // Optimistic Update
        setOrders(prev => prev.map(o => {
            if (o.id === orderId) {
                const updatedCart = o.data.cart.map(i => {
                    if (i.product.id === item.product.id && i.variant?.id === item.variant?.id) {
                        return { ...i, status: newStatus as any };
                    }
                    return i;
                });
                return { ...o, data: { ...o.data, cart: updatedCart } };
            }
            return o;
        }));

        try {
            const res = await fetch('/api/kitchen/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    productId: item.product.id,
                    variantId: item.variant?.id,
                    itemStatus: newStatus
                }),
            });

            if (!res.ok) throw new Error('Failed to update item status');

            if (newStatus === 'READY') {
                showSuccess(`${item.product.name} READY`);
                setTimeout(() => setRefreshKey(k => k + 1), 1500);
            }
        } catch (e) {
            showError('Failed to update item status');
            setRefreshKey(k => k + 1);
        }
    };

    const getElapsedTime = (timestamp: string) => {
        const start = new Date(timestamp).getTime();
        const now = new Date().getTime();
        const diff = Math.floor((now - start) / 60000); // minutes
        return `${diff} min`;
    };

    if (status === 'loading') return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-6 text-gray-900">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <ChefHat className="w-8 h-8 text-orange-600" />
                    Kitchen Display System
                </h1>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setRefreshKey(k => k + 1)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50 text-gray-700 font-medium"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={async () => {
                            await signOut({ redirect: false });
                            window.location.href = '/login';
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded shadow-sm hover:bg-red-100 font-medium"
                    >
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </div>

            {orders.length === 0 && !loading ? (
                <div className="text-center py-20 text-gray-500">
                    <div className="text-6xl mb-4">🍳</div>
                    <h2 className="text-2xl font-medium">No active orders</h2>
                    <p>Waiting for new orders from the floor...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {orders.map((order) => {
                        const { orderType, tableNumber, tokenNumber, orderStatus, cart, kitchenNote } = order.data;
                        const isPending = orderStatus === 'PENDING';

                        // Calculate overall late status based on EARLIEST item
                        const earliestTimestamp = cart?.reduce((acc, item) => {
                            const time = new Date(item.addedAt || order.createdAt).getTime();
                            return Math.min(acc, time);
                        }, Date.now());

                        const overallDiffMins = Math.floor((Date.now() - earliestTimestamp) / 60000);
                        const isLate = isPending && overallDiffMins >= 5;

                        return (
                            <div key={order.id} className={`bg-white rounded-xl shadow-md overflow-hidden border-l-4 flex flex-col transition-all duration-500 
                                ${isLate ? 'border-red-600 ring-2 ring-red-500 animate-pulse' : isPending ? 'border-red-500' : 'border-amber-500'}`}>
                                {/* Card Header */}
                                <div className={`p-4 border-b flex justify-between items-start ${isLate ? 'bg-red-50' : 'bg-gray-50'}`}>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${orderType === 'DINE_IN' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                                {orderType === 'DINE_IN' ? 'Dine-in' : 'Takeaway'}
                                            </span>
                                            {isLate && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-600 text-white rounded text-xs font-black animate-bounce">
                                                    <AlertCircle size={10} />
                                                    LATE ORDER
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">
                                            {orderType === 'DINE_IN' ? `Table ${tableNumber}` : `Token ${tokenNumber}`}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-1 text-gray-600 font-medium bg-white px-2 py-1 rounded border shadow-sm">
                                        <Clock className="w-4 h-4" />
                                        {getElapsedTime(new Date(earliestTimestamp).toISOString())}
                                    </div>
                                </div>

                                {/* Items List */}
                                <div className="p-4 flex-grow overflow-y-auto max-h-96">
                                    <ul className="space-y-4">
                                        {cart?.map((item, idx) => {
                                            const itemAge = getElapsedTime(item.addedAt || order.createdAt);
                                            const status = item.status || 'PENDING';
                                            const isRejected = status === 'REJECTED';
                                            const isServed = status === 'SERVED';

                                            if (isServed) return null;

                                            return (
                                                <li key={idx} className={`flex flex-col border-b border-dashed pb-3 last:border-0 last:pb-0 ${isRejected ? 'opacity-50 grayscale' : ''}`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className={`font-semibold text-gray-800 block text-lg leading-tight ${isRejected ? 'line-through' : ''}`}>{item.product.name}</span>
                                                            {item.variant && <span className="text-sm text-gray-500 block">{item.variant.name}</span>}
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                                                                    <Clock size={12} /> {itemAge} ago
                                                                </span>
                                                                {status !== 'PENDING' && (
                                                                    <span className={`px-1 rounded-[4px] text-[10px] font-bold uppercase border ${status === 'READY' ? 'bg-green-100 text-green-700 border-green-200' :
                                                                        status === 'PREPARING' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                                            'bg-red-100 text-red-700 border-red-200'
                                                                        }`}>
                                                                        {status}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-2">
                                                            <span className="bg-gray-100 text-gray-900 font-bold px-3 py-1 rounded-lg text-lg">
                                                                x{item.quantity}
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                {/* Reject Button (X) - Available for PENDING or PREPARING */}
                                                                {(status === 'PENDING' || status === 'PREPARING') && (
                                                                    <button
                                                                        onClick={() => updateItemStatus(order.id, item, 'REJECTED')}
                                                                        className="p-1.5 bg-red-50 text-red-600 border border-red-100 rounded hover:bg-red-100 transition-colors"
                                                                        title="Reject Item"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}

                                                                {/* Dynamic Status Button */}
                                                                {status === 'PENDING' && (
                                                                    <button
                                                                        onClick={() => updateItemStatus(order.id, item, 'PREPARING')}
                                                                        className="px-3 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 font-bold text-sm shadow-sm transition-all active:scale-95"
                                                                    >
                                                                        Start
                                                                    </button>
                                                                )}
                                                                {status === 'PREPARING' && (
                                                                    <button
                                                                        onClick={() => updateItemStatus(order.id, item, 'READY')}
                                                                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-bold text-sm shadow-sm transition-all active:scale-95 flex items-center gap-1"
                                                                    >
                                                                        <CheckCircle size={14} /> Done
                                                                    </button>
                                                                )}
                                                                {status === 'READY' && (
                                                                    <div className="flex items-center gap-1 text-green-600 font-bold text-xs">
                                                                        <CheckCircle size={14} /> Ready
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {kitchenNote && (
                                        <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                                            <p className="text-sm font-black text-orange-700 uppercase tracking-wider mb-1">Kitchen Note:</p>
                                            <p className="text-lg font-bold text-orange-900 leading-tight">
                                                {kitchenNote}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
