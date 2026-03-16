import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, sanitizeString, checkRateLimit, requireAdmin } from '@/lib/security';
import { logAudit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { getClientByToken, apiError } from '@/lib/helpers';
import { DEFAULT_REQUIRED_DOCS } from '@/lib/constants';

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

        const objects = db.prepare('SELECT * FROM objects WHERE client_id = ? ORDER BY created_at ASC').all(client.id);
        return NextResponse.json(objects);
    } catch (err) {
        logger.error('Failed to fetch objects', { error: String(err) });
        return apiError('Failed to fetch objects', 500);
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        if (!isValidToken(token)) {
            return apiError('Invalid token', 400);
        }

        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(`obj:${token}:${ip}`, 20, 60000)) {
            return apiError('Слишком много запросов', 429);
        }

        // Allow creation by client or admin
        const isAdmin = requireAdmin(request.headers.get('authorization'));

        const db = getDb();
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }

        const body = await request.json();
        const objectName = sanitizeString(body.object_name || '', 300);

        const createObject = db.transaction(() => {
            const result = db.prepare(
                `INSERT INTO objects (client_id, object_name) VALUES (?, ?)`
            ).run(client.id, objectName);

            const objectId = result.lastInsertRowid;

            // Auto-copy default required docs for the new object
            const insertReqDoc = db.prepare(
                `INSERT INTO required_docs (client_id, object_id, doc_name, description) VALUES (?, ?, ?, ?)`
            );
            for (const doc of DEFAULT_REQUIRED_DOCS) {
                insertReqDoc.run(client.id, objectId, doc.doc_name, doc.description);
            }

            return objectId;
        });

        const objectId = createObject();

        logAudit(client.id, isAdmin ? 'Администратор' : 'Клиент', isAdmin ? 'admin' : 'employee', 'Создан объект', 'object', Number(objectId), objectName);

        const object = db.prepare('SELECT * FROM objects WHERE id = ?').get(objectId);
        return NextResponse.json(object, { status: 201 });
    } catch (err) {
        logger.error('Failed to create object', { error: String(err) });
        return apiError('Failed to create object', 500);
    }
}
