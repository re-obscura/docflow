import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, checkRateLimit, verifyPassword, needsPasswordMigration, hashPassword } from '@/lib/security';
import { logger } from '@/lib/logger';
import { getClientByToken, apiError } from '@/lib/helpers';

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
        // Rate limit by IP
        if (!checkRateLimit(`empauth:${token}:${ip}`, 10, 60000)) {
            return apiError('Слишком много попыток. Подождите.', 429);
        }

        const db = getDb();
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }

        const body = await request.json();
        const { employee_id, password } = body;

        if (!employee_id) {
            return apiError('Укажите сотрудника', 400);
        }

        // Rate limit per employee to prevent brute force from multiple IPs
        if (!checkRateLimit(`empauth:emp:${employee_id}`, 5, 60000)) {
            return apiError('Слишком много попыток для этого сотрудника. Подождите.', 429);
        }

        const employee = db.prepare(
            'SELECT id, full_name, position, phone, email, password FROM employees WHERE id = ? AND client_id = ?'
        ).get(employee_id, client.id) as { id: number; full_name: string; position: string; phone: string; email: string; password: string } | undefined;

        if (!employee) {
            return apiError('Сотрудник не найден', 404);
        }

        // If employee has a password, verify it
        if (employee.password && employee.password !== '') {
            if (!password || !verifyPassword(password, employee.password)) {
                return apiError('Неверный пароль', 401);
            }
            // Auto-migrate legacy plain-text passwords to bcrypt
            if (needsPasswordMigration(employee.password)) {
                try { db.prepare('UPDATE employees SET password = ? WHERE id = ?').run(hashPassword(password), employee.id); } catch { /* non-critical */ }
            }
        }

        return NextResponse.json({
            success: true,
            employee: {
                id: employee.id,
                full_name: employee.full_name,
                position: employee.position,
                phone: employee.phone,
                email: employee.email,
            },
        });
    } catch (err) {
        logger.error('Employee auth error', { error: String(err) });
        return apiError('Ошибка авторизации', 500);
    }
}
