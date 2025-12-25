import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateTotals } from '@/lib/pricing';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

type LineInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  discountType?: 'PERCENT' | 'AMOUNT' | null;
  discountValue?: number | null;
};

// Generate unique order ID: YYYYMMDD-XXXXX
function generateOrderId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${dateStr}-${random}`;
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let clientId = user.clientId as string;
    const { searchParams } = new URL(req.url);

    // Super Admin impersonation
    if (user.role === 'SUPER_ADMIN') {
      const targetClient = searchParams.get('clientId');
      if (targetClient) clientId = targetClient;
    }

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const cashierId = searchParams.get('cashierId');
    const orderId = searchParams.get('orderId');

    const where: any = {};
    if (clientId) {
      where.clientId = clientId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    if (cashierId) where.cashierId = cashierId;
    if (orderId) where.orderId = { contains: orderId, mode: 'insensitive' };

    const sales = await (prisma as any).sale.findMany({
      where,
      include: {
        cashier: { select: { id: true, name: true, email: true } },
        refunds: { select: { id: true, refundId: true, total: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, name: true, sku: true, attributes: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    return NextResponse.json(sales);
  } catch (e: any) {
    console.error('sales GET error', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to fetch sales' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let clientId = user.clientId as string;

    // Super Admin theoretically shouldn't be making sales, but if they do:
    if (user.role === 'SUPER_ADMIN') {
      // Super Admin creating sales is an edge case best avoided to prevent data pollution.
      if (!clientId) {
        return NextResponse.json({ error: 'Super Admin cannot perform sales directly. Log in as a client user.' }, { status: 403 });
      }
    }

    const body = await req.json();
    const { items, cartDiscountType, cartDiscountValue, couponCode, taxId, heldBillId, paymentMethod = 'CASH' } = body ?? {};
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'No items' }, { status: 400 });
    if (!['CASH', 'CARD'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Payment method must be CASH or CARD' }, { status: 400 });
    }

    const productIds = items.map((i: LineInput) => i.productId);
    const products = (await (prisma as any).product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true, materials: { include: { rawMaterial: true } } },
    })) as any[];

    // Verify all products belong to this client
    const invalidProducts = products.filter(p => p.clientId !== clientId);
    if (invalidProducts.length > 0) {
      return NextResponse.json({ error: 'Security Violation: Attempting to sell products from another client' }, { status: 403 });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    const coupon = couponCode
      ? await (prisma as any).coupon.findFirst({ where: { code: couponCode.toUpperCase(), isActive: true, clientId } })
      : null;

    // Fetch tax mode from invoice settings FIRST
    const invoiceSetting = await (prisma as any).invoiceSetting.findUnique({
      where: { clientId },
    });
    const taxMode = (invoiceSetting?.taxMode || 'EXCLUSIVE') as 'EXCLUSIVE' | 'INCLUSIVE';

    // Get default tax slab - always use this for Tax Inclusive mode
    const defaultTax = await (prisma as any).taxSetting.findFirst({
      where: { clientId, isDefault: true },
    });

    const tax =
      taxId === 'none'
        ? null
        : (taxId ? await (prisma as any).taxSetting.findUnique({ where: { id: taxId, clientId } }) : null) ||
        defaultTax ||
        null;

    const itemInputs = (items as LineInput[]).map((line) => {
      const product = productMap.get(line.productId);
      if (!product) throw new Error(`Product not found: ${line.productId}`);
      const variantId = line.variantId;
      let overridePrice: number | null = null;
      if (variantId) {
        const variant = (product as any).variants.find((v: any) => v.id === variantId);
        if (!variant) throw new Error(`Variant not found for product: ${line.productId}`);
        overridePrice = Number(variant.price);
      }
      const discountRule =
        line.discountType && line.discountValue !== undefined && line.discountValue !== null
          ? {
            scope: 'ITEM',
            type: line.discountType,
            value: Number(line.discountValue),
          }
          : null;

      // Tax Inclusive mode: Always use default tax slab, ignore product-specific tax
      let perLineTaxPercent: number | undefined = undefined;
      if (taxMode === 'INCLUSIVE') {
        if (defaultTax && !taxId) {
          perLineTaxPercent = Number(defaultTax.percent);
        } else if (taxId && taxId !== 'none') {
          perLineTaxPercent = undefined;
        } else if (defaultTax) {
          perLineTaxPercent = Number(defaultTax.percent);
        }
      } else {
        perLineTaxPercent =
          taxId && taxId !== 'none'
            ? undefined
            : product.defaultTaxId
              ? Number(product.defaultTax?.percent ?? 0)
              : 0;
      }

      return {
        product,
        quantity: Number(line.quantity) || 1,
        discountRule,
        variantId: variantId ?? null,
        overridePrice,
        taxPercent: perLineTaxPercent,
      };
    });

    const cartRule =
      cartDiscountType && cartDiscountValue !== undefined && cartDiscountValue !== null
        ? { scope: 'CART', type: cartDiscountType, value: Number(cartDiscountValue) }
        : null;

    const totals = calculateTotals({
      items: itemInputs as any,
      cartRule: cartRule as any,
      coupon,
      tax,
      taxMode,
    });

    const orderId = generateOrderId();

    const sale = await (prisma as any).$transaction(async (tx: any) => {
      const saleRecord = await tx.sale.create({
        data: {
          clientId,
          cashierId: user.id,
          orderId,
          subtotal: totals.subtotal as any,
          discount: (totals.itemDiscountTotal + totals.cartDiscountTotal + totals.couponValue) as any,
          couponCode: coupon ? coupon.code : null,
          couponValue: coupon ? (totals.couponValue as any) : null,
          taxPercent: totals.taxPercent as any,
          tax: totals.taxAmount as any,
          total: totals.total as any,
          paymentMethod: paymentMethod,
        },
      });

      // Create sale items and handle stock deduction
      for (const line of totals.perItem) {
        const product = productMap.get(line.productId);
        if (!product) continue;

        await tx.saleItem.create({
          data: {
            clientId,
            saleId: saleRecord.id,
            productId: line.productId,
            variantId: line.variantId ?? null,
            quantity: line.quantity,
            price: line.price as any,
            discount: line.discount as any,
            tax: line.tax as any,
            total: line.total as any,
          },
        });

        if (product.type === 'SIMPLE') {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: line.quantity } },
          });
        }

        if (product.type === 'VARIANT' && line.variantId) {
          await tx.productVariant.update({
            where: { id: line.variantId },
            data: { stock: { decrement: line.quantity } },
          });
        }

        if (product.type === 'COMPOSITE' && product.materials && product.materials.length > 0) {
          for (const material of product.materials) {
            const quantityToDeduct = Number(material.quantity) * line.quantity;
            await tx.rawMaterial.update({
              where: { id: material.rawMaterialId },
              data: { stock: { decrement: quantityToDeduct } },
            });
          }
        }
      }

      // Delete held bill if it was checked out
      if (heldBillId) {
        await tx.heldBill.delete({ where: { id: heldBillId } }).catch(() => {
          // Ignore if already deleted or not found
        });
      }

      return saleRecord;
    });

    const saleWithCashier = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        cashier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ sale: saleWithCashier, totals }, { status: 201 });
  } catch (e: any) {
    console.error('sales error', e);
    return NextResponse.json({ error: e?.message ?? 'Checkout failed' }, { status: 500 });
  }
}
