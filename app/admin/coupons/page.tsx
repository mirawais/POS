'use client';

import { useEffect, useState } from 'react';
import { AdminHeader } from '@/components/layout/AdminHeader';

type Coupon = {
  id: string;
  code: string;
  type: 'PERCENT' | 'AMOUNT';
  value: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    type: 'PERCENT' as 'PERCENT' | 'AMOUNT',
    value: '',
    isActive: true,
    startsAt: '',
    endsAt: '',
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/coupons?includeInactive=true');
      if (!res.ok) throw new Error('Failed to load coupons');
      const data = await res.json();
      setCoupons(data);
    } catch (e: any) {
      setMessage(e.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      type: 'PERCENT',
      value: '',
      isActive: true,
      startsAt: '',
      endsAt: '',
    });
    setEditingCoupon(null);
    setShowForm(false);
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: String(coupon.value),
      isActive: coupon.isActive,
      startsAt: coupon.startsAt ? new Date(coupon.startsAt).toISOString().slice(0, 16) : '',
      endsAt: coupon.endsAt ? new Date(coupon.endsAt).toISOString().slice(0, 16) : '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const payload: any = {
        code: formData.code,
        type: formData.type,
        value: Number(formData.value),
        isActive: formData.isActive,
      };
      if (formData.startsAt) payload.startsAt = formData.startsAt;
      if (formData.endsAt) payload.endsAt = formData.endsAt;

      let res;
      if (editingCoupon) {
        res = await fetch('/api/coupons', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCoupon.id, ...payload }),
        });
      } else {
        res = await fetch('/api/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save coupon');
      }

      setMessage(editingCoupon ? 'Coupon updated successfully' : 'Coupon created successfully');
      resetForm();
      loadCoupons();
    } catch (e: any) {
      setMessage(e.message || 'Failed to save coupon');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    try {
      const res = await fetch(`/api/coupons?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete coupon');
      setMessage('Coupon deleted successfully');
      loadCoupons();
    } catch (e: any) {
      setMessage(e.message || 'Failed to delete coupon');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Coupon Management" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add Coupon
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      {showForm && (
        <div className="p-4 border rounded bg-white">
          <h2 className="text-lg font-semibold mb-4">{editingCoupon ? 'Edit Coupon' : 'Add New Coupon'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Coupon Code *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. SAVE10"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Discount Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'PERCENT' | 'AMOUNT' })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="PERCENT">Percentage (%)</option>
                  <option value="AMOUNT">Fixed Amount</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Discount Value *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder={formData.type === 'PERCENT' ? 'e.g. 10' : 'e.g. 50.00'}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Start Date (Optional)</label>
                <input
                  type="datetime-local"
                  value={formData.startsAt}
                  onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">End Date (Optional)</label>
                <input
                  type="datetime-local"
                  value={formData.endsAt}
                  onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Active
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                {editingCoupon ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 border rounded hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <p className="text-gray-600">Loading coupons...</p>}
      {!loading && coupons.length === 0 && <p className="text-gray-600">No coupons found. Create your first coupon above.</p>}

      {!loading && coupons.length > 0 && (
        <div className="border rounded bg-white overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Code</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Value</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Valid Period</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {coupons.map((coupon) => (
                <tr key={coupon.id} className={!coupon.isActive ? 'bg-gray-50' : ''}>
                  <td className="px-4 py-3 text-sm font-medium">{coupon.code}</td>
                  <td className="px-4 py-3 text-sm">{coupon.type === 'PERCENT' ? 'Percentage' : 'Fixed Amount'}</td>
                  <td className="px-4 py-3 text-sm">
                    {coupon.type === 'PERCENT' ? `${coupon.value}%` : `Rs. ${Number(coupon.value).toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${coupon.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {coupon.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {coupon.startsAt || coupon.endsAt ? (
                      <div className="text-xs">
                        {coupon.startsAt && <div>From: {new Date(coupon.startsAt).toLocaleString()}</div>}
                        {coupon.endsAt && <div>To: {new Date(coupon.endsAt).toLocaleString()}</div>}
                      </div>
                    ) : (
                      'No limit'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(coupon)}
                        className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(coupon.id)}
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

