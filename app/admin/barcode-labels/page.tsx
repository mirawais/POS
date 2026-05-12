// app/admin/barcode-labels/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/notifications/ToastContainer';
import { AdminHeader } from '@/components/layout/AdminHeader';
import BarcodePrintModal from '@/components/barcode/BarcodePrintModal';

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  type: 'SIMPLE' | 'VARIANT' | 'COMPOSITE';
  variants?: Array<{
    id: string;
    name?: string | null;
    sku?: string | null;
    price: number;
    attributes?: any;
  }>;
};

export default function AdminBarcodeLabelsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { showError } = useToast();

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProducts(data);
        else showError('Failed to load products');
      })
      .catch(() => showError('Failed to load products'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Barcode Labels" />
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Barcode Label Printer</h1>
          <p className="mt-1 text-gray-600 text-sm">
            Select a product, choose label size and quantity, then print.
          </p>
        </div>

        <div className="bg-white border rounded p-6 flex flex-col items-center justify-center gap-4 min-h-48">
          {loading ? (
            <p className="text-gray-500">Loading products...</p>
          ) : (
            <>
              <p className="text-gray-600 text-sm text-center">
                {products.length} products available.
                <br />
                Print barcode stickers for any product.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                🏷️ Print Barcode Labels
              </button>
            </>
          )}
        </div>

        <BarcodePrintModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          products={products}
        />
      </div>
    </div>
  );
}
