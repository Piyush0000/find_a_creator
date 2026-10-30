import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ROLE_COOKIE } from './lib/session';

// Portal routes and the role allowed to open each one
const PROTECTED_ROUTES: Array<{ prefix: string; role: string }> = [
  { prefix: '/dashboard', role: 'CREATOR' },
  { prefix: '/brief', role: 'MERCHANT' },
  { prefix: '/collabs', role: 'MERCHANT' },
  { prefix: '/moderation', role: 'SUPER_ADMIN' },
  { prefix: '/admin', role: 'SUPER_ADMIN' }
];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const route = PROTECTED_ROUTES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
  );
  if (!route) {
    return NextResponse.next();
  }

  const role = request.cookies.get(ROLE_COOKIE)?.value;
  if (role === route.role) {
    return NextResponse.next();
  }

  // Not signed in, or signed in with the wrong role: send to login and come back after
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/brief/:path*', '/collabs/:path*', '/moderation/:path*', '/admin/:path*']
};
