import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Netlify/Vercel compatible handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { items = [], cartDiscountPercent = 0, taxes = [] } = req.body || {};
  if (!items.length) return res.status(400).json({ message: 'No items provided' });

  try {
    // Calculate totals on the server to avoid tampering
    const itemRows = items.map((item) => {
      const base = Number(item.unit_price) * Number(item.quantity);
      const discountValue =
        item.itemDiscountType === 'percent'
          ? (base * (Number(item.itemDiscount) || 0)) / 100
          : Number(item.itemDiscount) || 0;
      const discounted = Math.max(base - discountValue, 0);
      return { ...item, base, discountValue, discounted };
    });

    const subtotalBeforeCart = itemRows.reduce((sum, row) => sum + row.discounted, 0);
    const cartDiscountValue = (subtotalBeforeCart * (Number(cartDiscountPercent) || 0)) / 100;
    const subtotal = Math.max(subtotalBeforeCart - cartDiscountValue, 0);
    const taxTotal = taxes.reduce((sum, tax) => sum + subtotal * Number(tax.rate || 0), 0);
    const total = subtotal + taxTotal;

    // Deduct stock per line; fails fast if any product lacks stock
    for (const item of itemRows) {
      const { data, error } = await supabase.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_qty: item.quantity,
      });
      if (error || !data || !data.length) {
        return res
          .status(400)
          .json({ message: `Insufficient stock for ${item.name || item.product_id}` });
      }
    }

    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .insert({
        subtotal,
        discount_total: cartDiscountValue + itemRows.reduce((s, r) => s + r.discountValue, 0),
        tax_total: taxTotal,
        total,
        cart_discount_percent: cartDiscountPercent,
      })
      .select('id')
      .single();

    if (txError) throw txError;

    const linePayload = itemRows.map((row) => ({
      transaction_id: tx.id,
      product_id: row.product_id,
      quantity: row.quantity,
      unit_price: row.unit_price,
      item_discount: row.discountValue,
      tax_total: taxes.reduce((sum, tax) => sum + row.discounted * Number(tax.rate || 0), 0),
    }));

    const { error: lineError } = await supabase.from('transaction_items').insert(linePayload);
    if (lineError) throw lineError;

    return res.status(200).json({ id: tx.id, total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
}

