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
  let totalTaxAmount = 0;

  for (const line of opts.items) {
    const unitPrice = line.overridePrice ?? Number(line.product.price);
    const taxPercent = line.taxPercent ?? 0;

    // Item total always uses the original display price (Quantity × Price)
    const lineBase = unitPrice * line.quantity;
    const lineDiscount = line.discountRule && line.discountRule.scope === 'ITEM' ? applyRule(lineBase, line.discountRule) : 0;

    // ItemNetValue is (Price * Quantity) - Discount
    const lineNet = Math.max(0, lineBase - lineDiscount);

    subtotal += lineBase;
    itemDiscountTotal += lineDiscount;

    // Calculate Tax per item based on Net Value
    let lineTax = 0;
    if (taxPercent > 0) {
      if (taxMode === 'INCLUSIVE') {
        // Tax Inclusive: LineNet includes tax
        // Tax = (ItemNetValue * TaxRate) / (100 + TaxRate)
        lineTax = (lineNet * taxPercent) / (100 + taxPercent);
      } else {
        // Tax Exclusive: LineNet is before tax
        // Tax = (ItemNetValue * TaxRate) / 100
        lineTax = (lineNet * taxPercent) / 100;
      }
    } else {
      lineTax = 0;
    }

    totalTaxAmount += lineTax;

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
      price: unitPrice, // Display price 
      discount: lineDiscount,
      tax: lineTax,
      total: taxMode === 'INCLUSIVE' ? lineNet : lineNet + lineTax,
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

  // Final total calculation
  let total = 0;
  if (taxMode === 'INCLUSIVE') {
    // Tax Inclusive: Total = Subtotal - Discount (tax already included in price)
    total = Math.max(0, subtotal - discountTotal);
  } else {
    // Tax Exclusive: Total = Subtotal - Discount + Tax
    total = Math.max(0, subtotal - discountTotal) + totalTaxAmount;
  }

  return {
    subtotal,
    itemDiscountTotal,
    cartDiscountTotal,
    couponValue,
    taxPercent: 0, // No longer a single cart-wide tax percent
    taxAmount: totalTaxAmount,
    total,
    perItem,
  };
}

