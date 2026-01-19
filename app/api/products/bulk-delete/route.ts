import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const session = await auth();
        const user = (session as any)?.user;
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const clientId = user.clientId as string;

        const body = await req.json();
        const { productIds } = body;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return NextResponse.json({ error: 'Product IDs are required' }, { status: 400 });
        }

        // Verify all products belong to this client and check for sales/refund history
        const products = await (prisma as any).product.findMany({
            where: {
                id: { in: productIds },
                clientId,
            },
            include: {
                _count: {
                    select: {
                        saleItems: true,
                        refundItems: true,
                    }
                }
            }
        });

        if (products.length === 0) {
            return NextResponse.json({
                error: 'No valid products found to delete'
            }, { status: 400 });
        }

        // Filter products that can be deleted (no sales or refund history)
        const deletableProductIds = products
            .filter((p: any) => p._count.saleItems === 0 && p._count.refundItems === 0)
            .map((p: any) => p.id);

        const skipCount = productIds.length - deletableProductIds.length;

        if (deletableProductIds.length === 0) {
            return NextResponse.json({
                error: `Cannot delete any of the selected products because they all have associated sales or refund history. ${skipCount} product(s) were skipped.`
            }, { status: 400 });
        }

        // Delete deletable products in a transaction
        const resultCount = await (prisma as any).$transaction(async (tx: any) => {
            // Delete related data first for the deletable products
            await tx.productVariant.deleteMany({
                where: { productId: { in: deletableProductIds } },
            });

            await tx.productRawMaterial.deleteMany({
                where: { productId: { in: deletableProductIds } },
            });

            // Delete the products themselves
            const deleted = await tx.product.deleteMany({
                where: {
                    id: { in: deletableProductIds },
                    clientId,
                },
            });

            return deleted.count;
        });

        let message = `Successfully deleted ${resultCount} product(s).`;
        if (skipCount > 0) {
            message += ` ${skipCount} product(s) were skipped because they have existing sales or refund records.`;
        }

        return NextResponse.json({
            success: true,
            deleted: resultCount,
            skipped: skipCount,
            message,
        });
    } catch (e: any) {
        console.error('Bulk delete error:', e);
        return NextResponse.json({
            error: e?.message ?? 'Failed to delete products'
        }, { status: 500 });
    }
}
