import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clientId = (session as any).user.clientId as string;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const where: any = { clientId };
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }
  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  const body = await req.json();
  const { name, isDefault = false } = body ?? {};
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  // Check for duplicate
  const existing = await prisma.category.findFirst({
    where: { clientId, name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) {
    return NextResponse.json({ error: 'Category with this name already exists' }, { status: 400 });
  }
  if (isDefault) {
    await prisma.category.updateMany({ where: { clientId }, data: { isDefault: false } });
  }
  const category = await prisma.category.create({
    data: { name, clientId, isDefault },
  });
  return NextResponse.json(category, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  const body = await req.json();
  const { id, name, isDefault } = body ?? {};
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  // Check for duplicate if name is being changed
  if (name) {
    const existing = await prisma.category.findFirst({
      where: { clientId, name: { equals: name, mode: 'insensitive' }, id: { not: id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Category with this name already exists' }, { status: 400 });
    }
  }
  if (isDefault === true) {
    await prisma.category.updateMany({ where: { clientId }, data: { isDefault: false } });
  }
  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(typeof name === 'string' ? { name } : {}),
      ...(typeof isDefault === 'boolean' ? { isDefault } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
