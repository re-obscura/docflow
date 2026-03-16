import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, sanitizeText, sanitizeString, checkRateLimit, requireAdmin, isAllowedFile } from '@/lib/security';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { getClientByToken, apiError } from '@/lib/helpers';
import { MAX_FILE_SIZE } from '@/lib/constants';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

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
        const messages = db.prepare('SELECT * FROM messages WHERE client_id = ? ORDER BY created_at ASC').all(client.id);
        return NextResponse.json(messages);
    } catch (err) {
        logger.error('Failed to fetch messages', { error: String(err) });
        return apiError('Failed to fetch messages', 500);
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
        if (!checkRateLimit(`msg:${token}:${ip}`, 30, 60000)) {
            return apiError('Слишком много сообщений. Попробуйте позже.', 429);
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
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }

        if (contentType.includes('multipart/form-data')) {
            // Handle file upload
            const formData = await request.formData();
            text = sanitizeText((formData.get('text') as string) || '', 5000);
            senderName = sanitizeString((formData.get('sender_name') as string) || '', 200);
            const senderField = (formData.get('sender') as string) || 'client';

            if (senderField === 'admin') {
                if (!requireAdmin(request.headers.get('authorization'))) {
                    return apiError('Unauthorized', 401);
                }
                senderValue = 'admin';
            }

            const file = formData.get('file') as File | null;
            if (file && file.size > 0) {
                if (file.size > MAX_FILE_SIZE) {
                    return apiError('Файл слишком большой (макс. 50 МБ)', 400);
                }
                if (!isAllowedFile(file.name, file.type)) {
                    return apiError('Недопустимый тип файла', 400);
                }

                const clientDir = path.join(UPLOAD_DIR, String(client.id), 'chat');
                await mkdir(clientDir, { recursive: true });

                const ext = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, '');
                const filename = `${randomUUID()}${ext}`;
                const buffer = Buffer.from(await file.arrayBuffer());
                await writeFile(path.join(clientDir, filename), buffer);

                attachmentFilename = filename;
                attachmentOriginalName = file.name.replace(/[<>"]/g, '').slice(0, 255);
                attachmentType = file.type;
                attachmentSize = file.size;
            }

            if (!text && !attachmentFilename) {
                return apiError('Введите текст или прикрепите файл', 400);
            }
        } else {
            // JSON body (backward compat)
            const body = await request.json();
            text = sanitizeText(body.text || '', 5000);
            senderName = sanitizeString(body.sender_name || '', 200);

            if (body.sender === 'admin') {
                if (!requireAdmin(request.headers.get('authorization'))) {
                    return apiError('Unauthorized', 401);
                }
                senderValue = 'admin';
            }

            if (!text) {
                return apiError('Текст сообщения обязателен', 400);
            }
        }

        const result = db.prepare(`
            INSERT INTO messages (client_id, sender, sender_name, text, attachment_filename, attachment_original_name, attachment_type, attachment_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(client.id, senderValue, senderName, text, attachmentFilename, attachmentOriginalName, attachmentType, attachmentSize);

        const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json(message, { status: 201 });
    } catch (err) {
        logger.error('Failed to send message', { error: String(err) });
        return apiError('Failed to send message', 500);
    }
}
