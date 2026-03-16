import { describe, it, expect } from 'vitest';
import {
    sanitizeString, sanitizeText, isValidToken, isAllowedFile,
    secureCompare, hashPassword, verifyPassword, needsPasswordMigration,
    checkRateLimit, createSession, validateSession, destroySession,
} from '@/lib/security';

// ─── sanitizeString ───

describe('sanitizeString', () => {
    it('trims whitespace', () => {
        expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('strips HTML angle brackets', () => {
        expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    });

    it('enforces max length', () => {
        expect(sanitizeString('abcdef', 3)).toBe('abc');
    });

    it('handles non-string input gracefully', () => {
        expect(sanitizeString(null as unknown as string)).toBe('');
        expect(sanitizeString(undefined as unknown as string)).toBe('');
        expect(sanitizeString(123 as unknown as string)).toBe('');
    });

    it('preserves normal text', () => {
        expect(sanitizeString('ООО «Строй-Инвест»')).toBe('ООО «Строй-Инвест»');
    });
});

// ─── sanitizeText ───

describe('sanitizeText', () => {
    it('strips script tags', () => {
        expect(sanitizeText('Hello <script>evil()</script> World')).toBe('Hello  World');
    });

    it('strips all HTML tags', () => {
        expect(sanitizeText('Hello <b>bold</b> <a href="x">link</a>')).toBe('Hello bold link');
    });

    it('enforces max length', () => {
        const long = 'a'.repeat(6000);
        expect(sanitizeText(long, 5000).length).toBe(5000);
    });
});

// ─── isValidToken ───

describe('isValidToken', () => {
    it('accepts valid UUID v4', () => {
        expect(isValidToken('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')).toBe(true);
    });

    it('rejects non-UUID strings', () => {
        expect(isValidToken('not-a-uuid')).toBe(false);
        expect(isValidToken('')).toBe(false);
        expect(isValidToken('a1b2c3d4-e5f6-1a7b-8c9d-0e1f2a3b4c5d')).toBe(false); // version 1
    });

    it('rejects SQL injection attempts', () => {
        expect(isValidToken("' OR 1=1 --")).toBe(false);
    });
});

// ─── isAllowedFile ───

describe('isAllowedFile', () => {
    it('accepts PDF files', () => {
        expect(isAllowedFile('document.pdf', 'application/pdf')).toBe(true);
    });

    it('accepts DOCX files', () => {
        expect(isAllowedFile('report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    });

    it('accepts JPG images', () => {
        expect(isAllowedFile('photo.jpg', 'image/jpeg')).toBe(true);
    });

    it('accepts PNG images', () => {
        expect(isAllowedFile('scan.png', 'image/png')).toBe(true);
    });

    it('accepts XLS files', () => {
        expect(isAllowedFile('data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
    });

    it('accepts application/octet-stream with valid extension', () => {
        expect(isAllowedFile('doc.pdf', 'application/octet-stream')).toBe(true);
    });

    it('rejects executable files', () => {
        expect(isAllowedFile('virus.exe', 'application/x-msdownload')).toBe(false);
    });

    it('rejects HTML files', () => {
        expect(isAllowedFile('page.html', 'text/html')).toBe(false);
    });

    it('rejects files with wrong extension-MIME combo', () => {
        expect(isAllowedFile('fake.txt', 'application/pdf')).toBe(false);
    });

    it('rejects double-extension tricks', () => {
        expect(isAllowedFile('file.exe.pdf', 'application/pdf')).toBe(true); // .pdf extension is valid
        expect(isAllowedFile('file.pdf.exe', 'application/x-msdownload')).toBe(false);
    });
});

// ─── secureCompare ───

describe('secureCompare', () => {
    it('returns true for equal strings', () => {
        expect(secureCompare('password123', 'password123')).toBe(true);
    });

    it('returns false for different strings', () => {
        expect(secureCompare('password123', 'password456')).toBe(false);
    });

    it('returns false for different lengths', () => {
        expect(secureCompare('short', 'much longer string')).toBe(false);
    });
});

// ─── Password hashing & verification ───

describe('password hashing', () => {
    it('hashPassword returns bcrypt hash', () => {
        const hash = hashPassword('mypassword');
        expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('verifyPassword works with bcrypt hash', () => {
        const hash = hashPassword('secret');
        expect(verifyPassword('secret', hash)).toBe(true);
        expect(verifyPassword('wrong', hash)).toBe(false);
    });

    it('verifyPassword handles legacy plain-text with secureCompare', () => {
        expect(verifyPassword('plaintext', 'plaintext')).toBe(true);
        expect(verifyPassword('plaintext', 'different')).toBe(false);
    });

    it('needsPasswordMigration detects legacy passwords', () => {
        expect(needsPasswordMigration('plaintext_password')).toBe(true);
        expect(needsPasswordMigration(hashPassword('modern'))).toBe(false);
        expect(needsPasswordMigration('')).toBe(false);
    });
});

// ─── Rate Limiting ───

describe('checkRateLimit', () => {
    it('allows requests within limit', () => {
        const key = `test_rate_${Date.now()}`;
        expect(checkRateLimit(key, 3, 60000)).toBe(true);
        expect(checkRateLimit(key, 3, 60000)).toBe(true);
        expect(checkRateLimit(key, 3, 60000)).toBe(true);
    });

    it('blocks requests exceeding limit', () => {
        const key = `test_block_${Date.now()}`;
        checkRateLimit(key, 2, 60000);
        checkRateLimit(key, 2, 60000);
        expect(checkRateLimit(key, 2, 60000)).toBe(false);
    });

    it('resets after window expires', () => {
        const key = `test_expire_${Date.now()}`;
        checkRateLimit(key, 1, 1); // 1ms window
        // Wait for window to expire
        const start = Date.now();
        while (Date.now() - start < 5) { /* busy wait */ }
        expect(checkRateLimit(key, 1, 1)).toBe(true);
    });
});

// ─── Admin Sessions ───

describe('admin sessions', () => {
    it('createSession returns a 64-char hex token', () => {
        const token = createSession();
        expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('validateSession returns true for valid session', () => {
        const token = createSession();
        expect(validateSession(token)).toBe(true);
    });

    it('validateSession returns false for unknown token', () => {
        expect(validateSession('nonexistent_token_1234567890abcdef')).toBe(false);
    });

    it('validateSession returns false for null', () => {
        expect(validateSession(null)).toBe(false);
    });

    it('destroySession invalidates a session', () => {
        const token = createSession();
        expect(validateSession(token)).toBe(true);
        destroySession(token);
        expect(validateSession(token)).toBe(false);
    });

    it('multiple sessions can coexist', () => {
        const token1 = createSession();
        const token2 = createSession();
        expect(validateSession(token1)).toBe(true);
        expect(validateSession(token2)).toBe(true);
        destroySession(token1);
        expect(validateSession(token1)).toBe(false);
        expect(validateSession(token2)).toBe(true);
        destroySession(token2);
    });
});
