import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Define protected routes that require authentication
const protectedRoutes = [
  '/admin',
  '/lists/liked',
  '/lists/saved',
  '/lists/favorites',
  '/lists/hidden',
  '/settings',
  '/api/trpc/admin',
];

// Define public routes that should bypass authentication
const publicRoutes = [
  '/',
  '/search',
  '/browse',
  '/map',
  '/apartment',
  '/auth/signin',
  '/auth/signup',
  '/api/auth',
  '/api/trpc/search',
  '/api/trpc/apartment',
  '/api/trpc/station',
  '/api/trpc/realtime-search',
  '/api/trpc/system',
  '/api/trpc/performance',
  '/api/trpc/apartmentList',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the route requires authentication
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  // Get the token to check if user is authenticated
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  
  // Handle authentication logic
  if (isProtectedRoute && !token) {
    // Redirect unauthenticated users to sign in page
    const url = new URL('/auth/signin', request.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }
  
  // Special handling for admin routes - could add role checking here
  if (pathname.startsWith('/admin') && token) {
    // For now, any authenticated user can access admin
    // In the future, you could check for specific roles:
    // if (token.role !== 'admin') {
    //   return NextResponse.redirect(new URL('/', request.url));
    // }
  }
  
  // Create response
  const response = NextResponse.next();
  
  // Apply no-cache headers to all routes
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};