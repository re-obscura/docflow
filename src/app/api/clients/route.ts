import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeString, checkRateLimit, requireAdmin } from '@/lib/security';

const DEFAULT_REQUIRED_DOCS = [
    { doc_name: 'Техническое задание', description: 'Техническое задание на выполнение работ' },
    { doc_name: 'Транспортная схема вывоза мусора', description: 'Схема транспортировки и вывоза строительного мусора' },
    { doc_name: 'Письмо о включении затрат в сводный сметный расчёт', description: 'Письмо о включении затрат в сводный сметный расчёт стоимости строительства (лимитированные затраты)' },
];

export async function GET(request: NextRequest) {
    try {
        if (!requireAdmin(request.headers.get('authorization'))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = getDb();
        const clients = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM documents WHERE client_id = c.id) as doc_count,
        (SELECT COUNT(*) FROM documents WHERE client_id = c.id AND status = 'pending') as pending_count,
        (SELECT COUNT(*) FROM documents WHERE client_id = c.id AND status = 'accepted') as accepted_count,
        (SELECT COUNT(*) FROM documents WHERE client_id = c.id AND status = 'rejected') as rejected_count,
        (SELECT COUNT(*) FROM messages WHERE client_id = c.id AND sender = 'client' AND id > COALESCE((SELECT MAX(id) FROM messages WHERE client_id = c.id AND sender = 'admin'), 0)) as unread_count
      FROM clients c ORDER BY c.created_at DESC
    `).all();
        return NextResponse.json(clients);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!requireAdmin(request.headers.get('authorization'))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(`create:${ip}`, 20, 60000)) {
            return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 });
        }

        const body = await request.json();
        const company_name = sanitizeString(body.company_name || '', 200);
        const contact_person = sanitizeString(body.contact_person || '', 200);
        const token = uuidv4();
        const db = getDb();

        const result = db.prepare(
            `INSERT INTO clients (token, company_name, contact_person) VALUES (?, ?, ?)`
        ).run(token, company_name, contact_person);

        const clientId = result.lastInsertRowid;

        const insertReqDoc = db.prepare(
            `INSERT INTO required_docs (client_id, doc_name, description) VALUES (?, ?, ?)`
        );
        for (const doc of DEFAULT_REQUIRED_DOCS) {
            insertReqDoc.run(clientId, doc.doc_name, doc.description);
        }

        return NextResponse.json({ token, id: clientId }, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
    }
}
