'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { UserProfileDropdown } from '@/components/layout/UserProfileDropdown';

function SuperAdminNav() {
    return (
        <nav className="bg-slate-900 text-white p-4 shadow-md">
            <div className="container mx-auto flex justify-between items-center">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <LayoutDashboard className="h-6 w-6" />
                        <h1 className="text-xl font-bold">Super Admin</h1>
                    </div>
                    <div className="flex items-center gap-4 border-l border-slate-700 pl-6">
                        <Link href="/super-admin" className="hover:text-blue-400 text-sm font-medium transition-colors">Tenants</Link>
                        <Link href="/super-admin/orders" className="hover:text-blue-400 text-sm font-medium transition-colors">Orders</Link>
                        <Link href="/super-admin/reports" className="hover:text-blue-400 text-sm font-medium transition-colors">Global Reports</Link>
                        <Link href="/super-admin/settings" className="hover:text-blue-400 text-sm font-medium transition-colors">Settings</Link>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <UserProfileDropdown />
                </div>
            </div>
        </nav>
    );
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <div className="min-h-screen bg-gray-100 font-sans">
                <SuperAdminNav />
                <main className="container mx-auto p-6">
                    {children}
                </main>
            </div>
        </SessionProvider>
    );
}
