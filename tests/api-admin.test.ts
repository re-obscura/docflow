import { describe, it, expect } from 'vitest';
import { buildRequest, parseResponse, createTestAdminToken } from './helpers';
import { POST as AUTH } from '@/app/api/admin/auth/route';
import { POST as LOGOUT } from '@/app/api/admin/logout/route';

// ─── Admin Auth ───

describe('POST /api/admin/auth', () => {
    it('authenticates with correct password', async () => {
        const req = buildRequest('/api/admin/auth', {
            method: 'POST',
            body: { password: 'test_admin_password_123' },
        });
        const res = await AUTH(req);
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(typeof data.token).toBe('string');
        expect(String(data.token).length).toBe(64);
    });

    it('rejects wrong password', async () => {
        const req = buildRequest('/api/admin/auth', {
            method: 'POST',
            body: { password: 'wrong_password' },
        });
        const res = await AUTH(req);
        expect(res.status).toBe(401);
    });

    it('rejects missing password', async () => {
        const req = buildRequest('/api/admin/auth', {
            method: 'POST',
            body: {},
        });
        const res = await AUTH(req);
        expect(res.status).toBe(400);
    });

    it('rejects empty password', async () => {
        const req = buildRequest('/api/admin/auth', {
            method: 'POST',
            body: { password: '' },
        });
        const res = await AUTH(req);
        expect(res.status).toBe(400);
    });
});

// ─── Admin Logout ───

describe('POST /api/admin/logout', () => {
    it('destroys server session on logout', async () => {
        const token = createTestAdminToken();

        // Verify session is valid
        const { validateSession } = await import('@/lib/security');
        expect(validateSession(token)).toBe(true);

        // Logout
        const req = buildRequest('/api/admin/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const res = await LOGOUT(req);
        expect(res.status).toBe(200);

        // Verify session is destroyed
        expect(validateSession(token)).toBe(false);
    });
});
