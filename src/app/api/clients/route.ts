import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeString, checkRateLimit, requireAdmin } from '@/lib/security';
import { logAudit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { DEFAULT_REQUIRED_DOCS } from '@/lib/constants';
import { apiError } from '@/lib/helpers';

export async function GET(request: NextRequest) {
    try {
        if (!requireAdmin(request.headers.get('authorization'))) {
            return apiError('Unauthorized', 401);
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('q')?.trim() || '';
        const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
        const offset = Math.max(Number(searchParams.get('offset') || 0), 0);

        const db = getDb();
        let countQuery = 'SELECT COUNT(*) as total FROM clients c';
        let query = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM documents WHERE client_id = c.id) as doc_count,
        (SELECT COUNT(*) FROM documents WHERE client_id = c.id AND status = 'pending') as pending_count,
        (SELECT COUNT(*) FROM documents WHERE client_id = c.id AND status = 'accepted') as accepted_count,
        (SELECT COUNT(*) FROM documents WHERE client_id = c.id AND status = 'rejected') as rejected_count,
        (SELECT COUNT(*) FROM messages WHERE client_id = c.id AND sender = 'client' AND id > COALESCE((SELECT MAX(id) FROM messages WHERE client_id = c.id AND sender = 'admin'), 0)) as unread_count,
        (SELECT COUNT(*) FROM employees WHERE client_id = c.id) as employee_count,
        (SELECT COUNT(*) FROM objects WHERE client_id = c.id) as object_count
      FROM clients c
    `;
        const params: unknown[] = [];
        const countParams: unknown[] = [];

        if (search) {
            const whereClause = ` WHERE c.company_name LIKE ? OR c.inn LIKE ? OR c.contact_person LIKE ?`;
            query += whereClause;
            countQuery += whereClause;
            const term = `%${search}%`;
            params.push(term, term, term);
            countParams.push(term, term, term);
        }

        const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

        query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const clients = db.prepare(query).all(...params);
        return NextResponse.json({ clients, total });
    } catch (err) {
        logger.error('Failed to fetch clients', { error: String(err) });
        return apiError('Failed to fetch clients', 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!requireAdmin(request.headers.get('authorization'))) {
            return apiError('Unauthorized', 401);
        }

        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(`create:${ip}`, 20, 60000)) {
            return apiError('Слишком много запросов', 429);
        }

        const body = await request.json();
        const company_name = sanitizeString(body.company_name || '', 200);
        const contact_person = sanitizeString(body.contact_person || '', 200);
        const token = uuidv4();
        const db = getDb();

        const createClient = db.transaction(() => {
            const result = db.prepare(
                `INSERT INTO clients (token, company_name, contact_person) VALUES (?, ?, ?)`
            ).run(token, company_name, contact_person);

            const clientId = result.lastInsertRowid;

            // Create a default first object
            const objResult = db.prepare(
                `INSERT INTO objects (client_id, object_name) VALUES (?, ?)`
            ).run(clientId, 'Объект 1');

            const objectId = objResult.lastInsertRowid;

            // Bind default required docs to the first object
            const insertReqDoc = db.prepare(
                `INSERT INTO required_docs (client_id, object_id, doc_name, description) VALUES (?, ?, ?, ?)`
            );
            for (const doc of DEFAULT_REQUIRED_DOCS) {
                insertReqDoc.run(clientId, objectId, doc.doc_name, doc.description);
            }

            return clientId;
        });

        const clientId = createClient();

        logAudit(Number(clientId), 'Администратор', 'admin', 'Создан клиент', 'client', Number(clientId), company_name);

        return NextResponse.json({ token, id: clientId }, { status: 201 });
    } catch (err) {
        logger.error('Failed to create client', { error: String(err) });
        return apiError('Failed to create client', 500);
    }
}
