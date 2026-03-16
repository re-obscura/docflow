import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, sanitizeString, checkRateLimit, requireAdmin } from '@/lib/security';
import { logger } from '@/lib/logger';
import { getClientByToken, apiError } from '@/lib/helpers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        if (!isValidToken(token)) {
            return apiError('Invalid token', 400);
        }

        const db = getDb();
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }
        const objectId = request.nextUrl.searchParams.get('object_id');
        let docs;
        if (objectId) {
            docs = db.prepare('SELECT * FROM required_docs WHERE client_id = ? AND object_id = ? ORDER BY id ASC').all(client.id, objectId);
        } else {
            docs = db.prepare('SELECT * FROM required_docs WHERE client_id = ? ORDER BY id ASC').all(client.id);
        }
        return NextResponse.json(docs);
    } catch (err) {
        logger.error('Failed to fetch required docs', { error: String(err) });
        return apiError('Failed to fetch required docs', 500);
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        // Admin-only: add required docs
        if (!requireAdmin(request.headers.get('authorization'))) {
            return apiError('Unauthorized', 401);
        }

        const { token } = await params;
        if (!isValidToken(token)) {
            return apiError('Invalid token', 400);
        }

        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(`reqdoc:${ip}`, 20, 60000)) {
            return apiError('Слишком много запросов', 429);
        }

        const body = await request.json();
        const doc_name = sanitizeString(body.doc_name || '', 300);
        const description = sanitizeString(body.description || '', 500);

        if (!doc_name) {
            return apiError('Название документа обязательно', 400);
        }

        const db = getDb();
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }

        const objectId = body.object_id ? Number(body.object_id) : null;

        const result = db.prepare(
            `INSERT INTO required_docs (client_id, object_id, doc_name, description) VALUES (?, ?, ?, ?)`
        ).run(client.id, objectId, doc_name, description);

        const doc = db.prepare('SELECT * FROM required_docs WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json(doc, { status: 201 });
    } catch (err) {
        logger.error('Failed to add required doc', { error: String(err) });
        return apiError('Failed to add required doc', 500);
    }
}
