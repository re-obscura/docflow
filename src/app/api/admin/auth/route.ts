import { NextRequest, NextResponse } from 'next/server';
import { createSession, checkRateLimit, secureCompare } from '@/lib/security';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(`auth:${ip}`, 5, 60000)) {
            return NextResponse.json(
                { error: 'Слишком много попыток. Попробуйте через минуту.' },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { password } = body;

        if (typeof password !== 'string' || !password) {
            return NextResponse.json({ error: 'Требуется пароль' }, { status: 400 });
        }

        if (secureCompare(password, ADMIN_PASSWORD)) {
            const token = createSession();
            return NextResponse.json({ success: true, token });
        }

        return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
    } catch {
        return NextResponse.json({ error: 'Ошибка авторизации' }, { status: 500 });
    }
}
