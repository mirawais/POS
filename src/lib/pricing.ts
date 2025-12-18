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
}): TotalsResult {
  const perItem: TotalsResult['perItem'] = [];
  let subtotal = 0;
  let itemDiscountTotal = 0;

  for (const line of opts.items) {
    const unitPrice = line.overridePrice ?? Number(line.product.price);
    const lineBase = unitPrice * line.quantity;
    const lineDiscount = line.discountRule && line.discountRule.scope === 'ITEM' ? applyRule(lineBase, line.discountRule) : 0;
    const lineNet = Math.max(0, lineBase - lineDiscount);
    subtotal += lineBase;
    itemDiscountTotal += lineDiscount;
    const taxPercent = line.taxPercent ?? 0;
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
      price: unitPrice,
      discount: lineDiscount,
      tax: 0,
      total: lineNet,
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
    const taxableBase = Math.max(0, subtotal - discountTotal);
    taxAmount = (taxableBase * cartTaxPercent) / 100;
    const allocationBase = perItem.reduce((sum, p) => sum + p.total, 0) || 1;
    for (const p of perItem) {
      const share = p.total / allocationBase;
      p.tax = taxAmount * share;
      p.total = p.total + p.tax;
      p.taxPercent = cartTaxPercent;
    }
  } else {
    // per-item tax
    for (const p of perItem) {
      const base = p.total;
      const lineTax = (base * p.taxPercent) / 100;
      p.tax = lineTax;
      p.total = p.total + lineTax;
      taxAmount += lineTax;
    }
  }

  const total = Math.max(0, subtotal - discountTotal) + taxAmount;

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

