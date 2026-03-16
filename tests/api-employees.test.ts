import { describe, it, expect, beforeAll } from 'vitest';
import { buildRequest, parseResponse, getTestDb, createTestAdminToken } from './helpers';
import { POST as CREATE_CLIENT } from '@/app/api/clients/route';
import { GET, POST } from '@/app/api/clients/[token]/employees/route';
import { PUT, DELETE as DELETE_EMP } from '@/app/api/clients/[token]/employees/[id]/route';
import { POST as AUTH } from '@/app/api/clients/[token]/employees/auth/route';

let adminToken: string;
let clientToken: string;
let employeeId: number;

beforeAll(async () => {
    adminToken = createTestAdminToken();
    // Create a test client
    const req = buildRequest('/api/clients', {
        method: 'POST',
        body: { company_name: 'Emp Test Co' },
        headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const res = await CREATE_CLIENT(req);
    const { data } = await parseResponse(res);
    clientToken = data.token as string;
});

// ─── POST /api/clients/[token]/employees ───

describe('employee creation', () => {
    it('creates an employee with hashed password', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/employees`, {
            method: 'POST',
            body: { full_name: 'Петров П.П.', position: 'Инженер', phone: '+79991234567', password: 'secret123' },
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(201);
        expect(data.full_name).toBe('Петров П.П.');
        expect(data).not.toHaveProperty('password'); // Password should NOT be returned
        employeeId = data.id as number;

        // Verify password is hashed in DB
        const db = getTestDb();
        const emp = db.prepare('SELECT password FROM employees WHERE id = ?').get(employeeId) as { password: string };
        expect(emp.password).toMatch(/^\$2[aby]\$/);
    });

    it('creates employee without password', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/employees`, {
            method: 'POST',
            body: { full_name: 'Сидоров С.С.', position: 'Бухгалтер' },
        });
        const res = await POST(req, { params: Promise.resolve({ token: clientToken }) });
        expect(res.status).toBe(201);
    });
});

// ─── GET /api/clients/[token]/employees ───

describe('employee listing', () => {
    it('returns all employees for the client', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/employees`);
        const res = await GET(req, { params: Promise.resolve({ token: clientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
        expect((data as unknown[]).length).toBe(2);
    });
});

// ─── Employee Auth ───

describe('employee authentication', () => {
    it('authenticates with correct password', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/employees/auth`, {
            method: 'POST',
            body: { employee_id: employeeId, password: 'secret123' },
        });
        const res = await AUTH(req, { params: Promise.resolve({ token: clientToken }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect((data.employee as Record<string, unknown>).full_name).toBe('Петров П.П.');
    });

    it('rejects wrong password', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/employees/auth`, {
            method: 'POST',
            body: { employee_id: employeeId, password: 'wrong' },
        });
        const res = await AUTH(req, { params: Promise.resolve({ token: clientToken }) });
        expect(res.status).toBe(401);
    });

    it('rejects without employee_id', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/employees/auth`, {
            method: 'POST',
            body: { password: 'secret123' },
        });
        const res = await AUTH(req, { params: Promise.resolve({ token: clientToken }) });
        expect(res.status).toBe(400);
    });
});

// ─── PUT /api/clients/[token]/employees/[id] ───

describe('employee update', () => {
    it('updates employee fields', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/employees/${employeeId}`, {
            method: 'PUT',
            body: { full_name: 'Петров Пётр Петрович', position: 'Главный инженер', phone: '+79991111111', email: 'petrov@test.ru' },
        });
        const res = await PUT(req, { params: Promise.resolve({ token: clientToken, id: String(employeeId) }) });
        const { data } = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(data.full_name).toBe('Петров Пётр Петрович');
        expect(data.position).toBe('Главный инженер');
    });

    it('changes password when provided', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/employees/${employeeId}`, {
            method: 'PUT',
            body: { full_name: 'Петров П.П.', password: 'new_password_456' },
        });
        const res = await PUT(req, { params: Promise.resolve({ token: clientToken, id: String(employeeId) }) });
        expect(res.status).toBe(200);

        // Verify new password works
        const authReq = buildRequest(`/api/clients/${clientToken}/employees/auth`, {
            method: 'POST',
            body: { employee_id: employeeId, password: 'new_password_456' },
        });
        const authRes = await AUTH(authReq, { params: Promise.resolve({ token: clientToken }) });
        expect(authRes.status).toBe(200);
    });
});

// ─── DELETE /api/clients/[token]/employees/[id] ───

describe('employee deletion', () => {
    it('deletes an employee', async () => {
        const req = buildRequest(`/api/clients/${clientToken}/employees/${employeeId}`, {
            method: 'DELETE',
        });
        const res = await DELETE_EMP(req, { params: Promise.resolve({ token: clientToken, id: String(employeeId) }) });
        expect(res.status).toBe(200);

        // Verify employee is gone
        const listReq = buildRequest(`/api/clients/${clientToken}/employees`);
        const listRes = await GET(listReq, { params: Promise.resolve({ token: clientToken }) });
        const { data } = await parseResponse(listRes);
        expect((data as unknown[]).length).toBe(1); // Only the second employee remains
    });
});
