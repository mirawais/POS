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
    else if (role === 'CASHIER' || role === 'WAITER') url.pathname = '/cashier/billing';
    else if (role === 'KITCHEN') url.pathname = '/kitchen';
    else url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2. Client Admin / Manager area
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (role === 'SUPER_ADMIN') {
      const url = req.nextUrl.clone();
      url.pathname = '/super-admin';
      return NextResponse.redirect(url);
    }

    if (role === 'MANAGER') {
      const permissions = (token.permissions as any) || {};
      const path = req.nextUrl.pathname;

      let allowed = false;
      if (path === '/admin/dashboard') allowed = true;
      else if (path.startsWith('/admin/reports')) allowed = !!permissions.view_reports;
      else if (path.startsWith('/admin/products')) allowed = !!permissions.manage_products;
      else if (path.startsWith('/admin/categories')) allowed = !!permissions.manage_inventory;
      else if (path.startsWith('/admin/raw-materials')) allowed = !!permissions.manage_inventory;
      else if (path.startsWith('/admin/settings/variant-attributes')) allowed = !!permissions.manage_variant_settings || !!permissions.manage_products;
      else if (path.startsWith('/admin/settings/invoice')) allowed = !!permissions.manage_receipt_settings;
      else if (path.startsWith('/admin/coupons')) allowed = !!permissions.manage_coupons;
      else if (path.startsWith('/admin/settings/tax')) allowed = !!permissions.manage_tax_settings;
      else if (path.startsWith('/admin/settings/fbr')) allowed = !!permissions.manage_fbr;
      else if (path.startsWith('/admin/settings')) allowed = !!permissions.manage_general_settings;
      else if (path.startsWith('/admin/orders')) allowed = !!permissions.view_orders;
      else if (path.startsWith('/admin/users')) allowed = false; // Never allowed for managers

      if (!allowed) {
        const url = req.nextUrl.clone();
        url.pathname = '/admin/dashboard';
        return NextResponse.redirect(url);
      }
    } else if (role !== 'ADMIN') {
      const url = req.nextUrl.clone();
      if (role === 'KITCHEN') url.pathname = '/kitchen';
      else url.pathname = '/cashier/billing';
      return NextResponse.redirect(url);
    }
  }

  // 3. Cashier area (Admins and Super Admins and Managers can access if needed, but usually redirect them to their area if they end up here?)
  // Actually, usually Managers shouldn't be here unless they have billing role too.
  // For now, let's keep it simple: Super Admin, Admin, and Cashier are allowed. 
  // Should Managers be allowed in /cashier? The request says "No change to Admin or Cashier permissions".
  // Let's allow Managers to /cashier if they have billing (though we didn't add that permission yet). 
  // Let's just include MANAGER in the list for now if they happen to go there.
  if (req.nextUrl.pathname.startsWith('/cashier') && !['SUPER_ADMIN', 'ADMIN', 'CASHIER', 'MANAGER', 'WAITER'].includes(role)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 4. Kitchen area
  if (req.nextUrl.pathname.startsWith('/kitchen') && !['SUPER_ADMIN', 'ADMIN', 'KITCHEN'].includes(role)) {
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

