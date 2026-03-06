import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, sanitizeString, checkRateLimit, requireAdmin } from '@/lib/security';
import { logAudit } from '@/lib/audit';

const DEFAULT_REQUIRED_DOCS = [
    { doc_name: 'Техническое задание', description: 'Техническое задание на выполнение работ' },
    { doc_name: 'Транспортная схема вывоза мусора', description: 'Схема транспортировки и вывоза строительного мусора' },
    { doc_name: 'Письмо о включении затрат в сводный сметный расчёт', description: 'Письмо о включении затрат в сводный сметный расчёт стоимости строительства' },
];

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        if (!isValidToken(token)) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const objects = db.prepare('SELECT * FROM objects WHERE client_id = ? ORDER BY created_at ASC').all(client.id);
        return NextResponse.json(objects);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch objects' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        if (!isValidToken(token)) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
        }

        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(`obj:${token}:${ip}`, 20, 60000)) {
            return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 });
        }

        // Allow creation by client or admin
        const isAdmin = requireAdmin(request.headers.get('authorization'));

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const body = await request.json();
        const objectName = sanitizeString(body.object_name || '', 300);

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

        logAudit(client.id, isAdmin ? 'Администратор' : 'Клиент', isAdmin ? 'admin' : 'employee', 'Создан объект', 'object', Number(objectId), objectName);

        const object = db.prepare('SELECT * FROM objects WHERE id = ?').get(objectId);
        return NextResponse.json(object, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Failed to create object' }, { status: 500 });
    }
}
