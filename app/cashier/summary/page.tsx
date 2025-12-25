'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function CashierSummaryPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalTax: 0,
    totalDiscount: 0,
    totalProducts: 0
  });
  const [productList, setProductList] = useState<any[]>([]);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        // Date filter for specific day (Today)
        const today = new Date();
        const start = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const end = new Date(today.setHours(23, 59, 59, 999)).toISOString();

        const res = await fetch(`/api/sales?startDate=${start}&endDate=${end}`);
        if (!res.ok) throw new Error('Failed to fetch data');

        const sales = await res.json();

        const stats = { totalSales: 0, totalTax: 0, totalDiscount: 0, totalProducts: 0 };
        const productsMap = new Map<string, any>();

        sales.forEach((sale: any) => {
          stats.totalSales += Number(sale.total);
          stats.totalTax += Number(sale.tax);
          stats.totalDiscount += Number(sale.discount);

          sale.items.forEach((item: any) => {
            // Net quantity logic
            const netQty = (item.quantity || 0) - (item.returnedQuantity || 0);
            stats.totalProducts += netQty;

            if (netQty > 0) {
              const key = `${item.productId}:${item.variantId || 'base'}`;
              const existing = productsMap.get(key);
              if (existing) {
                existing.quantity += netQty;
              } else {
                productsMap.set(key, {
                  name: item.product?.name || 'Unknown',
                  variant: item.variant?.name || null,
                  quantity: netQty,
                  total: 0 // Placeholder if needed, but simplified request asks for name & qty
                });
              }
            }
          });
        });

        setSummary(stats);
        setProductList(Array.from(productsMap.values()).sort((a, b) => b.quantity - a.quantity));

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Daily Summary</h1>
        <p className="mt-2 text-gray-600">Overview of your sales activity for today.</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading summary...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white border rounded shadow-sm">
            <div className="text-sm text-gray-600">Total Sales</div>
            <div className="text-2xl font-bold text-blue-600">Rs. {summary.totalSales.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-white border rounded shadow-sm">
            <div className="text-sm text-gray-600">Total Tax</div>
            <div className="text-2xl font-bold text-green-600">Rs. {summary.totalTax.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-white border rounded shadow-sm">
            <div className="text-sm text-gray-600">Total Discount</div>
            <div className="text-2xl font-bold text-red-600">Rs. {summary.totalDiscount.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-white border rounded shadow-sm">
            <div className="text-sm text-gray-600">Products Sold</div>
            <div className="text-2xl font-bold text-amber-600">{summary.totalProducts}</div>
          </div>
        </div>
      )}

      {!loading && productList.length > 0 && (
        <div className="bg-white border rounded shadow-sm overflow-hidden">
          <h2 className="text-lg font-semibold p-4 border-b">Products Sold</h2>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-900">Product</th>
                <th className="px-4 py-3 font-semibold text-gray-900 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {productList.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    {p.variant && <div className="text-xs text-gray-500">{p.variant}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{p.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

