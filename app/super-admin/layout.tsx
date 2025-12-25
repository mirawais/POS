'use client';

import { SessionProvider, signOut, useSession } from 'next-auth/react';
import { LogOut, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

function SuperAdminNav() {
    const { data: session } = useSession();

    return (
        <nav className="bg-slate-900 text-white p-4 shadow-md">
            <div className="container mx-auto flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <LayoutDashboard className="h-6 w-6" />
                    <h1 className="text-xl font-bold">Super Admin</h1>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-400">
                        {session?.user?.email}
                    </span>
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Logout
                    </button>
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
