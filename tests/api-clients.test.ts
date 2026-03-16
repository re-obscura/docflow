import { describe, it, expect, beforeAll } from 'vitest';
import { buildRequest, parseResponse, getTestDb, createTestAdminToken } from './helpers';
import { GET, POST } from '@/app/api/clients/route';
import { GET as GET_CLIENT, PUT, DELETE as DELETE_CLIENT } from '@/app/api/clients/[token]/route';

let adminToken: string;
let testClientToken: string;
let testClientId: number;

beforeAll(() => {
    adminToken = createTestAdminToken();
});

// ─── GET /api/clients (list) ───

describe('GET /api/clients', () => {
    it('rejects unauthenticated requests', async () => {
        const req = buildRequest('/api/clients');
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('returns paginated client list', async () => {
        const req = buildRequest('/api/clients', {
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const res = await GET(req);
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(data).toHaveProperty('clients');
        expect(data).toHaveProperty('total');
        expect(Array.isArray(data.clients)).toBe(true);
    });
});

// ─── POST /api/clients (create) ───

describe('POST /api/clients', () => {
    it('rejects unauthenticated requests', async () => {
        const req = buildRequest('/api/clients', {
            method: 'POST',
            body: { company_name: 'Test Co' },
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('creates a new client with default object and required docs', async () => {
        const req = buildRequest('/api/clients', {
            method: 'POST',
            body: { company_name: 'ООО Тест', contact_person: 'Иванов И.И.' },
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const res = await POST(req);
        const { data } = await parseResponse(res);
        expect(res.status).toBe(201);
        expect(data).toHaveProperty('token');
        expect(data).toHaveProperty('id');

        testClientToken = data.token as string;
        testClientId = data.id as number;

        // Verify default object was created
        const db = getTestDb();
        const objects = db.prepare('SELECT * FROM objects WHERE client_id = ?').all(testClientId);
        expect(objects.length).toBe(1);

        // Verify default required docs were created
        const reqDocs = db.prepare('SELECT * FROM required_docs WHERE client_id = ?').all(testClientId);
        expect(reqDocs.length).toBeGreaterThan(0);
    });

    it('sanitizes HTML in company name', async () => {
        const req = buildRequest('/api/clients', {
            method: 'POST',
            body: { company_name: '<script>alert(1)</script>' },
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const res = await POST(req);
        const { data } = await parseResponse(res);
        expect(res.status).toBe(201);

        const db = getTestDb();
        const client = db.prepare('SELECT company_name FROM clients WHERE id = ?').get(data.id) as { company_name: string };
        expect(client.company_name).not.toContain('<script>');
    });
});

// ─── GET /api/clients/[token] ───

describe('GET /api/clients/[token]', () => {
    it('returns client data for valid token', async () => {
        const req = buildRequest(`/api/clients/${testClientToken}`);
        const res = await GET_CLIENT(req, { params: Promise.resolve({ token: testClientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(data.token).toBe(testClientToken);
        expect(data.company_name).toBe('ООО Тест');
    });

    it('rejects invalid token format', async () => {
        const req = buildRequest('/api/clients/bad-token');
        const res = await GET_CLIENT(req, { params: Promise.resolve({ token: 'bad-token' }) });
        expect(res.status).toBe(400);
    });

    it('returns 404 for nonexistent token', async () => {
        const fakeToken = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
        const req = buildRequest(`/api/clients/${fakeToken}`);
        const res = await GET_CLIENT(req, { params: Promise.resolve({ token: fakeToken }) });
        expect(res.status).toBe(404);
    });
});

// ─── PUT /api/clients/[token] (update requisites) ───

describe('PUT /api/clients/[token]', () => {
    it('updates client requisites', async () => {
        const req = buildRequest(`/api/clients/${testClientToken}`, {
            method: 'PUT',
            body: {
                company_name: 'ООО Обновлённый Тест',
                inn: '1234567890',
                kpp: '123456789',
                legal_address: 'г. Москва, ул. Тестовая, д. 1',
            },
        });
        const res = await PUT(req, { params: Promise.resolve({ token: testClientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(data.company_name).toBe('ООО Обновлённый Тест');
        expect(data.inn).toBe('1234567890');
    });

    it('sanitizes input fields', async () => {
        const req = buildRequest(`/api/clients/${testClientToken}`, {
            method: 'PUT',
            body: { company_name: '<b>Name</b>', inn: '1234567890' },
        });
        const res = await PUT(req, { params: Promise.resolve({ token: testClientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(data.company_name).not.toContain('<b>');
    });
});

// ─── DELETE /api/clients/[token] ───

describe('DELETE /api/clients/[token]', () => {
    it('rejects unauthenticated deletion', async () => {
        const req = buildRequest(`/api/clients/${testClientToken}`, { method: 'DELETE' });
        const res = await DELETE_CLIENT(req, { params: Promise.resolve({ token: testClientToken }) });
        expect(res.status).toBe(401);
    });
});

// ─── Search & Pagination ───

describe('client search and pagination', () => {
    it('supports search by company name', async () => {
        // Create a client with a unique searchable name
        const createReq = buildRequest('/api/clients', {
            method: 'POST',
            body: { company_name: 'Поисковая Компания Уникальная' },
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        await POST(createReq);

        const req = buildRequest('/api/clients?q=Уникальная', {
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const res = await GET(req);
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect((data.clients as unknown[]).length).toBeGreaterThan(0);
    });

    it('supports pagination with limit and offset', async () => {
        const req = buildRequest('/api/clients?limit=1&offset=0', {
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const res = await GET(req);
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect((data.clients as unknown[]).length).toBeLessThanOrEqual(1);
        expect(typeof data.total).toBe('number');
    });
});
