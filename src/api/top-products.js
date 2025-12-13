import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(_req, res) {
  const { data, error } = await supabase
    .from('transaction_items')
    .select('product_id,quantity,product:products(name)')
    .neq('product_id', null);

  if (error) return res.status(500).json({ message: error.message });

  const aggregate = Object.values(
    data.reduce((acc, row) => {
      const key = row.product_id;
      acc[key] = acc[key] || { product_id: key, name: row.product?.name || 'Unknown', quantity_sold: 0 };
      acc[key].quantity_sold += Number(row.quantity) || 0;
      return acc;
    }, {})
  )
    .sort((a, b) => b.quantity_sold - a.quantity_sold)
    .slice(0, 5);

  return res.status(200).json({ data: aggregate });
}

