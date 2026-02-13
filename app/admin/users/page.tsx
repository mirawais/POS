'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AdminHeader } from '@/components/layout/AdminHeader';

type p = {
  manage_products: boolean;
  delete_products: boolean;
  manage_inventory: boolean; // Kept for backward compatibility or general inventory
  manage_categories: boolean;
  delete_categories: boolean;
  manage_raw_materials: boolean;
  delete_raw_materials: boolean;
  delete_variant_attributes: boolean;
  view_reports: boolean;
  manage_coupons: boolean;
  manage_fbr: boolean;
  manage_receipt_settings: boolean;
  manage_tax_settings: boolean;
  manage_variant_settings: boolean;
  manage_general_settings: boolean;
  view_orders: boolean;
  delete_orders: boolean;
};

type User = {
  id: string;
  email: string;
  name: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER' | 'MANAGER' | 'WAITER' | 'KITCHEN';
  permissions?: p;
  createdAt: string;
  updatedAt: string;
};

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const defaultPermissions: p = {
    manage_products: true,
    delete_products: false,
    manage_inventory: true,
    manage_categories: true,
    delete_categories: false,
    manage_raw_materials: true,
    delete_raw_materials: false,
    delete_variant_attributes: false,
    view_reports: true,
    manage_coupons: true,
    manage_fbr: false,
    manage_receipt_settings: false,
    manage_tax_settings: false,
    manage_variant_settings: false,
    manage_general_settings: false,
    view_orders: true,
    delete_orders: false,
  };

  const [formData, setFormData] = useState<{
    email: string;
    name: string;
    password: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER' | 'MANAGER' | 'WAITER' | 'KITCHEN';
    permissions?: p;
  }>({
    email: '',
    name: '',
    password: '',
    role: 'CASHIER',
    permissions: { ...defaultPermissions }
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setMessage(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      password: '',
      role: 'CASHIER',
      permissions: { ...defaultPermissions }
    });
    setEditingUser(null);
    setShowForm(false);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    // Merge existing permissions with defaults to ensure all keys are present
    const mergedPermissions = user.permissions
      ? { ...defaultPermissions, ...user.permissions }
      : { ...defaultPermissions };

    setFormData({
      email: user.email,
      name: user.name || '',
      password: '', // Don't pre-fill password
      role: user.role,
      permissions: mergedPermissions
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const payload: any = {
        email: formData.email,
        name: formData.name || null,
        role: formData.role,
        permissions: formData.role === 'MANAGER' ? formData.permissions : undefined,
      };

      // Only include password if provided (for new users or when updating)
      if (!editingUser || formData.password) {
        if (!formData.password || formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        payload.password = formData.password;
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

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save user');
      }

      setMessage(editingUser ? 'User updated successfully' : 'User created successfully');
      resetForm();
      loadUsers();
    } catch (e: any) {
      setMessage(e.message || 'Failed to save user');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }
      setMessage('User deleted successfully');
      loadUsers();
    } catch (e: any) {
      setMessage(e.message || 'Failed to delete user');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="User Management" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add User
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        {showForm && (
          <div className="p-4 border rounded bg-white">
            <h2 className="text-lg font-semibold mb-4">{editingUser ? 'Edit User' : 'Add New User'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Full Name (optional)"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Password {editingUser ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder={editingUser ? 'Enter new password (optional)' : 'Minimum 6 characters'}
                  minLength={editingUser ? 0 : 6}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="CASHIER">Cashier</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                  {(session?.user?.businessType === 'RESTAURANT' || session?.user?.role === 'SUPER_ADMIN') && (
                    <>
                      <option value="WAITER">Waiter</option>
                      <option value="KITCHEN">Kitchen Staff</option>
                    </>
                  )}
                  {session?.user?.role === 'SUPER_ADMIN' && (
                    <option value="SUPER_ADMIN">Super Admin</option>
                  )}
                </select>
              </div>

              {formData.role === 'MANAGER' && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-sm mb-3 text-gray-700">Manager Permissions</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.manage_products ?? true}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: {
                            ...(formData.permissions!),
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
                        checked={formData.permissions?.delete_products ?? false} // Safer default to false
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: {
                            ...(formData.permissions!),
                            delete_products: e.target.checked
                          }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Delete Products
                    </label>
                    {/* Categories */}
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.manage_categories ?? true}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...(formData.permissions!), manage_categories: e.target.checked }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Manage Categories
                    </label>
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.delete_categories ?? false}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...(formData.permissions!), delete_categories: e.target.checked }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Delete Categories
                    </label>

                    {/* Raw Materials */}
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.manage_raw_materials ?? true}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...(formData.permissions!), manage_raw_materials: e.target.checked }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Manage Raw Materials
                    </label>
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.delete_raw_materials ?? false}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...(formData.permissions!), delete_raw_materials: e.target.checked }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Delete Raw Materials
                    </label>

                    {/* Variant Attributes */}
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.manage_variant_settings ?? false}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...(formData.permissions!), manage_variant_settings: e.target.checked }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Manage Variant Attributes
                    </label>
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.delete_variant_attributes ?? false}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...(formData.permissions!), delete_variant_attributes: e.target.checked }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Delete Variant Attributes
                    </label>

                    {/* Restored checkboxes */}
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.view_reports ?? true}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...(formData.permissions!), view_reports: e.target.checked }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      View Reports
                    </label>
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.manage_coupons ?? true}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...(formData.permissions!), manage_coupons: e.target.checked }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Manage Coupons
                    </label>
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.manage_fbr ?? false}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...(formData.permissions!), manage_fbr: e.target.checked }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      FBR Integration
                    </label>
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.manage_receipt_settings ?? false}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...(formData.permissions!), manage_receipt_settings: e.target.checked }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Receipt Settings
                    </label>
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.manage_tax_settings ?? false}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...(formData.permissions!), manage_tax_settings: e.target.checked }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Tax Settings
                    </label>
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.manage_general_settings ?? false}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: {
                            ...(formData.permissions!),
                            manage_general_settings: e.target.checked
                          }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      General Settings
                    </label>
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.view_orders ?? true}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: {
                            ...(formData.permissions!),
                            view_orders: e.target.checked
                          }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      View Orders
                    </label>
                    <label className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.delete_orders ?? false}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: {
                            ...(formData.permissions!),
                            delete_orders: e.target.checked
                          }
                        })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      Delete Orders
                    </label>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  {editingUser ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={resetForm} className="px-4 py-2 border rounded hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading && <p className="text-gray-600">Loading users...</p>}
        {!loading && users.length === 0 && <p className="text-gray-600">No users found. Create your first user above.</p>}

        {!loading && users.length > 0 && (
          <div className="border rounded bg-white overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 text-sm font-medium">{user.email}</td>
                    <td className="px-4 py-3 text-sm">{user.name || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'MANAGER' ? 'bg-orange-100 text-orange-700' :
                          user.role === 'WAITER' ? 'bg-cyan-100 text-cyan-700' :
                            user.role === 'KITCHEN' ? 'bg-rose-100 text-rose-700' :
                              'bg-blue-100 text-blue-700'
                        }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


