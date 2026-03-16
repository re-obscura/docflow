import { NextRequest, NextResponse } from 'next/server';
import { destroySession, requireAdmin } from '@/lib/security';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/helpers';

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return apiError('No token provided', 400);
        }

        const token = authHeader.replace(/^Bearer\s+/i, '');
        destroySession(token);
        return NextResponse.json({ success: true });
    } catch (err) {
        logger.error('Admin logout error', { error: String(err) });
        return apiError('Ошибка при выходе', 500);
    }
}
