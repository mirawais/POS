'use client';

import { UserProfileDropdown } from './UserProfileDropdown';

type AdminHeaderProps = {
  title: string;
};

export function AdminHeader({ title }: AdminHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <UserProfileDropdown />
      </div>
    </header>
  );
}

