import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, requireAdmin } from '@/lib/security';
import { logger } from '@/lib/logger';
import { getClientByToken, apiError } from '@/lib/helpers';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        // Admin-only: delete required doc
        if (!requireAdmin(request.headers.get('authorization'))) {
            return apiError('Unauthorized', 401);
        }

        const { token, id } = await params;
        if (!isValidToken(token) || isNaN(Number(id))) {
            return apiError('Invalid parameters', 400);
        }

        const db = getDb();
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }

        db.prepare('DELETE FROM required_docs WHERE id = ? AND client_id = ?').run(Number(id), client.id);
        return NextResponse.json({ success: true });
    } catch (err) {
        logger.error('Failed to delete required doc', { error: String(err) });
        return apiError('Failed to delete required doc', 500);
    }
}
