import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { isValidToken } from '@/lib/security';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

interface MsgRow {
    id: number;
    client_id: number;
    attachment_filename: string;
    attachment_original_name: string;
    attachment_type: string;
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

        const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND client_id = ?').get(Number(id), client.id) as MsgRow | undefined;
        if (!msg || !msg.attachment_filename) {
            return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
        }

        const safeFilename = path.basename(msg.attachment_filename);
        const filePath = path.join(UPLOAD_DIR, String(client.id), 'chat', safeFilename);
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(UPLOAD_DIR))) {
            return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
        }

        const fileBuffer = await readFile(resolvedPath);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': msg.attachment_type || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(msg.attachment_original_name)}"`,
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch {
        return NextResponse.json({ error: 'Failed to download attachment' }, { status: 500 });
    }
}
