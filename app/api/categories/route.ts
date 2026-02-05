import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = (session as any).user;
  let clientId = user.clientId;
  const { searchParams } = new URL(req.url);

  // Super Admin impersonation logic
  if (user.role === 'SUPER_ADMIN') {
    const targetClient = searchParams.get('clientId');
    if (targetClient) clientId = targetClient;
  }

  const where: any = {};
  if (clientId) {
    where.clientId = clientId;
  }

  const search = searchParams.get('search') || '';
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

  const user = (session as any).user;
  const isManager = user.role === 'MANAGER';
  const permissions = user.permissions || {};

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role) && !(isManager && permissions.manage_categories)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let clientId = user.clientId;
  const body = await req.json();

  // Super Admin must specify target client
  if (user.role === 'SUPER_ADMIN') {
    if (!body.clientId) return NextResponse.json({ error: 'Super Admin must specify clientId' }, { status: 400 });
    clientId = body.clientId;
  }

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

  const user = (session as any).user;
  const isManager = user.role === 'MANAGER';
  const permissions = user.permissions || {};

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role) && !(isManager && permissions.manage_categories)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, isDefault } = body ?? {};
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  // Access Control: Verify ownership before editing
  const existingCategory = await prisma.category.findUnique({ where: { id } });
  if (!existingCategory) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  if (user.role === 'ADMIN' && existingCategory.clientId !== user.clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Use category's clientId for validation checks
  const targetClientId = existingCategory.clientId;

  // Check for duplicate if name is being changed
  if (name) {
    const existing = await prisma.category.findFirst({
      where: { clientId: targetClientId, name: { equals: name, mode: 'insensitive' }, id: { not: id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Category with this name already exists' }, { status: 400 });
    }
  }

  if (isDefault === true) {
    await prisma.category.updateMany({ where: { clientId: targetClientId }, data: { isDefault: false } });
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

  const user = (session as any).user;
  const isManager = user.role === 'MANAGER';
  const permissions = user.permissions || {};

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role) && !(isManager && permissions.delete_categories)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  // Access Control
  const existingCategory = await prisma.category.findUnique({ where: { id } });
  if (!existingCategory) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  if (user.role === 'ADMIN' && existingCategory.clientId !== user.clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
