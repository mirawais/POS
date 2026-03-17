'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/notifications/ToastContainer';
import { Bike, Plus, Edit2, Trash2, Phone, CreditCard, User } from 'lucide-react';

type Rider = {
    id: string;
    name: string;
    phone: string;
    idCard: string | null;
    status: 'FREE' | 'ON_DELIVERY';
};

export default function RiderManagementPage() {
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingRider, setEditingRider] = useState<Rider | null>(null);
    const [formData, setFormData] = useState({ name: '', phone: '', idCard: '' });
    const { data: session } = useSession();
    const { showError, showSuccess } = useToast();

    const isRestaurant = (session?.user as any)?.businessType === 'RESTAURANT';

    useEffect(() => {
        fetchRiders();
    }, []);

    const fetchRiders = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/riders');
            if (res.ok) {
                const data = await res.json();
                setRiders(data);
            }
        } catch (err) {
            showError('Failed to fetch riders');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const method = editingRider ? 'PATCH' : 'POST';
            const body = editingRider ? { ...formData, id: editingRider.id } : formData;

            const res = await fetch('/api/riders', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                showSuccess(`Rider ${editingRider ? 'updated' : 'added'} successfully`);
                setFormData({ name: '', phone: '', idCard: '' });
                setEditingRider(null);
                setShowForm(false);
                fetchRiders();
            } else {
                const data = await res.json();
                showError(data.error || 'Failed to save rider');
            }
        } catch (err) {
            showError('An error occurred while saving rider');
        }
    };

    const handleEdit = (rider: Rider) => {
        setEditingRider(rider);
        setFormData({ name: rider.name, phone: rider.phone, idCard: rider.idCard || '' });
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this rider?')) return;
        try {
            const res = await fetch(`/api/riders?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                showSuccess('Rider deleted successfully');
                fetchRiders();
            } else {
                showError('Failed to delete rider');
            }
        } catch (err) {
            showError('An error occurred while deleting rider');
        }
    };

    if (!isRestaurant) return <div className="p-8 text-center">This feature is only available for Restaurant clients.</div>;

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Bike className="text-blue-600" />
                        Rider Management
                    </h1>
                    <p className="text-gray-500 text-sm">Add and manage delivery riders</p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md shadow-blue-100"
                    >
                        <Plus size={18} />
                        Add Rider
                    </button>
                )}
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <h2 className="text-lg font-semibold mb-4">{editingRider ? 'Edit Rider' : 'Add New Rider'}</h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rider Name *</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    placeholder="e.g. John Doe"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    placeholder="e.g. 03001234567"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CNIC / ID Card</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    value={formData.idCard}
                                    onChange={(e) => setFormData({ ...formData, idCard: e.target.value })}
                                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    placeholder="e.g. 35201-1234567-1"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-3 flex justify-end gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForm(false);
                                    setEditingRider(null);
                                    setFormData({ name: '', phone: '', idCard: '' });
                                }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 text-sm font-bold"
                            >
                                {editingRider ? 'Update Rider' : 'Save Rider'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Rider Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID Card</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading riders...</td></tr>
                        ) : riders.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No riders found. Add your first rider!</td></tr>
                        ) : (
                            riders.map((rider) => (
                                <tr key={rider.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900">{rider.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{rider.phone}</td>
                                    <td className="px-6 py-4 text-gray-600">{rider.idCard || 'N/A'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${rider.status === 'FREE'
                                                ? 'bg-green-50 text-green-700 border-green-100'
                                                : 'bg-amber-50 text-amber-700 border-amber-100'
                                            }`}>
                                            {rider.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => handleEdit(rider)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Edit Rider"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(rider.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Delete Rider"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
