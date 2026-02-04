'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Trash2, Edit } from 'lucide-react';

export default function ClientUsersPage() {
    const params = useParams() as any;
    const router = useRouter();
    const clientId = params?.clientId;
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [formData, setFormData] = useState<{
        name: string;
        email: string;
        password: string;
        role: string;
        permissions?: {
            manage_products: boolean;
            delete_products: boolean;
            manage_inventory: boolean;
            view_reports: boolean;
            manage_coupons: boolean;
            manage_fbr: boolean;
            manage_receipt_settings: boolean;
            manage_tax_settings: boolean;
            manage_variant_settings: boolean;
            manage_general_settings: boolean;
            view_orders: boolean;
            delete_orders: boolean;
        }
    }>({ name: '', email: '', password: '', role: 'CASHIER' });
    const [submitting, setSubmitting] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/users?clientId=${clientId}`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [clientId]);

    const resetForm = () => {
        setFormData({
            name: '', email: '', password: '', role: 'CASHIER', permissions: {
                manage_products: true,
                delete_products: false,
                manage_inventory: true,
                view_reports: true,
                manage_coupons: true,
                manage_fbr: false,
                manage_receipt_settings: false,
                manage_tax_settings: false,
                manage_variant_settings: false,
                manage_general_settings: false,
                view_orders: true,
                delete_orders: false,
            }
        });
        setEditingUser(null);
        setShowForm(false);
    };

    const handleEdit = (user: any) => {
        setEditingUser(user);
        setFormData({
            name: user.name || '',
            email: user.email,
            password: '', // Leave blank to keep existing
            role: user.role,
            permissions: user.permissions || {
                manage_products: true,
                delete_products: false,
                manage_inventory: true,
                view_reports: true,
                manage_coupons: true,
                manage_fbr: false,
                manage_receipt_settings: false,
                manage_tax_settings: false,
                manage_variant_settings: false,
                manage_general_settings: false,
                view_orders: true,
                delete_orders: false,
            }
        });
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload: any = {
                ...formData,
                clientId: clientId, // Explicitly set scope
            };

            // Remove password if empty during edit
            if (editingUser && !payload.password) {
                delete payload.password;
            }

            let res;
            if (editingUser) {
                res = await fetch('/api/users', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingUser.id, ...payload }),
                });
            } else {
                res = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }

            const data = await res.json();
            if (res.ok) {
                resetForm();
                fetchUsers();
            } else {
                alert(data.error || 'Failed to save user');
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
        try {
            const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchUsers();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete user');
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred');
        }
    };

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
                    <h1 className="text-2xl font-bold">Client Users</h1>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <UserPlus className="h-4 w-4" />
                    Add User
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <h3 className="font-semibold mb-4">{editingUser ? 'Edit User' : 'Create New User'}</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Name"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                        <div className="flex flex-col">
                            <input
                                type="password"
                                placeholder={editingUser ? "Password (leave blank to keep)" : "Password (min 6 chars)"}
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                required={!editingUser}
                                minLength={editingUser ? 0 : 6}
                            />
                        </div>
                        <select
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        >
                            <option value="CASHIER">Cashier</option>
                            <option value="MANAGER">Manager</option>
                            <option value="ADMIN">Admin</option>
                        </select>

                        {formData.role === 'MANAGER' && (
                            <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h4 className="font-semibold text-sm mb-3 text-gray-700">Manager Permissions</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={(formData as any).permissions?.manage_products ?? true}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                permissions: {
                                                    ...(formData as any).permissions,
                                                    manage_products: e.target.checked
                                                }
                                            })}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        Manage Products (Add/Edit)
                                    </label>
                                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={(formData as any).permissions?.delete_products ?? false}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                permissions: {
                                                    ...(formData as any).permissions,
                                                    delete_products: e.target.checked
                                                }
                                            })}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        Delete Products
                                    </label>
                                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={(formData as any).permissions?.manage_inventory ?? true}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                permissions: {
                                                    ...(formData as any).permissions,
                                                    manage_inventory: e.target.checked
                                                }
                                            })}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        Manage Inventory
                                    </label>
                                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={(formData as any).permissions?.manage_coupons ?? true}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                permissions: {
                                                    ...(formData as any).permissions,
                                                    manage_coupons: e.target.checked
                                                }
                                            })}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        Manage Coupons
                                    </label>
                                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={(formData as any).permissions?.manage_fbr ?? false}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                permissions: {
                                                    ...(formData as any).permissions,
                                                    manage_fbr: e.target.checked
                                                }
                                            })}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        FBR Integration
                                    </label>
                                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={(formData as any).permissions?.manage_receipt_settings ?? false}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                permissions: {
                                                    ...(formData as any).permissions,
                                                    manage_receipt_settings: e.target.checked
                                                }
                                            })}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        Receipt Settings
                                    </label>
                                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={(formData as any).permissions?.manage_tax_settings ?? false}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                permissions: {
                                                    ...(formData as any).permissions,
                                                    manage_tax_settings: e.target.checked
                                                }
                                            })}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        Tax Settings
                                    </label>
                                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={(formData as any).permissions?.manage_variant_settings ?? false}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                permissions: {
                                                    ...(formData as any).permissions,
                                                    manage_variant_settings: e.target.checked
                                                }
                                            })}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        Variant Attributes
                                    </label>
                                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={(formData as any).permissions?.manage_general_settings ?? false}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                permissions: {
                                                    ...(formData as any).permissions,
                                                    manage_general_settings: e.target.checked
                                                }
                                            })}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        General Settings
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                                {submitting ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 font-semibold text-gray-700">Name</th>
                            <th className="px-6 py-3 font-semibold text-gray-700">Email</th>
                            <th className="px-6 py-3 font-semibold text-gray-700">Role</th>
                            <th className="px-6 py-3 font-semibold text-gray-700">Joined</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading users...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No users found.</td></tr>
                        ) : (
                            users.map((u) => (
                                <tr key={u.id} className="hover:bg-gray-50 group">
                                    <td className="px-6 py-3 font-medium text-gray-900">{u.name}</td>
                                    <td className="px-6 py-3 text-gray-600">{u.email}</td>
                                    <td className="px-6 py-3">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(u)}
                                                className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                                title="Edit User"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(u.id)}
                                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                title="Delete User"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
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
