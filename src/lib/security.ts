import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { getDb } from '@/lib/db';

// ─── SQLite-backed admin sessions ───

const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

export function createSession(): string {
    const token = randomBytes(32).toString('hex');
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO admin_sessions (token, created_at) VALUES (?, ?)').run(token, Date.now());
    cleanExpiredSessions();
    return token;
}

export function validateSession(token: string | null): boolean {
    if (!token) return false;
    const db = getDb();
    const session = db.prepare('SELECT created_at FROM admin_sessions WHERE token = ?').get(token) as { created_at: number } | undefined;
    if (!session) return false;
    if (Date.now() - session.created_at > SESSION_TTL) {
        db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
        return false;
    }
    return true;
}

export function destroySession(token: string): void {
    const db = getDb();
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
}

function cleanExpiredSessions(): void {
    const db = getDb();
    const cutoff = Date.now() - SESSION_TTL;
    db.prepare('DELETE FROM admin_sessions WHERE created_at < ?').run(cutoff);
}

// ─── Rate limiting (in-memory, acceptable for single-instance) ───

interface RateEntry {
    count: number;
    resetAt: number;
}

const globalRateLimits = (globalThis as Record<string, unknown>);
if (!globalRateLimits.__rateLimits) {
    globalRateLimits.__rateLimits = new Map<string, RateEntry>();
}
const rateLimits = globalRateLimits.__rateLimits as Map<string, RateEntry>;

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = rateLimits.get(key);

    // Periodic cleanup to prevent memory leaks (every 100th call)
    if (rateLimits.size > 1000) {
        for (const [k, v] of rateLimits.entries()) {
            if (now > v.resetAt) rateLimits.delete(k);
        }
    }

    if (!entry || now > entry.resetAt) {
        rateLimits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (entry.count >= maxRequests) {
        return false;
    }

    entry.count++;
    return true;
}

// ─── Input sanitization ───

export function sanitizeString(input: string, maxLength: number = 500): string {
    if (typeof input !== 'string') return '';
    return input
        .trim()
        .slice(0, maxLength)
        .replace(/[<>]/g, ''); // Strip potential HTML tags
}

export function sanitizeText(input: string, maxLength: number = 5000): string {
    if (typeof input !== 'string') return '';
    return input
        .trim()
        .slice(0, maxLength)
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '');
}

// ─── Token validation (UUID v4 format) ───

export function isValidToken(token: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
}

// ─── File validation ───

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/jpg',
]);

const ALLOWED_EXTENSIONS = new Set([
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png',
]);

export function isAllowedFile(filename: string, mimeType: string): boolean {
    const ext = '.' + filename.split('.').pop()?.toLowerCase();
    return ALLOWED_EXTENSIONS.has(ext) && (ALLOWED_MIME_TYPES.has(mimeType) || mimeType === 'application/octet-stream');
}

// ─── Password comparison (constant-time via timingSafeEqual) ───

export function secureCompare(a: string, b: string): boolean {
    const ha = createHash('sha256').update(a).digest();
    const hb = createHash('sha256').update(b).digest();
    return timingSafeEqual(ha, hb);
}

// ─── Extract and validate admin session from Authorization header ───

export function requireAdmin(authHeader: string | null): boolean {
    if (!authHeader) return false;
    const token = authHeader.replace(/^Bearer\s+/i, '');
    return validateSession(token);
}

// ─── Password hashing with bcrypt ───

import { hashSync, compareSync } from 'bcryptjs';

export function hashPassword(password: string): string {
    return hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
    // Handle legacy plain-text passwords: if hash doesn't start with $2, it's plain text
    if (!hash.startsWith('$2')) {
        return secureCompare(password, hash);
    }
    return compareSync(password, hash);
}

/** Returns true if the hash is legacy plain-text and should be migrated to bcrypt */
export function needsPasswordMigration(hash: string): boolean {
    return hash !== '' && !hash.startsWith('$2');
}
