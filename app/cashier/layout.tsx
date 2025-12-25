'use client';

import { SessionProvider } from 'next-auth/react';
import { CashierNav } from '@/components/nav/CashierNav';

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="space-y-6">
        <CashierNav />
        {children}
      </div>
    </SessionProvider>
  );
}

