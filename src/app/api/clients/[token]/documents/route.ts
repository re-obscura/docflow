import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { isValidToken, isAllowedFile, sanitizeString, checkRateLimit } from '@/lib/security';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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
        const objectId = request.nextUrl.searchParams.get('object_id');
        let documents;
        if (objectId) {
            documents = db.prepare('SELECT * FROM documents WHERE client_id = ? AND object_id = ? ORDER BY uploaded_at DESC').all(client.id, objectId);
        } else {
            documents = db.prepare('SELECT * FROM documents WHERE client_id = ? ORDER BY uploaded_at DESC').all(client.id);
        }
        return NextResponse.json(documents);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
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
        if (!checkRateLimit(`upload:${token}:${ip}`, 30, 60000)) {
            return NextResponse.json({ error: 'Слишком много загрузок. Попробуйте позже.' }, { status: 429 });
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const category = sanitizeString((formData.get('category') as string) || '', 300);
        const objectId = formData.get('object_id') ? Number(formData.get('object_id')) : null;
        const uploadedByEmployeeId = formData.get('uploaded_by_employee_id') ? Number(formData.get('uploaded_by_employee_id')) : null;
        const uploadedByName = sanitizeString((formData.get('uploaded_by_name') as string) || '', 200);

        if (!file) {
            return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'Файл слишком большой (максимум 50 МБ)' }, { status: 400 });
        }

        if (file.size === 0) {
            return NextResponse.json({ error: 'Файл пустой' }, { status: 400 });
        }

        if (!isAllowedFile(file.name, file.type)) {
            return NextResponse.json({ error: 'Недопустимый тип файла. Разрешены: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG' }, { status: 400 });
        }

        // Sanitize filename: only keep extension, generate safe name
        const ext = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, '');
        const filename = `${uuidv4()}${ext}`;
        const clientDir = path.join(UPLOAD_DIR, String(client.id));

        // Ensure path doesn't escape upload dir
        const resolvedDir = path.resolve(clientDir);
        if (!resolvedDir.startsWith(path.resolve(UPLOAD_DIR))) {
            return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
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
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
    }
}
