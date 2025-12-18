import { Coupon, DiscountRule, Product, TaxSetting } from '@prisma/client';

type ItemInput = {
  product: Product;
  quantity: number;
  discountRule?: DiscountRule | null;
  variantId?: string | null;
  overridePrice?: number | null;
  taxPercent?: number; // optional per-line tax
};

type TotalsResult = {
  subtotal: number;
  itemDiscountTotal: number;
  cartDiscountTotal: number;
  couponValue: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  perItem: Array<{
    productId: string;
    productName: string;
    variantId?: string | null;
    variantName?: string | null;
    quantity: number;
    price: number;
    discount: number;
    tax: number;
    total: number;
    taxPercent: number;
  }>;
};

function applyRule(amount: number, rule?: DiscountRule | null): number {
  if (!rule) return 0;
  if (rule.type === 'PERCENT') return (amount * Number(rule.value)) / 100;
  return Number(rule.value);
}

export function calculateTotals(opts: {
  items: ItemInput[];
  cartRule?: DiscountRule | null;
  coupon?: Coupon | null;
  tax?: TaxSetting | null;
  taxMode?: 'EXCLUSIVE' | 'INCLUSIVE'; // Tax pricing mode
}): TotalsResult {
  const taxMode = opts.taxMode || 'EXCLUSIVE'; // Default to EXCLUSIVE
  const perItem: TotalsResult['perItem'] = [];
  let subtotal = 0;
  let itemDiscountTotal = 0;

  for (const line of opts.items) {
    const unitPrice = line.overridePrice ?? Number(line.product.price);
    const taxPercent = line.taxPercent ?? 0;
    
    // Item total always uses the original display price (Quantity × Price)
    // Do not change display prices; tax is calculated internally
    const lineBase = unitPrice * line.quantity; // Item total = Quantity × Price (display price)
    const lineDiscount = line.discountRule && line.discountRule.scope === 'ITEM' ? applyRule(lineBase, line.discountRule) : 0;
    const lineNet = Math.max(0, lineBase - lineDiscount);
    subtotal += lineBase;
    itemDiscountTotal += lineDiscount;
    // Get variant name if variantId is provided
    let variantName: string | null = null;
    if (line.variantId && (line.product as any).variants && Array.isArray((line.product as any).variants)) {
      const variant = ((line.product as any).variants as any[]).find((v: any) => v.id === line.variantId);
      if (variant) {
        variantName = variant.name || null;
        // If variant name is not set, try to generate from attributes
        if (!variantName && variant.attributes) {
          const attrValues = Object.values(variant.attributes).filter(Boolean);
          if (attrValues.length > 0) {
            variantName = attrValues.join(' ');
          }
        }
      }
    }
    perItem.push({
      productId: line.product.id,
      productName: line.product.name,
      variantId: line.variantId ?? null,
      variantName: variantName,
      quantity: line.quantity,
      price: unitPrice, // Display price (original price - unchanged)
      discount: lineDiscount,
      tax: 0, // Will be calculated later based on tax mode
      total: lineBase, // Item total = Quantity × Price (display price - unchanged)
      taxPercent,
    });
  }

  let cartDiscountTotal = 0;
  if (opts.cartRule && opts.cartRule.scope === 'CART') {
    cartDiscountTotal = applyRule(Math.max(0, subtotal - itemDiscountTotal), opts.cartRule);
  }

  let couponValue = 0;
  if (opts.coupon) {
    const baseForCoupon = Math.max(0, subtotal - itemDiscountTotal - cartDiscountTotal);
    couponValue = opts.coupon.type === 'PERCENT' ? (baseForCoupon * Number(opts.coupon.value)) / 100 : Number(opts.coupon.value);
  }

  const discountTotal = itemDiscountTotal + cartDiscountTotal + couponValue;
  // If a cart-level tax is provided, use it; otherwise use per-item taxPercent
  const cartTaxPercent = opts.tax ? Number(opts.tax.percent) : null;

  let taxAmount = 0;
  if (cartTaxPercent !== null) {
    // Cart-level tax
    const taxableBase = Math.max(0, subtotal - discountTotal);
    if (taxMode === 'INCLUSIVE') {
      // Tax Inclusive: Product prices are final (tax included)
      // Extract tax using reverse calculation: Tax = (Price × DefaultTaxRate) / (100 + DefaultTaxRate)
      // Always use the cart tax (which should be default tax in Inclusive mode)
      taxAmount = (taxableBase * cartTaxPercent) / (100 + cartTaxPercent);
      // Allocate tax proportionally to items
      const allocationBase = perItem.reduce((sum, p) => sum + p.total, 0) || 1;
      for (const p of perItem) {
        const share = p.total / allocationBase;
        p.tax = taxAmount * share;
        p.taxPercent = cartTaxPercent;
      }
    } else {
      // Tax Exclusive: Add tax on top
      taxAmount = (taxableBase * cartTaxPercent) / 100;
      // Allocate tax proportionally to items
      const allocationBase = perItem.reduce((sum, p) => sum + p.total, 0) || 1;
      for (const p of perItem) {
        const share = p.total / allocationBase;
        p.tax = taxAmount * share;
        p.taxPercent = cartTaxPercent;
      }
    }
  } else {
    // per-item tax (but in Tax Inclusive mode, all items use default tax)
    if (taxMode === 'INCLUSIVE') {
      // Tax Inclusive: Product prices are final (tax included)
      // Extract tax using reverse calculation: Tax = (Price × DefaultTaxRate) / (100 + DefaultTaxRate)
      // All items use the same default tax rate (from taxPercent which is set to default tax)
      for (const p of perItem) {
        if (p.taxPercent > 0) {
          // Calculate tax from the item total (which uses display price)
          // Tax = (Price × DefaultTaxRate) / (100 + DefaultTaxRate)
          // Always use default tax slab rate for Tax Inclusive mode
          const lineTax = (p.total * p.taxPercent) / (100 + p.taxPercent);
          p.tax = lineTax;
          taxAmount += lineTax;
        }
      }
    } else {
      // Tax Exclusive: Add tax on top
      for (const p of perItem) {
        if (p.taxPercent > 0) {
          const base = p.total;
          const lineTax = (base * p.taxPercent) / 100;
          p.tax = lineTax;
          taxAmount += lineTax;
        }
      }
    }
  }

  // Final total calculation
  let total = 0;
  if (taxMode === 'INCLUSIVE') {
    // Tax Inclusive: Total = Subtotal - Discount (tax already included)
    total = Math.max(0, subtotal - discountTotal);
  } else {
    // Tax Exclusive: Total = Subtotal - Discount + Tax
    total = Math.max(0, subtotal - discountTotal) + taxAmount;
  }

  return {
    subtotal,
    itemDiscountTotal,
    cartDiscountTotal,
    couponValue,
    taxPercent: cartTaxPercent ?? 0,
    taxAmount,
    total,
    perItem,
  };
}

