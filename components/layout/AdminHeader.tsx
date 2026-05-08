'use client';

import { UserProfileDropdown } from './UserProfileDropdown';

type AdminHeaderProps = {
  title: string;
};

export function AdminHeader({ title }: AdminHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="min-w-0 text-xl sm:text-2xl font-semibold text-gray-900 break-words">{title}</h1>
      <div className="ml-auto flex items-center gap-3">
        <UserProfileDropdown />
      </div>
    </header>
  );
}

