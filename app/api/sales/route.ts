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
    const isManager = user.role === 'MANAGER';
    const permissions = user.permissions || {};

    // CASHIERS are allowed (maybe for their own history), but but we'll focus on MANAGER for now.
    // Actually, let's allow ADMIN, SUPER_ADMIN, and MANAGER with view_reports.
    // If a CASHIER calls this, they get their own client data, but we might want to restrict this further later.
    if (user.role === 'MANAGER' && !permissions.view_reports) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const sales = await prisma.sale.findMany({
      where,
      include: {
        client: { select: { name: true } },
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
    const { items, cartDiscountType, cartDiscountValue, couponCode, taxId, heldBillId, paymentMethod = 'CASH', kitchenNote } = body ?? {};
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'No items' }, { status: 400 });
    if (!['CASH', 'CARD'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Payment method must be CASH or CARD' }, { status: 400 });
    }

    const productIds = items.map((i: LineInput) => i.productId);
    const products = (await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true, materials: { include: { rawMaterial: true } }, defaultTax: true },
    })) as any[];

    // Verify all products belong to this client
    const invalidProducts = products.filter(p => p.clientId !== clientId);
    if (invalidProducts.length > 0) {
      return NextResponse.json({ error: 'Security Violation: Attempting to sell products from another client' }, { status: 403 });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    const coupon = couponCode
      ? await prisma.coupon.findFirst({ where: { code: couponCode.toUpperCase(), isActive: true, clientId } })
      : null;

    // Fetch tax mode from invoice settings FIRST
    const invoiceSetting = await prisma.invoiceSetting.findUnique({
      where: { clientId },
    });
    const taxMode = (invoiceSetting?.taxMode || 'EXCLUSIVE') as 'EXCLUSIVE' | 'INCLUSIVE';

    // Get default tax slab - always use this for Tax Inclusive mode
    const defaultTax = await prisma.taxSetting.findFirst({
      where: { clientId, isDefault: true },
    });

    // Fetch request-level tax if provided
    const transactionTax =
      taxId && taxId !== 'none'
        ? await prisma.taxSetting.findUnique({ where: { id: taxId, clientId } })
        : null;

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

      // Dynamic Tax Selection Priority:
      // 1. Explicit "No Tax" selection (taxId === 'none') -> Force 0%
      // 2. Transaction-level tax (from request body taxId)
      // 3. Product-level default tax
      // 4. Global default tax (fallback)
      let perLineTaxPercent: number = 0;

      if (taxId === 'none') {
        perLineTaxPercent = 0;
      } else if (transactionTax) {
        perLineTaxPercent = Number(transactionTax.percent);
      } else if (product.defaultTax) {
        perLineTaxPercent = Number(product.defaultTax.percent);
      } else if (defaultTax) {
        perLineTaxPercent = Number(defaultTax.percent);
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
      taxMode,
    });

    const orderId = generateOrderId();

    const saleWithCashier = await prisma.$transaction(async (tx) => {
      const saleRecord = await tx.sale.create({
        data: {
          clientId,
          cashierId: user.id,
          orderId,
          subtotal: totals.subtotal,
          discount: (totals.itemDiscountTotal + totals.cartDiscountTotal + totals.couponValue),
          couponCode: coupon ? coupon.code : null,
          couponValue: coupon ? totals.couponValue : null,
          taxPercent: totals.taxPercent,
          tax: totals.taxAmount,
          total: totals.total,
          paymentMethod: paymentMethod,
          customerName: body.customerName || null,
          customerPhone: body.customerPhone || null,
        },
      });

      // Prepare SaleItems for bulk create
      const saleItemsData = totals.perItem.map((line) => ({
        clientId,
        saleId: saleRecord.id,
        productId: line.productId,
        variantId: line.variantId ?? null,
        quantity: line.quantity,
        price: line.price,
        discount: line.discount,
        tax: line.tax,
        total: line.total,
      }));

      // Create sale items in bulk
      await tx.saleItem.createMany({
        data: saleItemsData,
      });

      // Collect all stock decrement updates into a Promises array
      const stockUpdatePromises: Promise<any>[] = [];

      for (const line of totals.perItem) {
        const product = productMap.get(line.productId);
        if (!product) continue;

        if (product.type === 'SIMPLE') {
          if (!product.isUnlimited) {
            stockUpdatePromises.push(
              tx.product.update({
                where: { id: product.id },
                data: { stock: { decrement: line.quantity } },
              })
            );
          }
        }

        if (product.type === 'VARIANT' && line.variantId) {
          stockUpdatePromises.push(
            tx.productVariant.update({
              where: { id: line.variantId },
              data: { stock: { decrement: line.quantity } },
            })
          );
        }

        if (product.type === 'COMPOSITE' && product.materials && product.materials.length > 0) {
          for (const material of product.materials) {
            const quantityToDeduct = Number(material.quantity) * line.quantity;
            stockUpdatePromises.push(
              tx.rawMaterial.update({
                where: { id: material.rawMaterialId },
                data: { stock: { decrement: Math.round(quantityToDeduct) } }, // Use Math.round for Int stock
              })
            );
          }
        }
      }

      // Execute all stock updates in parallel
      await Promise.all(stockUpdatePromises);

      // Delete held bill if it was checked out
      if (heldBillId) {
        if (!heldBillId.toString().startsWith('OFF-')) {
          try {
            await tx.heldBill.delete({ where: { id: heldBillId } });
          } catch (e) {
            console.warn(`Could not delete held bill ${heldBillId}:`, e);
          }
        }
      }

      // Final query inside transaction to return sale with cashier info
      return tx.sale.findUnique({
        where: { id: saleRecord.id },
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
    });

    return NextResponse.json({ sale: saleWithCashier, totals }, { status: 201 });
  } catch (e: any) {
    console.error('sales error', e);
    return NextResponse.json({ error: e?.message ?? 'Checkout failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const permissions = user.permissions || {};
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && !permissions.delete_orders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    // Use transaction to ensure cleanup
    await prisma.$transaction(async (tx) => {
      // 1. Delete RefundItems
      await tx.refundItem.deleteMany({
        where: { refund: { saleId: id } }
      });

      // 2. Delete Refunds
      await tx.refund.deleteMany({
        where: { saleId: id }
      });

      // 3. Delete SaleItems
      await tx.saleItem.deleteMany({
        where: { saleId: id }
      });

      // 4. Finally delete the Sale
      await tx.sale.delete({
        where: { id }
      });
    });

    return NextResponse.json({ message: 'Order deleted successfully' });
  } catch (e: any) {
    console.error('delete sale error', e);
    return NextResponse.json({ error: e?.message ?? 'Delete failed' }, { status: 500 });
  }
}
