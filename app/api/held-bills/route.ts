import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = (session as any).user;
  const clientId = user.clientId as string;
  const cashierId = user.id as string;
  const role = user.role;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const id = searchParams.get('id');

  const where: any = { clientId };

  if (id) {
    where.id = id;
  } else if (status) {
    // If filtering by status, allow seeing all for the client (for Pending Checkouts)
    where.data = {
      path: ['orderStatus'],
      equals: status
    };
  } else {
    // Default view: Show my own active bills
    where.cashierId = cashierId;
    where.NOT = {
      data: {
        path: ['orderStatus'],
        equals: 'BILLING_REQUESTED'
      }
    };
  }

  const bills = await prisma.heldBill.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(bills);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = (session as any).user;
  const clientId = user.clientId as string;
  const cashierId = user.id as string;
  const body = await req.json();
  const { data, id } = body; // id is optional - if provided, update existing; otherwise create new
  if (!data) return NextResponse.json({ error: 'No cart data' }, { status: 400 });

  // If id is provided, update existing held bill
  if (id) {
    const existing = await prisma.heldBill.findFirst({
      where: { id, clientId, cashierId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Held bill not found' }, { status: 404 });
    }
    const updated = await prisma.heldBill.update({
      where: { id },
      data: { data },
    });
    return NextResponse.json(updated);
  }

  // Otherwise, create new held bill
  const bill = await prisma.heldBill.create({
    data: {
      clientId,
      cashierId,
      data,
    },
  });
  return NextResponse.json(bill, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = (session as any).user;
  const clientId = user.clientId as string;
  const cashierId = user.id as string;
  const body = await req.json();
  const { id, status } = body;

  if (!id || !status) return NextResponse.json({ error: 'id and status are required' }, { status: 400 });

  const existing = await prisma.heldBill.findFirst({
    where: { id, clientId }, // Allow waiter to update even if not original cashier? Wait, requirements say "Waiters can mark as served".
  });

  if (!existing) return NextResponse.json({ error: 'Held bill not found' }, { status: 404 });

  const currentData = (existing.data as any) || {};
  let updatedCart = currentData.cart || [];

  if (status === 'SERVED') {
    updatedCart = updatedCart.map((item: any) => {
      if (item.status === 'READY') {
        return { ...item, status: 'SERVED' };
      }
      return item;
    });
  }

  const updatedData = {
    ...currentData,
    orderStatus: status,
    cart: updatedCart
  };

  const updated = await prisma.heldBill.update({
    where: { id },
    data: { data: updatedData },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  // Security: only allowing owner or admin to delete?
  // For now, simple delete as before but maybe add check
  await prisma.heldBill.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

