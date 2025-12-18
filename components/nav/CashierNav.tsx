'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const links = [
  { href: '/cashier/billing', label: 'Billing' },
  { href: '/cashier/held-bills', label: 'Held Bills' },
  { href: '/cashier/orders', label: 'Orders' },
  { href: '/cashier/exchanges', label: 'Returns/Exchanges' },
  { href: '/cashier/refunds', label: 'Refunds' },
  { href: '/cashier/summary', label: 'Summary' },
];

export function CashierNav() {
  const pathname = usePathname();
  return (
    <header className="flex items-center justify-between bg-white border rounded px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="font-semibold text-lg">Amanat POS</div>
        <nav className="flex items-center gap-3 text-sm">
          {links.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2 py-1 rounded ${active ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-700 hover:text-blue-700'}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
      >
        Logout
      </button>
    </header>
  );
}

