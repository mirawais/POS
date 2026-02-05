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
    where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }];
  }
  const materials = await prisma.rawMaterial.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(materials);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = (session as any).user;
  const isManager = user.role === 'MANAGER';
  const permissions = user.permissions || {};

  if (user.role !== 'ADMIN' && !(isManager && permissions.manage_raw_materials)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const clientId = (session as any).user.clientId as string;
  const data = await req.json();
  const { name, sku, unit = 'unit', stock = 0, lowStockAt = null } = data ?? {};
  if (!name || !sku) return NextResponse.json({ error: 'name and sku are required' }, { status: 400 });
  const created = await prisma.rawMaterial.create({
    data: {
      name,
      sku,
      unit: unit || 'unit',
      stock: Number(stock) || 0,
      isUnlimited: data.isUnlimited || false,
      lowStockAt: lowStockAt !== undefined && lowStockAt !== null ? Number(lowStockAt) : null,
      clientId,
    },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = (session as any).user;
  const isManager = user.role === 'MANAGER';
  const permissions = user.permissions || {};

  if (user.role !== 'ADMIN' && !(isManager && permissions.manage_raw_materials)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const clientId = (session as any).user.clientId as string;
  const data = await req.json();
  const { id, name, sku, unit, stock, lowStockAt } = data ?? {};
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const updated = await prisma.rawMaterial.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(sku ? { sku } : {}),
      ...(unit !== undefined ? { unit: unit || 'unit' } : {}),
      ...(stock !== undefined ? { stock: Number(stock) || 0 } : {}),
      ...(data.isUnlimited !== undefined ? { isUnlimited: data.isUnlimited } : {}),
      ...(lowStockAt !== undefined ? { lowStockAt: lowStockAt !== null ? Number(lowStockAt) : null } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = (session as any).user;
  const isManager = user.role === 'MANAGER';
  const permissions = user.permissions || {};

  if (user.role !== 'ADMIN' && !(isManager && permissions.delete_raw_materials)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await prisma.rawMaterial.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
