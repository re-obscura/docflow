/**
 * Test helper: provides a real SQLite DB and utilities
 * for testing API route handlers directly.
 */
import { getDb } from '@/lib/db';
import { createSession } from '@/lib/security';
import { NextRequest } from 'next/server';

export function getTestDb() {
    return getDb();
}

export function createTestAdminToken(): string {
    return createSession();
}

/**
 * Build a NextRequest compatible with App Router route handlers.
 */
export function buildRequest(
    url: string,
    options: {
        method?: string;
        body?: Record<string, unknown> | FormData;
        headers?: Record<string, string>;
    } = {}
): NextRequest {
    const baseUrl = 'http://localhost:3000';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    const init: RequestInit = {
        method: options.method || 'GET',
        headers: {
            ...(options.headers || {}),
        },
    };

    if (options.body && !(options.body instanceof FormData)) {
        init.body = JSON.stringify(options.body);
        (init.headers as Record<string, string>)['content-type'] = 'application/json';
    } else if (options.body instanceof FormData) {
        init.body = options.body;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new NextRequest(fullUrl, init as any);
}

/**
 * Helper to parse JSON from NextResponse
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseResponse(res: Response): Promise<{ status: number; data: any }> {
    const data = await res.json();
    return { status: res.status, data };
}
