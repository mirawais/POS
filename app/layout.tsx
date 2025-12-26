import './globals.css';
import type { Metadata } from 'next';
import { ToastProvider } from '@/components/notifications/ToastContainer';

export const metadata: Metadata = {
  title: 'Amanat POS',
  description: 'Multi-tenant Point of Sale',
  manifest: '/manifest.json', // Link manifest
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}

