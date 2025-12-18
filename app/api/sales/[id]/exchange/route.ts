import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateTotals } from '@/lib/pricing';
import { NextResponse } from 'next/server';

type ReturnItem = {
  saleItemId: string;
  returnQuantity: number;
};

type ReplacementItem = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  discountType?: 'PERCENT' | 'AMOUNT' | null;
  discountValue?: number | null;
};

// Generate unique order ID: YYYYMMDD-XXXXX (removed ORD- prefix)
function generateOrderId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${dateStr}-${random}`;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clientId = user.clientId as string;
    const cashierId = user.id as string;
    const originalSaleId = params.id;

    const body = await req.json();
    const { returnItems = [], replacementItems = [] } = body;

    // Fetch the original sale
    const originalSale = await (prisma as any).sale.findUnique({
      where: { id: originalSaleId },
      include: {
        items: {
          include: {
            product: {
              include: {
                variants: true,
                materials: { include: { rawMaterial: true } },
                defaultTax: true,
              },
            },
            variant: true,
          },
        },
      },
    });

    if (!originalSale || originalSale.clientId !== clientId) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    const originalTotal = Number(originalSale.total);

    // Process exchange: returns + replacements
    const result = await (prisma as any).$transaction(async (tx: any) => {
      // Step 1: Process returns - restore stock and update returnedQuantity
      for (const ret of returnItems as ReturnItem[]) {
        const saleItem = originalSale.items.find((item: any) => item.id === ret.saleItemId);
        if (!saleItem) continue;

        const returnQty = Math.min(
          ret.returnQuantity,
          saleItem.quantity - (saleItem.returnedQuantity || 0)
        );
        if (returnQty <= 0) continue;

        // Update returned quantity
        await tx.saleItem.update({
          where: { id: ret.saleItemId },
          data: { returnedQuantity: { increment: returnQty } },
        });

        const product = saleItem.product;
        // Restore stock
        if (product.type === 'SIMPLE') {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { increment: returnQty } },
          });
        } else if (product.type === 'VARIANT' && saleItem.variantId) {
          await tx.productVariant.update({
            where: { id: saleItem.variantId },
            data: { stock: { increment: returnQty } },
          });
        } else if (product.type === 'COMPOSITE' && product.materials) {
          for (const material of product.materials) {
            const quantityToRestore = Number(material.quantity) * returnQty;
            await tx.rawMaterial.update({
              where: { id: material.rawMaterialId },
              data: { stock: { increment: quantityToRestore } },
            });
          }
        }
      }

      // Step 2: Process replacements - create new sale with new order ID
      if (replacementItems.length > 0) {
        const productIds = (replacementItems as ReplacementItem[]).map((i) => i.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          include: {
            variants: true,
            materials: { include: { rawMaterial: true } },
            defaultTax: true,
          },
        });
        const productMap = new Map(products.map((p: any) => [p.id, p]));

        const replacementItemInputs: any[] = [];
        for (const repl of replacementItems as ReplacementItem[]) {
          const product = productMap.get(repl.productId);
          if (!product) continue;

          let overridePrice: number | null = null;
          if (repl.variantId) {
            const variant = product.variants.find((v: any) => v.id === repl.variantId);
            if (variant) overridePrice = Number(variant.price);
          }

          const discountRule =
            repl.discountType && repl.discountValue !== undefined && repl.discountValue !== null
              ? { scope: 'ITEM', type: repl.discountType, value: Number(repl.discountValue) }
              : null;

          replacementItemInputs.push({
            product,
            quantity: Number(repl.quantity) || 1,
            discountRule,
            variantId: repl.variantId ?? null,
            overridePrice,
          });
        }

        // Use same tax as original sale
        const taxPercent = originalSale.taxPercent ? Number(originalSale.taxPercent) : null;
        const tax = taxPercent
          ? await tx.taxSetting
              .findFirst({
                where: {
                  clientId,
                  percent: taxPercent as any,
                  isActive: true,
                },
              })
              .catch(() => null) ||
            (await tx.taxSetting.findFirst({ where: { clientId, isDefault: true } }))
          : null;

        const replacementTotals = calculateTotals({
          items: replacementItemInputs as any,
          cartRule: null,
          coupon: null,
          tax,
        });

        // Calculate total returned value
        let totalReturnedValue = 0;
        for (const ret of returnItems as ReturnItem[]) {
          const saleItem = originalSale.items.find((item: any) => item.id === ret.saleItemId);
          if (saleItem && ret.returnQuantity > 0) {
            const unitTotal = Number(saleItem.total) / saleItem.quantity;
            totalReturnedValue += unitTotal * ret.returnQuantity;
          }
        }

        // Validate: Replacement total must be >= Returned value (no cash refund)
        // This ensures replacement items cover the value of returned items
        const replacementTotal = Number(replacementTotals.total);
        if (totalReturnedValue > 0) {
          if (replacementTotal < totalReturnedValue) {
            throw new Error(
              `Exchange not allowed: Replacement total (Rs. ${replacementTotal.toFixed(2)}) must be equal to or greater than returned value (Rs. ${totalReturnedValue.toFixed(2)})`
            );
          }
        } else if (replacementItems.length > 0) {
          // If no returns, replacement must be >= original total
          if (replacementTotal < originalTotal) {
            throw new Error(
              `Exchange not allowed: Replacement total (Rs. ${replacementTotal.toFixed(2)}) must be equal to or greater than original total (Rs. ${originalTotal.toFixed(2)})`
            );
          }
        }

        // Create new sale with new order ID
        const newOrderId = generateOrderId();
        const newSale = await tx.sale.create({
          data: {
            clientId,
            cashierId,
            orderId: newOrderId,
            subtotal: replacementTotals.subtotal as any,
            discount: replacementTotals.itemDiscountTotal as any,
            couponCode: null,
            couponValue: null,
            taxPercent: replacementTotals.taxPercent as any,
            tax: replacementTotals.taxAmount as any,
            total: replacementTotals.total as any,
            type: 'EXCHANGE', // Mark as exchange
          },
        });

        // Create sale items and deduct stock
        for (const line of replacementTotals.perItem) {
          const product = productMap.get(line.productId);
          if (!product) continue;

          await tx.saleItem.create({
            data: {
              clientId,
              saleId: newSale.id,
              productId: line.productId,
              variantId: line.variantId ?? null,
              quantity: line.quantity,
              price: line.price as any,
              discount: line.discount as any,
              tax: line.tax as any,
              total: line.total as any,
            },
          });

          // Deduct stock for replacements
          if (product.type === 'SIMPLE') {
            await tx.product.update({
              where: { id: product.id },
              data: { stock: { decrement: line.quantity } },
            });
          } else if (product.type === 'VARIANT' && line.variantId) {
            await tx.productVariant.update({
              where: { id: line.variantId },
              data: { stock: { decrement: line.quantity } },
            });
          } else if (product.type === 'COMPOSITE' && product.materials) {
            for (const material of product.materials) {
              const quantityToDeduct = Number(material.quantity) * line.quantity;
              await tx.rawMaterial.update({
                where: { id: material.rawMaterialId },
                data: { stock: { decrement: quantityToDeduct } },
              });
            }
          }
        }

        return {
          originalSale,
          newSale: await tx.sale.findUnique({
            where: { id: newSale.id },
            include: {
              cashier: { select: { id: true, name: true, email: true } },
              items: {
                include: {
                  product: { select: { id: true, name: true, sku: true } },
                  variant: { select: { id: true, name: true, sku: true, attributes: true } },
                },
              },
            },
          }),
        };
      }

      return { originalSale };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('exchange error', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to process exchange' }, { status: 500 });
  }
}

