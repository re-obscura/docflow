import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, sanitizeString, checkRateLimit, hashPassword } from '@/lib/security';
import { logAudit } from '@/lib/audit';
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

        const employees = db.prepare('SELECT id, client_id, full_name, position, phone, email, created_at FROM employees WHERE client_id = ? ORDER BY created_at ASC').all(client.id);
        return NextResponse.json(employees);
    } catch (err) {
        logger.error('Failed to fetch employees', { error: String(err) });
        return apiError('Failed to fetch employees', 500);
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
        if (!checkRateLimit(`emp:${token}:${ip}`, 20, 60000)) {
            return apiError('Слишком много запросов', 429);
        }

        const db = getDb();
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }

        const body = await request.json();
        const fullName = sanitizeString(body.full_name || '', 200);
        const rawPassword = body.password || '';
        const hashedPassword = rawPassword ? hashPassword(rawPassword) : '';

        const result = db.prepare(
            `INSERT INTO employees (client_id, full_name, position, phone, email, password) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
            client.id,
            fullName,
            sanitizeString(body.position || '', 200),
            sanitizeString(body.phone || '', 30),
            sanitizeString(body.email || '', 100),
            hashedPassword,
        );

        logAudit(client.id, fullName || 'Новый сотрудник', 'employee', 'Создан сотрудник', 'employee', Number(result.lastInsertRowid), fullName);

        const employee = db.prepare('SELECT id, client_id, full_name, position, phone, email, created_at FROM employees WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json(employee, { status: 201 });
    } catch (err) {
        logger.error('Failed to create employee', { error: String(err) });
        return apiError('Failed to create employee', 500);
    }
}
