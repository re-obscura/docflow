import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import { isValidToken, sanitizeString, requireAdmin } from '@/lib/security';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

interface DocRow {
    id: number;
    client_id: number;
    filename: string;
    original_name: string;
    file_type: string;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        const { token, id } = await params;
        if (!isValidToken(token) || isNaN(Number(id))) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND client_id = ?').get(Number(id), client.id) as DocRow | undefined;
        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Prevent path traversal in filename
        const safeFilename = path.basename(doc.filename);
        const filePath = path.join(UPLOAD_DIR, String(client.id), safeFilename);
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(UPLOAD_DIR))) {
            return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
        }

        const fileBuffer = await readFile(resolvedPath);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': doc.file_type || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.original_name)}"`,
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch {
        return NextResponse.json({ error: 'Failed to download document' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        const { token, id } = await params;
        if (!isValidToken(token) || isNaN(Number(id))) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND client_id = ?').get(Number(id), client.id) as DocRow | undefined;
        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        try {
            const safeFilename = path.basename(doc.filename);
            await unlink(path.join(UPLOAD_DIR, String(client.id), safeFilename));
        } catch { /* file may not exist */ }

        db.prepare('DELETE FROM documents WHERE id = ?').run(Number(id));
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        // Admin-only: change document status
        if (!requireAdmin(request.headers.get('authorization'))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { token, id } = await params;
        if (!isValidToken(token) || isNaN(Number(id))) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const body = await request.json();
        const { status } = body;
        const status_comment = sanitizeString(body.status_comment || '', 1000);

        if (!['accepted', 'rejected', 'pending'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        db.prepare(`
      UPDATE documents SET status = ?, status_comment = ?, reviewed_at = datetime('now')
      WHERE id = ? AND client_id = ?
    `).run(status, status_comment, Number(id), client.id);

        const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(id));
        return NextResponse.json(doc);
    } catch {
        return NextResponse.json({ error: 'Failed to update document status' }, { status: 500 });
    }
}
