import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, sanitizeString, checkRateLimit, hashPassword } from '@/lib/security';
import { logAudit } from '@/lib/audit';

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

        const employees = db.prepare('SELECT id, client_id, full_name, position, phone, email, created_at FROM employees WHERE client_id = ? ORDER BY created_at ASC').all(client.id);
        return NextResponse.json(employees);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
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
        if (!checkRateLimit(`emp:${token}:${ip}`, 20, 60000)) {
            return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 });
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
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
    } catch {
        return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
    }
}
