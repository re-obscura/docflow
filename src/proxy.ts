import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware — runs before route handlers.
 *
 * Currently handles:
 * - Admin API route protection (validates Bearer token via the /api/admin/validate-session endpoint)
 *
 * Note: We can't import server-only SQLite code here (middleware runs in Edge-like runtime),
 * so we validate by checking if the session token is present and well-formed.
 * The actual SQLite validation happens inside each route handler via requireAdmin().
 * This middleware acts as a fast-reject for obviously unauthenticated requests.
 */
export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Protect admin API routes (except login endpoint)
    if (pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/auth')) {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        // Quick format check (64 hex chars = 32 bytes)
        if (!/^[0-9a-f]{64}$/i.test(token)) {
            return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/api/admin/:path*'],
};
