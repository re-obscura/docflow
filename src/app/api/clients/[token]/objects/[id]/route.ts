import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeString, sanitizeText, isValidToken, checkRateLimit } from '@/lib/security';
import { rmSync } from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { getClientByToken, apiError } from '@/lib/helpers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        const { token, id } = await params;
        if (!isValidToken(token)) {
            return apiError('Invalid token', 400);
        }

        const db = getDb();
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }

        const obj = db.prepare('SELECT * FROM objects WHERE id = ? AND client_id = ?').get(id, client.id);
        if (!obj) {
            return apiError('Object not found', 404);
        }
        return NextResponse.json(obj);
    } catch (err) {
        logger.error('Failed to fetch object', { error: String(err) });
        return apiError('Failed to fetch object', 500);
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        const { token, id } = await params;
        if (!isValidToken(token)) {
            return apiError('Invalid token', 400);
        }

        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(`obj:${token}:${ip}`, 20, 60000)) {
            return apiError('Слишком много запросов', 429);
        }

        const db = getDb();
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }

        const body = await request.json();
        db.prepare(`
            UPDATE objects SET
                object_name = ?, object_address = ?, object_purpose = ?,
                tech_economic_indicators = ?, construction_type = ?,
                financing_info = ?, buildings_info = ?, cost_justification = ?
            WHERE id = ? AND client_id = ?
        `).run(
            sanitizeString(body.object_name || '', 500),
            sanitizeString(body.object_address || '', 500),
            sanitizeText(body.object_purpose || '', 2000),
            sanitizeText(body.tech_economic_indicators || '', 5000),
            sanitizeString(body.construction_type || '', 300),
            sanitizeText(body.financing_info || '', 2000),
            sanitizeText(body.buildings_info || '', 5000),
            sanitizeText(body.cost_justification || '', 5000),
            id,
            client.id,
        );

        const updated = db.prepare('SELECT * FROM objects WHERE id = ? AND client_id = ?').get(id, client.id);
        if (!updated) {
            return apiError('Object not found', 404);
        }
        return NextResponse.json(updated);
    } catch (err) {
        logger.error('Failed to update object', { error: String(err) });
        return apiError('Failed to update object', 500);
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        const { token, id } = await params;
        if (!isValidToken(token)) {
            return apiError('Invalid token', 400);
        }

        const db = getDb();
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }

        // Clean up uploaded files for documents belonging to this object
        const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
        const docs = db.prepare('SELECT filename FROM documents WHERE client_id = ? AND object_id = ?').all(client.id, Number(id)) as { filename: string }[];
        for (const doc of docs) {
            try { const safeName = path.basename(doc.filename); rmSync(path.join(UPLOAD_DIR, String(client.id), safeName), { force: true }); } catch { /* ignore */ }
        }

        const result = db.prepare('DELETE FROM objects WHERE id = ? AND client_id = ?').run(id, client.id);
        if (result.changes === 0) {
            return apiError('Object not found', 404);
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        logger.error('Failed to delete object', { error: String(err) });
        return apiError('Failed to delete object', 500);
    }
}
