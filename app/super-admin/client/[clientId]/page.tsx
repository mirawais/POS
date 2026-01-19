'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Package, ShoppingCart } from 'lucide-react';
import { useToast } from '@/components/notifications/ToastContainer';
import ConfirmationModal from '@/components/ConfirmationModal';

export default function ClientDetailsPage() {
    const params = useParams() as any;
    const router = useRouter();
    const clientId = params?.clientId;
    const [client, setClient] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        name: '',
        companyName: '',
        contactNumber: '',
        techContact: '',
        email: '',
        address: '',
        isActive: true,
        activeDate: '',
        inactiveDate: ''
    });
    const { showSuccess, showError } = useToast();
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        const fetchClient = async () => {
            try {
                const res = await fetch(`/api/clients/${clientId}`);
                if (res.ok) {
                    const data = await res.json();
                    setClient(data);
                    setEditData({
                        name: data.name || '',
                        companyName: data.companyName || '',
                        contactNumber: data.contactNumber || '',
                        techContact: data.techContact || '',
                        email: data.email || '',
                        address: data.address || '',
                        isActive: data.isActive,
                        activeDate: data.activeDate,
                        inactiveDate: data.inactiveDate,
                    });
                }
            } catch (err) {
                console.error(err);
                showError('Failed to fetch client details');
            } finally {
                setLoading(false);
            }
        };
        if (clientId) fetchClient();
    }, [clientId]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/clients/${clientId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editData),
            });
            if (res.ok) {
                const updated = await res.json();
                setClient({ ...client, ...updated });
                setIsEditing(false);
                showSuccess('Client updated successfully');
            } else {
                showError('Failed to update client');
            }
        } catch (err) {
            console.error(err);
            showError('Error updating client');
        }
    };

    const handleDelete = async () => {
        try {
            const res = await fetch(`/api/clients?id=${clientId}`, { method: 'DELETE' });
            if (res.ok) {
                showSuccess('Client deleted successfully');
                router.push('/super-admin');
            } else {
                const err = await res.json();
                showError('Failed to delete client: ' + (err.error || 'Unknown error'));
            }
        } catch (e) {
            showError('Failed to delete client');
        } finally {
            setIsDeleteModalOpen(false);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!client) return <div>Client not found</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-200 rounded-full"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold">{client.name}</h1>
                        <div className="flex gap-2 text-xs font-mono text-gray-500">
                            <span className="bg-gray-100 px-2 py-1 rounded">ID: {client.id}</span>
                            {client.companyName && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">{client.companyName}</span>}
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
                >
                    {isEditing ? 'Cancel Edit' : 'Edit Information'}
                </button>
            </div>

            {isEditing ? (
                <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm ring-1 ring-blue-100">
                    <h3 className="font-semibold mb-4 text-blue-900">Edit Client Information</h3>
                    <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Client Name</label>
                            <input
                                type="text"
                                value={editData.name}
                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Company Name</label>
                            <input
                                type="text"
                                value={editData.companyName}
                                onChange={(e) => setEditData({ ...editData, companyName: e.target.value })}
                                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Contact Number</label>
                            <input
                                type="text"
                                value={editData.contactNumber}
                                onChange={(e) => setEditData({ ...editData, contactNumber: e.target.value })}
                                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Technical Contact</label>
                            <input
                                type="text"
                                value={editData.techContact}
                                onChange={(e) => setEditData({ ...editData, techContact: e.target.value })}
                                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Email Address</label>
                            <input
                                type="email"
                                value={editData.email}
                                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Address</label>
                            <input
                                type="text"
                                value={editData.address}
                                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="space-y-1 md:col-span-2 border-t pt-4 mt-2">
                            <div className="flex items-center gap-2 mb-4">
                                <label className="text-sm font-medium text-gray-900">Account Status:</label>
                                <button
                                    type="button"
                                    onClick={() => setEditData({ ...editData, isActive: !editData.isActive } as any)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editData.isActive ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                                <span className="text-sm font-medium text-gray-700">{editData.isActive ? 'Active' : 'Deactivated'}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">Active Date (Start)</label>
                                    <input
                                        type="date"
                                        value={(editData as any).activeDate ? new Date((editData as any).activeDate).toISOString().split('T')[0] : ''}
                                        onChange={e => setEditData({ ...editData, activeDate: e.target.value } as any)}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">Inactive Date (Optional End)</label>
                                    <input
                                        type="date"
                                        value={(editData as any).inactiveDate ? new Date((editData as any).inactiveDate).toISOString().split('T')[0] : ''}
                                        onChange={e => setEditData({ ...editData, inactiveDate: e.target.value || null } as any)}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                            <button
                                type="submit"
                                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-semibold text-lg">Contact Information</h3>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${client.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {client.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                        <div>
                            <div className="text-gray-500 mb-1">Company</div>
                            <div className="font-medium">{client.companyName || '-'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 mb-1">Contact Number</div>
                            <div className="font-medium">{client.contactNumber || '-'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 mb-1">Email</div>
                            <div className="font-medium">{client.email || '-'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 mb-1">Account Active Since</div>
                            <div className="font-medium">{client.activeDate ? new Date(client.activeDate).toLocaleDateString() : 'N/A'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 mb-1">Account Expires On</div>
                            <div className={`font-medium ${client.inactiveDate && new Date(client.inactiveDate) < new Date() ? 'text-red-600' : ''}`}>
                                {client.inactiveDate ? new Date(client.inactiveDate).toLocaleDateString() : 'Never'}
                            </div>
                        </div>
                        <div>
                            <div className="text-gray-500 mb-1">Tech Contact</div>
                            <div className="font-medium">{client.techContact || '-'}</div>
                        </div>
                        <div className="md:col-span-3">
                            <div className="text-gray-500 mb-1">Address</div>
                            <div className="font-medium">{client.address || '-'}</div>
                        </div>
                    </div>
                </div>
            )}

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
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                        Delete Client
                    </button>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                title="Delete Client"
                message="EXTREME WARNING: You are about to delete this client and ALL related data (users, products, sales). This action CANNOT be undone. Are you absolutely sure?"
                onConfirm={handleDelete}
                onCancel={() => setIsDeleteModalOpen(false)}
                confirmVariant="danger"
                confirmText="Delete Client"
            />
        </div>
    );
}
