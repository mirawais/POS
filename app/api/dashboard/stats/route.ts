import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clientId = (session as any).user.clientId as string;

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Calculate stats in parallel
    const [
      totalSales,
      todayOrders,
      lowStockProducts,
      totalCustomers,
      recentOrders,
    ] = await Promise.all([
      // Total Sales (sum of all sale totals)
      prisma.sale.aggregate({
        where: { clientId },
        _sum: { total: true },
      }),

      // Today's Orders (count and sum)
      prisma.sale.aggregate({
        where: {
          clientId,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        _count: { id: true },
        _sum: { total: true },
      }),

      // Low Stock Products (products with stock <= lowStockAt)
      (async () => {
        const products = await prisma.product.findMany({
          where: {
            clientId,
            isActive: true,
          },
          select: {
            stock: true,
            lowStockAt: true,
          },
        });
        return products.filter((p) => {
          if (p.lowStockAt !== null) {
            return p.stock <= p.lowStockAt;
          }
          return p.stock <= 10; // Default threshold
        }).length;
      })(),

      // Total Customers (for now, we'll use a placeholder or count unique cashiers)
      // Since we don't have a Customer model, we'll count unique cashiers as a proxy
      prisma.sale.groupBy({
        by: ['cashierId'],
        where: { clientId },
        _count: { cashierId: true },
      }),

      // Recent Orders (last 10)
      prisma.sale.findMany({
        where: { clientId },
        include: {
          cashier: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      totalSales: Number(totalSales._sum.total || 0),
      todayOrders: {
        count: todayOrders._count.id || 0,
        total: Number(todayOrders._sum.total || 0),
      },
      lowStock: lowStockProducts,
      totalCustomers: totalCustomers.length, // Count of unique cashiers
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderId: order.orderId,
        date: order.createdAt,
        customer: order.cashier?.name || order.cashier?.email || 'Unknown',
        amount: Number(order.total),
        status: order.type || 'SALE',
        paymentMethod: order.paymentMethod || 'CASH',
      })),
    });
  } catch (e: any) {
    console.error('Dashboard stats error:', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}

