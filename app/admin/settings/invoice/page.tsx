'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/notifications/ToastContainer';
import { AdminHeader } from '@/components/layout/AdminHeader';

type CustomField = {
  label: string;
  value: string;
  sortOrder: number;
};

export default function AdminInvoiceSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [showTax, setShowTax] = useState(true);
  const [showDiscount, setShowDiscount] = useState(true);
  const [showCashier, setShowCashier] = useState(true);
  const [showCustomer, setShowCustomer] = useState(true);
  const [taxMode, setTaxMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('EXCLUSIVE');
  const [fontSize, setFontSize] = useState<number>(12);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/invoice-settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      setLogoUrl(data.logoUrl || '');
      setHeaderText(data.headerText || '');
      setFooterText(data.footerText || '');
      setShowTax(data.showTax !== false);
      setShowDiscount(data.showDiscount !== false);
      setShowCashier(data.showCashier !== false);
      setShowCustomer(data.showCustomer !== false);
      setTaxMode(data.taxMode === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE');
      setFontSize(data.fontSize || 12);
      if (data.customFields && Array.isArray(data.customFields)) {
        setCustomFields(data.customFields);
      }
    } catch (e: any) {
      showError(e.message || 'Failed to load settings');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Validate font size
      let validFontSize = Math.max(8, Math.min(20, Number(fontSize) || 12));

      const res = await fetch('/api/invoice-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: logoUrl.trim() || null,
          headerText: headerText.trim() || null,
          footerText: footerText.trim() || null,
          showTax,
          showDiscount,
          showCashier,
          showCustomer,
          taxMode,
          fontSize: validFontSize,
          customFields: customFields.length > 0 ? customFields : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save settings');
      }
      showSuccess('Invoice settings saved successfully');
    } catch (e: any) {
      showError(e.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const addCustomField = () => {
    const maxSortOrder = customFields.length > 0 ? Math.max(...customFields.map((f) => f.sortOrder)) : 0;
    setCustomFields([...customFields, { label: '', value: '', sortOrder: maxSortOrder + 1 }]);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const updateCustomField = (index: number, field: Partial<CustomField>) => {
    const updated = [...customFields];
    updated[index] = { ...updated[index], ...field };
    setCustomFields(updated);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Invoice Settings" />
      <div className="p-6 space-y-6">
        <form onSubmit={handleSubmit} className="p-4 border rounded bg-white space-y-6">
          <div>
            <h2 className="font-semibold mb-3">Layout</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-sm text-gray-700">Logo URL</span>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="https://example.com/logo.png"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-700">Header Text</span>
                <input
                  type="text"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Store Name or Header"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm text-gray-700">Footer Text</span>
                <textarea
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  placeholder="Thank you for your business!"
                />
              </label>
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-3">Receipt Font Size</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="text-sm text-gray-700">Font Size (px)</span>
                <input
                  type="number"
                  min="8"
                  max="20"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full border rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500">Global font size for printed receipts (Min: 8px, Max: 20px)</p>
              </div>
              <div className="border rounded p-4 bg-white shadow-sm flex items-center justify-center">
                <div style={{ fontSize: `${Math.max(8, Math.min(20, fontSize))}px` }} className="text-center">
                  <p className="font-bold">Simple Store</p>
                  <p>Receipt Preview</p>
                  <div className="my-1 border-t border-dashed border-gray-300 w-32 mx-auto"></div>
                  <div className="flex justify-between w-32 mx-auto">
                    <span>Item</span>
                    <span>$10.00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-3">Visibility Options</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showTax}
                  onChange={(e) => setShowTax(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">Show Tax</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showDiscount}
                  onChange={(e) => setShowDiscount(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">Show Discount</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showCashier}
                  onChange={(e) => setShowCashier(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">Show Cashier</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showCustomer}
                  onChange={(e) => setShowCustomer(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">Show Customer</span>
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Custom Fields</h2>
              <button
                type="button"
                onClick={addCustomField}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                + Add Field
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Add custom fields that will appear on every invoice. Fields are displayed in order based on sort order.
            </p>
            {customFields.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No custom fields added. Click "Add Field" to create one.</p>
            ) : (
              <div className="space-y-3">
                {customFields
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((field, index) => {
                    const originalIndex = customFields.findIndex((f) => f === field);
                    return (
                      <div key={index} className="p-3 border rounded bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                          <div className="md:col-span-4">
                            <label className="block text-xs text-gray-600 mb-1">Field Label</label>
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => updateCustomField(originalIndex, { label: e.target.value })}
                              className="w-full border rounded px-2 py-1 text-sm"
                              placeholder="e.g., Order Type"
                            />
                          </div>
                          <div className="md:col-span-5">
                            <label className="block text-xs text-gray-600 mb-1">Field Value</label>
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) => updateCustomField(originalIndex, { value: e.target.value })}
                              className="w-full border rounded px-2 py-1 text-sm"
                              placeholder="e.g., Pre-Order"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs text-gray-600 mb-1">Sort Order</label>
                            <input
                              type="number"
                              value={field.sortOrder}
                              onChange={(e) => updateCustomField(originalIndex, { sortOrder: Number(e.target.value) || 0 })}
                              className="w-full border rounded px-2 py-1 text-sm"
                              min="1"
                            />
                          </div>
                          <div className="md:col-span-1">
                            <button
                              type="button"
                              onClick={() => removeCustomField(originalIndex)}
                              className="w-full px-2 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
