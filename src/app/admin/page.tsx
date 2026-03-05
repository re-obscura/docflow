'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Client {
    id: number; token: string;
    company_name: string; short_name: string; legal_form: string;
    inn: string; kpp: string; ogrn: string; okpo: string; okved: string;
    registration_date: string;
    legal_address: string; actual_address: string; postal_address: string;
    bank_name: string; bank_account: string; corr_account: string; bik: string;
    director_name: string; director_title: string; acts_on_basis: string;
    contact_person: string; phone: string; email: string; fax: string; website: string;
    tax_system: string; sro_name: string; sro_number: string;
    object_name: string; object_address: string; object_purpose: string;
    tech_economic_indicators: string; construction_type: string;
    financing_info: string; buildings_info: string; cost_justification: string;
    created_at: string;
    doc_count: number; pending_count: number; accepted_count: number; rejected_count: number;
    unread_count: number;
}

interface Document {
    id: number; client_id: number; filename: string; original_name: string;
    file_type: string; file_size: number; category: string; status: string;
    status_comment: string; uploaded_at: string; reviewed_at: string;
}

interface RequiredDoc {
    id: number; client_id: number; doc_name: string; description: string;
}

interface Message {
    id: number; client_id: number; sender: string; text: string; created_at: string;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / 1048576).toFixed(1) + ' МБ';
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'Z');
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(type: string): { label: string; cls: string } {
    if (type.includes('pdf')) return { label: 'PDF', cls: 'pdf' };
    if (type.includes('word') || type.includes('doc')) return { label: 'DOC', cls: 'doc' };
    if (type.includes('sheet') || type.includes('xls')) return { label: 'XLS', cls: 'xls' };
    if (type.includes('image')) return { label: 'IMG', cls: 'img' };
    return { label: 'FILE', cls: 'other' };
}

function statusLabel(s: string) {
    if (s === 'pending') return 'Ожидание';
    if (s === 'accepted') return 'Принят';
    return 'Отклонён';
}

// Clipboard fallback for non-HTTPS contexts
function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(text);
    }
    // Fallback: create a temporary textarea
    return new Promise((resolve, reject) => {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            resolve();
        } catch (e) {
            reject(e);
        }
    });
}

export default function AdminPage() {
    const [authed, setAuthed] = useState(false);
    const [adminToken, setAdminToken] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');

    const [clients, setClients] = useState<Client[]>([]);
    const [selectedToken, setSelectedToken] = useState<string | null>(null);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [requiredDocs, setRequiredDocs] = useState<RequiredDoc[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [detailTab, setDetailTab] = useState('docs');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCompany, setNewCompany] = useState('');
    const [newContact, setNewContact] = useState('');
    const [createdLink, setCreatedLink] = useState('');

    const [newReqDocName, setNewReqDocName] = useState('');
    const [newReqDocDesc, setNewReqDocDesc] = useState('');
    const [reviewingDocId, setReviewingDocId] = useState<number | null>(null);
    const [reviewComment, setReviewComment] = useState('');
    const [msgText, setMsgText] = useState('');
    const [toast, setToast] = useState<{ type: string; text: string } | null>(null);
    const [copied, setCopied] = useState(false);

    const chatEndRef = useRef<HTMLDivElement>(null);

    const showToast = useCallback((type: string, text: string) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Helper: admin-authenticated fetch
    const adminFetch = useCallback((url: string, options: RequestInit = {}) => {
        const token = sessionStorage.getItem('admin_token') || adminToken;
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`,
            },
        });
    }, [adminToken]);

    // Check stored admin session
    useEffect(() => {
        const token = sessionStorage.getItem('admin_token');
        if (token) {
            setAdminToken(token);
            setAuthed(true);
        }
    }, []);

    const fetchClients = useCallback(async () => {
        try {
            const res = await adminFetch('/api/clients');
            if (res.ok) setClients(await res.json());
            else if (res.status === 401) {
                sessionStorage.removeItem('admin_token');
                setAuthed(false);
            }
        } catch { /* ignore */ }
    }, [adminFetch]);

    useEffect(() => {
        if (authed) {
            fetchClients();
            const interval = setInterval(fetchClients, 15000);
            return () => clearInterval(interval);
        }
    }, [authed, fetchClients]);

    const fetchClientDetails = useCallback(async (token: string) => {
        try {
            const [cRes, dRes, rRes, mRes] = await Promise.all([
                fetch(`/api/clients/${token}`),
                fetch(`/api/clients/${token}/documents`),
                fetch(`/api/clients/${token}/required-docs`),
                fetch(`/api/clients/${token}/messages`),
            ]);
            if (cRes.ok) setSelectedClient(await cRes.json());
            if (dRes.ok) setDocuments(await dRes.json());
            if (rRes.ok) setRequiredDocs(await rRes.json());
            if (mRes.ok) setMessages(await mRes.json());
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        if (selectedToken) {
            fetchClientDetails(selectedToken);
            const interval = setInterval(() => fetchClientDetails(selectedToken), 10000);
            return () => clearInterval(interval);
        }
    }, [selectedToken, fetchClientDetails]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleAuth = async () => {
        try {
            const res = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (res.ok) {
                const data = await res.json();
                setAdminToken(data.token);
                sessionStorage.setItem('admin_token', data.token);
                setAuthed(true);
                setAuthError('');
                setPassword('');
            } else {
                const data = await res.json();
                setAuthError(data.error || 'Неверный пароль');
            }
        } catch {
            setAuthError('Ошибка авторизации');
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('admin_token');
        setAdminToken('');
        setAuthed(false);
        setClients([]);
        setSelectedToken(null);
        setSelectedClient(null);
    };

    const handleCreateClient = async () => {
        try {
            const res = await adminFetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company_name: newCompany, contact_person: newContact }),
            });
            if (res.ok) {
                const data = await res.json();
                const link = `${window.location.origin}/portal/${data.token}`;
                setCreatedLink(link);
                setNewCompany('');
                setNewContact('');
                fetchClients();
                showToast('success', 'Клиент создан');
            }
        } catch {
            showToast('error', 'Ошибка создания');
        }
    };

    const handleCopy = async () => {
        try {
            await copyToClipboard(createdLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            showToast('error', 'Не удалось скопировать. Выделите ссылку вручную.');
        }
    };

    const handleDeleteClient = async (token: string) => {
        if (!confirm('Удалить клиента и все его документы?')) return;
        try {
            const res = await adminFetch(`/api/clients/${token}`, { method: 'DELETE' });
            if (res.ok) {
                setClients(prev => prev.filter(c => c.token !== token));
                if (selectedToken === token) {
                    setSelectedToken(null);
                    setSelectedClient(null);
                }
                showToast('success', 'Клиент удалён');
            }
        } catch {
            showToast('error', 'Ошибка удаления');
        }
    };

    const handleDocStatus = async (docId: number, status: string) => {
        try {
            const res = await adminFetch(`/api/clients/${selectedToken}/documents/${docId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, status_comment: reviewComment }),
            });
            if (res.ok) {
                const updatedDoc = await res.json();
                setDocuments(prev => prev.map(d => d.id === docId ? updatedDoc : d));
                setReviewingDocId(null);
                setReviewComment('');
                showToast('success', status === 'accepted' ? 'Документ принят' : 'Документ отклонён');
            }
        } catch {
            showToast('error', 'Ошибка обновления статуса');
        }
    };

    const handleAddReqDoc = async () => {
        if (!newReqDocName.trim() || !selectedToken) return;
        try {
            const res = await adminFetch(`/api/clients/${selectedToken}/required-docs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doc_name: newReqDocName, description: newReqDocDesc }),
            });
            if (res.ok) {
                const doc = await res.json();
                setRequiredDocs(prev => [...prev, doc]);
                setNewReqDocName('');
                setNewReqDocDesc('');
                showToast('success', 'Документ добавлен в список');
            }
        } catch {
            showToast('error', 'Ошибка добавления');
        }
    };

    const handleDeleteReqDoc = async (id: number) => {
        if (!selectedToken) return;
        try {
            const res = await adminFetch(`/api/clients/${selectedToken}/required-docs/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setRequiredDocs(prev => prev.filter(d => d.id !== id));
                showToast('success', 'Удалено из списка');
            }
        } catch {
            showToast('error', 'Ошибка удаления');
        }
    };

    const handleSendMessage = async () => {
        if (!msgText.trim() || !selectedToken) return;
        try {
            const res = await adminFetch(`/api/clients/${selectedToken}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: msgText, sender: 'admin' }),
            });
            if (res.ok) {
                const msg = await res.json();
                setMessages(prev => [...prev, msg]);
                setMsgText('');
            }
        } catch {
            showToast('error', 'Ошибка отправки');
        }
    };

    // AUTH SCREEN
    if (!authed) {
        return (
            <div className="auth-overlay">
                <div className="auth-box">
                    <h2>DocFlow Admin</h2>
                    <div className="form-group">
                        <label>Пароль</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAuth()}
                            placeholder="Введите пароль"
                        />
                    </div>
                    {authError && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{authError}</p>}
                    <button className="btn btn-primary" onClick={handleAuth}>Войти</button>
                </div>
            </div>
        );
    }

    // CLIENT DETAIL VIEW
    if (selectedToken && selectedClient) {
        return (
            <div className="page-wrapper">
                <button className="back-link" onClick={() => { setSelectedToken(null); setSelectedClient(null); }}>
                    &larr; Назад к списку
                </button>
                <div className="page-header">
                    <h1>{selectedClient.company_name || 'Без названия'}</h1>
                    <p>{selectedClient.contact_person} &middot; {selectedClient.phone || 'Нет телефона'}</p>
                </div>

                <div className="tabs">
                    <button className={`tab ${detailTab === 'docs' ? 'active' : ''}`} onClick={() => setDetailTab('docs')}>
                        Документы ({documents.length})
                    </button>
                    <button className={`tab ${detailTab === 'info' ? 'active' : ''}`} onClick={() => setDetailTab('info')}>
                        Данные клиента
                    </button>
                    <button className={`tab ${detailTab === 'required' ? 'active' : ''}`} onClick={() => setDetailTab('required')}>
                        Требуемые документы
                    </button>
                    <button className={`tab ${detailTab === 'chat' ? 'active' : ''}`} onClick={() => setDetailTab('chat')}>
                        Переписка
                    </button>
                </div>

                {detailTab === 'docs' && (
                    <div className="card">
                        <div className="card-header">
                            <h2><span className="icon">|</span> Загруженные документы</h2>
                        </div>
                        {documents.length === 0 ? (
                            <div className="empty-state">
                                <p>Клиент ещё не загрузил документы</p>
                            </div>
                        ) : (
                            documents.map(doc => {
                                const fi = getFileIcon(doc.file_type);
                                return (
                                    <div key={doc.id}>
                                        <div className="doc-row">
                                            <div className={`file-icon ${fi.cls}`}>{fi.label}</div>
                                            <div className="doc-info">
                                                <div className="doc-name">{doc.original_name}</div>
                                                <div className="doc-meta">
                                                    {doc.category && <span style={{ color: 'var(--accent)' }}>{doc.category}</span>}
                                                    {doc.category && ' · '}{formatSize(doc.file_size)} &middot; {formatDate(doc.uploaded_at)}
                                                </div>
                                                {doc.status_comment && (
                                                    <div className="doc-comment">{doc.status_comment}</div>
                                                )}
                                            </div>
                                            <div className="doc-actions">
                                                <span className={`badge badge-${doc.status}`}>{statusLabel(doc.status)}</span>
                                                <a href={`/api/clients/${selectedToken}/documents/${doc.id}`} className="btn btn-secondary btn-sm" download>Скачать</a>
                                                {doc.status === 'pending' && (
                                                    <>
                                                        <button className="btn btn-success btn-sm" onClick={() => handleDocStatus(doc.id, 'accepted')}>
                                                            Принять
                                                        </button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => { setReviewingDocId(doc.id); setReviewComment(''); }}>
                                                            Отклонить
                                                        </button>
                                                    </>
                                                )}
                                                {doc.status !== 'pending' && (
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleDocStatus(doc.id, 'pending')}>
                                                        Сбросить
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {reviewingDocId === doc.id && (
                                            <div className="review-form">
                                                <textarea
                                                    value={reviewComment}
                                                    onChange={e => setReviewComment(e.target.value)}
                                                    placeholder="Укажите причину отклонения..."
                                                />
                                                <div className="btn-group">
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDocStatus(doc.id, 'rejected')}>
                                                        Отклонить с комментарием
                                                    </button>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => setReviewingDocId(null)}>
                                                        Отмена
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {detailTab === 'info' && (
                    <>
                        {/* Основные реквизиты */}
                        <div className="card section-gap">
                            <div className="card-header">
                                <h2><span className="icon">|</span> Основные реквизиты</h2>
                            </div>
                            <div className="form-grid">
                                {[
                                    ['Полное наименование', selectedClient.company_name],
                                    ['Сокращённое', selectedClient.short_name],
                                    ['ОПФ', selectedClient.legal_form],
                                    ['ИНН', selectedClient.inn],
                                    ['КПП', selectedClient.kpp],
                                    ['ОГРН', selectedClient.ogrn],
                                    ['ОКПО', selectedClient.okpo],
                                    ['ОКВЭД', selectedClient.okved],
                                    ['Дата регистрации', selectedClient.registration_date],
                                ].map(([label, value]) => (
                                    <div className="form-group" key={label}>
                                        <label>{label}</label>
                                        <div style={{ fontSize: 14, padding: '10px 0', color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                            {value || '\u2014'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Адреса */}
                        <div className="card section-gap">
                            <div className="card-header">
                                <h2><span className="icon">|</span> Адреса</h2>
                            </div>
                            <div className="form-grid">
                                {[
                                    ['Юридический адрес', selectedClient.legal_address],
                                    ['Фактический адрес', selectedClient.actual_address],
                                    ['Почтовый адрес', selectedClient.postal_address],
                                ].map(([label, value]) => (
                                    <div className="form-group full-width" key={label}>
                                        <label>{label}</label>
                                        <div style={{ fontSize: 14, padding: '10px 0', color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                            {value || '\u2014'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Банковские реквизиты */}
                        <div className="card section-gap">
                            <div className="card-header">
                                <h2><span className="icon">|</span> Банковские реквизиты</h2>
                            </div>
                            <div className="form-grid">
                                {[
                                    ['Банк', selectedClient.bank_name],
                                    ['Р/с', selectedClient.bank_account],
                                    ['К/с', selectedClient.corr_account],
                                    ['БИК', selectedClient.bik],
                                ].map(([label, value]) => (
                                    <div className="form-group" key={label}>
                                        <label>{label}</label>
                                        <div style={{ fontSize: 14, padding: '10px 0', color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                            {value || '\u2014'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Руководство + Контакты */}
                        <div className="card section-gap">
                            <div className="card-header">
                                <h2><span className="icon">|</span> Руководство и контакты</h2>
                            </div>
                            <div className="form-grid">
                                {[
                                    ['Руководитель', selectedClient.director_name],
                                    ['Должность', selectedClient.director_title],
                                    ['Действует на основании', selectedClient.acts_on_basis],
                                    ['Контактное лицо', selectedClient.contact_person],
                                    ['Телефон', selectedClient.phone],
                                    ['Email', selectedClient.email],
                                    ['Факс', selectedClient.fax],
                                    ['Сайт', selectedClient.website],
                                ].map(([label, value]) => (
                                    <div className="form-group" key={label}>
                                        <label>{label}</label>
                                        <div style={{ fontSize: 14, padding: '10px 0', color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                            {value || '\u2014'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Доп. сведения */}
                        <div className="card section-gap">
                            <div className="card-header">
                                <h2><span className="icon">|</span> Дополнительно</h2>
                            </div>
                            <div className="form-grid">
                                {[
                                    ['Система налогообложения', selectedClient.tax_system],
                                    ['СРО', selectedClient.sro_name],
                                    ['Номер допуска СРО', selectedClient.sro_number],
                                ].map(([label, value]) => (
                                    <div className="form-group" key={label}>
                                        <label>{label}</label>
                                        <div style={{ fontSize: 14, padding: '10px 0', color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                            {value || '\u2014'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Обоснование сметной стоимости */}
                        <div className="card section-gap">
                            <div className="card-header">
                                <h2><span className="icon">|</span> Обоснование сметной стоимости</h2>
                            </div>
                            <div className="form-group full-width">
                                <label>Коэффициенты условий производства работ</label>
                                <div style={{ fontSize: 14, padding: '10px 0', color: selectedClient.cost_justification ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                                    {selectedClient.cost_justification || '\u2014'}
                                </div>
                            </div>
                        </div>

                        {/* Объект */}
                        <div className="card section-gap">
                            <div className="card-header">
                                <h2><span className="icon">|</span> Сведения об объекте</h2>
                            </div>
                            <div className="form-grid">
                                {[
                                    ['Наименование', selectedClient.object_name],
                                    ['Вид строительства', selectedClient.construction_type],
                                    ['Адрес', selectedClient.object_address],
                                ].map(([label, value]) => (
                                    <div className="form-group" key={label}>
                                        <label>{label}</label>
                                        <div style={{ fontSize: 14, padding: '10px 0', color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                            {value || '\u2014'}
                                        </div>
                                    </div>
                                ))}
                                {[
                                    ['Финансирование', selectedClient.financing_info],
                                    ['Функциональное назначение', selectedClient.object_purpose],
                                    ['ТЭП', selectedClient.tech_economic_indicators],
                                    ['Здания и сооружения', selectedClient.buildings_info],
                                ].map(([label, value]) => (
                                    <div className="form-group full-width" key={label}>
                                        <label>{label}</label>
                                        <div style={{ fontSize: 14, padding: '10px 0', color: value ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                                            {value || '\u2014'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Ссылка */}
                        <div className="card section-gap">
                            <div className="card-header">
                                <h2><span className="icon">|</span> Ссылка для клиента</h2>
                            </div>
                            <div className="link-display">
                                {typeof window !== 'undefined' ? window.location.origin : ''}/portal/{selectedClient.token}
                            </div>
                            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => {
                                copyToClipboard(`${window.location.origin}/portal/${selectedClient.token}`)
                                    .then(() => showToast('success', 'Ссылка скопирована'))
                                    .catch(() => showToast('error', 'Не удалось скопировать'));
                            }}>
                                Скопировать ссылку клиента
                            </button>
                        </div>
                    </>
                )}

                {detailTab === 'required' && (
                    <div className="card">
                        <div className="card-header">
                            <h2><span className="icon">|</span> Список требуемых документов</h2>
                        </div>
                        {requiredDocs.map(rd => {
                            const catDocs = documents.filter(d => d.category === rd.doc_name);
                            const hasUploaded = catDocs.length > 0;
                            const allAccepted = hasUploaded && catDocs.every(d => d.status === 'accepted');
                            return (
                                <div key={rd.id} className="req-doc-item">
                                    <div>
                                        <div className="req-doc-name">{rd.doc_name}</div>
                                        {rd.description && <div className="req-doc-desc">{rd.description}</div>}
                                    </div>
                                    <div className="req-doc-status">
                                        {allAccepted ? (
                                            <span className="badge badge-accepted">Принят</span>
                                        ) : hasUploaded ? (
                                            <span className="badge badge-pending">Загружен</span>
                                        ) : (
                                            <span className="badge badge-rejected">Не загружен</span>
                                        )}
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteReqDoc(rd.id)}>Удалить</button>
                                    </div>
                                </div>
                            );
                        })}

                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Добавить документ в список</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Название документа</label>
                                    <input value={newReqDocName} onChange={e => setNewReqDocName(e.target.value)} placeholder={'Например: Акт приёмки'} />
                                </div>
                                <div className="form-group">
                                    <label>Описание (необязательно)</label>
                                    <input value={newReqDocDesc} onChange={e => setNewReqDocDesc(e.target.value)} placeholder="Краткое описание" />
                                </div>
                            </div>
                            <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={handleAddReqDoc}>
                                Добавить
                            </button>
                        </div>
                    </div>
                )}

                {detailTab === 'chat' && (
                    <div className="card">
                        <div className="card-header">
                            <h2><span className="icon">|</span> Переписка</h2>
                        </div>
                        <div className="chat-container">
                            <div className="chat-messages">
                                {messages.length === 0 && (
                                    <div className="empty-state">
                                        <p>Нет сообщений</p>
                                    </div>
                                )}
                                {messages.map(msg => (
                                    <div key={msg.id} className={`chat-bubble ${msg.sender}`}>
                                        <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.7, marginBottom: 2 }}>
                                            {msg.sender === 'admin' ? 'Менеджер' : 'Клиент'}
                                        </div>
                                        <div>{msg.text}</div>
                                        <div className="chat-time">{formatDate(msg.created_at)}</div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="chat-input-row">
                                <input
                                    value={msgText}
                                    onChange={e => setMsgText(e.target.value)}
                                    placeholder="Написать клиенту..."
                                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                />
                                <button className="btn btn-primary" onClick={handleSendMessage}>Отправить</button>
                            </div>
                        </div>
                    </div>
                )}

                {toast && <div className={`toast toast-${toast.type}`}>{toast.text}</div>}
            </div>
        );
    }

    // CLIENT LIST VIEW
    return (
        <div className="page-wrapper">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1>DocFlow &mdash; Панель управления</h1>
                    <p>Управление клиентами и документами</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Выйти</button>
            </div>

            <div style={{ marginBottom: 24 }}>
                <button className="btn btn-primary" onClick={() => { setShowCreateModal(true); setCreatedLink(''); }}>
                    Создать клиента
                </button>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2><span className="icon">|</span> Клиенты ({clients.length})</h2>
                </div>
                {clients.length === 0 ? (
                    <div className="empty-state">
                        <p>Нет клиентов. Создайте первого!</p>
                    </div>
                ) : (
                    clients.map(client => (
                        <div key={client.id} className="client-card" onClick={() => { setSelectedToken(client.token); setDetailTab('docs'); }}>
                            <div className="client-info">
                                <div className="client-name">
                                    {client.company_name || 'Без названия'}
                                    {client.unread_count > 0 && <span className="unread-badge" style={{ marginLeft: 8 }}>{client.unread_count}</span>}
                                </div>
                                <div className="client-meta">
                                    <span>{client.contact_person || '\u2014'}</span>
                                    <span>{formatDate(client.created_at)}</span>
                                </div>
                            </div>
                            <div className="client-stats">
                                {client.pending_count > 0 && <span className="badge badge-pending">{client.pending_count} ожид.</span>}
                                {client.accepted_count > 0 && <span className="badge badge-accepted">{client.accepted_count} прин.</span>}
                                {client.rejected_count > 0 && <span className="badge badge-rejected">{client.rejected_count} откл.</span>}
                                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDeleteClient(client.token); }}>
                                    Удалить
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Создать нового клиента</h3>
                        {!createdLink ? (
                            <>
                                <div className="form-group" style={{ marginBottom: 16 }}>
                                    <label>Название компании</label>
                                    <input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder={'ООО «Пример»'} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 16 }}>
                                    <label>Контактное лицо</label>
                                    <input value={newContact} onChange={e => setNewContact(e.target.value)} placeholder="ФИО" />
                                </div>
                                <div className="btn-group">
                                    <button className="btn btn-primary" onClick={handleCreateClient}>Создать</button>
                                    <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Отмена</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                    Клиент создан. Отправьте эту ссылку клиенту:
                                </p>
                                <div className="link-display">{createdLink}</div>
                                <div className="btn-group" style={{ marginTop: 16 }}>
                                    <button className="btn btn-primary" onClick={handleCopy}>
                                        {copied ? 'Скопировано!' : 'Скопировать ссылку'}
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Закрыть</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.text}</div>}
        </div>
    );
}
