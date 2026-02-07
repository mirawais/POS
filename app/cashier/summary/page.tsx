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
    totalCouponDiscount: 0,
    totalProducts: 0,
    totalRefunds: 0,
    netSale: 0,
    cashSales: 0,
    cardSales: 0,
  });
  const [productList, setProductList] = useState<any[]>([]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      // Date filter for specific day (Today)
      const today = new Date();
      const start = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const end = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      // Fetch Sales
      const salesRes = await fetch(`/api/sales?startDate=${start}&endDate=${end}`);
      if (!salesRes.ok) throw new Error('Failed to fetch sales');
      const sales = await salesRes.json();

      // Fetch Refunds
      const refundsRes = await fetch(`/api/refunds?startDate=${start}&endDate=${end}`);
      if (!refundsRes.ok) throw new Error('Failed to fetch refunds');
      const refunds = await refundsRes.json();

      const stats = {
        totalSales: 0,
        totalTax: 0,
        totalDiscount: 0,
        totalCouponDiscount: 0,
        totalProducts: 0,
        totalRefunds: 0,
        netSale: 0,
        cashSales: 0,
        cardSales: 0,
      };

      const methodStats = {
        CASH: { sales: 0, tax: 0, discount: 0, coupon: 0, refunds: 0 },
        CARD: { sales: 0, tax: 0, discount: 0, coupon: 0, refunds: 0 }
      };

      const productsMap = new Map<string, any>();

      // Process Sales
      sales.forEach((sale: any) => {
        stats.totalSales += Number(sale.total);
        stats.totalTax += Number(sale.tax);

        // Separate manual discount and coupon discount
        const rawDiscount = Number(sale.discount || 0);
        const couponVal = Number(sale.couponValue || 0);
        const manualDiscount = rawDiscount - couponVal;

        // Database 'discount' includes coupon value, so we subtract it to get manual discount
        stats.totalDiscount += manualDiscount;
        stats.totalCouponDiscount += couponVal;

        // Break down by payment method
        const method = (sale.paymentMethod === 'CARD' ? 'CARD' : 'CASH') as 'CASH' | 'CARD';
        methodStats[method].sales += Number(sale.total);
        methodStats[method].tax += Number(sale.tax);
        methodStats[method].discount += manualDiscount;
        methodStats[method].coupon += couponVal;

        sale.items.forEach((item: any) => {
          // Net quantity logic (quantitiy sold - quantity returned in THIS sale item context)
          // Note: item.returnedQuantity tracks returns against this specific sale item
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
              });
            }
          }
        });
      });

      // Process Refunds (Today's actual refund transactions)
      refunds.forEach((refund: any) => {
        const refundAmount = Number(refund.total);
        stats.totalRefunds += refundAmount;

        // Attribution to payment method based on original sale
        // If paymentMethod is missing (old records), default to CASH
        // We use the optional chaining from the updated API
        const method = (refund.sale?.paymentMethod === 'CARD' ? 'CARD' : 'CASH') as 'CASH' | 'CARD';
        methodStats[method].refunds += refundAmount;
      });

      // Strict User Formula: Net Sale = Total Sale - Discount - Coupon - Refund + Tax
      stats.netSale = stats.totalSales - stats.totalDiscount - stats.totalCouponDiscount - stats.totalRefunds + stats.totalTax;

      // Calculate Cash/Card Net Sales using same formula
      stats.cashSales = methodStats.CASH.sales - methodStats.CASH.discount - methodStats.CASH.coupon - methodStats.CASH.refunds + methodStats.CASH.tax;
      stats.cardSales = methodStats.CARD.sales - methodStats.CARD.discount - methodStats.CARD.coupon - methodStats.CARD.refunds + methodStats.CARD.tax;

      setSummary(stats);
      setProductList(Array.from(productsMap.values()).sort((a, b) => b.quantity - a.quantity));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .cards-container {
            display: none !important;
          }
          .print-summary-text {
            display: block !important;
            margin-bottom: 2rem;
          }
          .print-header {
            text-align: center;
            margin-bottom: 2rem;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border-bottom: 1px solid #ddd !important;
            padding: 8px !important;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>

      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-2xl font-semibold">Daily Summary</h1>
          <p className="mt-2 text-gray-600">Overview of your sales activity for today.</p>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Print Report
        </button>
      </div>

      {/* Print Only Header */}
      <div className="print-only print-header">
        <h1 className="text-2xl font-bold">Daily Sales Report</h1>
        <p className="text-gray-600">Generated on: {new Date().toLocaleString()}</p>
        <p className="text-gray-600">Cashier: {session?.user?.name || 'Cashier'}</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading summary...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 cards-container">
            <div className="p-4 bg-white border rounded shadow-sm">
              <div className="text-sm text-gray-600">Total Sales</div>
              <div className="text-2xl font-bold text-blue-600">Rs. {summary.totalSales.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-white border rounded shadow-sm">
              <div className="text-sm text-gray-600">Total Refunded</div>
              <div className="text-2xl font-bold text-red-600">Rs. {summary.totalRefunds.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-white border rounded shadow-sm">
              <div className="text-sm text-gray-600 font-bold">Net Sale</div>
              <div className="text-2xl font-bold text-green-700">Rs. {summary.netSale.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-white border rounded shadow-sm">
              <div className="text-sm text-gray-600">Total Tax</div>
              <div className="text-2xl font-bold text-amber-600">Rs. {summary.totalTax.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-white border rounded shadow-sm">
              <div className="text-sm text-gray-600">Cash Sales</div>
              <div className="text-2xl font-bold text-emerald-600">Rs. {summary.cashSales.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-white border rounded shadow-sm">
              <div className="text-sm text-gray-600">Card Sales</div>
              <div className="text-2xl font-bold text-purple-600">Rs. {summary.cardSales.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-white border rounded shadow-sm">
              <div className="text-sm text-gray-600">Total Discount</div>
              <div className="text-2xl font-bold text-gray-700">Rs. {summary.totalDiscount.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-white border rounded shadow-sm">
              <div className="text-sm text-gray-600">Coupon Discount</div>
              <div className="text-2xl font-bold text-gray-700">Rs. {summary.totalCouponDiscount.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-white border rounded shadow-sm">
              <div className="text-sm text-gray-600">Products Sold</div>
              <div className="text-2xl font-bold text-indigo-600">{summary.totalProducts}</div>
            </div>
          </div>

          {/* Print Only Summary Text */}
          <div className="print-only print-summary-text space-y-2 border-b pb-4">
            <div className="flex justify-between text-lg">
              <span>Total Sales:</span>
              <span className="font-bold">Rs. {summary.totalSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span>Total Refunded:</span>
              <span className="font-bold text-red-600">Rs. {summary.totalRefunds.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg mt-2">
              <span>Total Tax:</span>
              <span>Rs. {summary.totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span>Total Discount:</span>
              <span>Rs. {summary.totalDiscount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span>Coupon Discount:</span>
              <span>Rs. {summary.totalCouponDiscount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold border-t pt-2 mt-2">
              <span>Net Sale:</span>
              <span>Rs. {summary.netSale.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg mt-2">
              <span>Cash Sales:</span>
              <span>Rs. {summary.cashSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span>Card Sales:</span>
              <span>Rs. {summary.cardSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg border-t pt-2 mt-2">
              <span>Products Sold:</span>
              <span>{summary.totalProducts}</span>
            </div>
          </div>
        </>
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

