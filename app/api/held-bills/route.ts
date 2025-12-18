import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = (session as any).user;
  const clientId = user.clientId as string;
  const cashierId = user.id as string;
  const bills = await prisma.heldBill.findMany({
    where: { clientId, cashierId },
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

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await prisma.heldBill.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

