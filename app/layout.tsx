import './globals.css';
import type { Metadata } from 'next';
import { ToastProvider } from '@/components/notifications/ToastContainer';

export const metadata: Metadata = {
  title: 'Amanat POS',
  description: 'Multi-tenant Point of Sale',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <ToastProvider>
          <div className="max-w-7xl mx-auto p-4">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}

