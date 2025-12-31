import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateTotals } from '@/lib/pricing';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

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

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clientId = user.clientId as string;
    const saleId = params.id;

    const sale = await (prisma as any).sale.findUnique({
      where: { id: saleId },
      include: {
        cashier: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, name: true, sku: true, attributes: true } },
          },
        },
      },
    });

    if (!sale || sale.clientId !== clientId) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (e: any) {
    console.error('sales GET error', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to fetch sale' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clientId = user.clientId as string;
    const saleId = params.id;

    const body = await req.json();
    const { returnItems = [], replacementItems = [] } = body;

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
                defaultTax: true,
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

    const result = await (prisma as any).$transaction(async (tx: any) => {
      // Process returns: restore stock and update returnedQuantity
      for (const ret of returnItems as ReturnItem[]) {
        const saleItem = sale.items.find((item: any) => item.id === ret.saleItemId);
        if (!saleItem) continue;

        const returnQty = Math.min(ret.returnQuantity, saleItem.quantity - (saleItem.returnedQuantity || 0));
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

      // Process replacements: add new items and deduct stock
      const replacementItemInputs: any[] = [];
      if (replacementItems.length > 0) {
        const productIds = (replacementItems as ReplacementItem[]).map((i) => i.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          include: { variants: true, materials: { include: { rawMaterial: true } }, defaultTax: true },
        });
        const productMap = new Map(products.map((p: any) => [p.id, p]));

        for (const repl of replacementItems as ReplacementItem[]) {
          const product = productMap.get(repl.productId);
          if (!product) continue;

          let overridePrice: number | null = null;
          if (repl.variantId && (product as any).variants) {
            const variant = (product as any).variants.find((v: any) => v.id === repl.variantId);
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

        // Calculate totals for replacements - find tax by percent or use default
        const taxPercent = sale.taxPercent ? Number(sale.taxPercent) : null;
        const tax = taxPercent
          ? await tx.taxSetting.findFirst({
            where: {
              clientId,
              percent: taxPercent as any,
              isActive: true,
            },
          }) || (await tx.taxSetting.findFirst({ where: { clientId, isDefault: true } }))
          : null;

        const replacementTotals = calculateTotals({
          items: replacementItemInputs as any,
          cartRule: null,
          coupon: null,
          tax,
        });

        // Create new sale items for replacements
        for (const line of replacementTotals.perItem) {
          const product = productMap.get(line.productId);
          if (!product) continue;

          await tx.saleItem.create({
            data: {
              clientId,
              saleId: sale.id,
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
          if ((product as any).type === 'SIMPLE') {
            await tx.product.update({
              where: { id: (product as any).id },
              data: { stock: { decrement: line.quantity } },
            });
          } else if ((product as any).type === 'VARIANT' && line.variantId) {
            await tx.productVariant.update({
              where: { id: line.variantId },
              data: { stock: { decrement: line.quantity } },
            });
          } else if ((product as any).type === 'COMPOSITE' && (product as any).materials) {
            for (const material of (product as any).materials) {
              const quantityToDeduct = Number(material.quantity) * line.quantity;
              await tx.rawMaterial.update({
                where: { id: material.rawMaterialId },
                data: { stock: { decrement: quantityToDeduct } },
              });
            }
          }
        }

        // Recalculate sale totals including replacements
        const allItems = await tx.saleItem.findMany({
          where: { saleId: sale.id },
        });

        // Calculate new totals based on all items (original - returns + replacements)
        let newSubtotal = 0;
        let newDiscount = 0;
        let newTax = 0;

        for (const item of allItems) {
          const netQuantity = item.quantity - (item.returnedQuantity || 0);
          if (netQuantity > 0) {
            const unitPrice = Number(item.price);
            const unitDiscount = Number(item.discount) / item.quantity;
            const unitTax = Number(item.tax) / item.quantity;
            newSubtotal += unitPrice * netQuantity;
            newDiscount += unitDiscount * netQuantity;
            newTax += unitTax * netQuantity;
          }
        }

        const newTotal = newSubtotal - newDiscount + newTax;

        // Update sale record
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            subtotal: newSubtotal as any,
            discount: newDiscount as any,
            tax: newTax as any,
            total: newTotal as any,
          },
        });
      } else if (returnItems.length > 0) {
        // Only returns, no replacements - still need to recalculate totals
        const allItems = await tx.saleItem.findMany({
          where: { saleId: sale.id },
        });

        let newSubtotal = 0;
        let newDiscount = 0;
        let newTax = 0;

        for (const item of allItems) {
          const netQuantity = item.quantity - (item.returnedQuantity || 0);
          if (netQuantity > 0) {
            const unitPrice = Number(item.price);
            const unitDiscount = Number(item.discount) / item.quantity;
            const unitTax = Number(item.tax) / item.quantity;
            newSubtotal += unitPrice * netQuantity;
            newDiscount += unitDiscount * netQuantity;
            newTax += unitTax * netQuantity;
          }
        }

        const newTotal = newSubtotal - newDiscount + newTax;

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            subtotal: newSubtotal as any,
            discount: newDiscount as any,
            tax: newTax as any,
            total: newTotal as any,
          },
        });
      }

      // Return updated sale
      return await tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          cashier: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
              variant: { select: { id: true, name: true, sku: true, attributes: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('sales PATCH error', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to update sale' }, { status: 500 });
  }
}

