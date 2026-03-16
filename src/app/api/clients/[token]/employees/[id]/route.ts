import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, sanitizeString, checkRateLimit, hashPassword } from '@/lib/security';
import { logAudit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { getClientByToken, apiError } from '@/lib/helpers';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        const { token, id } = await params;
        if (!isValidToken(token) || isNaN(Number(id))) {
            return apiError('Invalid parameters', 400);
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

        // Handle password: only re-hash if a new password is provided
        const rawPassword = body.password;
        let passwordUpdate = '';
        const updateParams: unknown[] = [
            sanitizeString(body.full_name || '', 200),
            sanitizeString(body.position || '', 200),
            sanitizeString(body.phone || '', 30),
            sanitizeString(body.email || '', 100),
        ];

        if (rawPassword && rawPassword.trim()) {
            passwordUpdate = ', password = ?';
            updateParams.push(hashPassword(rawPassword));
        }

        updateParams.push(Number(id), client.id);

        db.prepare(`
            UPDATE employees SET full_name = ?, position = ?, phone = ?, email = ?${passwordUpdate}
            WHERE id = ? AND client_id = ?
        `).run(...updateParams);

        logAudit(client.id, 'Сотрудник', 'employee', 'Обновлён сотрудник', 'employee', Number(id), body.full_name || '');

        const employee = db.prepare('SELECT id, client_id, full_name, position, phone, email, created_at FROM employees WHERE id = ? AND client_id = ?').get(Number(id), client.id);
        if (!employee) {
            return apiError('Employee not found', 404);
        }
        return NextResponse.json(employee);
    } catch (err) {
        logger.error('Failed to update employee', { error: String(err) });
        return apiError('Failed to update employee', 500);
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        const { token, id } = await params;
        if (!isValidToken(token) || isNaN(Number(id))) {
            return apiError('Invalid parameters', 400);
        }

        const db = getDb();
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }

        const emp = db.prepare('SELECT full_name FROM employees WHERE id = ? AND client_id = ?').get(Number(id), client.id) as { full_name: string } | undefined;
        db.prepare('DELETE FROM employees WHERE id = ? AND client_id = ?').run(Number(id), client.id);
        logAudit(client.id, emp?.full_name || '', 'employee', 'Удалён сотрудник', 'employee', Number(id));

        return NextResponse.json({ success: true });
    } catch (err) {
        logger.error('Failed to delete employee', { error: String(err) });
        return apiError('Failed to delete employee', 500);
    }
}
