import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function CashierSales() {
  const [products, setProducts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [query, setQuery] = useState('');
  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState([]);
  const [cartDiscountPercent, setCartDiscountPercent] = useState(0);
  const [savedLabel, setSavedLabel] = useState('');
  const [savedCarts, setSavedCarts] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const [{ data: productData }, { data: taxData }, { data: cartData }] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('taxes').select('*').eq('active', true),
        supabase.from('saved_carts').select('*').order('created_at', { ascending: false }),
      ]);
      setProducts(productData || []);
      setTaxes(taxData || []);
      setSavedCarts(cartData || []);
    };
    load();
  }, []);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
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
          itemDiscountType: 'percent',
        },
      ];
    });
  };

  const handleBarcodeScan = async (e) => {
    if (e.key !== 'Enter') return;
    const code = barcode.trim();
    if (!code) return;
    setMessage('');
    const { data, error } = await supabase.from('products').select('*').eq('sku', code).maybeSingle();
    if (error || !data) {
      setMessage('SKU not found');
    } else {
      addToCart(data);
      setBarcode('');
    }
  };

  const saveCart = async () => {
    if (!cart.length) return setMessage('Nothing to save');
    const payload = {
      label: savedLabel || `Cart ${new Date().toLocaleTimeString()}`,
      cart_data: {
        cart,
        cartDiscountPercent,
      },
    };
    const { error } = await supabase.from('saved_carts').insert(payload);
    if (error) setMessage(error.message);
    else {
      setMessage('Cart saved');
      setSavedLabel('');
      const { data } = await supabase
        .from('saved_carts')
        .select('*')
        .order('created_at', { ascending: false });
      setSavedCarts(data || []);
    }
  };

  const loadCart = async (id) => {
    const { data } = await supabase.from('saved_carts').select('*').eq('id', id).maybeSingle();
    if (data) {
      setCart(data.cart_data.cart || []);
      setCartDiscountPercent(data.cart_data.cartDiscountPercent || 0);
      setMessage('Cart loaded');
    }
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
    const taxTotal = taxes.reduce((sum, tax) => sum + subtotal * Number(tax.rate || 0), 0);
    const total = subtotal + taxTotal;
    return { itemRows, subtotalBeforeCart, cartDiscountValue, subtotal, taxTotal, total };
  }, [cart, cartDiscountPercent, taxes]);

  const finalizeSale = async () => {
    setMessage('');
    const response = await fetch('/api/handleTransaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart, cartDiscountPercent, taxes }),
    });
    if (!response.ok) {
      const err = await response.json();
      setMessage(err.message || 'Failed');
      return;
    }
    setCart([]);
    setCartDiscountPercent(0);
    setMessage('Sale completed');
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <h2>Sales (Cashier)</h2>
      <input
        placeholder="Search products"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div>
        {filteredProducts.map((product) => (
          <button key={product.id} onClick={() => addToCart(product)}>
            {product.name} (${product.price})
          </button>
        ))}
      </div>

      <div>
        <input
          placeholder="Scan or enter SKU"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={handleBarcodeScan}
        />
      </div>

      <h3>Cart</h3>
      {cart.map((item) => (
        <div key={item.product_id}>
          {item.name} x {item.quantity} (${item.unit_price})
          <button onClick={() => setCart((prev) => prev.filter((p) => p.product_id !== item.product_id))}>
            Remove
          </button>
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

      <button onClick={finalizeSale} disabled={!cart.length}>
        Finalize Sale
      </button>

      <div>
        <h4>Save Cart</h4>
        <input
          placeholder="Label (optional)"
          value={savedLabel}
          onChange={(e) => setSavedLabel(e.target.value)}
        />
        <button onClick={saveCart}>Save Current Cart</button>
      </div>

      <div>
        <h4>Load Cart</h4>
        {savedCarts.map((c) => (
          <button key={c.id} onClick={() => loadCart(c.id)}>
            {c.label || c.id}
          </button>
        ))}
      </div>
      {message && <p>{message}</p>}
    </div>
  );
}

