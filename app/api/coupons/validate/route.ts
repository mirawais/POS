import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clientId = (session as any).user.clientId as string;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
  }
  
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });
  
  if (!coupon) {
    return NextResponse.json({ error: 'Invalid coupon code' }, { status: 404 });
  }
  
  // Verify coupon belongs to client
  if (coupon.clientId !== clientId) {
    return NextResponse.json({ error: 'Invalid coupon code' }, { status: 404 });
  }
  
  // Check if coupon is active
  if (!coupon.isActive) {
    return NextResponse.json({ error: 'This coupon code is not active' }, { status: 400 });
  }
  
  // Check if coupon has started
  const now = new Date();
  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    return NextResponse.json({ error: 'This coupon code is not yet valid' }, { status: 400 });
  }
  
  // Check if coupon has expired
  if (coupon.endsAt && new Date(coupon.endsAt) < now) {
    return NextResponse.json({ error: 'This coupon code has expired' }, { status: 400 });
  }
  
  return NextResponse.json(coupon);
}

