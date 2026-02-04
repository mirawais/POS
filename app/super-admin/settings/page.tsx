'use client';

export default function SuperAdminSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-gray-500">Manage your general preferences.</p>
            </div>

            <div className="grid gap-6">
                <div className="p-6 bg-white rounded-lg shadow-sm border">
                    <h2 className="text-lg font-semibold mb-4">General Settings</h2>
                    <p className="text-sm text-gray-500">No general settings available at this time.</p>
                </div>
            </div>
        </div>
    );
}
