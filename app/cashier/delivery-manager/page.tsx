'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/notifications/ToastContainer';
import { Bike, Clock, CheckCircle, Navigation, MapPin, Phone, User, RefreshCcw, Trash2, Ban } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

type Rider = {
    id: string;
    name: string;
    status: 'FREE' | 'ON_DELIVERY';
};

const WASTE_REASONS = ['Kitchen Accident', 'Waiter Mishap', 'Rider Accident', 'Customer Refused', 'Other'] as const;
type WasteReason = typeof WASTE_REASONS[number];

type DeliveryOrder = {
    id: string;
    orderId: string;
    customerName: string | null;
    customerPhone: string | null;
    address: string | null;
    total: number;
    orderStatus: string;
    riderName: string | null;
    dispatchedAt: string | null;
    createdAt: string;
};

export default function DeliveryManagerPage() {
    const [readyOrders, setReadyOrders] = useState<DeliveryOrder[]>([]);
    const [onTheWayOrders, setOnTheWayOrders] = useState<DeliveryOrder[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [dispatchingId, setDispatchingId] = useState<string | null>(null);
    const [selectedRiderId, setSelectedRiderId] = useState<Record<string, string>>({});
    const { data: session } = useSession();
    const { showError, showSuccess } = useToast();

    // Waste Modal State
    const [wasteModal, setWasteModal] = useState({ isOpen: false, saleId: '' });
    const [selectedWasteReason, setSelectedWasteReason] = useState<WasteReason>('Kitchen Accident');
    const [wasting, setWasting] = useState(false);

    const isRestaurant = (session?.user as any)?.businessType === 'RESTAURANT';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [salesRes, ridersRes] = await Promise.all([
                fetch('/api/sales?deliveryOnly=true'), // I'll need to update the sales API to support this or just fetch all and filter
                fetch('/api/riders'),
            ]);

            if (salesRes.ok && ridersRes.ok) {
                const salesData = await salesRes.json();
                const ridersData = await ridersRes.json();

                // Filtering on frontend for now, but ideally backend should handle it
                setReadyOrders(salesData.filter((s: any) => s.orderStatus === 'READY_FOR_PICKUP'));
                setOnTheWayOrders(salesData.filter((s: any) => s.orderStatus === 'ON_THE_WAY'));
                setRiders(ridersData);
            }
        } catch (err) {
            showError('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleDispatch = async (saleId: string) => {
        const riderId = selectedRiderId[saleId];
        if (!riderId) {
            showError('Please select a rider');
            return;
        }

        setDispatchingId(saleId);
        try {
            const res = await fetch('/api/delivery/dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saleId, riderId }),
            });

            if (res.ok) {
                showSuccess('Order dispatched successfully');
                fetchData();
            } else {
                const data = await res.json();
                showError(data.error || 'Failed to dispatch order');
            }
        } catch (err) {
            showError('An error occurred during dispatch');
        } finally {
            setDispatchingId(null);
        }
    };

    const handleComplete = async (saleId: string) => {
        try {
            const res = await fetch('/api/delivery/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saleId }),
            });

            if (res.ok) {
                showSuccess('Delivery completed successfully');
                fetchData();
            } else {
                const data = await res.json();
                showError(data.error || 'Failed to complete delivery');
            }
        } catch (err) {
        }
    };

    const handleWasteClick = (saleId: string) => {
        setSelectedWasteReason('Kitchen Accident');
        setWasteModal({ isOpen: true, saleId });
    };

    const confirmWaste = async () => {
        setWasting(true);
        try {
            const res = await fetch(`/api/sales/${wasteModal.saleId}/waste`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wasteReason: selectedWasteReason }),
            });

            if (res.ok) {
                showSuccess(`Order marked as wasted: ${selectedWasteReason}`);
                setWasteModal({ isOpen: false, saleId: '' });
                fetchData();
            } else {
                const data = await res.json();
                showError(data.error || 'Failed to waste order');
            }
        } catch (err) {
            showError('An error occurred while marking as wasted');
        } finally {
            setWasting(false);
        }
    };

    if (!isRestaurant) return <div className="p-8 text-center">This feature is only available for Restaurant clients.</div>;

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Navigation className="text-blue-600" />
                        Delivery Manager
                    </h1>
                    <p className="text-gray-500 text-sm">Dispatch and track delivery orders</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors shadow-sm"
                >
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Dispatch Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-2">
                        <Bike className="text-orange-500" />
                        <h2 className="text-lg font-bold text-gray-800">Ready for Dispatch</h2>
                        <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {readyOrders.length}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {readyOrders.length === 0 ? (
                            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl py-12 text-center text-gray-500">
                                No orders ready for pickup.
                            </div>
                        ) : (
                            readyOrders.map((order) => (
                                <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-gray-900">Order #{order.orderId}</h3>
                                            <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleTimeString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-blue-600">Rs. {formatPrice(order.total)}</div>
                                            <div className="text-xs text-gray-400">Ready for {Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)}m</div>
                                        </div>
                                        <button
                                            onClick={() => handleWasteClick(order.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                            title="Mark as Wasted"
                                        >
                                            <Ban size={16} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">Customer</div>
                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                <User size={14} className="text-gray-400" />
                                                {order.customerName || 'N/A'}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                <Phone size={14} className="text-gray-400" />
                                                {order.customerPhone || 'N/A'}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">Address</div>
                                            <div className="flex items-start gap-2 text-sm font-medium">
                                                <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                                <span className="line-clamp-2">{order.address || 'No address provided'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-3 pt-2">
                                        <select
                                            value={selectedRiderId[order.id] || ''}
                                            onChange={(e) => setSelectedRiderId(prev => ({ ...prev, [order.id]: e.target.value }))}
                                            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">Select Rider...</option>
                                            {riders.filter(r => r.status === 'FREE').map(rider => (
                                                <option key={rider.id} value={rider.id}>{rider.name} (Available)</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => handleDispatch(order.id)}
                                            disabled={dispatchingId === order.id}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 disabled:opacity-50"
                                        >
                                            {dispatchingId === order.id ? 'Dispatching...' : 'Dispatch'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Tracking Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-2">
                        <Clock className="text-blue-500" />
                        <h2 className="text-lg font-bold text-gray-800">On The Way</h2>
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {onTheWayOrders.length}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {onTheWayOrders.length === 0 ? (
                            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl py-12 text-center text-gray-500">
                                No orders currently being delivered.
                            </div>
                        ) : (
                            onTheWayOrders.map((order) => (
                                <div key={order.id} className="bg-white border border-blue-100 rounded-xl p-5 shadow-sm border-l-4 border-l-blue-500 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-gray-900">Order #{order.orderId}</h3>
                                            <div className="flex items-center gap-2 text-xs text-blue-600 font-bold mt-1">
                                                <Bike size={12} />
                                                Rider: {order.riderName}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400">Dispatched at {order.dispatchedAt ? new Date(order.dispatchedAt).toLocaleTimeString() : 'N/A'}</div>
                                            <div className="text-xs font-bold text-blue-600 mt-1">
                                                {order.dispatchedAt ? `${Math.floor((Date.now() - new Date(order.dispatchedAt).getTime()) / 60000)}m on road` : ''}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleWasteClick(order.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                            title="Mark as Wasted"
                                        >
                                            <Ban size={16} />
                                        </button>
                                    </div>

                                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                        <div className="flex items-start gap-2 text-sm text-gray-700">
                                            <MapPin size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                            <span>{order.address}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleComplete(order.id)}
                                        className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-100 flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle size={18} />
                                        Confirm Delivery
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Waste/Void Modal */}
            {wasteModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Mark Order as Wasted</h3>
                        <p className="text-sm text-gray-500 mb-4">Select the reason for voiding this order.</p>
                        <div className="space-y-2 mb-6">
                            {WASTE_REASONS.map(reason => (
                                <label key={reason} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50">
                                    <input
                                        type="radio"
                                        name="wasteReason"
                                        value={reason}
                                        checked={selectedWasteReason === reason}
                                        onChange={() => setSelectedWasteReason(reason)}
                                        className="text-red-600"
                                    />
                                    <span className="text-sm font-medium text-gray-800">{reason}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setWasteModal({ isOpen: false, saleId: '' })}
                                className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmWaste}
                                disabled={wasting}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {wasting ? 'Processing...' : 'Confirm Waste'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
