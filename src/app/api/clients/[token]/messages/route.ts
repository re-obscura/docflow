import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, sanitizeText, checkRateLimit, requireAdmin } from '@/lib/security';

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
        const messages = db.prepare('SELECT * FROM messages WHERE client_id = ? ORDER BY created_at ASC').all(client.id);
        return NextResponse.json(messages);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
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
        if (!checkRateLimit(`msg:${token}:${ip}`, 30, 60000)) {
            return NextResponse.json({ error: 'Слишком много сообщений. Попробуйте позже.' }, { status: 429 });
        }

        const body = await request.json();
        const text = sanitizeText(body.text || '', 5000);

        if (!text) {
            return NextResponse.json({ error: 'Текст сообщения обязателен' }, { status: 400 });
        }

        // Determine sender: only authenticated admin can send as 'admin'
        let senderValue = 'client';
        if (body.sender === 'admin') {
            if (!requireAdmin(request.headers.get('authorization'))) {
                return NextResponse.json({ error: 'Unauthorized: cannot send as admin' }, { status: 401 });
            }
            senderValue = 'admin';
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const result = db.prepare(
            `INSERT INTO messages (client_id, sender, text) VALUES (?, ?, ?)`
        ).run(client.id, senderValue, text);

        const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json(message, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}
