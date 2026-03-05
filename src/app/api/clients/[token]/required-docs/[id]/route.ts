import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { isValidToken, requireAdmin } from '@/lib/security';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; id: string }> }
) {
    try {
        // Admin-only: delete required doc
        if (!requireAdmin(request.headers.get('authorization'))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { token, id } = await params;
        if (!isValidToken(token) || isNaN(Number(id))) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        db.prepare('DELETE FROM required_docs WHERE id = ? AND client_id = ?').run(Number(id), client.id);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to delete required doc' }, { status: 500 });
    }
}
