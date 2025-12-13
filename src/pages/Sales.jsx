import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const defaultTaxes = [
  { name: 'GST', rate: 0.13 },
  { name: 'PST', rate: 0.05 },
];

export default function Sales() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [cartDiscountPercent, setCartDiscountPercent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .order('name')
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  const handleAddToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          unit_price: Number(product.price),
          quantity: 1,
          itemDiscount: 0,
          itemDiscountType: 'percent', // percent | fixed
        },
      ];
    });
  };

  const handleQuantityChange = (productId, quantity) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, quantity: Math.max(1, quantity) } : item
      )
    );
  };

  const handleItemDiscount = (productId, type, value) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, itemDiscountType: type, itemDiscount: Number(value) || 0 }
          : item
      )
    );
  };

  const handleRemove = (productId) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const totals = useMemo(() => {
    const itemRows = cart.map((item) => {
      const base = item.unit_price * item.quantity;
      const discountValue =
        item.itemDiscountType === 'percent'
          ? (base * (item.itemDiscount || 0)) / 100
          : item.itemDiscount || 0;
      const discounted = Math.max(base - discountValue, 0);
      return { ...item, base, discountValue, discounted };
    });

    const subtotalBeforeCart = itemRows.reduce((sum, row) => sum + row.discounted, 0);
    const cartDiscountValue = (subtotalBeforeCart * (cartDiscountPercent || 0)) / 100;
    const subtotal = Math.max(subtotalBeforeCart - cartDiscountValue, 0);
    const taxTotal = defaultTaxes.reduce((sum, tax) => sum + subtotal * tax.rate, 0);
    const total = subtotal + taxTotal;

    return { itemRows, subtotalBeforeCart, cartDiscountValue, subtotal, taxTotal, total };
  }, [cart, cartDiscountPercent]);

  const finalizeSale = async () => {
    if (!cart.length) return;
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/handleTransaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          cartDiscountPercent,
          taxes: defaultTaxes,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Transaction failed');
      }
      setCart([]);
      setCartDiscountPercent(0);
      setMessage('Sale completed and saved.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <h2>Sales</h2>
      <input
        placeholder="Search products"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div>
        {filteredProducts.map((product) => (
          <button key={product.id} onClick={() => handleAddToCart(product)}>
            {product.name} (${product.price})
          </button>
        ))}
      </div>

      <h3>Cart</h3>
      {cart.map((item) => (
        <div key={item.product_id}>
          <span>
            {item.name} x
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => handleQuantityChange(item.product_id, Number(e.target.value))}
            />
          </span>
          <div>
            <label>
              Item Discount Type
              <select
                value={item.itemDiscountType}
                onChange={(e) => handleItemDiscount(item.product_id, e.target.value, item.itemDiscount)}
              >
                <option value="percent">Percent</option>
                <option value="fixed">Fixed</option>
              </select>
            </label>
            <input
              type="number"
              value={item.itemDiscount}
              onChange={(e) => handleItemDiscount(item.product_id, item.itemDiscountType, e.target.value)}
            />
          </div>
          <button onClick={() => handleRemove(item.product_id)}>Remove</button>
        </div>
      ))}

      <div>
        <label>
          Cart Discount (%)
          <input
            type="number"
            value={cartDiscountPercent}
            onChange={(e) => setCartDiscountPercent(Number(e.target.value) || 0)}
          />
        </label>
      </div>

      <div>
        <p>Subtotal: ${totals.subtotalBeforeCart.toFixed(2)}</p>
        <p>Cart Discount: -${totals.cartDiscountValue.toFixed(2)}</p>
        <p>Taxes: ${totals.taxTotal.toFixed(2)}</p>
        <p>Total: ${totals.total.toFixed(2)}</p>
      </div>

      <button onClick={finalizeSale} disabled={loading || !cart.length}>
        {loading ? 'Saving…' : 'Finalize Sale'}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}

