import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, sanitizeText, sanitizeString, checkRateLimit, requireAdmin } from '@/lib/security';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { isAllowedFile } from '@/lib/security';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

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

        const contentType = request.headers.get('content-type') || '';
        let text = '';
        let senderValue = 'client';
        let senderName = '';
        let attachmentFilename = '';
        let attachmentOriginalName = '';
        let attachmentType = '';
        let attachmentSize = 0;

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        if (contentType.includes('multipart/form-data')) {
            // Handle file upload
            const formData = await request.formData();
            text = sanitizeText((formData.get('text') as string) || '', 5000);
            senderName = sanitizeString((formData.get('sender_name') as string) || '', 200);
            const senderField = (formData.get('sender') as string) || 'client';

            if (senderField === 'admin') {
                if (!requireAdmin(request.headers.get('authorization'))) {
                    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
                }
                senderValue = 'admin';
            }

            const file = formData.get('file') as File | null;
            if (file && file.size > 0) {
                if (file.size > MAX_FILE_SIZE) {
                    return NextResponse.json({ error: 'Файл слишком большой (макс. 50 МБ)' }, { status: 400 });
                }
                if (!isAllowedFile(file.name, file.type)) {
                    return NextResponse.json({ error: 'Недопустимый тип файла' }, { status: 400 });
                }

                const clientDir = path.join(UPLOAD_DIR, String(client.id), 'chat');
                await mkdir(clientDir, { recursive: true });

                const ext = path.extname(file.name) || '';
                const filename = `${randomUUID()}${ext}`;
                const buffer = Buffer.from(await file.arrayBuffer());
                await writeFile(path.join(clientDir, filename), buffer);

                attachmentFilename = filename;
                attachmentOriginalName = file.name.replace(/[<>"]/g, '').slice(0, 255);
                attachmentType = file.type;
                attachmentSize = file.size;
            }

            if (!text && !attachmentFilename) {
                return NextResponse.json({ error: 'Введите текст или прикрепите файл' }, { status: 400 });
            }
        } else {
            // JSON body (backward compat)
            const body = await request.json();
            text = sanitizeText(body.text || '', 5000);
            senderName = sanitizeString(body.sender_name || '', 200);

            if (body.sender === 'admin') {
                if (!requireAdmin(request.headers.get('authorization'))) {
                    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
                }
                senderValue = 'admin';
            }

            if (!text) {
                return NextResponse.json({ error: 'Текст сообщения обязателен' }, { status: 400 });
            }
        }

        const result = db.prepare(`
            INSERT INTO messages (client_id, sender, sender_name, text, attachment_filename, attachment_original_name, attachment_type, attachment_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(client.id, senderValue, senderName, text, attachmentFilename, attachmentOriginalName, attachmentType, attachmentSize);

        const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json(message, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}
