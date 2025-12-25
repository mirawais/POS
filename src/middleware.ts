import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const isAuthRoute = req.nextUrl.pathname.startsWith('/api/auth') || req.nextUrl.pathname === '/login';
  if (isAuthRoute) return NextResponse.next();

  const token = await getToken({ req });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Role-based guards
  const role = String(token.role);

  // 1. Super Admin ONLY area
  if (req.nextUrl.pathname.startsWith('/super-admin') && role !== 'SUPER_ADMIN') {
    const url = req.nextUrl.clone();
    // Redirect unauthorized users to their dashboard or login
    if (role === 'ADMIN') url.pathname = '/admin/dashboard';
    else if (role === 'CASHIER') url.pathname = '/cashier/billing';
    else url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2. Client Admin area (Super Admin can also access if we want, or we keep them separate. 
  // Requirement says "Super Admin can access... all data". 
  // Usually Super Admin uses their own dashboard. Let's block them from /admin to avoid confusion unless impersonating.)
  if (req.nextUrl.pathname.startsWith('/admin') && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    const url = req.nextUrl.clone();
    url.pathname = '/cashier/billing';
    return NextResponse.redirect(url);
  }

  // 3. Cashier area (Admins and Super Admins can access)
  if (req.nextUrl.pathname.startsWith('/cashier') && !['SUPER_ADMIN', 'ADMIN', 'CASHIER'].includes(role)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|images|fonts).*)',
  ],
};

