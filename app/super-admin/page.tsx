'use client';

import { useState, useEffect } from 'react';
import { Plus, Building2, Users, ShoppingCart, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ClientStats {
    users: number;
    products: number;
    sales: number;
}

interface Client {
    id: string;
    name: string;
    createdAt: string;
    _count: ClientStats;
}

export default function SuperAdminDashboard() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const res = await fetch('/api/clients');
            if (res.ok) {
                const data = await res.json();
                setClients(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const createClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClientName.trim()) return;

        setCreating(true);
        try {
            const res = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newClientName }),
            });

            if (res.ok) {
                setNewClientName('');
                setShowCreate(false);
                fetchClients();
            } else {
                alert('Failed to create client');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Tenants</h2>
                    <p className="text-muted-foreground text-gray-500">Manage your business clients and vendors.</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Add Client
                </button>
            </div>

            {showCreate && (
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <h3 className="font-semibold mb-4">Create New Client</h3>
                    <form onSubmit={createClient} className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Business Name"
                            value={newClientName}
                            onChange={e => setNewClientName(e.target.value)}
                            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={creating}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            {creating ? 'Creating...' : 'Create'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowCreate(false)}
                            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 bg-gray-100 animate-pulse rounded-xl"></div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map((client) => (
                        <div key={client.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Building2 className="h-6 w-6" />
                                </div>
                                <div className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded">
                                    {client.id.slice(-8)}
                                </div>
                            </div>

                            <h3 className="font-bold text-lg mb-1 group-hover:text-blue-600 transition-colors">{client.name}</h3>
                            <p className="text-sm text-gray-500 mb-6">Created {new Date(client.createdAt).toLocaleDateString()}</p>

                            <div className="grid grid-cols-3 gap-2 mb-6 border-t border-b border-gray-100 py-4">
                                <div className="text-center">
                                    <div className="flex justify-center text-gray-400 mb-1"><Users className="h-4 w-4" /></div>
                                    <div className="font-semibold">{client._count.users}</div>
                                    <div className="text-xs text-gray-500">Users</div>
                                </div>
                                <div className="text-center border-l border-gray-100">
                                    <div className="flex justify-center text-gray-400 mb-1"><ShoppingCart className="h-4 w-4" /></div>
                                    <div className="font-semibold">{client._count.products}</div>
                                    <div className="text-xs text-gray-500">Products</div>
                                </div>
                                <div className="text-center border-l border-gray-100">
                                    <div className="flex justify-center text-gray-400 mb-1"><ArrowRight className="h-4 w-4" /></div>
                                    <div className="font-semibold">{client._count.sales}</div>
                                    <div className="text-xs text-gray-500">Sales</div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Link
                                    href={`/super-admin/client/${client.id}`}
                                    className="flex-1 text-center py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                >
                                    Manage Details
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
