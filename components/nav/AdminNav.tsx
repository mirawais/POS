/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const links = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/raw-materials', label: 'Raw Materials' },
  { href: '/admin/coupons', label: 'Coupons' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/settings/tax', label: 'Taxes' },
  { href: '/admin/settings/invoice', label: 'Receipt' },
  { href: '/admin/settings/variant-attributes', label: 'Variant Attributes' },
  { href: '/admin/settings/fbr', label: 'FBR Integration' },
  { href: '/admin/reports', label: 'Reports' },
];

export function AdminNav() {
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
        onClick={() => {
          // Use current origin to ensure correct redirect in both local and production
          const callbackUrl = typeof window !== 'undefined' 
            ? `${window.location.origin}/login`
            : '/login';
          signOut({ callbackUrl });
        }}
        className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
      >
        Logout
      </button>
    </header>
  );
}

