import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/helpers';

export async function GET(request: NextRequest) {
    try {
        if (!requireAdmin(request.headers.get('authorization'))) {
            return apiError('Unauthorized', 401);
        }

        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('client_id');
        const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
        const offset = Number(searchParams.get('offset') || 0);

        const db = getDb();
        let query = 'SELECT * FROM audit_log';
        const params: unknown[] = [];

        if (clientId) {
            query += ' WHERE client_id = ?';
            params.push(Number(clientId));
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const entries = db.prepare(query).all(...params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM audit_log';
        const countParams: unknown[] = [];
        if (clientId) {
            countQuery += ' WHERE client_id = ?';
            countParams.push(Number(clientId));
        }
        const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

        return NextResponse.json({ entries, total });
    } catch (err) {
        logger.error('Failed to fetch audit log', { error: String(err) });
        return apiError('Failed to fetch audit log', 500);
    }
}
