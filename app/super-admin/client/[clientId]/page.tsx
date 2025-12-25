'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Package, ShoppingCart } from 'lucide-react';

export default function ClientDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // We will need separate fetches or a composite API for details
    // For now, let's fetch the specific client details via the clients API (filtering) or a new endpoint
    // Simplest is to update the /api/clients to handle a single record retrieval if needed, 
    // OR just filter from the list for now if we don't have a single-get endpoint yet.
    // Actually, we can assume we need a GET /api/clients/[id] or similar. 
    // Let's implement a quick client-side filter since we lack the specific endpoint, 
    // or better, let's build the endpoint properly.
    // Wait, I can only assume endpoints I've built. I built /api/clients (GET list).
    // Ideally I should update /api/clients to support ?id=... or a dynamic route.

    useEffect(() => {
        const fetchClient = async () => {
            try {
                // Temporary: fetch all and find (not efficient but works for MVP logic)
                // Or better: update the API to support fetching one.
                const res = await fetch('/api/clients');
                if (res.ok) {
                    const data = await res.json();
                    const found = data.find((c: any) => c.id === clientId);
                    setClient(found);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchClient();
    }, [clientId]);

    if (loading) return <div>Loading...</div>;
    if (!client) return <div>Client not found</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-200 rounded-full"
                >
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <h1 className="text-2xl font-bold">{client.name}</h1>
                <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded text-gray-600">{client.id}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <Users className="h-5 w-5 text-blue-600" />
                        <h3 className="font-semibold">Users</h3>
                    </div>
                    <p className="text-3xl font-bold">{client._count.users}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <Package className="h-5 w-5 text-purple-600" />
                        <h3 className="font-semibold">Products</h3>
                    </div>
                    <p className="text-3xl font-bold">{client._count.products}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <ShoppingCart className="h-5 w-5 text-green-600" />
                        <h3 className="font-semibold">Sales</h3>
                    </div>
                    <p className="text-3xl font-bold">{client._count.sales}</p>
                </div>
            </div>

            {/* Logic to manage users would go here, fetching from /api/users?clientId={clientId} */}

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>
                <div className="flex gap-4">
                    <button
                        onClick={() => router.push(`/super-admin/client/${clientId}/products`)}
                        className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
                    >
                        View Products
                    </button>
                    <button
                        onClick={() => router.push(`/super-admin/client/${clientId}/users`)}
                        className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
                    >
                        View Users
                    </button>
                    <button
                        onClick={() => router.push(`/super-admin/client/${clientId}/sales`)}
                        className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
                    >
                        View Sales
                    </button>
                </div>
            </div>
        </div>
    );
}
