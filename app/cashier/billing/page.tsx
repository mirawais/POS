/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/notifications/ToastContainer';
import { Wifi, WifiOff, RefreshCcw, ArrowUpAZ, ArrowDownAZ, ArrowUp, ArrowDown } from 'lucide-react';
import ConfirmationModal from '@/components/ConfirmationModal';


type ProductVariant = {
  id: string;
  name?: string | null;
  sku?: string | null;
  price: number;
  stock?: number;
  attributes?: { color?: string; size?: string; weight?: string;[key: string]: any } | null;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  type?: 'SIMPLE' | 'VARIANT' | 'COMPOSITE';
  stock?: number;
  variants?: ProductVariant[];
  isFavorite?: boolean;
  isUnlimited?: boolean;
  createdAt?: string | Date;
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
  const [validatedCoupon, setValidatedCoupon] = useState<any | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [taxId, setTaxId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [heldBills, setHeldBills] = useState<any[]>([]);
  const [taxMode, setTaxMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('EXCLUSIVE');
  const { showError, showSuccess, showInfo } = useToast();

  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [currentHeldBillId, setCurrentHeldBillId] = useState<string | null>(null);
  const [showCartNamePrompt, setShowCartNamePrompt] = useState(false);
  const [cartName, setCartName] = useState('');
  const [isLoadedCart, setIsLoadedCart] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  // UI Visibility State
  const [showPriceDecimals, setShowPriceDecimals] = useState(true);
  const [showCartDiscount, setShowCartDiscount] = useState(false);
  const [showCouponInput, setShowCouponInput] = useState(false);

  // Sorting State
  const [favoritesFirst, setFavoritesFirst] = useState(true);
  const [sortBy, setSortBy] = useState<'NAME' | 'LATEST'>('LATEST');
  const [sortAsc, setSortAsc] = useState(false);

  // Offline Mode State
  const [isOnline, setIsOnline] = useState(true);
  const [offlineOrderCount, setOfflineOrderCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const loadProducts = useCallback(async (term: string) => {
    setCurrentPage(1); // Reset to first page on search/reload

    // 1. Cache-First Strategy: Load from local storage IMMEDIATELY
    // If there is a search term, we try to filter locally first to give instant feedback
    const cached = localStorage.getItem('cached_products');
    let localProducts: Product[] = [];

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localProducts = parsed;
          if (term) {
            const lowerTerm = term.toLowerCase();
            const filtered = parsed.filter(p =>
              p.name.toLowerCase().includes(lowerTerm) ||
              p.sku.toLowerCase().includes(lowerTerm)
            );
            setProducts(filtered);
          } else {
            setProducts(parsed);
          }
        }
      } catch (e) {
        console.error('Cache parse error', e);
      }
    }

    // 2. Network-In-Background Strategy: Fetch fresh data silently
    // Only attempt fetch if online roughly check or just try/catch
    try {
      if (!term && !navigator.onLine) return; // Don't fetch if offline and just loading all (we have cache)

      const res = await fetch(`/api/products${term ? `?search=${encodeURIComponent(term)}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const p = await res.json();
      setProducts(p);

      // Update cache ONLY if we fetched ALL products (no search term)
      if (!term) {
        localStorage.setItem('cached_products', JSON.stringify(p));
      }
    } catch (e) {
      // If network fails, we rely on what we already showed from cache (step 1).
      // If we didn't show anything (empty cache) and fetch failed:
      if (localProducts.length === 0) {
        console.error('Failed to load products and no cache available', e);
      }
      // If we successfully showed cached data filtered by term, the user is happy.
    }
  }, []);

  const sortedProducts = useMemo(() => {
    const list = [...products];

    list.sort((a, b) => {
      // 1. Favorites First Logic
      if (favoritesFirst) {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
      }

      // 2. Primary Sort Field
      let comparison = 0;
      if (sortBy === 'NAME') {
        comparison = a.name.localeCompare(b.name);
      } else {
        // LATEST (createdAt)
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        comparison = dateA - dateB;
      }

      // 3. Direction
      return sortAsc ? comparison : -comparison;
    });

    return list;
  }, [products, favoritesFirst, sortBy, sortAsc]);

  const loadHeldBill = useCallback(async (bill: any) => {
    try {
      const data = bill.data || {};
      const savedCart = data.cart || [];

      // Reconstruct cart with full product objects
      // Get current products - if empty, fetch them
      let currentProducts = products;
      if (currentProducts.length === 0) {
        try {
          if (!navigator.onLine) throw new Error('Offline');
          const productsData = await fetch('/api/products').then((r) => r.json());
          currentProducts = productsData;
          setProducts(productsData);
        } catch (e) {
          // If fetch fails (offline), try cache
          const cached = localStorage.getItem('cached_products');
          if (cached) {
            const productsData = JSON.parse(cached);
            currentProducts = productsData;
            setProducts(productsData);
          }
        }
      }

      const reconstructedCart: CartLine[] = [];

      for (const item of savedCart) {
        // If item already has full product object, use it
        if (item.product && item.product.id) {
          // Verify product still exists in current product list
          let currentProduct = currentProducts.find((p: Product) => p.id === item.product.id);

          // Debug: Check if we are offline/using cache and still can't find it
          if (!currentProduct) {
            console.warn('Product not found in current list, using saved product data', item.product.name);
            currentProduct = item.product; // Fallback to saved data
          }

          if (currentProduct) {
            let variant: ProductVariant | undefined;
            if (item.variant && item.variant.id) {
              variant = currentProduct.variants?.find((v: ProductVariant) => v.id === item.variant.id);
              // Fallback for variant too
              if (!variant && item.variant) {
                variant = item.variant;
              }
            }

            reconstructedCart.push({
              product: currentProduct,
              quantity: item.quantity || 1,
              discountType: item.discountType,
              discountValue: item.discountValue,
              variant,
            });
          }
        } else if (item.productId) {
          // Fetch product details if only ID is available
          const product = currentProducts.find((p: Product) => p.id === item.productId);
          if (product) {
            let variant: ProductVariant | undefined;
            if (item.variantId && product.variants) {
              variant = product.variants.find((v: ProductVariant) => v.id === item.variantId);
            }

            reconstructedCart.push({
              product,
              quantity: item.quantity || 1,
              discountType: item.discountType,
              discountValue: item.discountValue,
              variant,
            });
          }
        }
      }

      if (reconstructedCart.length === 0 && savedCart.length > 0) {
        // If still empty despite fallback, it's a critical error
        console.error("Failed to reconstruct cart. Saved items:", savedCart.length, "Reconstructed:", reconstructedCart.length);
      }

      setCart(reconstructedCart);
      setCartDiscountType(data.cartDiscountType || 'AMOUNT');
      setCartDiscountValue(data.cartDiscountValue || 0);
      setCouponCode(data.couponCode || '');
      setValidatedCoupon(null); // Will be re-validated if user wants to apply
      setTaxId(data.taxId || taxId);
      setCurrentHeldBillId(bill.id); // Track which held bill is currently loaded
      setIsLoadedCart(true); // Mark that this is a loaded cart, so saves will update it
      setCartName(data.label || ''); // Preserve cart name if it exists
      setShowHeld(false);
      setInvoiceData(null);

      if (reconstructedCart.length > 0) {
        showSuccess('Cart loaded successfully');
      }
    } catch (err: any) {
      showError(err.message || 'Failed to load cart');
    }
  }, [taxId, products, showSuccess, showError]);

  useEffect(() => {
    loadProducts('');
    loadTaxes();
    loadHeld();

    // Load caching for settings
    const loadSettings = async () => {
      try {
        const r = await fetch('/api/invoice-settings');
        if (!r.ok) throw new Error('Failed');
        const data = await r.json();
        setTaxMode(data.taxMode === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE');
        setShowPriceDecimals(data.showPriceDecimals !== false);
        localStorage.setItem('cached_settings', JSON.stringify(data));
      } catch (e) {
        const cached = localStorage.getItem('cached_settings');
        if (cached) {
          const data = JSON.parse(cached);
          setTaxMode(data.taxMode === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE');
          setShowPriceDecimals(data.showPriceDecimals !== false);
        }
      }
    };
    loadSettings();
  }, [loadProducts]);

  // Handle loading held bill from Held Bills page
  useEffect(() => {
    const loadHeldBillId = sessionStorage.getItem('loadHeldBillId');
    console.log('DEBUG: loadHeldBillId from session:', loadHeldBillId);
    console.log('DEBUG: heldBills count:', heldBills.length);
    console.log('DEBUG: products count:', products.length);

    if (loadHeldBillId && heldBills.length > 0 && products.length > 0) {
      sessionStorage.removeItem('loadHeldBillId');
      const bill = heldBills.find(b => b.id.toString() === loadHeldBillId.toString());
      console.log('DEBUG: Found bill to load:', bill ? 'YES' : 'NO');
      if (bill) {
        loadHeldBill(bill);
      } else {
        console.warn('DEBUG: Bill ID not found in heldBills list:', loadHeldBillId);
      }
    }
  }, [heldBills, products, loadHeldBill]);

  // Note: Invoice data is now only cleared when "New Order" is clicked, not automatically
  const loadTaxes = async () => {
    try {
      const res = await fetch('/api/taxes');
      if (!res.ok) throw new Error('Failed');
      const t = await res.json();
      const withNoTax = [{ id: 'none', name: 'No Tax', percent: 0, isDefault: false }, ...t];
      setTaxes(withNoTax);
      localStorage.setItem('cached_taxes', JSON.stringify(withNoTax));
      const defTax = t.find((x: Tax) => x.isDefault);
      if (defTax) setTaxId(defTax.id);
    } catch (e) {
      const cached = localStorage.getItem('cached_taxes');
      if (cached) {
        const t = JSON.parse(cached);
        setTaxes(t);
        const defTax = t.find((x: Tax) => x.isDefault);
        if (defTax) setTaxId(defTax.id);
      }
    }
  };
  const loadHeld = async () => {
    try {
      const offlineQueue = JSON.parse(localStorage.getItem('offline_held_queue') || '[]');
      const hb = await fetch('/api/held-bills').then((r) => r.json());
      // Merge: Offline items first (they are more "recent" in the user's mind)
      const combined = [...offlineQueue, ...hb];
      setHeldBills(combined);
      localStorage.setItem('cached_held_bills', JSON.stringify(combined));
      return combined;
    } catch (e) {
      // Offline fallback
      const offlineQueue = JSON.parse(localStorage.getItem('offline_held_queue') || '[]');
      const cached = localStorage.getItem('cached_held_bills');
      let combined = offlineQueue;

      if (cached) {
        const cachedHB = JSON.parse(cached);
        // Combine and de-duplicate by ID to be safe
        const ids = new Set(offlineQueue.map((b: any) => b.id.toString()));
        combined = [...offlineQueue, ...cachedHB.filter((b: any) => !ids.has(b.id.toString()))];
      }

      setHeldBills(combined);
      return combined;
    }
  };

  const formatPrice = useCallback((amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return '0';
    return showPriceDecimals ? Number(amount).toFixed(2) : Number(amount).toFixed(0);
  }, [showPriceDecimals]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let itemDiscountTotal = 0;

    // Resolve effective tax percent first
    let effectiveTaxPercent = 0;
    // Explicit 'No Tax' check
    if (taxId === 'none') {
      effectiveTaxPercent = 0;
    } else if (taxMode === 'INCLUSIVE') {
      // In INCLUSIVE mode, we prioritize specific tax slab if selected, otherwise default
      // But based on backend, we should use the resolved tax.
      // Frontend simplification: If no taxId selected, find default.
      if (!taxId) {
        const defaultTax = taxes.find((t) => t.isDefault);
        if (defaultTax) effectiveTaxPercent = Number(defaultTax.percent);
      } else {
        const selectedTax = taxes.find((t) => t.id === taxId);
        if (selectedTax) effectiveTaxPercent = Number(selectedTax.percent);
      }
    } else {
      // EXCLUSIVE
      const selectedTax = taxes.find((t) => t.id === taxId);
      if (selectedTax) {
        effectiveTaxPercent = Number(selectedTax.percent);
      } else {
        // Fallback to product default? 
        // For now, let's stick to the selected global tax for the cart display estimation
        // Backend handles per-product, but frontend usually estimates based on global selection for simplicity unless we iterate all products.
        // Let's assume global selection for the "Cart Total" estimation.
      }
    }

    let totalTaxAmount = 0;

    const perItem = cart.map((line) => {
      const unitPrice = line.variant?.price ?? line.product.price;
      // 1. Display Price (Subtotal Source)
      const base = unitPrice * line.quantity;

      let discount = 0;
      if (line.discountType && line.discountValue) {
        discount = line.discountType === 'PERCENT' ? (base * line.discountValue) / 100 : line.discountValue * line.quantity;
      }

      // Net Price for Tax Calc
      const netPrice = Math.max(0, base - discount);

      // Calculate Tax per line to match backend
      let lineTax = 0;
      // Note: Backend has per-product tax fallback, but here we mainly use the global taxId state for the "Order Tax".
      // If we want perfection, we'd need to check each product's default tax if taxId is empty.
      // For this specific request, we use 'effectiveTaxPercent' resolved above.

      if (effectiveTaxPercent > 0) {
        if (taxMode === 'INCLUSIVE') {
          // Tax = (Net * Rate) / (100 + Rate)
          lineTax = (netPrice * effectiveTaxPercent) / (100 + effectiveTaxPercent);
        } else {
          // Tax = (Net * Rate) / 100
          lineTax = (netPrice * effectiveTaxPercent) / 100;
        }
      }

      totalTaxAmount += lineTax;

      return {
        productId: line.product.id,
        productName: line.product.name,
        variantId: line.variant?.id,
        variantName: line.variant?.name,
        quantity: line.quantity,
        price: Number(unitPrice),
        discount: Number(discount),
        tax: lineTax,
        total: taxMode === 'INCLUSIVE' ? netPrice : netPrice + lineTax // Line total for display
      };
    });

    perItem.forEach(i => {
      subtotal += i.price * i.quantity; // Gross subtotal
      itemDiscountTotal += i.discount;
    });

    let cartDiscountTotal = 0;
    if (cartDiscountValue) {
      const base = Math.max(0, subtotal - itemDiscountTotal);
      cartDiscountTotal = cartDiscountType === 'PERCENT' ? (base * cartDiscountValue) / 100 : cartDiscountValue;
    }

    let couponValue = 0;
    const afterDiscount = Math.max(0, subtotal - itemDiscountTotal - cartDiscountTotal);

    if (validatedCoupon) {
      if (validatedCoupon.type === 'PERCENT') {
        couponValue = (afterDiscount * Number(validatedCoupon.value)) / 100;
      } else {
        couponValue = Number(validatedCoupon.value);
      }
    }

    // Recalculate tax if cart discounts/coupons apply? 
    // Backend pricing.ts currently calculates tax on (ItemNet), and cart discounts are separate?
    // WARNING: In pricing.ts, cart discounts are applied AFTER subtotal.
    // However, for correct tax calculation on arguably "final" price, often systems assume item-level first.
    // The previous pricing.ts logic calculated tax on ITEM NET.
    // Cart-level discounts usually shouldn't reduce tax base unless distributed?
    // Let's stick to the current pricing.ts logic: Tax is sum of Line Taxes. 
    // Line Taxes are based on Item Net. Cart discount doesn't change Item Net.

    let total = 0;

    if (taxMode === 'INCLUSIVE') {
      // Total = Subtotal - All Discounts
      // Tax is internally extracted from this, ensuring Total doesn't increase.
      total = Math.max(0, subtotal - itemDiscountTotal - cartDiscountTotal - couponValue);
    } else {
      // Total = Subtotal - All Discounts + Tax
      total = Math.max(0, subtotal - itemDiscountTotal - cartDiscountTotal - couponValue) + totalTaxAmount;
    }

    return {
      subtotal,
      itemDiscountTotal,
      cartDiscountTotal,
      couponValue,
      taxPercent: effectiveTaxPercent,
      tax: totalTaxAmount,
      taxAmount: totalTaxAmount,
      total,
      perItem
    };
  }, [cart, cartDiscountType, cartDiscountValue, validatedCoupon, taxes, taxId, taxMode]);

  const getMaxStock = (product: Product, variant?: ProductVariant | null) => {
    if (product.type === 'SIMPLE') {
      if (product.isUnlimited) return 999999;
      return product.stock || 0;
    }
    if (product.type === 'VARIANT' && variant) {
      return (variant as any).stock || 0;
    }
    if (product.type === 'COMPOSITE') {
      // Calculate based on raw materials
      const materials = (product as any).materials || [];
      if (materials.length === 0) return 999999; // No recipe = assume infinite? or 0? sticking to existing behavior

      let maxProducible = 999999;
      for (const m of materials) {
        const rawMat = m.rawMaterial;
        // If unlimited, this material doesn't constrain us
        if (rawMat?.isUnlimited) continue;

        const requiredPerUnit = Number(m.quantity) || 0;
        const availableStock = Number(rawMat?.stock) || 0;

        if (requiredPerUnit <= 0) continue; // Should not happen but safety

        const maxForThis = Math.floor(availableStock / requiredPerUnit);
        if (maxForThis < maxProducible) {
          maxProducible = maxForThis;
        }
      }
      return maxProducible;
    }
    return 0;
  };

  const addToCart = (product: Product, variant?: ProductVariant) => {
    // Check stock before adding
    const availableStock = getMaxStock(product, variant);

    // Check current cart quantity
    const key = `${product.id}:${variant?.id || 'base'}`;
    const existing = cart.find((p) => `${p.product.id}:${p.variant?.id || 'base'}` === key);
    const currentQty = existing ? existing.quantity : 0;
    const requestedQty = currentQty + 1;

    if (requestedQty > availableStock) {
      showError(
        `Insufficient stock! Available: ${availableStock}, Requested: ${requestedQty}. Product: ${product.name}${variant ? ` (${variant.name})` : ''}`
      );
      return;
    }

    setCart((prev) => {
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
    setCart((prev) => {
      const item = prev.find((p) => `${p.product.id}:${p.variant?.id || 'base'}` === keyId);
      if (!item) return prev;

      // Check stock
      const availableStock = getMaxStock(item.product, item.variant);

      if (qty > availableStock) {
        showError(
          `Insufficient stock! Available: ${availableStock}, Requested: ${qty}. Product: ${item.product.name}${item.variant ? ` (${item.variant.name})` : ''}`
        );
        return prev;
      }

      return prev.map((p) => (`${p.product.id}:${p.variant?.id || 'base'}` === keyId ? { ...p, quantity: Math.max(1, qty) } : p));
    });
  };

  const updateItemDiscount = (keyId: string, discountType: 'PERCENT' | 'AMOUNT', value: number) => {
    setCart((prev) =>
      prev.map((p) =>
        `${p.product.id}:${p.variant?.id || 'base'}` === keyId ? { ...p, discountType, discountValue: value } : p
      )
    );
  };

  const removeLine = (keyId: string) => setCart((prev) => prev.filter((p) => `${p.product.id}:${p.variant?.id || 'base'}` !== keyId));

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      showError('Please enter a coupon code');
      return;
    }

    setApplyingCoupon(true);
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(couponCode.trim())}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Invalid coupon code');
      }
      const coupon = await res.json();
      setValidatedCoupon(coupon);
      showSuccess(`Coupon "${coupon.code}" applied successfully!`);
    } catch (err: any) {
      showError(err.message || 'Failed to validate coupon code');
      setValidatedCoupon(null);
    } finally {
      setApplyingCoupon(false);
    }
  };

  // Clear validated coupon when coupon code changes
  useEffect(() => {
    if (couponCode !== validatedCoupon?.code) {
      setValidatedCoupon(null);
    }
  }, [couponCode, validatedCoupon?.code]);

  // The duplicate declaration was here on line 139, and it has been removed.

  const checkout = async () => {
    if (cart.length === 0) {
      showError('Cart is empty');
      return;
    }
    // Show payment method selection modal
    setShowPaymentModal(true);
  };

  const syncLock = useRef(false);

  // Helper to remove item from local storage queue immediately after success
  const removeFromQueue = (key: string, itemId: string) => {
    const stored = localStorage.getItem(key);
    if (!stored) return;
    try {
      const queue = JSON.parse(stored);
      const filtered = queue.filter((i: any) => i.id !== itemId);
      if (filtered.length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    } catch (e) {
      console.error(`Failed to update queue ${key}`, e);
    }
  };

  const syncHeldBills = useCallback(async () => {
    if (!navigator.onLine || syncLock.current) return;
    const stored = localStorage.getItem('offline_held_queue');
    if (!stored) return;

    try {
      const queue = JSON.parse(stored);
      if (!Array.isArray(queue) || queue.length === 0) return;

      syncLock.current = true;
      setIsSyncing(true);

      for (const bill of queue) {
        try {
          const isOfflineId = bill.id.startsWith('OFF-');
          const dataToSync = {
            data: bill.data,
            id: isOfflineId ? undefined : bill.id
          };

          const res = await fetch('/api/held-bills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSync),
          });

          if (res.ok) {
            removeFromQueue('offline_held_queue', bill.id);
          }
        } catch (e) {
          console.error("Failed to sync held bill", bill.id, e);
        }
      }
      loadHeld(); // Refresh list from server
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, [loadHeld]);

  const syncOfflineOrders = useCallback(async () => {
    if (!navigator.onLine || syncLock.current) return;

    // Set lock IMMEDIATELY to prevent concurrent calls
    syncLock.current = true;
    setIsSyncing(true);

    try {
      // Sync held bills first (they might be dependencies)
      const heldStored = localStorage.getItem('offline_held_queue');
      if (heldStored) {
        const heldQueue = JSON.parse(heldStored);
        if (Array.isArray(heldQueue) && heldQueue.length > 0) {
          for (const bill of heldQueue) {
            try {
              const isOfflineId = bill.id.startsWith('OFF-');
              const dataToSync = {
                data: bill.data,
                id: isOfflineId ? undefined : bill.id
              };

              const res = await fetch('/api/held-bills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSync),
              });

              if (res.ok) {
                removeFromQueue('offline_held_queue', bill.id);
              }
            } catch (e) {
              console.error("Failed to sync held bill", bill.id, e);
            }
          }
          loadHeld();
        }
      }

      // Now sync orders
      const stored = localStorage.getItem('offline_orders');
      if (!stored) return;

      const orders = JSON.parse(stored);
      if (!Array.isArray(orders) || orders.length === 0) return;

      for (const order of orders) {
        try {
          const res = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order.payload),
          });

          if (res.ok) {
            removeFromQueue('offline_orders', order.id);
            setOfflineOrderCount(prev => Math.max(0, prev - 1));
          } else {
            throw new Error('Failed to post');
          }
        } catch (e) {
          console.error("Sync failed for order", order.id, e);
        }
      }
      showSuccess(`Offline sync completed.`);
    } catch (e) {
      console.error('Sync error', e);
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, [loadHeld, showSuccess]);

  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine);
    const count = JSON.parse(localStorage.getItem('offline_orders') || '[]').length;
    setOfflineOrderCount(count);
    if (navigator.onLine && count > 0) {
      syncOfflineOrders();
    }

    const handleOnline = () => {
      setIsOnline(true);
      showSuccess('Back Online! Syncing data...');
      syncOfflineOrders();
      loadProducts(''); // Refresh data
    };
    const handleOffline = () => {
      setIsOnline(false);
      showError('You are offline. Transactions will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const confirmCheckout = async () => {
    setLoading(true);
    setShowPaymentModal(false);

    const orderPayload = {
      items: cart.map((c) => ({
        productId: c.product.id,
        quantity: c.quantity,
        discountType: c.discountType ?? null,
        discountValue: c.discountValue ?? null,
        variantId: c.variant?.id ?? null,
      })),
      cartDiscountType: cartDiscountValue ? cartDiscountType : null,
      cartDiscountValue: cartDiscountValue || null,
      couponCode: validatedCoupon?.code || couponCode || null,
      taxId: taxId || null,
      paymentMethod: paymentMethod,
      heldBillId: currentHeldBillId || null,
      customerName,
      customerPhone,
    };

    try {
      if (!isOnline) {
        throw new Error('Offline');
      }

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        // If 5xx error or fetch failed, treat as potential offline candidate depending on error?
        // For now, strict check on isOnline or fetch throwing exception.
        // If fetch returns 400 (validation), we should NOT save offline.
        // If fetch returns 500 or network error, we MIGHT save offline.
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Checkout failed');
        }
        throw new Error('Network response was not ok');
      }

      // ... Success logic
      // ... Success logic: Remove from held bills if applicable
      if (currentHeldBillId) {
        // Remove from offline queue and cache
        const offlineQueue = JSON.parse(localStorage.getItem('offline_held_queue') || '[]');
        const updatedQueue = offlineQueue.filter((b: any) => b.id.toString() !== currentHeldBillId.toString());
        localStorage.setItem('offline_held_queue', JSON.stringify(updatedQueue));

        const cached = JSON.parse(localStorage.getItem('cached_held_bills') || '[]');
        const updatedCached = cached.filter((b: any) => b.id.toString() !== currentHeldBillId.toString());
        localStorage.setItem('cached_held_bills', JSON.stringify(updatedCached));

        setHeldBills(updatedCached);
        setCurrentHeldBillId(null);
      }
      setCart([]);
      setCouponCode('');
      setValidatedCoupon(null);
      setCartDiscountValue(0);
      const data = await res.json();
      setInvoiceData(data);
      showSuccess(`Sale recorded. Total: Rs. ${Number(data?.totals?.total ?? 0).toFixed(2)}`);

    } catch (e: any) {
      if (e.message === 'Offline' || e.message === 'Failed to fetch' || !navigator.onLine) {
        // Save Offline
        const offlineOrder = {
          id: `OFF-${Date.now()}`,
          timestamp: Date.now(),
          payload: orderPayload
        };

        const existing = JSON.parse(localStorage.getItem('offline_orders') || '[]');
        const updated = [...existing, offlineOrder];
        localStorage.setItem('offline_orders', JSON.stringify(updated));
        setOfflineOrderCount(updated.length);

        // Clear cart and show success
        setCart([]);
        setCouponCode('');
        setValidatedCoupon(null);
        setCartDiscountValue(0);
        if (currentHeldBillId) {
          // Cleanup from localStorage too
          const offlineQueue = JSON.parse(localStorage.getItem('offline_held_queue') || '[]');
          const updatedQueue = offlineQueue.filter((b: any) => b.id.toString() !== currentHeldBillId.toString());
          localStorage.setItem('offline_held_queue', JSON.stringify(updatedQueue));

          const cached = JSON.parse(localStorage.getItem('cached_held_bills') || '[]');
          const updatedCached = cached.filter((b: any) => b.id.toString() !== currentHeldBillId.toString());
          localStorage.setItem('cached_held_bills', JSON.stringify(updatedCached));

          setHeldBills(updatedCached);
          setCurrentHeldBillId(null);
        }

        // Mock invoice data for printing (limited)
        const mockInvoice = {
          sale: {
            orderId: offlineOrder.id,
            createdAt: new Date().toISOString(),
            paymentMethod,
            cashier: { name: 'Offline User' }
          },
          totals: totals // Use the locally calculated totals
        };
        setInvoiceData(mockInvoice);
        showSuccess('Order saved OFFLINE. Will sync when online.');
      } else {
        showError(e.message || 'Checkout failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const [fbrLoading, setFbrLoading] = useState(false);
  const [fbrInvoiceId, setFbrInvoiceId] = useState<string | null>(null);

  const sendToFBR = async (): Promise<string | null> => {
    if (!invoiceData?.sale?.id) {
      showError('No sale data available');
      return null;
    }

    // Check if FBR Invoice ID already exists
    if (invoiceData.sale?.fbrInvoiceId || fbrInvoiceId) {
      return invoiceData.sale?.fbrInvoiceId || fbrInvoiceId;
    }

    setFbrLoading(true);
    try {
      const paymentMode = invoiceData?.sale?.paymentMethod === 'CARD' ? 2 : 1;
      const res = await fetch(`/api/sales/${invoiceData.sale.id}/fbr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMode }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'FBR integration failed');
      }

      const data = await res.json();
      const newFbrId = data.fbrInvoiceId;
      setFbrInvoiceId(newFbrId);
      // Update invoice data with FBR Invoice ID
      setInvoiceData({
        ...invoiceData,
        sale: { ...invoiceData.sale, fbrInvoiceId: newFbrId },
      });
      showSuccess(`FBR Invoice generated successfully! Invoice ID: ${newFbrId}`);
      return newFbrId;
    } catch (e: any) {
      showError(e.message || 'FBR integration failed');
      return null;
    } finally {
      setFbrLoading(false);
    }
  };

  /**
   * Print Invoice function
   * @param includeFbrId - Set to true only when "Print FBR Invoice" is clicked
   * @param fbrIdToDisplay - FBR Invoice ID from FBR API response (only provided when includeFbrId is true)
   * 
   * This function does NOT send data to FBR API.
   * It only prints the invoice with or without FBR ID based on the parameters.
   */
  const printInvoice = async (includeFbrId: boolean = false, fbrIdToDisplay: string | null = null) => {
    if (!invoiceData?.sale) {
      showError('No invoice data available');
      return;
    }
    const setting = await fetch('/api/invoice-settings').then((r) => r.json()).catch(() => ({}));
    const invoice = invoiceData;
    if (!invoice) return;

    // Use unique window name to allow multiple prints
    const win = window.open('', `PRINT_${Date.now()}`, 'height=800,width=1200,menubar=0,toolbar=0,location=0,status=0');
    if (!win) return;

    const logo = setting?.logoUrl ? `<img src=\"${setting.logoUrl}\" style=\"max-width:150px;\" />` : '';
    const header = setting?.headerText ? `<div>${setting.headerText}</div>` : '';
    const footer = setting?.footerText ? `<div>${setting.footerText}</div>` : '';

    // CRITICAL: Only show FBR ID if BOTH conditions are met:
    // 1. includeFbrId is true (only set by "Print FBR Invoice" button)
    // 2. fbrIdToDisplay is provided (the actual FBR Invoice ID from API response)
    // This ensures "Print Invoice" button NEVER shows FBR ID
    const fbrId = includeFbrId && fbrIdToDisplay ? fbrIdToDisplay : null;
    const fontSize = setting?.fontSize || 12;
    const smallFontSize = Math.max(8, fontSize - 2);

    const items =
      invoice?.totals?.perItem
        ?.map(
          (i: any) => {
            // Item total = Quantity × Unit Price only (no tax, no discount)
            const price = Number(i.price);
            const itemTotal = price * i.quantity;
            return `<tr><td>${i.productName || 'Unknown'}${i.variantName ? ` (${i.variantName})` : ''}</td><td>${i.quantity}</td><td>Rs. ${formatPrice(price)}</td><td>Rs. ${formatPrice(itemTotal)}</td></tr>`;
          }
        )
        .join('') || '';
    const html = `
      <html>
        <head>
          <title>Invoice ${invoice.sale?.orderId || 'N/A'}</title>
        </head>
        <body style="font-family: monospace; font-size: ${fontSize}px;">
          <div style="text-align:center;">
            ${logo}
            ${header}
          </div>
          <div style="margin-top:8px;font-size:${fontSize}px;">
            Order ID: ${invoice.sale?.orderId || 'N/A'}<br/>
            ${fbrId ? `FBR Invoice ID: ${fbrId}<br/>` : ''}
            Date: ${new Date(invoice.sale?.createdAt || Date.now()).toLocaleString()}<br/>
            ${setting?.showCashier !== false ? `Cashier: ${invoice.sale?.cashier?.name || invoice.sale?.cashier?.email || 'Unknown'}<br/>` : ''}
            Payment Method: ${invoice.sale?.paymentMethod === 'CARD' ? 'Card' : 'Cash'}<br/>
            ${setting?.customFields && Array.isArray(setting.customFields) && setting.customFields.length > 0
        ? setting.customFields.map((field: any) => `<div><strong>${field.label}:</strong> ${field.value}</div>`).join('')
        : ''}
          </div>
          <table style="width:100%;font-size:${fontSize}px;margin-top:8px;">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>${items}</tbody>
          </table>
          <div style="margin-top:8px;font-size:${fontSize}px;text-align:right;">
            Subtotal: Rs. ${formatPrice(invoice.totals.subtotal)}<br/>
            ${setting?.showDiscount !== false ? `Discount: Rs. ${formatPrice(Number(invoice.totals.itemDiscountTotal) + Number(invoice.totals.cartDiscountTotal) + Number(invoice.totals.couponValue))}<br/>` : ''}
            ${setting?.showTax !== false ? `Tax: Rs. ${formatPrice(invoice.totals.taxAmount)}<br/>` : ''}
            <strong>Total: Rs. ${formatPrice(invoice.totals.total)}</strong>
          </div>
          <div style="text-align:center;margin-top:12px;font-size:${fontSize}px;">${footer}</div>
          <div style="text-align:center;margin-top:4px;font-size:${smallFontSize}px;border-top:1px dashed #ccc;padding-top:4px;">Developed by: AmanatPOS - +923344668996</div>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    // Don't close immediately - let user cancel print dialog if needed
    setTimeout(() => {
      try {
        win.close();
      } catch (e) {
        // Ignore if window already closed
      }
    }, 1000);
  };

  /**
   * Print FBR Invoice function
   * This function:
   * 1. Sends order data to FBR API
   * 2. Receives FBR Invoice Number/USIN from FBR API response
   * 3. Displays the FBR Invoice Number on the printed invoice
   * 
   * This is ONLY called when "Print FBR Invoice" button is clicked.
   */
  const printFBRInvoice = async () => {
    if (!invoiceData?.sale?.id) {
      showError('No sale data available');
      return;
    }

    // Step 1: Send order data to FBR API and receive FBR Invoice Number
    const fbrId = await sendToFBR();

    if (fbrId) {
      // Step 2: Wait a moment for state to update, then print with FBR ID
      setTimeout(() => {
        // Get the latest FBR ID from state (may have been updated by sendToFBR)
        const currentFbrId = invoiceData?.sale?.fbrInvoiceId || fbrInvoiceId || fbrId;
        // Step 3: Print invoice with FBR Invoice Number displayed
        printInvoice(true, currentFbrId);
      }, 500);
    } else {
      showError('Failed to generate FBR Invoice. Cannot print.');
    }
  };

  const startNewOrder = () => {
    setCart([]);
    setCouponCode('');
    setValidatedCoupon(null);
    setCartDiscountValue(0);
    setInvoiceData(null);
    setFbrInvoiceId(null);
    setCurrentHeldBillId(null);
    setCustomerName('');
    setCustomerPhone('');
    setIsLoadedCart(false); // Clear loaded cart flag
  };

  const handleSaveCartClick = () => {
    if (cart.length === 0) {
      showError('Nothing to save');
      return;
    }
    // Always show prompt for cart name
    // Only pre-fill if we're updating a cart that was explicitly loaded from saved carts
    // We track this with a flag to distinguish between "loaded cart" vs "newly saved cart"
    if (currentHeldBillId && isLoadedCart) {
      const existingBill = heldBills.find(b => b.id === currentHeldBillId);
      const existingLabel = existingBill?.data?.label || '';
      setCartName(existingLabel);
    } else {
      setCartName('');
    }
    setShowCartNamePrompt(true);
  };

  const saveCart = async (name?: string) => {
    if (cart.length === 0) {
      showError('Nothing to save');
      return;
    }

    // Prepare payload first
    const existingLabel = (currentHeldBillId && isLoadedCart) ? heldBills.find(b => b.id === currentHeldBillId)?.data?.label : null;
    const payload = {
      cart,
      cartDiscountType,
      cartDiscountValue,
      couponCode: validatedCoupon?.code || couponCode || null,
      taxId,
      label: name || cartName || existingLabel || `Cart ${new Date().toLocaleString()}`,
    };

    // CHECK OFFLINE STATUS FIRST - before any try/catch
    if (!navigator.onLine) {
      // Offline Save Logic
      setLoading(true);
      const offlineId = (currentHeldBillId && isLoadedCart) ? currentHeldBillId : `OFF-HELD-${Date.now()}`;
      const offlineBill = {
        id: offlineId,
        createdAt: new Date().toISOString(),
        data: payload,
        isOffline: true
      };

      // 1. Update cached held bills (Display)
      const cached = JSON.parse(localStorage.getItem('cached_held_bills') || '[]');
      const updatedCached = (currentHeldBillId && isLoadedCart)
        ? cached.map((b: any) => b.id === offlineId ? offlineBill : b)
        : [offlineBill, ...cached];
      localStorage.setItem('cached_held_bills', JSON.stringify(updatedCached));
      setHeldBills(updatedCached);

      // 2. Queue for Sync
      const offlineQueue = JSON.parse(localStorage.getItem('offline_held_queue') || '[]');
      // Remove any previous update for same ID to avoid duplicates in queue
      const filteredQueue = offlineQueue.filter((q: any) => q.id !== offlineId);
      filteredQueue.push(offlineBill);
      localStorage.setItem('offline_held_queue', JSON.stringify(filteredQueue));

      if (currentHeldBillId && isLoadedCart) {
        // Updated existing
      } else {
        // Created new
        setCurrentHeldBillId(null);
        setIsLoadedCart(false);
      }

      showSuccess(`Cart saved OFFLINE. (${cart.length} items)`);
      console.log('OFFLINE SAVE DEBUG:', JSON.stringify(payload));
      setShowCartNamePrompt(false);
      setCartName('');
      setLoading(false);
      startNewOrder();
      return;
    }

    // ONLINE: Save to server
    setLoading(true);
    try {
      // Only pass id if we're updating a loaded cart, otherwise create new
      const res = await fetch('/api/held-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload, id: (currentHeldBillId && isLoadedCart) ? currentHeldBillId : undefined }), // Update only if loaded cart
      });
      if (!res.ok) throw new Error('Failed to save cart');
      const saved = await res.json();

      // Update local state and cache to keep them in sync
      let newHeldBills;
      if (currentHeldBillId && isLoadedCart) {
        newHeldBills = heldBills.map((b) => (b.id === currentHeldBillId ? saved : b));
      } else {
        newHeldBills = [saved, ...heldBills];
        setCurrentHeldBillId(null);
        setIsLoadedCart(false);
      }
      setHeldBills(newHeldBills);
      localStorage.setItem('cached_held_bills', JSON.stringify(newHeldBills));

      showSuccess('Cart saved successfully');
      setShowCartNamePrompt(false);
      setCartName('');
      startNewOrder();
    } catch (e: any) {
      // If network fails (even if navigator.onLine was true initially), fallback to offline save
      console.error('Save cart failed:', e);

      // Check if it's a network error or explicitly "Offline"
      if (
        e.message === 'Failed to fetch' ||
        e.message === 'Network request failed' ||
        e.message.includes('network') ||
        !navigator.onLine
      ) {
        // Fallback: Save Offline
        setLoading(true);
        const offlineId = (currentHeldBillId && isLoadedCart) ? currentHeldBillId : `OFF-HELD-${Date.now()}`;
        const offlineBill = {
          id: offlineId,
          createdAt: new Date().toISOString(),
          data: payload,
          isOffline: true
        };

        // 1. Update cached held bills (Display)
        const cached = JSON.parse(localStorage.getItem('cached_held_bills') || '[]');
        const updatedCached = (currentHeldBillId && isLoadedCart)
          ? cached.map((b: any) => b.id === offlineId ? offlineBill : b)
          : [offlineBill, ...cached];
        localStorage.setItem('cached_held_bills', JSON.stringify(updatedCached));
        setHeldBills(updatedCached);

        // 2. Queue for Sync
        const offlineQueue = JSON.parse(localStorage.getItem('offline_held_queue') || '[]');
        const filteredQueue = offlineQueue.filter((q: any) => q.id !== offlineId);
        filteredQueue.push(offlineBill);
        localStorage.setItem('offline_held_queue', JSON.stringify(filteredQueue));

        if (currentHeldBillId && isLoadedCart) {
          // Updated existing
        } else {
          // Created new
          setCurrentHeldBillId(null);
          setIsLoadedCart(false);
        }

        showSuccess(`Cart saved OFFLINE (Network Error). (${cart.length} items)`);
        setShowCartNamePrompt(false);
        setCartName('');
        setLoading(false);
        startNewOrder();
        return;
      }

      showError(e.message || 'Save cart failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCartNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartName.trim()) {
      showError('Please enter a cart name');
      return;
    }
    saveCart(cartName.trim());
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="mt-2 text-gray-600">Add items, apply discounts/coupons, and checkout.</p>
        </div>
        <div className="flex items-center gap-3">
          {offlineOrderCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-1 rounded text-sm">
              <span className="font-semibold">{offlineOrderCount} offline orders</span>
              {isOnline && (
                <button
                  onClick={syncOfflineOrders}
                  disabled={isSyncing}
                  className="ml-2 flex items-center gap-1 bg-amber-200 hover:bg-amber-300 px-2 py-0.5 rounded text-xs transition-colors"
                >
                  <RefreshCcw size={12} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              )}
            </div>
          )}
          <div className={`flex items-center gap-2 px-3 py-1 rounded text-sm ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span className="font-semibold">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-4 border rounded bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Products</h2>
            <div className="flex items-center gap-4">
              {products.length > ITEMS_PER_PAGE && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-0.5 border rounded text-xs hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-gray-500">
                    Page {currentPage} of {Math.ceil(products.length / ITEMS_PER_PAGE)}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(products.length / ITEMS_PER_PAGE), p + 1))}
                    disabled={currentPage === Math.ceil(products.length / ITEMS_PER_PAGE)}
                    className="px-2 py-0.5 border rounded text-xs hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
              <span className="text-sm text-gray-600">{products.length} items</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
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

            {/* Sorting Controls */}
            <div className="flex items-center gap-2">
              <label className="flex items-center space-x-1 text-sm px-2 py-1 border rounded hover:bg-gray-50 bg-white cursor-pointer select-none" title="Show Favorites First">
                <input
                  type="checkbox"
                  checked={favoritesFirst}
                  onChange={(e) => setFavoritesFirst(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Favorites</span>
              </label>

              <div className="flex border rounded overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSortBy('NAME')}
                  className={`px-3 py-1 text-sm ${sortBy === 'NAME' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                >
                  Name
                </button>
                <div className="w-px bg-gray-200"></div>
                <button
                  type="button"
                  onClick={() => setSortBy('LATEST')}
                  className={`px-3 py-1 text-sm ${sortBy === 'LATEST' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                >
                  Latest
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSortAsc(!sortAsc)}
                className="p-1 border rounded hover:bg-gray-50 text-gray-600"
                title={sortAsc ? "Sort Ascending" : "Sort Descending"}
              >
                {sortAsc ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {sortedProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((p) => (
              <div key={p.id} className={`border rounded px-3 py-2 text-left relative ${p.isFavorite ? 'ring-1 ring-amber-400 bg-amber-50/30' : ''}`}>
                {p.isFavorite && <span className="absolute top-1 right-1 text-amber-500 text-xs text-yellow-500">★</span>}
                <div className="font-medium mr-3">{p.name}</div>
                <div className="text-xs text-gray-500">{p.sku}</div>
                <div className="text-sm text-gray-700">Rs. {formatPrice(p.price)}</div>
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
                          {v.name || 'Variant'} {attrStr ? `(${attrStr})` : ''} - Rs. {formatPrice(v.price)}
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

          {/* Pagination Controls */}
          {products.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 pt-2 border-t">
              <span className="text-sm text-gray-600">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, products.length)} of {products.length} entries
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm bg-gray-100 px-3 py-1 rounded flex items-center">
                  Page {currentPage} of {Math.ceil(products.length / ITEMS_PER_PAGE)}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(products.length / ITEMS_PER_PAGE), p + 1))}
                  disabled={currentPage === Math.ceil(products.length / ITEMS_PER_PAGE)}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border rounded bg-white space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              placeholder="Customer Name (Optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Customer Phone (Optional)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Cart</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveCartClick}
                className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                disabled={loading || cart.length === 0}
              >
                Save Cart
              </button>
              <button
                type="button"
                onClick={() => setShowHeld((v) => !v)}
                className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                {showHeld ? 'Hide Saved' : 'Saved Carts'}
              </button>
            </div>
          </div>
          {showHeld && (
            <div className="border rounded p-2 max-h-48 overflow-auto space-y-1">
              {heldBills.map((b) => {
                const cartLabel = (b.data as any)?.label;
                return (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <div>
                      {cartLabel ? (
                        <div className="font-medium">{cartLabel}</div>
                      ) : null}
                      <div className="text-xs text-gray-500">
                        Saved at {new Date(b.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-2 py-1 border rounded" onClick={() => loadHeldBill(b)}>
                        Load
                      </button>
                    </div>
                  </div>
                );
              })}
              {heldBills.length === 0 && <p className="text-xs text-gray-500">No saved carts.</p>}
            </div>
          )}
          <div className="space-y-2">
            {cart.map((line) => (
              <div key={`${line.product.id}:${line.variant?.id || 'base'}`} className="border rounded px-2 py-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      {line.product.name}
                      <span className="ml-2 text-gray-600 font-normal text-sm">
                        (Rs. {formatPrice(line.variant ? line.variant.price : line.product.price)})
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{line.product.sku}</div>
                    {line.variant && (
                      <div className="text-xs text-gray-600">
                        {line.variant.name || 'Variant'}{' '}
                        {line.variant.attributes
                          ? `(${Object.entries(line.variant.attributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')})`
                          : ''}{' '}
                        @ Rs. {formatPrice(line.variant.price)}
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
                  <label className="text-xs text-gray-700 ml-2">Item Discount</label>
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
                  // Don't clear invoiceData here - only clear on "New Order"
                  setCurrentHeldBillId(null);
                  setIsLoadedCart(false);
                }}
                disabled={cart.length === 0 || !!invoiceData}
              >
                Clear Cart
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="space-y-1 block flex-1">
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

            {/* Action Buttons Row */}
            <div className="flex gap-2">
              {!showCartDiscount && (
                <button
                  type="button"
                  onClick={() => setShowCartDiscount(true)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                >
                  Add Discount
                </button>
              )}
              {!showCouponInput && !validatedCoupon && (
                <button
                  type="button"
                  onClick={() => setShowCouponInput(true)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                >
                  Apply Coupon
                </button>
              )}
            </div>

            {/* Hidden Inputs */}
            {showCartDiscount && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200 p-2 border rounded bg-gray-50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">Cart Discount</span>
                  <button
                    onClick={() => {
                      setShowCartDiscount(false);
                      setCartDiscountValue(0);
                    }}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
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
              </div>
            )}

            {(showCouponInput || validatedCoupon) && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200 p-2 border rounded bg-gray-50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">Coupon Code</span>
                  <button
                    onClick={() => {
                      setShowCouponInput(false);
                      setCouponCode('');
                      setValidatedCoupon(null);
                    }}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 border rounded px-2 py-1 text-sm"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyCoupon();
                      }
                    }}
                    placeholder="e.g. SAVE10"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={applyingCoupon || !couponCode.trim()}
                    className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    title="Apply coupon code"
                  >
                    {applyingCoupon ? '...' : validatedCoupon ? '✓' : 'Apply'}
                  </button>
                </div>
                {validatedCoupon && (
                  <div className="text-xs text-green-600 mt-1">
                    ✓ {validatedCoupon.code} applied: {validatedCoupon.type === 'PERCENT' ? `${validatedCoupon.value}%` : `Rs. ${formatPrice(validatedCoupon.value)}`} off
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>Rs. {formatPrice(totals.subtotal)}</span></div>
            <div className="flex justify-between text-amber-700"><span>Item discounts</span><span>- Rs. {formatPrice(totals.itemDiscountTotal)}</span></div>
            <div className="flex justify-between text-amber-700"><span>Cart discount</span><span>- Rs. {formatPrice(totals.cartDiscountTotal)}</span></div>
            {totals.couponValue > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Coupon {validatedCoupon ? `(${validatedCoupon.code})` : '(est.)'}</span>
                <span>- Rs. {formatPrice(totals.couponValue)}</span>
              </div>
            )}
            <div className="flex justify-between text-green-700"><span>Tax ({totals.taxPercent}%)</span><span>+ Rs. {formatPrice(totals.tax)}</span></div>
            <div className="flex justify-between font-semibold text-lg pt-2 border-t"><span>Total</span><span>Rs. {formatPrice(totals.total)}</span></div>
          </div>

          <div className="flex gap-2">
            <button
              disabled={loading || cart.length === 0}
              onClick={checkout}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Checkout'}
            </button>
            {invoiceData && (
              <button
                onClick={() => {
                  if (cart.length > 0) {
                    setNewOrderModalOpen(true);
                  } else {
                    startNewOrder();
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
              >
                New Order
              </button>
            )}
          </div>
          {invoiceData && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => printInvoice(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800"
              >
                Print Invoice
              </button>
              <button
                onClick={printFBRInvoice}
                disabled={fbrLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {fbrLoading ? 'Processing...' : 'Print FBR Invoice'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 md:p-6 w-full max-w-sm md:max-w-md shadow-xl transform transition-all scale-100">
            <h3 className="text-xl md:text-lg font-bold mb-4 text-center md:text-left">Select Payment Method</h3>
            <div className="space-y-3 mb-6">
              <label className="flex items-center p-4 border-2 border-transparent hover:border-blue-100 bg-gray-50 rounded-xl cursor-pointer hover:bg-blue-50 transition-all active:scale-[0.98]">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="CASH"
                  checked={paymentMethod === 'CASH'}
                  onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'CARD')}
                  className="w-5 h-5 text-blue-600 mr-4"
                />
                <span className="text-lg font-medium">Cash Payment</span>
              </label>
              <label className="flex items-center p-4 border-2 border-transparent hover:border-blue-100 bg-gray-50 rounded-xl cursor-pointer hover:bg-blue-50 transition-all active:scale-[0.98]">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="CARD"
                  checked={paymentMethod === 'CARD'}
                  onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'CARD')}
                  className="w-5 h-5 text-blue-600 mr-4"
                />
                <span className="text-lg font-medium">Card Payment</span>
              </label>
            </div>
            <div className="flex flex-col-reverse md:flex-row gap-3 md:justify-end mt-6">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCheckout}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Name Prompt Modal */}
      {showCartNamePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Save Cart</h3>
            <form onSubmit={handleCartNameSubmit}>
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-2">Enter Cart Name *</label>
                <input
                  type="text"
                  value={cartName}
                  onChange={(e) => setCartName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g. Customer Order, Morning Sale"
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCartNamePrompt(false);
                    setCartName('');
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !cartName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={newOrderModalOpen}
        title="Start New Order"
        message="Are you sure you want to start a new order? This will clear all items from the current cart."
        onConfirm={() => {
          setNewOrderModalOpen(false);
          startNewOrder();
        }}
        onCancel={() => setNewOrderModalOpen(false)}
        confirmText="Clear & Start New"
      />
    </div>
  );
}