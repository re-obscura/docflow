import { NextRequest, NextResponse } from 'next/server';
import { createSession, checkRateLimit, secureCompare } from '@/lib/security';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/helpers';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD environment variable is not set. Please set it in .env file.');
}

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(`auth:${ip}`, 5, 60000)) {
            return apiError('Слишком много попыток. Попробуйте через минуту.', 429);
        }

        const body = await request.json();
        const { password } = body;

        if (typeof password !== 'string' || !password) {
            return apiError('Требуется пароль', 400);
        }

        if (secureCompare(password, ADMIN_PASSWORD!)) {
            const token = createSession();
            return NextResponse.json({ success: true, token });
        }

        return apiError('Неверный пароль', 401);
    } catch (err) {
        logger.error('Admin auth error', { error: String(err) });
        return apiError('Ошибка авторизации', 500);
    }
}
