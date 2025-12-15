/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useState } from 'react';

type ProductVariant = {
  id: string;
  name?: string | null;
  sku?: string | null;
  price: number;
  attributes?: { color?: string; size?: string; weight?: string; [key: string]: any } | null;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  variants?: ProductVariant[];
};

type Tax = { id: string; name: string; percent: number; isDefault: boolean };

type CartLine = {
  product: Product;
  quantity: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number | null;
  variant?: ProductVariant;
};

export default function BillingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [cartDiscountType, setCartDiscountType] = useState<'PERCENT' | 'AMOUNT'>('AMOUNT');
  const [cartDiscountValue, setCartDiscountValue] = useState<number>(0);
  const [couponCode, setCouponCode] = useState('');
  const [taxId, setTaxId] = useState<string>('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [heldBills, setHeldBills] = useState<any[]>([]);
  const [showHeld, setShowHeld] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any | null>(null); // This is the first declaration (Line 44)

  useEffect(() => {
    loadProducts('');
    loadTaxes();
    loadHeld();
  }, []);

// Reset success/print when cart changes after a completed sale
useEffect(() => {
  if (invoiceData && cart.length > 0) {
    setInvoiceData(null);
    setMessage(null);
  }
}, [cart]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProducts = async (term: string) => {
    const p = await fetch(`/api/products${term ? `?search=${encodeURIComponent(term)}` : ''}`).then((r) => r.json());
    setProducts(p);
  };
  const loadTaxes = async () => {
    const t = await fetch('/api/taxes').then((r) => r.json());
    const withNoTax = [{ id: 'none', name: 'No Tax', percent: 0, isDefault: false }, ...t];
    setTaxes(withNoTax);
    const defTax = t.find((x: Tax) => x.isDefault);
    if (defTax) setTaxId(defTax.id);
  };
  const loadHeld = async () => {
    const hb = await fetch('/api/held-bills').then((r) => r.json());
    setHeldBills(hb);
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let itemDiscountTotal = 0;
    let cartDiscountTotal = 0;
    let couponValue = 0;

    cart.forEach((line) => {
      const unitPrice = line.variant?.price ?? line.product.price;
      const base = unitPrice * line.quantity;
      subtotal += base;
      if (line.discountType && line.discountValue) {
        const disc = line.discountType === 'PERCENT' ? (base * line.discountValue) / 100 : line.discountValue * line.quantity;
        itemDiscountTotal += disc;
      }
    });

    if (cartDiscountValue) {
      const base = Math.max(0, subtotal - itemDiscountTotal);
      cartDiscountTotal = cartDiscountType === 'PERCENT' ? (base * cartDiscountValue) / 100 : cartDiscountValue;
    }

    const afterDiscount = Math.max(0, subtotal - itemDiscountTotal - cartDiscountTotal);
    if (couponCode) {
      // client-side estimate only; server validates coupon on submit
      // assume percent if startswith P or endswith % for a hint, else amount
      const couponPercent = couponCode.endsWith('%') || couponCode.toUpperCase().includes('P');
      couponValue = couponPercent ? (afterDiscount * 10) / 100 : 0; // rough hint, server authoritative
    }

    const taxPercent = taxes.find((t) => t.id === taxId)?.percent ?? 0;
    const tax = (Math.max(0, afterDiscount - couponValue) * taxPercent) / 100;
    const total = Math.max(0, afterDiscount - couponValue) + tax;
    return { subtotal, itemDiscountTotal, cartDiscountTotal, couponValue, taxPercent, tax, total };
  }, [cart, cartDiscountType, cartDiscountValue, couponCode, taxes, taxId]);

  const addToCart = (product: Product, variant?: ProductVariant) => {
    setCart((prev) => {
      const key = `${product.id}:${variant?.id || 'base'}`;
      const existing = prev.find((p) => `${p.product.id}:${p.variant?.id || 'base'}` === key);
      if (existing) {
        return prev.map((p) => (`${p.product.id}:${p.variant?.id || 'base'}` === key ? { ...p, quantity: p.quantity + 1 } : p));
      }
      return [...prev, { product, variant, quantity: 1 }];
    });
    if (!taxId && (product as any).defaultTaxId) {
      setTaxId((product as any).defaultTaxId);
    }
  };

  const updateQuantity = (keyId: string, qty: number) => {
    setCart((prev) => prev.map((p) => (`${p.product.id}:${p.variant?.id || 'base'}` === keyId ? { ...p, quantity: Math.max(1, qty) } : p)));
  };

  const updateItemDiscount = (keyId: string, discountType: 'PERCENT' | 'AMOUNT', value: number) => {
    setCart((prev) =>
      prev.map((p) =>
        `${p.product.id}:${p.variant?.id || 'base'}` === keyId ? { ...p, discountType, discountValue: value } : p
      )
    );
  };

  const removeLine = (keyId: string) => setCart((prev) => prev.filter((p) => `${p.product.id}:${p.variant?.id || 'base'}` !== keyId));

  // The duplicate declaration was here on line 139, and it has been removed.

  const checkout = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((c) => ({
            productId: c.product.id,
            quantity: c.quantity,
            discountType: c.discountType ?? null,
            discountValue: c.discountValue ?? null,
            variantId: c.variant?.id ?? null,
          })),
          cartDiscountType: cartDiscountValue ? cartDiscountType : null,
          cartDiscountValue: cartDiscountValue || null,
          couponCode: couponCode || null,
          taxId: taxId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Checkout failed');
      }
      setCart([]);
      setCouponCode('');
      setCartDiscountValue(0);
      const data = await res.json();
      setInvoiceData(data);
      setMessage(`Sale recorded. Total: $${Number(data?.totals?.total ?? 0).toFixed(2)}`);
    } catch (e: any) {
      setMessage(e.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const printInvoice = async () => {
    const setting = await fetch('/api/invoice-settings').then((r) => r.json()).catch(() => ({}));
    const invoice = invoiceData;
    if (!invoice) return;
    const win = window.open('', 'PRINT', 'height=650,width=400');
    if (!win) return;
    const logo = setting?.logoUrl ? `<img src=\"${setting.logoUrl}\" style=\"max-width:150px;\" />` : '';
    const header = setting?.headerText ? `<div>${setting.headerText}</div>` : '';
    const footer = setting?.footerText ? `<div>${setting.footerText}</div>` : '';
    const items =
      invoice?.totals?.perItem
        ?.map(
          (i: any) =>
            `<tr><td>${i.productId}</td><td>${i.quantity}</td><td>${i.price.toFixed(2)}</td><td>${i.total.toFixed(2)}</td></tr>`
        )
        .join('') || '';
    const html = `
      <html>
        <body>
          <div style="text-align:center;">
            ${logo}
            ${header}
          </div>
          <table style="width:100%;font-size:12px;margin-top:8px;">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>${items}</tbody>
          </table>
          <div style="margin-top:8px;font-size:12px;">
            Subtotal: ${invoice.totals.subtotal.toFixed(2)}<br/>
            Discount: ${(invoice.totals.itemDiscountTotal + invoice.totals.cartDiscountTotal + invoice.totals.couponValue).toFixed(2)}<br/>
            Tax: ${invoice.totals.taxAmount.toFixed(2)}<br/>
            <strong>Total: ${invoice.totals.total.toFixed(2)}</strong>
          </div>
          <div style="text-align:center;margin-top:12px;font-size:12px;">${footer}</div>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const saveCart = async () => {
    if (cart.length === 0) {
      setMessage('Nothing to save');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        cart,
        cartDiscountType,
        cartDiscountValue,
        couponCode,
        taxId,
      };
      const res = await fetch('/api/held-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload }),
      });
      if (!res.ok) throw new Error('Failed to save cart');
      const saved = await res.json();
      setHeldBills((prev) => [saved, ...prev]);
      setMessage('Cart saved.');
    } catch (e: any) {
      setMessage(e.message || 'Save cart failed');
    } finally {
      setLoading(false);
    }
  };

  const loadHeldBill = (bill: any) => {
    const data = bill.data || {};
    setCart(data.cart || []);
    setCartDiscountType(data.cartDiscountType || 'AMOUNT');
    setCartDiscountValue(data.cartDiscountValue || 0);
    setCouponCode(data.couponCode || '');
    setTaxId(data.taxId || taxId);
    setShowHeld(false);
    setInvoiceData(null);
    setMessage(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-2 text-gray-600">Add items, apply discounts/coupons, and checkout.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-4 border rounded bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Products</h2>
            <span className="text-sm text-gray-600">{products.length} items</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              placeholder="Search or scan..."
              className="flex-1 border rounded px-2 py-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const term = (e.target as HTMLInputElement).value.toLowerCase();
                  const found = products.find(
                    (p) => p.sku.toLowerCase() === term || p.name.toLowerCase().includes(term)
                  );
                  if (found) addToCart(found);
                }
              }}
              onChange={(e) => {
                const term = e.target.value;
                loadProducts(term);
              }}
            />
            <button
              type="button"
              onClick={saveCart}
              className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
              disabled={loading || cart.length === 0}
            >
              Save Cart
            </button>
            <button
              type="button"
              onClick={() => setShowHeld((v) => !v)}
              className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
            >
              {showHeld ? 'Hide Saved' : 'Saved Carts'}
            </button>
          </div>
          {showHeld && (
            <div className="border rounded p-2 max-h-48 overflow-auto space-y-1">
              {heldBills.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <div>
                    Saved at {new Date(b.createdAt).toLocaleString()}
                  </div>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 border rounded" onClick={() => loadHeldBill(b)}>
                      Load
                    </button>
                  </div>
                </div>
              ))}
              {heldBills.length === 0 && <p className="text-xs text-gray-500">No saved carts.</p>}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {products.map((p) => (
              <div key={p.id} className="border rounded px-3 py-2 text-left">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-500">{p.sku}</div>
                <div className="text-sm text-gray-700">${Number(p.price).toFixed(2)}</div>
                {p.variants && p.variants.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.variants.map((v) => {
                      const attrs = v.attributes || {};
                      const attrStr = Object.entries(attrs)
                        .map(([k, val]) => `${k}: ${val}`)
                        .join(', ');
                      return (
                        <button
                          key={v.id}
                          className="text-xs px-2 py-1 border rounded hover:border-blue-500"
                          onClick={() => addToCart(p, v)}
                        >
                          {v.name || 'Variant'} {attrStr ? `(${attrStr})` : ''} - ${Number(v.price).toFixed(2)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    className="mt-2 w-full text-sm px-2 py-1 border rounded hover:border-blue-500"
                    onClick={() => addToCart(p)}
                  >
                    Add
                  </button>
                )}
              </div>
            ))}
            {products.length === 0 && <p className="text-sm text-gray-600">No products found.</p>}
          </div>
        </div>

        <div className="p-4 border rounded bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Cart</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveCart}
                className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
                disabled={loading || cart.length === 0}
              >
                Save Cart
              </button>
              <button
                type="button"
                onClick={() => setShowHeld((v) => !v)}
                className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
              >
                {showHeld ? 'Hide Saved' : 'Saved Carts'}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {cart.map((line) => (
              <div key={`${line.product.id}:${line.variant?.id || 'base'}`} className="border rounded px-2 py-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{line.product.name}</div>
                    <div className="text-xs text-gray-500">{line.product.sku}</div>
                    {line.variant && (
                      <div className="text-xs text-gray-600">
                        {line.variant.name || 'Variant'}{' '}
                        {line.variant.attributes
                          ? `(${Object.entries(line.variant.attributes)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ')})`
                          : ''}{' '}
                        @ ${Number(line.variant.price).toFixed(2)}
                      </div>
                    )}
                  </div>
                  <button className="text-xs text-red-600" onClick={() => removeLine(`${line.product.id}:${line.variant?.id || 'base'}`)}>Remove</button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-gray-700">Qty</label>
                  <input
                    type="number"
                    min={1}
                    className="w-16 border rounded px-2 py-1 text-sm"
                    value={line.quantity}
                    onChange={(e) => updateQuantity(`${line.product.id}:${line.variant?.id || 'base'}`, Number(e.target.value))}
                  />
                  <select
                    className="border rounded px-2 py-1 text-sm flex-1"
                    value={line.discountType || 'AMOUNT'}
                    onChange={(e) => updateItemDiscount(`${line.product.id}:${line.variant?.id || 'base'}`, e.target.value as any, line.discountValue || 0)}
                  >
                    <option value="AMOUNT">Amount</option>
                    <option value="PERCENT">Percent</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-24 border rounded px-2 py-1 text-sm"
                    value={line.discountValue ?? 0}
                    onChange={(e) =>
                      updateItemDiscount(
                        `${line.product.id}:${line.variant?.id || 'base'}`,
                        line.discountType || 'AMOUNT',
                        Number(e.target.value)
                      )
                    }
                    placeholder="Disc"
                  />
                </div>
              </div>
            ))}
            {cart.length === 0 && <p className="text-sm text-gray-600">Cart is empty.</p>}
          </div>

          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1 border rounded text-sm"
                onClick={() => {
                  setCart([]);
                  setInvoiceData(null);
                  setMessage(null);
                }}
                disabled={cart.length === 0}
              >
                Clear Cart
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="space-y-1 block flex-1">
                <span className="text-sm text-gray-700">Cart discount</span>
                <div className="flex gap-2">
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={cartDiscountType}
                    onChange={(e) => setCartDiscountType(e.target.value as any)}
                  >
                    <option value="AMOUNT">Amount</option>
                    <option value="PERCENT">Percent</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="flex-1 border rounded px-2 py-1 text-sm"
                    value={cartDiscountValue}
                    onChange={(e) => setCartDiscountValue(Number(e.target.value) || 0)}
                    placeholder="Value"
                  />
                </div>
              </label>
            </div>
            <label className="space-y-1 block">
              <span className="text-sm text-gray-700">Coupon code</span>
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="e.g. SAVE10"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-sm text-gray-700">Tax</span>
              <select className="w-full border rounded px-2 py-1 text-sm" value={taxId} onChange={(e) => setTaxId(e.target.value)}>
                {taxes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.percent}%){t.isDefault ? ' • Default' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>${totals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-amber-700"><span>Item discounts</span><span>- ${totals.itemDiscountTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-amber-700"><span>Cart discount</span><span>- ${totals.cartDiscountTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-amber-700"><span>Coupon (est.)</span><span>- ${totals.couponValue.toFixed(2)}</span></div>
            <div className="flex justify-between text-green-700"><span>Tax ({totals.taxPercent}%)</span><span>+ ${totals.tax.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-lg pt-2 border-t"><span>Total</span><span>${totals.total.toFixed(2)}</span></div>
          </div>

          <button
            disabled={loading || cart.length === 0}
            onClick={checkout}
            className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Checkout'}
          </button>
          {invoiceData && (
            <button
              onClick={printInvoice}
              className="w-full mt-2 px-4 py-2 bg-gray-700 text-white rounded"
            >
              Print Invoice
            </button>
          )}
          {message && <p className="text-sm mt-2">{message}</p>}
        </div>
      </div>
    </div>
  );
}