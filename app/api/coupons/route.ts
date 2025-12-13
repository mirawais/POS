import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clientId = (session as any).user.clientId as string;
  const coupons = await prisma.coupon.findMany({
    where: { clientId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(coupons);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  const body = await req.json();
  const { code, type, value, isActive = true } = body ?? {};
  if (!code || typeof code !== 'string') return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  if (!['PERCENT', 'AMOUNT'].includes(type)) return NextResponse.json({ error: 'Type must be PERCENT or AMOUNT' }, { status: 400 });
  const val = Number(value);
  if (Number.isNaN(val)) return NextResponse.json({ error: 'Value must be a number' }, { status: 400 });
  const created = await prisma.coupon.create({
    data: { code: code.toUpperCase(), type, value: val as any, isActive, clientId },
  });
  return NextResponse.json(created, { status: 201 });
}

