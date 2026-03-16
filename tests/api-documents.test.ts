import { describe, it, expect, beforeAll } from 'vitest';
import { buildRequest, parseResponse, createTestAdminToken } from './helpers';
import { POST as CREATE_CLIENT } from '@/app/api/clients/route';
import { GET, POST } from '@/app/api/clients/[token]/documents/route';
import { GET as DOWNLOAD, DELETE as DELETE_DOC, PATCH } from '@/app/api/clients/[token]/documents/[id]/route';

let adminToken: string;
let clientToken: string;
let objectId: number;
let documentId: number;

beforeAll(async () => {
    adminToken = createTestAdminToken();
    const req = buildRequest('/api/clients', {
        method: 'POST',
        body: { company_name: 'Docs Test Co' },
        headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const res = await CREATE_CLIENT(req);
    const { data } = await parseResponse(res);
    clientToken = data.token as string;

    // Get the default object
    const { getTestDb } = await import('./helpers');
    const db = getTestDb();
    const obj = db.prepare('SELECT id FROM objects WHERE client_id = ?').get(data.id) as { id: number };
    objectId = obj.id;
});

// ─── GET /api/clients/[token]/documents ───

describe('document listing', () => {
    it('returns empty list for new client', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/documents`);
        const res = await GET(req, { params: Promise.resolve({ token: clientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
        expect((data as unknown[]).length).toBe(0);
    });

    it('supports filtering by object_id', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/documents?object_id=${objectId}`);
        const res = await GET(req, { params: Promise.resolve({ token: clientToken }) });
        expect(res.status).toBe(200);
    });
});

// ─── POST /api/clients/[token]/documents (upload) ───

describe('document upload', () => {
    it('uploads a PDF file', async () => {
        const formData = new FormData();
        const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF magic bytes
        const blob = new Blob([pdfContent], { type: 'application/pdf' });
        formData.append('file', blob, 'test-document.pdf');
        formData.append('category', 'Разрешительная документация');
        formData.append('object_id', String(objectId));
        formData.append('uploaded_by_name', 'Тест');

        const req = buildRequest(`/api/clients/${clientToken}/documents`, {
            method: 'POST',
            body: formData,
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(201);
        expect(data.original_name).toBe('test-document.pdf');
        expect(data.category).toBe('Разрешительная документация');
        expect(data.status).toBe('pending');
        expect(data.object_id).toBe(objectId);
        documentId = data.id as number;
    });

    it('rejects empty file', async () => {
        const formData = new FormData();
        const blob = new Blob([], { type: 'application/pdf' });
        formData.append('file', blob, 'empty.pdf');

        const req = buildRequest(`/api/clients/${clientToken}/documents`, {
            method: 'POST',
            body: formData,
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        expect(res.status).toBe(400);
    });

    it('rejects disallowed file types', async () => {
        const formData = new FormData();
        const blob = new Blob(['#!/bin/bash'], { type: 'text/x-shellscript' });
        formData.append('file', blob, 'evil.sh');

        const req = buildRequest(`/api/clients/${clientToken}/documents`, {
            method: 'POST',
            body: formData,
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        expect(res.status).toBe(400);
    });

    it('rejects missing file', async () => {
        const formData = new FormData();
        formData.append('category', 'Test');

        const req = buildRequest(`/api/clients/${clientToken}/documents`, {
            method: 'POST',
            body: formData,
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        expect(res.status).toBe(400);
    });
});

// ─── PATCH /api/clients/[token]/documents/[id] (status change) ───

describe('document status change', () => {
    it('rejects unauthenticated status change', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/documents/${documentId}`, {
            method: 'PATCH',
            body: { status: 'accepted' },
        });
        const res = await PATCH(req, { params: Promise.resolve({ token: clientToken, id: String(documentId) }) });
        expect(res.status).toBe(401);
    });

    it('accepts document as admin', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/documents/${documentId}`, {
            method: 'PATCH',
            body: { status: 'accepted' },
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const res = await PATCH(req, { params: Promise.resolve({ token: clientToken, id: String(documentId) }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(data.status).toBe('accepted');
    });

    it('rejects document with comment', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/documents/${documentId}`, {
            method: 'PATCH',
            body: { status: 'rejected', status_comment: 'Не хватает подписи' },
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const res = await PATCH(req, { params: Promise.resolve({ token: clientToken, id: String(documentId) }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(data.status).toBe('rejected');
        expect(data.status_comment).toBe('Не хватает подписи');
    });

    it('rejects invalid status value', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/documents/${documentId}`, {
            method: 'PATCH',
            body: { status: 'approved' }, // invalid
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const res = await PATCH(req, { params: Promise.resolve({ token: clientToken, id: String(documentId) }) });
        expect(res.status).toBe(400);
    });
});

// ─── DELETE /api/clients/[token]/documents/[id] ───

describe('document deletion', () => {
    it('client cannot delete non-pending document', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/documents/${documentId}`, {
            method: 'DELETE',
        });
        const res = await DELETE_DOC(req, { params: Promise.resolve({ token: clientToken, id: String(documentId) }) });
        expect(res.status).toBe(403); // rejected status, not pending
    });

    it('admin can delete any document', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/documents/${documentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const res = await DELETE_DOC(req, { params: Promise.resolve({ token: clientToken, id: String(documentId) }) });
        expect(res.status).toBe(200);
    });
});
