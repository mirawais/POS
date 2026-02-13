import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = (session as any).user;
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let clientId = user.clientId;
  const { searchParams } = new URL(req.url);

  // Super Admin impersonation logic
  if (user.role === 'SUPER_ADMIN') {
    const targetClient = searchParams.get('clientId');
    if (targetClient) clientId = targetClient;
  }

  const where: any = {};
  // If we have a clientId (Client Admin or Super Admin viewing specific client), filter by it.
  // If Super Admin viewing all (clientId is null), don't filter.
  if (clientId) {
    where.clientId = clientId;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
      clientId: true,
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

  const user = (session as any).user;
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let clientId = user.clientId;
  const body = await req.json();

  // Super Admin must specify target client
  if (user.role === 'SUPER_ADMIN') {
    if (!body.clientId) return NextResponse.json({ error: 'Super Admin must specify clientId' }, { status: 400 });
    clientId = body.clientId;
  }

  // Client Admin creating user: Force to their own client
  if (user.role === 'ADMIN') {
    // Cannot assign to other client
    if (body.clientId && body.clientId !== clientId) {
      return NextResponse.json({ error: 'Forbidden: Cannot create user for another client' }, { status: 403 });
    }
  }

  const { email, name, password, role = 'CASHIER', permissions } = body ?? {};

  if (!email || typeof email !== 'string') return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  if (!password || typeof password !== 'string' || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  // Role validation
  // Client Admins can only create Admin, Manager or Cashier. (Updated for Restaurant)
  const allowedRoles = ['ADMIN', 'CASHIER', 'MANAGER', 'WAITER', 'KITCHEN', 'SUPER_ADMIN'];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: `Role must be one of: ${allowedRoles.join(', ')}` }, { status: 400 });
  }

  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      email,
      name: name || null,
      password: hashedPassword,
      role: role as any,
      permissions: role === 'MANAGER' ? (permissions || {}) : undefined,
      clientId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
      clientId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(newUser, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = (session as any).user;
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { id, email, name, password, role, permissions } = body ?? {};

  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Access Control Logic
  if (user.role === 'ADMIN') {
    // Client Admin can only edit users in their own client
    if (existing.clientId !== user.clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Prevent admin from changing their own role (optional safety check)
    if (existing.id === user.id && role && role !== existing.role) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }
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
    const allowedRoles = ['ADMIN', 'CASHIER', 'MANAGER', 'WAITER', 'KITCHEN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: `Role must be one of: ${allowedRoles.join(', ')}` }, { status: 400 });
    }
    updateData.role = role;
  }

  if (permissions !== undefined) {
    // Only update permissions if role is MANAGER (or becoming MANAGER)
    const targetRole = role || existing.role;
    if (targetRole === 'MANAGER') {
      updateData.permissions = permissions;
    } else {
      updateData.permissions = null; // Clear permissions if not manager
    }
  } else if (role === 'MANAGER' && !existing.permissions) {
    // If switching to manager and no permissions provided, maybe set default? 
    // For now, let frontend handle providing defaults.
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
      clientId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = (session as any).user;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Verify user exists
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Access Control
    if (user.role === 'ADMIN') {
      if (existing.clientId !== user.clientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      // Prevent admin from deleting themselves
      if (existing.id === user.id) {
        return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
      }
    }

    // Check if user has related records that would prevent deletion
    const [salesCount, heldBillsCount, refundsCount] = await Promise.all([
      prisma.sale.count({ where: { cashierId: id } }),
      prisma.heldBill.count({ where: { cashierId: id } }),
      prisma.refund.count({ where: { cashierId: id } }),
    ]);

    if (salesCount > 0 || heldBillsCount > 0 || refundsCount > 0) {
      const reasons: string[] = [];
      if (salesCount > 0) reasons.push(`${salesCount} sale(s)`);
      if (heldBillsCount > 0) reasons.push(`${heldBillsCount} held bill(s)`);
      if (refundsCount > 0) reasons.push(`${refundsCount} refund(s)`);

      return NextResponse.json({
        error: `Cannot delete user. This user has ${reasons.join(', ')} associated with their account. Please reassign or delete these records first.`
      }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Delete user error:', e);
    // Handle Prisma foreign key constraint errors
    if (e.code === 'P2003' || e.message?.includes('Foreign key constraint')) {
      return NextResponse.json({
        error: 'Cannot delete user. This user has records (sales, held bills, or refunds) associated with their account. Please reassign or delete these records first.'
      }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message || 'Failed to delete user' }, { status: 500 });
  }
}

