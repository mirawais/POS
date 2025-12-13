import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const daysBack = 7;

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const since = new Date();
      since.setDate(since.getDate() - daysBack);

      const [{ data: txData, error: txError }] = await Promise.all([
        supabase
          .from('transactions')
          .select('id,total,created_at')
          .gte('created_at', since.toISOString()),
      ]);
      if (txError) setMessage(txError.message);
      setTransactions(txData || []);

      // Fetch aggregated top products from serverless function
      try {
        const response = await fetch('/api/top-products');
        if (response.ok) {
          const { data } = await response.json();
          setTopProducts(data || []);
        }
      } catch (err) {
        setMessage(err.message);
      }
    };
    load();
  }, []);

  const revenueSeries = useMemo(() => {
    const today = new Date();
    return Array.from({ length: daysBack }, (_, idx) => {
      const day = new Date(today);
      day.setDate(today.getDate() - idx);
      const key = day.toISOString().slice(0, 10);
      const dailyTotal = transactions
        .filter((t) => t.created_at.startsWith(key))
        .reduce((sum, t) => sum + Number(t.total), 0);
      return { date: key, total: dailyTotal };
    }).reverse();
  }, [transactions]);

  return (
    <div>
      <h2>Sales Dashboard</h2>
      <h3>Revenue (last {daysBack} days)</h3>
      <ul>
        {revenueSeries.map((r) => (
          <li key={r.date}>
            {r.date}: ${r.total.toFixed(2)}
          </li>
        ))}
      </ul>

      <h3>Top Products (qty)</h3>
      <ul>
        {topProducts.map((p) => (
          <li key={p.product_id}>
            {p.name}: {p.quantity_sold}
          </li>
        ))}
      </ul>

      {message && <p>{message}</p>}
    </div>
  );
}

