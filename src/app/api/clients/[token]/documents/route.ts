import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { isValidToken, isAllowedFile, sanitizeString, checkRateLimit } from '@/lib/security';
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
        const objectId = request.nextUrl.searchParams.get('object_id');
        let documents;
        if (objectId) {
            documents = db.prepare('SELECT * FROM documents WHERE client_id = ? AND object_id = ? ORDER BY uploaded_at DESC').all(client.id, objectId);
        } else {
            documents = db.prepare('SELECT * FROM documents WHERE client_id = ? ORDER BY uploaded_at DESC').all(client.id);
        }
        return NextResponse.json(documents);
    } catch (err) {
        logger.error('Failed to fetch documents', { error: String(err) });
        return apiError('Failed to fetch documents', 500);
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
        if (!checkRateLimit(`upload:${token}:${ip}`, 30, 60000)) {
            return apiError('Слишком много загрузок. Попробуйте позже.', 429);
        }

        const db = getDb();
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const category = sanitizeString((formData.get('category') as string) || '', 300);
        const objectId = formData.get('object_id') ? Number(formData.get('object_id')) : null;
        const uploadedByEmployeeId = formData.get('uploaded_by_employee_id') ? Number(formData.get('uploaded_by_employee_id')) : null;
        const uploadedByName = sanitizeString((formData.get('uploaded_by_name') as string) || '', 200);

        if (!file) {
            return apiError('Файл не выбран', 400);
        }

        if (file.size > MAX_FILE_SIZE) {
            return apiError('Файл слишком большой (максимум 50 МБ)', 400);
        }

        if (file.size === 0) {
            return apiError('Файл пустой', 400);
        }

        if (!isAllowedFile(file.name, file.type)) {
            return apiError('Недопустимый тип файла. Разрешены: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG', 400);
        }

        // Sanitize filename: only keep extension, generate safe name
        const ext = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, '');
        const filename = `${uuidv4()}${ext}`;
        const clientDir = path.join(UPLOAD_DIR, String(client.id));

        // Ensure path doesn't escape upload dir
        const resolvedDir = path.resolve(clientDir);
        if (!resolvedDir.startsWith(path.resolve(UPLOAD_DIR))) {
            return apiError('Invalid path', 400);
        }

        await mkdir(clientDir, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(path.join(clientDir, filename), buffer);

        // Sanitize the original name for storage
        const safeName = file.name.replace(/[<>"]/g, '').slice(0, 255);

        const result = db.prepare(`
      INSERT INTO documents (client_id, object_id, filename, original_name, file_type, file_size, category, uploaded_by_employee_id, uploaded_by_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(client.id, objectId, filename, safeName, file.type, file.size, category, uploadedByEmployeeId, uploadedByName);

        const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json(doc, { status: 201 });
    } catch (err) {
        logger.error('Upload error', { error: String(err) });
        return apiError('Failed to upload document', 500);
    }
}
