import Link from 'next/link';
import { AdminNav } from '@/components/nav/AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <AdminNav />
      {children}
    </div>
  );
}

