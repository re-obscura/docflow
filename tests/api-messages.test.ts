import { describe, it, expect, beforeAll } from 'vitest';
import { buildRequest, parseResponse, createTestAdminToken } from './helpers';
import { POST as CREATE_CLIENT } from '@/app/api/clients/route';
import { GET, POST } from '@/app/api/clients/[token]/messages/route';

let adminToken: string;
let clientToken: string;

beforeAll(async () => {
    adminToken = createTestAdminToken();
    const req = buildRequest('/api/clients', {
        method: 'POST',
        body: { company_name: 'Messages Test Co' },
        headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const res = await CREATE_CLIENT(req);
    const { data } = await parseResponse(res);
    clientToken = data.token as string;
});

// ─── GET /api/clients/[token]/messages ───

describe('message listing', () => {
    it('returns empty list for new client', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/messages`);
        const res = await GET(req, { params: Promise.resolve({ token: clientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
        expect((data as unknown[]).length).toBe(0);
    });
});

// ─── POST /api/clients/[token]/messages (JSON) ───

describe('message sending (JSON)', () => {
    it('sends a text message as client', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/messages`, {
            method: 'POST',
            body: { text: 'Здравствуйте!', sender: 'client', sender_name: 'Иванов' },
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(201);
        expect(data.text).toBe('Здравствуйте!');
        expect(data.sender).toBe('client');
        expect(data.sender_name).toBe('Иванов');
    });

    it('rejects empty message', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/messages`, {
            method: 'POST',
            body: { text: '', sender: 'client' },
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        expect(res.status).toBe(400);
    });

    it('rejects admin sender without auth', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/messages`, {
            method: 'POST',
            body: { text: 'Admin msg', sender: 'admin', sender_name: 'Менеджер' },
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        expect(res.status).toBe(401);
    });

    it('allows admin sender with auth token', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/messages`, {
            method: 'POST',
            body: { text: 'Добрый день!', sender: 'admin', sender_name: 'Менеджер' },
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(201);
        expect(data.sender).toBe('admin');
    });

    it('sanitizes HTML from message text', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/messages`, {
            method: 'POST',
            body: { text: '<script>alert(1)</script>Hello', sender: 'client' },
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(201);
        expect(data.text).not.toContain('<script>');
    });
});

// ─── POST /api/clients/[token]/messages (multipart with file) ───

describe('message sending (multipart)', () => {
    it('sends message with file attachment', async () => {
        const formData = new FormData();
        formData.append('text', 'Прикрепляю файл');
        formData.append('sender', 'client');
        formData.append('sender_name', 'Иванов');
        const blob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' });
        formData.append('file', blob, 'attachment.pdf');

        const req = buildRequest(`/api/clients/${clientToken}/messages`, {
            method: 'POST',
            body: formData,
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(201);
        expect(data.text).toBe('Прикрепляю файл');
        expect(data.attachment_original_name).toBe('attachment.pdf');
        expect(data.attachment_size).toBeGreaterThan(0);
    });

    it('rejects multipart without text and without file', async () => {
        const formData = new FormData();
        formData.append('text', '');
        formData.append('sender', 'client');

        const req = buildRequest(`/api/clients/${clientToken}/messages`, {
            method: 'POST',
            body: formData,
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        expect(res.status).toBe(400);
    });
});

// ─── Message ordering ───

describe('message ordering', () => {
    it('returns messages in chronological order', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/messages`);
        const res = await GET(req, { params: Promise.resolve({ token: clientToken }) });
        const { data } = await parseResponse(res);
        const messages = data as unknown as { created_at: string }[];
        expect(messages.length).toBeGreaterThan(1);
        for (let i = 1; i < messages.length; i++) {
            expect(messages[i].created_at >= messages[i - 1].created_at).toBe(true);
        }
    });
});
