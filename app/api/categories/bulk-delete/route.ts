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
        const { categoryIds } = body;

        if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
            return NextResponse.json({ error: 'Category IDs are required' }, { status: 400 });
        }

        // Verify all categories belong to this client and none are default
        const categories = await (prisma as any).category.findMany({
            where: {
                id: { in: categoryIds },
                clientId,
            },
        });

        if (categories.length !== categoryIds.length) {
            return NextResponse.json({
                error: 'Some categories not found or do not belong to your account'
            }, { status: 400 });
        }

        if (categories.some((c: any) => c.isDefault)) {
            return NextResponse.json({
                error: 'Default categories cannot be deleted'
            }, { status: 400 });
        }

        // Check if any products are using these categories
        const productsInCategories = await (prisma as any).product.count({
            where: {
                categoryId: { in: categoryIds },
                clientId,
            },
        });

        if (productsInCategories > 0) {
            return NextResponse.json({
                error: `Cannot delete categories that are still assigned to ${productsInCategories} products. Please reassign the products first.`
            }, { status: 400 });
        }

        // Delete categories in a transaction
        const result = await (prisma as any).category.deleteMany({
            where: {
                id: { in: categoryIds },
                clientId,
                isDefault: false,
            },
        });

        return NextResponse.json({
            success: true,
            deleted: result.count,
            message: `Successfully deleted ${result.count} category(ies)`,
        });
    } catch (e: any) {
        console.error('Bulk delete categories error:', e);
        return NextResponse.json({
            error: e?.message ?? 'Failed to delete categories'
        }, { status: 500 });
    }
}
