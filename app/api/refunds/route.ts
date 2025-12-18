import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Generate unique refund ID: REF-YYYYMMDD-XXXXX
function generateRefundId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `REF-${dateStr}-${random}`;
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clientId = user.clientId as string;

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const saleId = searchParams.get('saleId');

    const where: any = { clientId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    if (saleId) where.saleId = saleId;

    const refunds = await (prisma as any).refund.findMany({
      where,
      include: {
        sale: { select: { id: true, orderId: true } },
        cashier: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            saleItem: { include: { product: true, variant: true } },
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    return NextResponse.json(refunds);
  } catch (e: any) {
    console.error('refunds GET error', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to fetch refunds' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clientId = user.clientId as string;
    const cashierId = user.id as string;

    const body = await req.json();
    const { saleId, items, reason } = body;
    if (!saleId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'saleId and items are required' }, { status: 400 });
    }

    // Fetch the original sale
    const sale = await (prisma as any).sale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            product: {
              include: {
                variants: true,
                materials: { include: { rawMaterial: true } },
              },
            },
            variant: true,
          },
        },
      },
    });

    if (!sale || sale.clientId !== clientId) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    const refundId = generateRefundId();
    let totalRefund = 0;

    // Calculate total refund first
    for (const refundItem of items) {
      const saleItem = sale.items.find((item: any) => item.id === refundItem.saleItemId);
      if (!saleItem) continue;
      const refundQty = Math.min(
        refundItem.quantity,
        saleItem.quantity - (saleItem.returnedQuantity || 0)
      );
      if (refundQty <= 0) continue;
      const unitPrice = Number(saleItem.total) / saleItem.quantity;
      totalRefund += unitPrice * refundQty;
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      // Step 1: Create refund record FIRST
      const refund = await tx.refund.create({
        data: {
          clientId,
          cashierId,
          saleId,
          refundId,
          total: totalRefund as any,
          reason: reason || null,
        },
      });

      // Step 2: Process refund items and link to refund
      for (const refundItem of items) {
        const saleItem = sale.items.find((item: any) => item.id === refundItem.saleItemId);
        if (!saleItem) continue;

        const refundQty = Math.min(
          refundItem.quantity,
          saleItem.quantity - (saleItem.returnedQuantity || 0)
        );
        if (refundQty <= 0) continue;

        // Calculate refund amount (unit price * quantity)
        const unitPrice = Number(saleItem.total) / saleItem.quantity;
        const refundAmount = unitPrice * refundQty;

        // Create refund item with valid refund ID
        await tx.refundItem.create({
          data: {
            clientId,
            refundId: refund.id, // Use the created refund's ID
            saleItemId: saleItem.id,
            productId: saleItem.productId,
            variantId: saleItem.variantId,
            quantity: refundQty,
            refundAmount: refundAmount as any,
          },
        });

        // Update returned quantity
        await tx.saleItem.update({
          where: { id: saleItem.id },
          data: { returnedQuantity: { increment: refundQty } },
        });

        // Restore stock
        const product = saleItem.product;
        if (product.type === 'SIMPLE') {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { increment: refundQty } },
          });
        } else if (product.type === 'VARIANT' && saleItem.variantId) {
          await tx.productVariant.update({
            where: { id: saleItem.variantId },
            data: { stock: { increment: refundQty } },
          });
        } else if (product.type === 'COMPOSITE' && product.materials) {
          for (const material of product.materials) {
            const quantityToRestore = Number(material.quantity) * refundQty;
            await tx.rawMaterial.update({
              where: { id: material.rawMaterialId },
              data: { stock: { increment: quantityToRestore } },
            });
          }
        }
      }

      // Return refund with items
      return await tx.refund.findUnique({
        where: { id: refund.id },
        include: {
          sale: { select: { id: true, orderId: true } },
          cashier: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              saleItem: { include: { product: true, variant: true } },
              product: { select: { id: true, name: true, sku: true } },
              variant: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    console.error('refunds POST error', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to process refund' }, { status: 500 });
  }
}

