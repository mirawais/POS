import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clientId = (session as any).user.clientId as string;
  const bills = await prisma.heldBill.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(bills);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = (session as any).user;
  const clientId = user.clientId as string;
  const body = await req.json();
  const data = body?.data;
  if (!data) return NextResponse.json({ error: 'No cart data' }, { status: 400 });
  const bill = await prisma.heldBill.create({
    data: {
      clientId,
      cashierId: user.id,
      data,
    },
  });
  return NextResponse.json(bill, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await prisma.heldBill.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

