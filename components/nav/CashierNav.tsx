'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { Menu, X, LogOut } from 'lucide-react';

const links = [
  { href: '/cashier/billing', label: 'Billing' },
  { href: '/cashier/held-bills', label: 'Held Bills' },
  { href: '/cashier/orders', label: 'Orders' },
  { href: '/cashier/exchanges', label: 'Returns/Exchanges' },
  { href: '/cashier/refunds', label: 'Refunds' },
  { href: '/cashier/summary', label: 'Summary' },
  { href: '/cashier/settings', label: 'Settings' },
];

export function CashierNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="bg-white border-b relative print:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="font-bold text-xl text-blue-900">Amanat POS</div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 text-sm bg-gray-50/50 p-1 rounded-lg border border-gray-100">
            {links.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md transition-all duration-200 font-medium ${active
                    ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                    }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Logout Button (Desktop) */}
          <button
            onClick={async () => {
              await signOut({ redirect: false });
              window.location.href = '/login';
            }}
            className="hidden md:flex items-center gap-2 text-sm px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors font-medium"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {isOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg z-50 animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col p-4 space-y-2">
            {links.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active
                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <hr className="my-2 border-gray-100" />
            <button
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.href = '/login';
              }}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-red-600 bg-red-50 rounded-lg w-full text-left"
            >
              <LogOut size={16} />
              Logout
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

