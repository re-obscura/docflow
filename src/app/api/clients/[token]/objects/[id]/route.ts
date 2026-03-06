import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeString, sanitizeText, isValidToken, checkRateLimit } from '@/lib/security';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        const { token, id } = await params;
        if (!isValidToken(token)) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const obj = db.prepare('SELECT * FROM objects WHERE id = ? AND client_id = ?').get(id, client.id);
        if (!obj) {
            return NextResponse.json({ error: 'Object not found' }, { status: 404 });
        }
        return NextResponse.json(obj);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch object' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        const { token, id } = await params;
        if (!isValidToken(token)) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
        }

        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(`obj:${token}:${ip}`, 20, 60000)) {
            return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 });
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
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
            return NextResponse.json({ error: 'Object not found' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: 'Failed to update object' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        const { token, id } = await params;
        if (!isValidToken(token)) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const result = db.prepare('DELETE FROM objects WHERE id = ? AND client_id = ?').run(id, client.id);
        if (result.changes === 0) {
            return NextResponse.json({ error: 'Object not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to delete object' }, { status: 500 });
    }
}
