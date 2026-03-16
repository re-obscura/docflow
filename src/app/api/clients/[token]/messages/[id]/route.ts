import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { isValidToken } from '@/lib/security';
import { logger } from '@/lib/logger';
import { getClientByToken, apiError } from '@/lib/helpers';

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
            return apiError('Invalid parameters', 400);
        }

        const db = getDb();
        const client = getClientByToken(db, token);
        if (!client) {
            return apiError('Client not found', 404);
        }

        const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND client_id = ?').get(Number(id), client.id) as MsgRow | undefined;
        if (!msg || !msg.attachment_filename) {
            return apiError('Attachment not found', 404);
        }

        const safeFilename = path.basename(msg.attachment_filename);
        const filePath = path.join(UPLOAD_DIR, String(client.id), 'chat', safeFilename);
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(UPLOAD_DIR))) {
            return apiError('Invalid file path', 400);
        }

        const fileBuffer = await readFile(resolvedPath);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': msg.attachment_type || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(msg.attachment_original_name)}"`,
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (err) {
        logger.error('Failed to download attachment', { error: String(err) });
        return apiError('Failed to download attachment', 500);
    }
}
