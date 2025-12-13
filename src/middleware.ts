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

  // role-based guard for admin vs cashier spaces
  if (req.nextUrl.pathname.startsWith('/admin') && token.role !== 'ADMIN') {
    const url = req.nextUrl.clone();
    url.pathname = '/cashier/billing';
    return NextResponse.redirect(url);
  }

  if (req.nextUrl.pathname.startsWith('/cashier') && !['ADMIN', 'CASHIER'].includes(String(token.role))) {
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

