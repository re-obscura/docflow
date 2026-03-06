import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, checkRateLimit, verifyPassword } from '@/lib/security';

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
        // Rate limit by IP
        if (!checkRateLimit(`empauth:${token}:${ip}`, 10, 60000)) {
            return NextResponse.json({ error: 'Слишком много попыток. Подождите.' }, { status: 429 });
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const body = await request.json();
        const { employee_id, password } = body;

        if (!employee_id) {
            return NextResponse.json({ error: 'Укажите сотрудника' }, { status: 400 });
        }

        // Rate limit per employee to prevent brute force from multiple IPs
        if (!checkRateLimit(`empauth:emp:${employee_id}`, 5, 60000)) {
            return NextResponse.json({ error: 'Слишком много попыток для этого сотрудника. Подождите.' }, { status: 429 });
        }

        const employee = db.prepare(
            'SELECT id, full_name, position, phone, email, password FROM employees WHERE id = ? AND client_id = ?'
        ).get(employee_id, client.id) as { id: number; full_name: string; position: string; phone: string; email: string; password: string } | undefined;

        if (!employee) {
            return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });
        }

        // If employee has a password, verify it
        if (employee.password && employee.password !== '') {
            if (!password || !verifyPassword(password, employee.password)) {
                return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
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
    } catch {
        return NextResponse.json({ error: 'Ошибка авторизации' }, { status: 500 });
    }
}
