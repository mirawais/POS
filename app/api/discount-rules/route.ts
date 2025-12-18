import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clientId = (session as any).user.clientId as string;
  const rules = await prisma.discountRule.findMany({
    where: { clientId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(rules);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  const body = await req.json();
  const { name, scope, type, value, isActive = true } = body ?? {};
  if (!name || typeof name !== 'string') return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!['ITEM', 'CART'].includes(scope)) return NextResponse.json({ error: 'Scope must be ITEM or CART' }, { status: 400 });
  if (!['PERCENT', 'AMOUNT'].includes(type)) return NextResponse.json({ error: 'Type must be PERCENT or AMOUNT' }, { status: 400 });
  const val = Number(value);
  if (Number.isNaN(val)) return NextResponse.json({ error: 'Value must be a number' }, { status: 400 });
  const created = await prisma.discountRule.create({
    data: { name, scope, type, value: val as any, isActive, clientId },
  });
  return NextResponse.json(created, { status: 201 });
}

