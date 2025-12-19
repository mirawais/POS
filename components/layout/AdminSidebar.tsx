'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  BarChart3,
  Package,
  FolderTree,
  Boxes,
  Tags,
  Receipt,
  Ticket,
  Calculator,
  Settings,
  Users,
  LogOut,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { useState } from 'react';

type MenuGroup = {
  title: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
};

const menuGroups: MenuGroup[] = [
  {
    title: 'Overview',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { href: '/admin/products', label: 'Products', icon: Package },
      { href: '/admin/categories', label: 'Categories', icon: FolderTree },
      { href: '/admin/raw-materials', label: 'Raw Materials', icon: Boxes },
      { href: '/admin/settings/variant-attributes', label: 'Variant Attributes', icon: Tags },
    ],
  },
  {
    title: 'Sales & Finance',
    items: [
      { href: '/admin/settings/invoice', label: 'Receipt', icon: Receipt },
      { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
      { href: '/admin/settings/tax', label: 'Taxes', icon: Calculator },
      { href: '/admin/settings/fbr', label: 'FBR Integration', icon: FileText },
    ],
  },
  {
    title: 'Management',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Overview', 'Inventory', 'Sales & Finance', 'Management']));
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    window.location.href = '/login';
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white border rounded shadow-md"
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-gray-900 text-white z-40
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-800">
            <h1 className="text-xl font-bold text-white">Amanat POS</h1>
          </div>

          {/* Menu Groups */}
          <nav className="flex-1 overflow-y-auto py-4">
            {menuGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.title);
              return (
                <div key={group.title} className="mb-2">
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="w-full px-6 py-2 text-left text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between hover:text-gray-200"
                  >
                    <span>{group.title}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="mt-1">
                      {group.items.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMobileOpen(false)}
                            className={`
                              flex items-center gap-3 px-6 py-2.5 text-sm
                              transition-colors duration-150
                              ${
                                isActive
                                  ? 'bg-blue-600 text-white border-r-2 border-blue-400'
                                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                              }
                            `}
                          >
                            <Icon className="w-5 h-5" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

