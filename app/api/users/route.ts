import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  
  const users = await prisma.user.findMany({
    where: { clientId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  
  const body = await req.json();
  const { email, name, password, role = 'CASHIER' } = body ?? {};
  
  if (!email || typeof email !== 'string') return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  if (!password || typeof password !== 'string' || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }
  if (!['ADMIN', 'CASHIER'].includes(role)) {
    return NextResponse.json({ error: 'Role must be ADMIN or CASHIER' }, { status: 400 });
  }
  
  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      password: hashedPassword,
      role: role as any,
      clientId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  return NextResponse.json(user, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  
  const body = await req.json();
  const { id, email, name, password, role } = body ?? {};
  
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  
  // Verify user belongs to client
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.clientId !== clientId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  
  // Prevent admin from changing their own role (optional safety check)
  if (existing.id === (session as any).user.id && role && role !== existing.role) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
  }
  
  const updateData: any = {};
  if (email !== undefined && email !== existing.email) {
    // Check for duplicate email if changing
    const duplicate = await prisma.user.findUnique({ where: { email } });
    if (duplicate) return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    updateData.email = email;
  }
  if (name !== undefined) updateData.name = name || null;
  if (password !== undefined) {
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    updateData.password = await bcrypt.hash(password, 10);
  }
  if (role !== undefined) {
    if (!['ADMIN', 'CASHIER'].includes(role)) {
      return NextResponse.json({ error: 'Role must be ADMIN or CASHIER' }, { status: 400 });
    }
    updateData.role = role;
  }
  
  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  
  // Verify user belongs to client
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.clientId !== clientId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  
  // Prevent admin from deleting themselves
  if (existing.id === (session as any).user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }
  
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

