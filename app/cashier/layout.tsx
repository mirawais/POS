import { CashierNav } from '@/components/nav/CashierNav';

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <CashierNav />
      {children}
    </div>
  );
}

