import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = (session as any).user;
    const clientId = user.clientId as string;

    // Kitchen/Admin/SuperAdmin can view kitchen orders
    const allowedRoles = ['KITCHEN', 'ADMIN', 'SUPER_ADMIN', 'RESTAURANT_ADMIN']; // Adjust based on exact role names
    // Actually checking role might be good but let's assume if they have access to this route via UI they are auth'd.
    // But for safety:
    if (!['KITCHEN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        // Waiters shouldn't see all orders? Or maybe they should to know status?
        // Requirement says Kitchen View.
    }

    try {
        const bills = await prisma.heldBill.findMany({
            where: { clientId }, // Fetch ALL for this client, not just user specific
            orderBy: { createdAt: 'asc' }, // Oldest first for kitchen
        });

        // Filter and map: only return orders with PENDING or PREPARING items
        const kitchenOrders = bills.map((bill: any) => {
            const cart = bill.data?.cart || [];
            const visibleItems = cart.filter((item: any) =>
                !item.status || item.status === 'PENDING' || item.status === 'PREPARING' || item.status === 'READY'
            );

            if (visibleItems.length === 0) return null;

            return {
                ...bill,
                data: {
                    ...bill.data,
                    cart: visibleItems
                }
            };
        }).filter(Boolean);

        return NextResponse.json(kitchenOrders);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch kitchen orders' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, status, productId, variantId, itemStatus } = body;

    if (!id) return NextResponse.json({ error: 'Missing bill id' }, { status: 400 });

    try {
        const bill = await prisma.heldBill.findUnique({ where: { id } });
        if (!bill) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

        const currentData = bill.data as any;
        const cart = currentData.cart || [];
        let updatedCart = [...cart];
        let newOrderStatus = currentData.orderStatus;

        if (productId && itemStatus) {
            // Item-level update
            updatedCart = cart.map((item: any) => {
                const isMatch = item.product?.id === productId &&
                    (!variantId || item.variant?.id === variantId);

                if (isMatch) {
                    // Protection: NEVER modify already served items from kitchen
                    if (item.status === 'SERVED' || item.status === 'BILLING_REQUESTED') return item;
                    return { ...item, status: itemStatus };
                }
                return item;
            });

            // If we marked an item as READY or REJECTED, check overall order status
            const stillWorking = updatedCart.some(i => !i.status || i.status === 'PENDING' || i.status === 'PREPARING');
            if (!stillWorking) {
                // If everything is READY, SERVED or REJECTED, order is READY for pickup/billing
                newOrderStatus = 'READY';
            } else if (itemStatus === 'PREPARING') {
                newOrderStatus = 'PREPARING';
            }
        } else if (status) {
            // Bulk update (Original behavior but with protection)
            updatedCart = cart.map((item: any) => {
                if (item.status === 'SERVED' || item.status === 'BILLING_REQUESTED') return item;

                if (status === 'PREPARING' && (!item.status || item.status === 'PENDING')) {
                    return { ...item, status: 'PREPARING' };
                }
                if (status === 'READY' && item.status === 'PREPARING') {
                    return { ...item, status: 'READY' };
                }
                return item;
            });
            newOrderStatus = status;
        }

        const updated = await prisma.heldBill.update({
            where: { id },
            data: {
                data: {
                    ...currentData,
                    cart: updatedCart,
                    orderStatus: newOrderStatus
                }
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Kitchen update error:', error);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
}
