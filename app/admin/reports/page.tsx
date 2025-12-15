'use client';

import { useEffect, useState } from 'react';

export default function ReportsPage() {
  const [sales, setSales] = useState<any[]>([]); // State to store sales data
  const [loading, setLoading] = useState(true); // State to manage loading
  const [error, setError] = useState<string | null>(null); // State to manage errors

  // Function to fetch sales data
  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sales'); // Fetch sales data from the API
      if (!response.ok) {
        throw new Error('Failed to fetch sales data');
      }
      const data = await response.json();
      setSales(data); // Update state with sales data
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales(); // Fetch sales data when the component loads
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Sales Reports</h1>
      <p className="mt-2 text-gray-600">Filter by date, product, cashier. Export actions placeholder.</p>
      {loading && <p>Loading sales data...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && sales.length === 0 && <p>No sales data available.</p>}
      {!loading && !error && sales.length > 0 && (
        <table border="1" cellPadding="8" cellSpacing="0">
          <thead>
            <tr>
              <th>Sale ID</th>
              <th>Cashier</th>
              <th>Subtotal</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Total</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{sale.id}</td>
                <td>{sale.cashierId}</td>
                <td>${sale.subtotal.toFixed(2)}</td>
                <td>${sale.discount.toFixed(2)}</td>
                <td>${sale.tax.toFixed(2)}</td>
                <td>${sale.total.toFixed(2)}</td>
                <td>{new Date(sale.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}