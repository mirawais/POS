'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/notifications/ToastContainer';

export default function AdminSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-gray-500">Manage your general preferences.</p>
            </div>

            <div className="grid gap-6">
                {/* General Settings Section */}
                <div className="p-6 bg-white rounded-lg shadow-sm border">
                    <h2 className="text-lg font-semibold mb-4">General Settings</h2>
                    <GeneralSettingsForm />
                </div>
            </div>
        </div>
    );
}

function GeneralSettingsForm() {
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<any>(null);
    const { showSuccess, showError } = useToast();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const res = await fetch('/api/invoice-settings');
            if (!res.ok) throw new Error('Failed to load settings');
            const data = await res.json();
            setSettings(data);
        } catch (e: any) {
            console.error(e);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        setLoading(true);
        try {
            const res = await fetch('/api/invoice-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            if (!res.ok) throw new Error('Failed to save settings');
            showSuccess('General settings saved successfully');
        } catch (e: any) {
            showError(e.message || 'Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    if (!settings) return <div>Loading settings...</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border pl-4 pr-2 py-3 rounded-lg bg-gray-50">
                <div>
                    <h3 className="font-medium">Price Display Format</h3>
                    <p className="text-sm text-gray-500">Show decimals in prices (e.g. 2500.00 vs 2500)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.showPriceDecimals !== false}
                        onChange={(e) => setSettings({ ...settings, showPriceDecimals: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div className="flex items-center justify-between border pl-4 pr-2 py-3 rounded-lg bg-gray-50">
                <div>
                    <h3 className="font-medium">Day Closing Time</h3>
                    <p className="text-sm text-gray-500">Time when the business day ends (e.g., 02:00 AM)</p>
                </div>
                <input
                    type="time"
                    value={settings.dayClosingTime || '00:00'}
                    onChange={(e) => setSettings({ ...settings, dayClosingTime: e.target.value })}
                    className="border rounded px-3 py-2"
                />
            </div>

            <div className="flex justify-end pt-2">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                    {loading ? 'Saving...' : 'Save Preferences'}
                </button>
            </div>
        </div>
    );
}
