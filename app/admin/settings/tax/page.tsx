'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/notifications/ToastContainer';
import { AdminHeader } from '@/components/layout/AdminHeader';

type Tax = {
  id: string;
  name: string;
  percent: number;
  isDefault: boolean;
  isActive: boolean;
};

export default function AdminTaxSettingsPage() {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(false);
  const [taxMode, setTaxMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('EXCLUSIVE');
  const [formData, setFormData] = useState({ name: '', percent: '', isDefault: false });
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadTaxes();
    loadTaxMode();
  }, []);

  const loadTaxes = async () => {
    try {
      const res = await fetch('/api/taxes');
      if (!res.ok) throw new Error('Failed to load taxes');
      const data = await res.json();
      setTaxes(data);
    } catch (e: any) {
      showError(e.message || 'Failed to load taxes');
    }
  };

  const loadTaxMode = async () => {
    try {
      const res = await fetch('/api/invoice-settings');
      if (!res.ok) throw new Error('Failed to load tax mode');
      const data = await res.json();
      setTaxMode(data.taxMode === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE');
    } catch (e: any) {
      // Ignore error, use default
    }
  };

  const handleCreateTax = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/taxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          percent: Number(formData.percent),
          isDefault: formData.isDefault,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create tax');
      }
      showSuccess('Tax created successfully');
      setFormData({ name: '', percent: '', isDefault: false });
      loadTaxes();
    } catch (e: any) {
      showError(e.message || 'Failed to create tax');
    } finally {
      setLoading(false);
    }
  };

  const handleMakeDefault = async (id: string) => {
    try {
      const res = await fetch('/api/taxes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, setDefault: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update tax');
      }
      showSuccess('Default tax updated successfully');
      loadTaxes();
    } catch (e: any) {
      showError(e.message || 'Failed to update tax');
    }
  };

  const handleDeleteTax = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tax slab? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/taxes?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete tax');
      }
      showSuccess('Tax deleted successfully');
      loadTaxes();
    } catch (e: any) {
      showError(e.message || 'Failed to delete tax');
    }
  };

  const handleTaxModeChange = async (mode: 'EXCLUSIVE' | 'INCLUSIVE') => {
    setLoading(true);
    try {
      // Fetch current invoice settings
      const settingsRes = await fetch('/api/invoice-settings');
      const currentSettings = await settingsRes.json();
      
      // Update tax mode
      const res = await fetch('/api/invoice-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentSettings,
          taxMode: mode,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update tax mode');
      }
      setTaxMode(mode);
      showSuccess(`Tax mode changed to ${mode === 'INCLUSIVE' ? 'Tax Inclusive' : 'Tax Exclusive'}`);
    } catch (e: any) {
      showError(e.message || 'Failed to update tax mode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Tax Settings" />
      <div className="p-6 space-y-6">
        {/* Tax Mode Selection */}
        <div className="p-4 border rounded bg-white">
          <h2 className="font-semibold mb-3">Global Tax Pricing Mode</h2>
          <p className="text-sm text-gray-600 mb-3">
            This setting applies globally to all products, carts, invoices, and reports.
          </p>
          <div className="space-y-2">
          <label className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="taxMode"
              value="EXCLUSIVE"
              checked={taxMode === 'EXCLUSIVE'}
              onChange={() => handleTaxModeChange('EXCLUSIVE')}
              disabled={loading}
              className="h-4 w-4"
            />
            <div>
              <span className="font-medium">Tax Exclusive</span>
              <p className="text-xs text-gray-600">Product price is net price. Tax is added on top.</p>
            </div>
          </label>
          <label className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="taxMode"
              value="INCLUSIVE"
              checked={taxMode === 'INCLUSIVE'}
              onChange={() => handleTaxModeChange('INCLUSIVE')}
              disabled={loading}
              className="h-4 w-4"
            />
            <div>
              <span className="font-medium">Tax Inclusive</span>
              <p className="text-xs text-gray-600">Product price includes tax. Tax is deducted using reverse calculation.</p>
            </div>
          </label>
          </div>
        </div>

        {/* Add Tax Form */}
        <form onSubmit={handleCreateTax} className="p-4 border rounded space-y-3 bg-white">
        <h2 className="font-semibold">Add Tax Slab</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-sm text-gray-700">Name</span>
            <input
              name="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
              placeholder="e.g., GST 13%"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-700">Percent</span>
            <input
              name="percent"
              type="number"
              step="0.01"
              min="0"
              value={formData.percent}
              onChange={(e) => setFormData({ ...formData, percent: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
              placeholder="13"
            />
          </label>
          <label className="flex items-center gap-2 mt-6">
            <input
              name="isDefault"
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm text-gray-700">Set as default</span>
          </label>
        </div>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Saving...' : 'Save Tax'}
        </button>
        </form>

        {/* Existing Taxes */}
        <div className="p-4 border rounded bg-white">
        <h2 className="font-semibold mb-3">Existing Tax Slabs</h2>
        <div className="space-y-2">
          {taxes.length === 0 ? (
            <p className="text-sm text-gray-600">No taxes yet. Add a tax slab above.</p>
          ) : (
            taxes.map((tax) => (
              <div key={tax.id} className="flex items-center justify-between border rounded px-3 py-2">
                <div>
                  <div className="font-medium">
                    {tax.name}
                    {tax.isDefault && <span className="ml-2 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">Default</span>}
                  </div>
                  <div className="text-sm text-gray-600">{Number(tax.percent).toFixed(2)}%</div>
                </div>
                <div className="flex gap-2">
                  {!tax.isDefault && (
                    <button
                      onClick={() => handleMakeDefault(tax.id)}
                      className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
                    >
                      Make default
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteTax(tax.id)}
                    className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
