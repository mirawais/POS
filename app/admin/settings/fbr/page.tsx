'use client';

import { useEffect, useState } from 'react';
import { AdminHeader } from '@/components/layout/AdminHeader';

type FBRSetting = {
  id: string;
  url: string;
  bearerToken: string;
  posId: string;
  usin: string;
  paymentMode: number;
  invoiceType: number;
};

export default function AdminFBRSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<FBRSetting>({
    id: '',
    url: 'https://esp.fbr.gov.pk:8244/FBR/v1/api/Live/PostData',
    bearerToken: '',
    posId: '',
    usin: 'USIN0',
    paymentMode: 2,
    invoiceType: 1,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fbr-settings');
      if (!res.ok) throw new Error('Failed to load FBR settings');
      const data = await res.json();
      // If bearerToken is masked, we need to handle it differently
      // For now, we'll load it but user will need to re-enter if it's masked
      setSettings({
        ...data,
        bearerToken: data.bearerToken?.endsWith('...') ? '' : data.bearerToken || '',
      });
    } catch (err: any) {
      setMessage(err.message || 'Failed to load FBR settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/fbr-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save FBR settings');
      }

      setMessage('FBR settings saved successfully!');
      await loadSettings(); // Reload to get updated data
    } catch (err: any) {
      setMessage(err.message || 'Failed to save FBR settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="FBR Integration" />
      <div className="p-6 space-y-6">

        {message && (
          <div className={`p-3 rounded ${message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-gray-600">Loading FBR settings...</p>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 border rounded bg-white space-y-4">
            <div className="space-y-4">
              <label className="space-y-1 block">
                <span className="text-sm text-gray-700 font-medium">FBR API URL *</span>
                <input
                  type="url"
                  value={settings.url}
                  onChange={(e) => setSettings({ ...settings, url: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="https://esp.fbr.gov.pk:8244/FBR/v1/api/Live/PostData"
                  required
                />
                <p className="text-xs text-gray-500">The FBR API endpoint URL</p>
              </label>

              <label className="space-y-1 block">
                <span className="text-sm text-gray-700 font-medium">Bearer Token *</span>
                <input
                  type="text"
                  value={settings.bearerToken}
                  onChange={(e) => setSettings({ ...settings, bearerToken: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Enter FBR API Bearer Token"
                  required
                />
                <p className="text-xs text-gray-500">API authorization token for FBR</p>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1 block">
                  <span className="text-sm text-gray-700 font-medium">POS ID *</span>
                  <input
                    type="text"
                    value={settings.posId}
                    onChange={(e) => setSettings({ ...settings, posId: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="e.g., 818258"
                    required
                  />
                  <p className="text-xs text-gray-500">Point of Sale identifier</p>
                </label>

                <label className="space-y-1 block">
                  <span className="text-sm text-gray-700 font-medium">USIN</span>
                  <input
                    type="text"
                    value={settings.usin}
                    onChange={(e) => setSettings({ ...settings, usin: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="USIN0"
                  />
                  <p className="text-xs text-gray-500">Unique system identifier (default: USIN0)</p>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/*
              <label className="space-y-1 block">
                <span className="text-sm text-gray-700 font-medium">Payment Mode *</span>
                <select
                  value={settings.paymentMode}
                  onChange={(e) => setSettings({ ...settings, paymentMode: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                  required
                >
                  <option value={1}>1 - Cash</option>
                  <option value={2}>2 - Card</option>
                </select>
                <p className="text-xs text-gray-500">Payment type code (1 = Cash, 2 = Card)</p>
              </label>
              */}

                <label className="space-y-1 block">
                  <span className="text-sm text-gray-700 font-medium">Invoice Type *</span>
                  <select
                    value={settings.invoiceType}
                    onChange={(e) => setSettings({ ...settings, invoiceType: Number(e.target.value) })}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    <option value={1}>1 - Standard Invoice</option>
                  </select>
                  <p className="text-xs text-gray-500">Invoice type code</p>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save FBR Settings'}
              </button>
              <button
                type="button"
                onClick={loadSettings}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

