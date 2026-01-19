'use client';

import ChangePasswordForm from '@/components/auth/ChangePasswordForm';

export default function SuperAdminSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-gray-500">Manage your profile and security preferences.</p>
            </div>

            <div className="grid gap-6">
                <ChangePasswordForm />
            </div>
        </div>
    );
}
