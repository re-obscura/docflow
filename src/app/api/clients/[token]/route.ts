import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeString, sanitizeText, isValidToken, requireAdmin, checkRateLimit } from '@/lib/security';
import { rmSync } from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

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
        const client = db.prepare('SELECT * FROM clients WHERE token = ?').get(token);
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }
        return NextResponse.json(client);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        if (!isValidToken(token)) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
        }

        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(`put:${token}:${ip}`, 20, 60000)) {
            return NextResponse.json({ error: 'Слишком много запросов. Попробуйте позже.' }, { status: 429 });
        }

        const body = await request.json();
        const db = getDb();

        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        db.prepare(`
      UPDATE clients SET 
        company_name = ?, short_name = ?, legal_form = ?,
        inn = ?, kpp = ?, ogrn = ?, okpo = ?, okved = ?, registration_date = ?,
        legal_address = ?, actual_address = ?, postal_address = ?,
        bank_name = ?, bank_account = ?, corr_account = ?, bik = ?,
        director_name = ?, director_title = ?, acts_on_basis = ?,
        contact_person = ?, phone = ?, email = ?, fax = ?, website = ?,
        tax_system = ?, sro_name = ?, sro_number = ?,
        object_name = ?, object_address = ?, object_purpose = ?,
        tech_economic_indicators = ?,
        construction_type = ?, financing_info = ?,
        buildings_info = ?, cost_justification = ?
      WHERE token = ?
    `).run(
            sanitizeString(body.company_name, 500),
            sanitizeString(body.short_name, 300),
            sanitizeString(body.legal_form, 200),
            sanitizeString(body.inn, 12),
            sanitizeString(body.kpp, 9),
            sanitizeString(body.ogrn, 15),
            sanitizeString(body.okpo, 10),
            sanitizeString(body.okved, 200),
            sanitizeString(body.registration_date, 20),
            sanitizeString(body.legal_address, 500),
            sanitizeString(body.actual_address, 500),
            sanitizeString(body.postal_address, 500),
            sanitizeString(body.bank_name, 300),
            sanitizeString(body.bank_account, 20),
            sanitizeString(body.corr_account, 20),
            sanitizeString(body.bik, 9),
            sanitizeString(body.director_name, 200),
            sanitizeString(body.director_title, 200),
            sanitizeString(body.acts_on_basis, 200),
            sanitizeString(body.contact_person, 200),
            sanitizeString(body.phone, 30),
            sanitizeString(body.email, 100),
            sanitizeString(body.fax, 30),
            sanitizeString(body.website, 200),
            sanitizeString(body.tax_system, 100),
            sanitizeString(body.sro_name, 500),
            sanitizeString(body.sro_number, 100),
            sanitizeString(body.object_name, 500),
            sanitizeString(body.object_address, 500),
            sanitizeText(body.object_purpose, 2000),
            sanitizeText(body.tech_economic_indicators, 5000),
            sanitizeString(body.construction_type, 300),
            sanitizeText(body.financing_info, 2000),
            sanitizeText(body.buildings_info, 5000),
            sanitizeText(body.cost_justification, 5000),
            token
        );

        const updated = db.prepare('SELECT * FROM clients WHERE token = ?').get(token);
        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        if (!requireAdmin(request.headers.get('authorization'))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { token } = await params;
        if (!isValidToken(token)) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
        }

        const db = getDb();
        const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        try {
            const clientDir = path.join(UPLOAD_DIR, String(client.id));
            rmSync(clientDir, { recursive: true, force: true });
        } catch { /* directory may not exist */ }

        db.prepare('DELETE FROM clients WHERE token = ?').run(token);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
    }
}
