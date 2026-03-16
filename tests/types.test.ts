import { describe, it, expect } from 'vitest';
import {
    validateINN, validateKPP, validateOGRN, validateBIK, validateAccount,
    formatSize, formatDate, getFileIcon, statusLabel, isImageType,
} from '@/lib/types';

// ─── INN Validation ───

describe('validateINN', () => {
    it('accepts empty (optional field)', () => {
        expect(validateINN('')).toBe(true);
    });

    it('accepts 10-digit INN (legal entity)', () => {
        expect(validateINN('1234567890')).toBe(true);
    });

    it('accepts 12-digit INN (individual)', () => {
        expect(validateINN('123456789012')).toBe(true);
    });

    it('rejects wrong length', () => {
        expect(validateINN('12345')).toBe(false);
        expect(validateINN('12345678901')).toBe(false); // 11 digits
    });

    it('strips non-digit characters', () => {
        expect(validateINN('12-34-567890')).toBe(true); // 10 digits after strip
    });
});

// ─── KPP Validation ───

describe('validateKPP', () => {
    it('accepts empty', () => {
        expect(validateKPP('')).toBe(true);
    });

    it('accepts 9 digits', () => {
        expect(validateKPP('123456789')).toBe(true);
    });

    it('rejects wrong length', () => {
        expect(validateKPP('12345678')).toBe(false);
        expect(validateKPP('1234567890')).toBe(false);
    });
});

// ─── OGRN Validation ───

describe('validateOGRN', () => {
    it('accepts 13 digits (OGRN)', () => {
        expect(validateOGRN('1234567890123')).toBe(true);
    });

    it('accepts 15 digits (OGRNIP)', () => {
        expect(validateOGRN('123456789012345')).toBe(true);
    });

    it('rejects wrong length', () => {
        expect(validateOGRN('12345678901234')).toBe(false); // 14
    });
});

// ─── BIK Validation ───

describe('validateBIK', () => {
    it('accepts 9 digits', () => {
        expect(validateBIK('044525225')).toBe(true);
    });

    it('rejects non-9-digit', () => {
        expect(validateBIK('12345')).toBe(false);
    });
});

// ─── Account Validation ───

describe('validateAccount', () => {
    it('accepts 20 digits', () => {
        expect(validateAccount('40702810100000000001')).toBe(true);
    });

    it('rejects non-20-digit', () => {
        expect(validateAccount('123')).toBe(false);
    });
});

// ─── formatSize ───

describe('formatSize', () => {
    it('formats bytes', () => {
        expect(formatSize(500)).toBe('500 Б');
    });

    it('formats kilobytes', () => {
        expect(formatSize(2048)).toBe('2.0 КБ');
    });

    it('formats megabytes', () => {
        expect(formatSize(5 * 1048576)).toBe('5.0 МБ');
    });
});

// ─── formatDate ───

describe('formatDate', () => {
    it('returns empty for empty input', () => {
        expect(formatDate('')).toBe('');
    });

    it('formats a date-time string', () => {
        const result = formatDate('2024-01-15T10:30:00');
        expect(result).toContain('15');
        expect(result).toContain('01');
        expect(result).toContain('2024');
    });
});

// ─── getFileIcon ───

describe('getFileIcon', () => {
    it('returns PDF icon for PDF type', () => {
        expect(getFileIcon('application/pdf')).toEqual({ label: 'PDF', cls: 'pdf' });
    });

    it('returns DOC icon for Word types', () => {
        expect(getFileIcon('application/vnd.openxmlformats-officedocument.wordprocessingml.document').label).toBe('DOC');
    });

    it('returns XLS icon for Excel types', () => {
        expect(getFileIcon('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').label).toBe('XLS');
    });

    it('returns IMG icon for images', () => {
        expect(getFileIcon('image/jpeg')).toEqual({ label: 'IMG', cls: 'img' });
    });

    it('returns FILE for unknown types', () => {
        expect(getFileIcon('application/zip')).toEqual({ label: 'FILE', cls: 'other' });
    });
});

// ─── statusLabel ───

describe('statusLabel', () => {
    it('maps pending', () => {
        expect(statusLabel('pending')).toBe('На проверке');
    });

    it('maps accepted', () => {
        expect(statusLabel('accepted')).toBe('Принят');
    });

    it('maps rejected', () => {
        expect(statusLabel('rejected')).toBe('Отклонён');
    });
});

// ─── isImageType ───

describe('isImageType', () => {
    it('returns true for image types', () => {
        expect(isImageType('image/jpeg')).toBe(true);
        expect(isImageType('image/png')).toBe(true);
    });

    it('returns false for non-image types', () => {
        expect(isImageType('application/pdf')).toBe(false);
    });
});
