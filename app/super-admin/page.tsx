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
    companyName?: string;
    contactNumber?: string;
    techContact?: string;
    email?: string;
    address?: string;
    createdAt: string;
    _count: ClientStats;
}

import { useToast } from '@/components/notifications/ToastContainer';

export default function SuperAdminDashboard() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newClientData, setNewClientData] = useState({
        name: '',
        companyName: '',
        contactNumber: '',
        techContact: '',
        email: '',
        address: '',
        businessType: 'GROCERY'
    });
    const [creating, setCreating] = useState(false);
    const { showSuccess, showError } = useToast();

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
            showError("Failed to fetch clients.");
        } finally {
            setLoading(false);
        }
    };

    const createClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClientData.name.trim()) {
            showError("Client Name cannot be empty.");
            return;
        }

        setCreating(true);
        try {
            const res = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newClientData),
            });

            if (res.ok) {
                setNewClientData({ name: '', companyName: '', contactNumber: '', techContact: '', email: '', address: '', businessType: 'GROCERY' });
                setShowCreate(false);
                fetchClients();
                showSuccess("Client created successfully.");
            } else {
                const errorData = await res.json();
                showError(errorData.message || "Failed to create client.");
            }
        } catch (err) {
            console.error(err);
            showError("An error occurred while creating the client.");
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
                    <form onSubmit={createClient} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Client Name *</label>
                                <input
                                    type="text"
                                    placeholder="Client Name"
                                    value={newClientData.name}
                                    onChange={e => setNewClientData({ ...newClientData, name: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Company Name (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Company Name"
                                    value={newClientData.companyName}
                                    onChange={e => setNewClientData({ ...newClientData, companyName: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Contact Number (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Contact Number"
                                    value={newClientData.contactNumber}
                                    onChange={e => setNewClientData({ ...newClientData, contactNumber: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Business Type</label>
                                <select
                                    value={newClientData.businessType}
                                    onChange={e => setNewClientData({ ...newClientData, businessType: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="GROCERY">Grocery / Retail</option>
                                    <option value="RESTAURANT">Restaurant / Cafe</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Technical Contact (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Tech Contact"
                                    value={newClientData.techContact}
                                    onChange={e => setNewClientData({ ...newClientData, techContact: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Email Address (Optional)</label>
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={newClientData.email}
                                    onChange={e => setNewClientData({ ...newClientData, email: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Mailing Address (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Address"
                                    value={newClientData.address}
                                    onChange={e => setNewClientData({ ...newClientData, address: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Active Date (Start)</label>
                                <input
                                    type="date"
                                    value={(newClientData as any).activeDate || new Date().toISOString().split('T')[0]}
                                    onChange={e => setNewClientData({ ...newClientData, activeDate: e.target.value } as any)}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Inactive Date (Optional End)</label>
                                <input
                                    type="date"
                                    value={(newClientData as any).inactiveDate || ''}
                                    onChange={e => setNewClientData({ ...newClientData, inactiveDate: e.target.value } as any)}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <p className="text-xs text-gray-500">Leave empty for unlimited duration</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={creating}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                                {creating ? 'Creating...' : 'Create Client'}
                            </button>
                        </div>
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
                                <div className="text-right">
                                    <div className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded inline-block mb-1">
                                        {client.id.slice(-8)}
                                    </div>
                                    <div>
                                        {(() => {
                                            const now = new Date();
                                            const activeDate = (client as any).activeDate ? new Date((client as any).activeDate) : new Date(0);
                                            const inactiveDate = (client as any).inactiveDate ? new Date((client as any).inactiveDate) : null;
                                            const isActive = (client as any).isActive;

                                            let status = 'ACTIVE';
                                            let color = 'bg-green-100 text-green-800';

                                            if (!isActive) {
                                                status = 'DISABLED';
                                                color = 'bg-red-100 text-red-800';
                                            } else if (activeDate > now) {
                                                status = 'SCHEDULED';
                                                color = 'bg-yellow-100 text-yellow-800';
                                            } else if (inactiveDate && inactiveDate < now) {
                                                status = 'EXPIRED';
                                                color = 'bg-red-100 text-red-800';
                                            }

                                            return (
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${color}`}>
                                                    {status}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <h3 className="font-bold text-lg mb-1 group-hover:text-blue-600 transition-colors">{client.name}</h3>
                            <p className="text-sm text-gray-500 mb-6">Created {new Date(client.createdAt).toLocaleDateString()}</p>

                            {(client as any).companyName && (
                                <p className="text-xs text-gray-500 font-medium -mt-4 mb-4">
                                    {(client as any).companyName}
                                </p>
                            )}

                            <div className="mb-4">
                                <span className={`text-[10px] px-2 py-1 rounded-full font-medium border ${(client as any).businessType === 'RESTAURANT'
                                        ? 'bg-orange-50 text-orange-600 border-orange-100'
                                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    }`}>
                                    {(client as any).businessType || 'GROCERY'}
                                </span>
                            </div>

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
