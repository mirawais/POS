'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    // Redirect Waiters and Kitchen staff away from Admin Panel
    if (session?.user?.role === 'WAITER') {
      router.push('/cashier/billing');
    } else if (session?.user?.role === 'KITCHEN') {
      router.push('/kitchen');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminGuard>
        <div className="flex min-h-screen bg-gray-50">
          <AdminSidebar />
          <main className="flex-1 lg:ml-64">
            {children}
          </main>
        </div>
      </AdminGuard>
    </SessionProvider>
  );
}
