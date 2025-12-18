import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clientId = (session as any).user.clientId as string;
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const where: any = { clientId };
  if (!includeInactive) {
    where.isActive = true;
  }
  const coupons = await prisma.coupon.findMany({
    where,
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
  const { code, type, value, isActive = true, startsAt, endsAt } = body ?? {};
  if (!code || typeof code !== 'string') return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  if (!['PERCENT', 'AMOUNT'].includes(type)) return NextResponse.json({ error: 'Type must be PERCENT or AMOUNT' }, { status: 400 });
  const val = Number(value);
  if (Number.isNaN(val)) return NextResponse.json({ error: 'Value must be a number' }, { status: 400 });
  
  // Check for duplicate code
  const existing = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (existing) return NextResponse.json({ error: 'Coupon code already exists' }, { status: 400 });
  
  const created = await prisma.coupon.create({
    data: {
      code: code.toUpperCase(),
      type,
      value: val as any,
      isActive,
      clientId,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
    },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  const body = await req.json();
  const { id, code, type, value, isActive, startsAt, endsAt } = body ?? {};
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  
  // Verify coupon belongs to client
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing || existing.clientId !== clientId) {
    return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
  }
  
  const updateData: any = {};
  if (code !== undefined) {
    // Check for duplicate code if changing
    if (code.toUpperCase() !== existing.code) {
      const duplicate = await prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
      });
      if (duplicate) return NextResponse.json({ error: 'Coupon code already exists' }, { status: 400 });
    }
    updateData.code = code.toUpperCase();
  }
  if (type !== undefined) {
    if (!['PERCENT', 'AMOUNT'].includes(type)) return NextResponse.json({ error: 'Type must be PERCENT or AMOUNT' }, { status: 400 });
    updateData.type = type;
  }
  if (value !== undefined) {
    const val = Number(value);
    if (Number.isNaN(val)) return NextResponse.json({ error: 'Value must be a number' }, { status: 400 });
    updateData.value = val;
  }
  if (isActive !== undefined) updateData.isActive = isActive;
  if (startsAt !== undefined) updateData.startsAt = startsAt ? new Date(startsAt) : null;
  if (endsAt !== undefined) updateData.endsAt = endsAt ? new Date(endsAt) : null;
  
  const updated = await prisma.coupon.update({
    where: { id },
    data: updateData,
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  
  // Verify coupon belongs to client
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing || existing.clientId !== clientId) {
    return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
  }
  
  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

