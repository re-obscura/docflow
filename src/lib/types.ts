// Shared TypeScript interfaces for DocFlow
// Used by both portal and admin pages

export interface Client {
    id: number;
    token: string;
    company_name: string;
    short_name: string;
    legal_form: string;
    inn: string;
    kpp: string;
    ogrn: string;
    okpo: string;
    okved: string;
    registration_date: string;
    legal_address: string;
    actual_address: string;
    postal_address: string;
    bank_name: string;
    bank_account: string;
    corr_account: string;
    bik: string;
    director_name: string;
    director_title: string;
    acts_on_basis: string;
    contact_person: string;
    phone: string;
    email: string;
    fax: string;
    website: string;
    tax_system: string;
    sro_name: string;
    sro_number: string;
    created_at: string;
}

export interface ClientWithStats extends Client {
    doc_count: number;
    pending_count: number;
    accepted_count: number;
    rejected_count: number;
    unread_count: number;
    employee_count: number;
    object_count: number;
}

export interface Employee {
    id: number;
    client_id: number;
    full_name: string;
    position: string;
    phone: string;
    email: string;
    created_at: string;
}

export interface ObjectItem {
    id: number;
    client_id: number;
    object_name: string;
    object_address: string;
    object_purpose: string;
    tech_economic_indicators: string;
    construction_type: string;
    financing_info: string;
    buildings_info: string;
    cost_justification: string;
    created_at: string;
}

export interface Document {
    id: number;
    client_id: number;
    object_id: number | null;
    filename: string;
    original_name: string;
    file_type: string;
    file_size: number;
    category: string;
    status: string;
    status_comment: string;
    uploaded_at: string;
    reviewed_at: string;
    uploaded_by_employee_id: number | null;
    uploaded_by_name: string;
}

export interface RequiredDoc {
    id: number;
    client_id: number;
    object_id: number | null;
    doc_name: string;
    description: string;
}

export interface Message {
    id: number;
    client_id: number;
    sender: string;
    sender_name: string;
    text: string;
    attachment_filename: string;
    attachment_original_name: string;
    attachment_type: string;
    attachment_size: number;
    created_at: string;
}

export interface AuditLogEntry {
    id: number;
    client_id: number;
    actor_name: string;
    actor_type: string; // 'admin' | 'employee'
    action: string;
    entity_type: string;
    entity_id: number | null;
    details: string;
    created_at: string;
}

// Field validation helpers
export function validateINN(inn: string): boolean {
    if (!inn) return true; // optional
    const digits = inn.replace(/\D/g, '');
    return digits.length === 10 || digits.length === 12;
}

export function validateKPP(kpp: string): boolean {
    if (!kpp) return true;
    return /^\d{9}$/.test(kpp.replace(/\D/g, ''));
}

export function validateOGRN(ogrn: string): boolean {
    if (!ogrn) return true;
    const digits = ogrn.replace(/\D/g, '');
    return digits.length === 13 || digits.length === 15;
}

export function validateBIK(bik: string): boolean {
    if (!bik) return true;
    return /^\d{9}$/.test(bik.replace(/\D/g, ''));
}

export function validateAccount(account: string): boolean {
    if (!account) return true;
    return /^\d{20}$/.test(account.replace(/\D/g, ''));
}

export function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / 1048576).toFixed(1) + ' МБ';
}

export function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
    return d.toLocaleDateString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export function getFileIcon(type: string): { label: string; cls: string } {
    if (type.includes('pdf')) return { label: 'PDF', cls: 'pdf' };
    if (type.includes('sheet') || type.includes('xls')) return { label: 'XLS', cls: 'xls' };
    if (type.includes('word') || type.includes('doc')) return { label: 'DOC', cls: 'doc' };
    if (type.includes('image')) return { label: 'IMG', cls: 'img' };
    return { label: 'FILE', cls: 'other' };
}

export function statusLabel(s: string): string {
    if (s === 'pending') return 'На проверке';
    if (s === 'accepted') return 'Принят';
    return 'Отклонён';
}

export function isImageType(type: string): boolean {
    return type.startsWith('image/');
}
