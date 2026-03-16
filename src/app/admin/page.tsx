'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ClientWithStats, Employee, ObjectItem, Document, RequiredDoc, Message } from '@/lib/types';
import { formatSize, formatDate, getFileIcon, statusLabel, isImageType } from '@/lib/types';

// ─── Clipboard utility ───
function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
        try {
            const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
            document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); resolve();
        } catch (e) { reject(e); }
    });
}

// ─── Debounce hook ───
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}

// ─── useAdminAuth ───
function useAdminAuth() {
    const [authed, setAuthed] = useState(false);
    const [adminToken, setAdminToken] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        const token = sessionStorage.getItem('admin_token');
        if (token) { setAdminToken(token); setAuthed(true); }
    }, []);

    const adminFetch = useCallback((url: string, options: RequestInit = {}) => {
        const token = sessionStorage.getItem('admin_token') || adminToken;
        return fetch(url, { ...options, headers: { ...options.headers, 'Authorization': `Bearer ${token}` } });
    }, [adminToken]);

    const handleAuth = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
            if (res.ok) { const data = await res.json(); setAdminToken(data.token); sessionStorage.setItem('admin_token', data.token); setAuthed(true); setAuthError(''); setPassword(''); }
            else { const data = await res.json(); setAuthError(data.error || 'Неверный пароль'); }
        } catch { setAuthError('Ошибка авторизации'); }
    }, [password]);

    const handleLogout = useCallback(async () => {
        try { await fetch('/api/admin/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}` } }); } catch { /* ignore */ }
        sessionStorage.removeItem('admin_token');
        setAdminToken(''); setAuthed(false);
    }, []);

    return { authed, password, authError, setPassword, handleAuth, handleLogout, adminFetch };
}

// ─── useAdminData ───
function useAdminData(authed: boolean, adminFetch: (url: string, opts?: RequestInit) => Promise<Response>) {
    const [clients, setClients] = useState<ClientWithStats[]>([]);
    const [totalClients, setTotalClients] = useState(0);
    const [selectedToken, setSelectedToken] = useState<string | null>(null);
    const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [objects, setObjects] = useState<ObjectItem[]>([]);
    const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [requiredDocs, setRequiredDocs] = useState<RequiredDoc[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 300);

    const fetchClients = useCallback(async () => {
        try {
            const res = await adminFetch(`/api/clients${debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : ''}`);
            if (res.ok) {
                const data = await res.json();
                setClients(data.clients || data); // Support both new { clients, total } and legacy array
                setTotalClients(data.total ?? (data.clients || data).length);
            } else if (res.status === 401) {
                sessionStorage.removeItem('admin_token');
                window.location.reload();
            }
        } catch { /* ignore */ }
    }, [adminFetch, debouncedSearch]);

    useEffect(() => { if (authed) { fetchClients(); const i = setInterval(fetchClients, 15000); return () => clearInterval(i); } }, [authed, fetchClients]);

    const fetchDetail = useCallback(async (tk: string) => {
        try {
            const [cRes, empRes, objRes, mRes] = await Promise.all([
                adminFetch(`/api/clients/${tk}`), adminFetch(`/api/clients/${tk}/employees`),
                adminFetch(`/api/clients/${tk}/objects`), adminFetch(`/api/clients/${tk}/messages`),
            ]);
            if (cRes.ok) setSelectedClient(await cRes.json());
            if (empRes.ok) setEmployees(await empRes.json());
            if (objRes.ok) {
                const objs: ObjectItem[] = await objRes.json();
                setObjects(objs);
                if (objs.length > 0) setSelectedObjectId(prev => (prev && objs.some(o => o.id === prev)) ? prev : objs[0].id);
            }
            if (mRes.ok) setMessages(await mRes.json());
        } catch { /* ignore */ }
    }, [adminFetch]);

    const fetchObjectDocs = useCallback(async (tk: string, objId: number | null) => {
        if (!objId) return;
        try {
            const [dRes, rRes] = await Promise.all([
                adminFetch(`/api/clients/${tk}/documents?object_id=${objId}`),
                adminFetch(`/api/clients/${tk}/required-docs?object_id=${objId}`),
            ]);
            if (dRes.ok) setDocuments(await dRes.json());
            if (rRes.ok) setRequiredDocs(await rRes.json());
        } catch { /* ignore */ }
    }, [adminFetch]);

    useEffect(() => { if (selectedToken) fetchDetail(selectedToken); }, [selectedToken, fetchDetail]);
    useEffect(() => { if (selectedToken && selectedObjectId) fetchObjectDocs(selectedToken, selectedObjectId); }, [selectedToken, selectedObjectId, fetchObjectDocs]);

    // Periodic polling for selected client
    useEffect(() => {
        if (!selectedToken) return;
        const interval = setInterval(async () => {
            try {
                const [dRes, mRes] = await Promise.all([
                    selectedObjectId ? adminFetch(`/api/clients/${selectedToken}/documents?object_id=${selectedObjectId}`) : Promise.resolve(null),
                    adminFetch(`/api/clients/${selectedToken}/messages`),
                ]);
                if (dRes?.ok) setDocuments(await dRes.json());
                if (mRes.ok) setMessages(await mRes.json());
            } catch { /* ignore */ }
        }, 8000);
        return () => clearInterval(interval);
    }, [selectedToken, selectedObjectId, adminFetch]);

    return {
        clients, setClients, totalClients, fetchClients,
        selectedToken, setSelectedToken, selectedClient, setSelectedClient,
        employees, objects, selectedObjectId, setSelectedObjectId,
        documents, setDocuments, requiredDocs, setRequiredDocs,
        messages, setMessages, searchQuery, setSearchQuery,
    };
}

// ═══════════════════════════════════
// MAIN ADMIN PAGE COMPONENT
// ═══════════════════════════════════
export default function AdminPage() {
    const auth = useAdminAuth();
    const data = useAdminData(auth.authed, auth.adminFetch);

    const [detailTab, setDetailTab] = useState('docs');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCompany, setNewCompany] = useState('');
    const [newContact, setNewContact] = useState('');
    const [createdLink, setCreatedLink] = useState('');
    const [newReqDocName, setNewReqDocName] = useState('');
    const [newReqDocDesc, setNewReqDocDesc] = useState('');
    const [reviewingDocId, setReviewingDocId] = useState<number | null>(null);
    const [reviewComment, setReviewComment] = useState('');
    const [savingClient, setSavingClient] = useState(false);
    const [msgText, setMsgText] = useState('');
    const [toast, setToast] = useState<{ type: string; text: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [chatDragOver, setChatDragOver] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [data.messages]);

    const showToast = useCallback((type: string, text: string) => { setToast({ type, text }); setTimeout(() => setToast(null), 3000); }, []);

    // ── Handlers ──
    const updateClientField = (field: string, value: string) => {
        data.setSelectedClient(prev => prev ? { ...prev, [field]: value } : prev);
    };
    const handleSaveClientRequisites = async () => {
        if (!data.selectedClient || !data.selectedToken) return;
        setSavingClient(true);
        try {
            const res = await auth.adminFetch(`/api/clients/${data.selectedToken}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.selectedClient) });
            if (res.ok) { const saved = await res.json(); data.setSelectedClient(saved); showToast('success', 'Реквизиты сохранены'); data.fetchClients(); }
            else { showToast('error', 'Ошибка сохранения'); }
        } catch { showToast('error', 'Ошибка сохранения'); } finally { setSavingClient(false); }
    };
    const handleCreateClient = async () => {
        try {
            const res = await auth.adminFetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_name: newCompany, contact_person: newContact }) });
            if (res.ok) { const d = await res.json(); setCreatedLink(`${window.location.origin}/portal/${d.token}`); setNewCompany(''); setNewContact(''); data.fetchClients(); showToast('success', 'Клиент создан'); }
        } catch { showToast('error', 'Ошибка создания'); }
    };
    const handleCopy = async () => { try { await copyToClipboard(createdLink); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { showToast('error', 'Не удалось скопировать'); } };
    const handleDeleteClient = async (token: string) => {
        if (!confirm('Удалить клиента и все его данные?')) return;
        try {
            const res = await auth.adminFetch(`/api/clients/${token}`, { method: 'DELETE' });
            if (res.ok) { data.setClients(prev => prev.filter(c => c.token !== token)); if (data.selectedToken === token) { data.setSelectedToken(null); data.setSelectedClient(null); } showToast('success', 'Клиент удалён'); }
        } catch { showToast('error', 'Ошибка удаления'); }
    };
    const handleDocStatus = async (docId: number, status: string) => {
        try {
            const res = await auth.adminFetch(`/api/clients/${data.selectedToken}/documents/${docId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, status_comment: reviewComment }) });
            if (res.ok) { const updatedDoc = await res.json(); data.setDocuments(prev => prev.map(d => d.id === docId ? updatedDoc : d)); setReviewingDocId(null); setReviewComment(''); showToast('success', status === 'accepted' ? 'Документ принят' : 'Документ отклонён'); }
        } catch { showToast('error', 'Ошибка обновления статуса'); }
    };
    const handleAddReqDoc = async () => {
        if (!newReqDocName.trim() || !data.selectedToken || !data.selectedObjectId) return;
        try {
            const res = await auth.adminFetch(`/api/clients/${data.selectedToken}/required-docs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc_name: newReqDocName, description: newReqDocDesc, object_id: data.selectedObjectId }) });
            if (res.ok) { const doc = await res.json(); data.setRequiredDocs(prev => [...prev, doc]); setNewReqDocName(''); setNewReqDocDesc(''); showToast('success', 'Документ добавлен в список'); }
        } catch { showToast('error', 'Ошибка добавления'); }
    };
    const handleDeleteReqDoc = async (id: number) => {
        if (!data.selectedToken) return;
        try { const res = await auth.adminFetch(`/api/clients/${data.selectedToken}/required-docs/${id}`, { method: 'DELETE' }); if (res.ok) { data.setRequiredDocs(prev => prev.filter(d => d.id !== id)); showToast('success', 'Удалено из списка'); } }
        catch { showToast('error', 'Ошибка удаления'); }
    };
    const handleSendMessage = async (file?: File) => {
        if (!data.selectedToken) return;
        if (!msgText.trim() && !file) return;
        try {
            const adminTk = sessionStorage.getItem('admin_token');
            const formData = new FormData();
            formData.append('text', msgText); formData.append('sender', 'admin'); formData.append('sender_name', 'Менеджер');
            if (file) formData.append('file', file);
            const res = await fetch(`/api/clients/${data.selectedToken}/messages`, { method: 'POST', headers: { 'Authorization': `Bearer ${adminTk}` }, body: formData });
            if (res.ok) { const msg = await res.json(); data.setMessages(prev => [...prev, msg]); setMsgText(''); }
            else { const err = await res.json(); showToast('error', err.error || 'Ошибка отправки'); }
        } catch { showToast('error', 'Ошибка отправки'); }
    };

    // ═══ AUTH SCREEN ═══
    if (!auth.authed) {
        return (
            <div className="auth-screen">
                <div className="auth-box">
                    <h2>DocFlow</h2>
                    <p className="auth-subtitle">Панель администратора</p>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                        <label>Пароль</label>
                        <input type="password" value={auth.password} onChange={e => auth.setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && auth.handleAuth()} placeholder="Введите пароль администратора" />
                    </div>
                    {auth.authError && <p className="field-error" style={{ marginBottom: 8 }}>{auth.authError}</p>}
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={auth.handleAuth}>Войти</button>
                </div>
            </div>
        );
    }

    // ═══ CLIENT DETAIL VIEW ═══
    if (data.selectedToken && data.selectedClient) {
        const selectedObject = data.objects.find(o => o.id === data.selectedObjectId) || null;

        return (
            <div className="page-wrapper">
                <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => { data.setSelectedToken(null); data.setSelectedClient(null); }}>&larr; Назад к списку</button>

                <div className="app-header" style={{ marginBottom: 20 }}>
                    <div className="app-header-left">
                        <div className="app-logo">DF</div>
                        <div className="app-header-text">
                            <h1>{data.selectedClient.company_name || 'Без названия'}</h1>
                            <p>{data.selectedClient.contact_person || 'Нет контактного лица'}{data.selectedClient.phone ? ` · ${data.selectedClient.phone}` : ''}</p>
                        </div>
                    </div>
                </div>

                <div className="tabs">
                    {(['docs', 'info', 'employees', 'objects', 'required', 'chat'] as const).map(tab => (
                        <button key={tab} className={`tab ${detailTab === tab ? 'active' : ''}`} onClick={() => setDetailTab(tab)}>
                            {{ docs: 'Документы', info: 'Реквизиты', employees: 'Сотрудники', objects: 'Объекты', required: 'Требуемые', chat: 'Переписка' }[tab]}
                        </button>
                    ))}
                </div>

                {/* Object selector */}
                {(detailTab === 'docs' || detailTab === 'required') && data.objects.length > 0 && (
                    <div className="obj-list">
                        {data.objects.map(o => (
                            <div key={o.id} className={`obj-item ${o.id === data.selectedObjectId ? 'active' : ''}`} onClick={() => data.setSelectedObjectId(o.id)}>
                                <div className="obj-item-name">{o.object_name || `Объект ${o.id}`}</div>
                                <div className="obj-item-addr">{o.object_address || 'Адрес не указан'}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* DOCUMENTS TAB */}
                {detailTab === 'docs' && (
                    <div className="card">
                        <div className="card-title">Загруженные документы{selectedObject ? ` — ${selectedObject.object_name}` : ''}</div>
                        {data.documents.length === 0 ? (
                            <div className="loading-center" style={{ padding: 30 }}><span>Клиент ещё не загрузил документы для этого объекта</span></div>
                        ) : (
                            data.documents.map(doc => {
                                const fi = getFileIcon(doc.file_type);
                                return (
                                    <div key={doc.id}>
                                        <div className="doc-item">
                                            <div className={`doc-icon ${fi.cls}`}>{fi.label}</div>
                                            <div className="doc-info">
                                                <div className="doc-name">{doc.original_name}</div>
                                                <div className="doc-meta">
                                                    {doc.category && <><span style={{ color: 'var(--accent-text)' }}>{doc.category}</span> · </>}
                                                    {formatSize(doc.file_size)} · {formatDate(doc.uploaded_at)}
                                                    {doc.uploaded_by_name && ` · ${doc.uploaded_by_name}`}
                                                </div>
                                                {doc.status_comment && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>{doc.status_comment}</div>}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                                <span className={`badge badge-${doc.status}`}>{statusLabel(doc.status)}</span>
                                                <a href={`/api/clients/${data.selectedToken}/documents/${doc.id}`} className="btn btn-secondary btn-xs" download>Скачать</a>
                                                {doc.status === 'pending' && (
                                                    <>
                                                        <button className="btn btn-xs" style={{ background: 'var(--green-soft)', color: 'var(--green)' }} onClick={() => handleDocStatus(doc.id, 'accepted')}>Принять</button>
                                                        <button className="btn btn-danger btn-xs" onClick={() => { setReviewingDocId(doc.id); setReviewComment(''); }}>Отклонить</button>
                                                    </>
                                                )}
                                                {doc.status !== 'pending' && <button className="btn btn-ghost btn-xs" onClick={() => handleDocStatus(doc.id, 'pending')}>Сбросить</button>}
                                            </div>
                                        </div>
                                        {reviewingDocId === doc.id && (
                                            <div className="review-box">
                                                <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Укажите причину отклонения — клиент увидит этот комментарий" />
                                                <div className="btn-group">
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDocStatus(doc.id, 'rejected')}>Отклонить с комментарием</button>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => setReviewingDocId(null)}>Отмена</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* REQUISITES TAB */}
                {detailTab === 'info' && (
                    <>
                        {[
                            { title: 'Основные реквизиты', fields: [['Полное наименование', 'company_name'], ['Сокращённое', 'short_name'], ['ОПФ', 'legal_form'], ['ИНН', 'inn'], ['КПП', 'kpp'], ['ОГРН', 'ogrn'], ['ОКПО', 'okpo'], ['ОКВЭД', 'okved'], ['Дата регистрации', 'registration_date']] },
                            { title: 'Адреса', fields: [['Юридический адрес', 'legal_address'], ['Фактический адрес', 'actual_address'], ['Почтовый адрес', 'postal_address']], full: true },
                            { title: 'Банковские реквизиты', fields: [['Банк', 'bank_name'], ['Расчётный счёт', 'bank_account'], ['Корр. счёт', 'corr_account'], ['БИК', 'bik']] },
                            { title: 'Руководство и контакты', fields: [['Руководитель', 'director_name'], ['Должность', 'director_title'], ['Действует на основании', 'acts_on_basis'], ['Контактное лицо', 'contact_person'], ['Телефон', 'phone'], ['Email', 'email'], ['Факс', 'fax'], ['Сайт', 'website']] },
                            { title: 'Дополнительно', fields: [['Система налогообложения', 'tax_system'], ['Наименование СРО', 'sro_name'], ['Номер допуска СРО', 'sro_number']] },
                        ].map(section => (
                            <div className="card" key={section.title}>
                                <div className="card-title">{section.title}</div>
                                <div className="form-grid">
                                    {section.fields.map(([label, field]) => (
                                        <div className={`form-group ${section.full ? 'full-width' : ''}`} key={field}>
                                            <label>{label}</label>
                                            <input value={(data.selectedClient as unknown as Record<string, string>)[field] || ''} onChange={e => updateClientField(field, e.target.value)} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <button className="btn btn-primary" onClick={handleSaveClientRequisites} disabled={savingClient} style={{ marginTop: 8 }}>
                            {savingClient ? 'Сохранение...' : 'Сохранить реквизиты'}
                        </button>
                    </>
                )}

                {/* EMPLOYEES TAB */}
                {detailTab === 'employees' && (
                    <div className="card">
                        <div className="card-title">Сотрудники ({data.employees.length})</div>
                        {data.employees.length === 0 ? (
                            <div className="loading-center" style={{ padding: 20 }}><span>Сотрудники ещё не добавлены</span></div>
                        ) : data.employees.map(emp => (
                            <div key={emp.id} className="emp-row">
                                <div><div className="emp-name">{emp.full_name}</div><div className="emp-detail">{[emp.position, emp.phone, emp.email].filter(Boolean).join(' · ') || 'Нет подробностей'}</div></div>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(emp.created_at)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* OBJECTS TAB */}
                {detailTab === 'objects' && (
                    <div className="card">
                        <div className="card-title">Объекты ({data.objects.length})</div>
                        {data.objects.length === 0 ? (
                            <div className="loading-center" style={{ padding: 20 }}><span>Объекты ещё не созданы</span></div>
                        ) : data.objects.map(o => (
                            <div key={o.id} className="emp-row">
                                <div><div className="emp-name">{o.object_name || `Объект ${o.id}`}</div><div className="emp-detail">{o.object_address || 'Адрес не указан'}</div></div>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(o.created_at)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* REQUIRED DOCS TAB */}
                {detailTab === 'required' && (
                    <div className="card">
                        <div className="card-title">Требуемые документы{selectedObject ? ` — ${selectedObject.object_name}` : ''}</div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>Список документов, которые клиент должен загрузить. Вы можете добавить новые требования.</p>
                        {data.requiredDocs.map(req => (
                            <div key={req.id} className="req-item">
                                <div className="req-item-info"><div className="req-item-name">{req.doc_name}</div>{req.description && <div className="req-item-desc">{req.description}</div>}</div>
                                <button className="btn btn-danger btn-xs" onClick={() => handleDeleteReqDoc(req.id)}>Удалить</button>
                            </div>
                        ))}
                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16, marginTop: 12 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Добавить требование</p>
                            <div className="form-grid">
                                <div className="form-group"><label>Название документа</label><input value={newReqDocName} onChange={e => setNewReqDocName(e.target.value)} placeholder="Акт приёмки, Справка КС-3..." /></div>
                                <div className="form-group"><label>Описание</label><input value={newReqDocDesc} onChange={e => setNewReqDocDesc(e.target.value)} placeholder="Необязательно — пояснение для клиента" /></div>
                            </div>
                            <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={handleAddReqDoc}>Добавить</button>
                        </div>
                    </div>
                )}

                {/* CHAT TAB */}
                {detailTab === 'chat' && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px 0' }}><div className="card-title" style={{ marginBottom: 12 }}>Переписка</div></div>
                        <div className={`chat-wrap ${chatDragOver ? 'drag-over' : ''}`}
                            onDragOver={e => { e.preventDefault(); setChatDragOver(true); }}
                            onDragLeave={() => setChatDragOver(false)}
                            onDrop={e => { e.preventDefault(); setChatDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleSendMessage(f); }}
                        >
                            <div className="chat-messages">
                                {data.messages.length === 0 && <div className="loading-center" style={{ padding: 40 }}><span>Нет сообщений</span></div>}
                                {data.messages.map(msg => (
                                    <div key={msg.id} className={`chat-bubble ${msg.sender}`}>
                                        <div className="chat-sender">{msg.sender_name || (msg.sender === 'admin' ? 'Менеджер' : 'Клиент')}</div>
                                        {msg.text && <div>{msg.text}</div>}
                                        {msg.attachment_filename && isImageType(msg.attachment_type) && (
                                            <img src={`/api/clients/${data.selectedToken}/messages/${msg.id}`} alt={msg.attachment_original_name} className="chat-img-thumb"
                                                onClick={() => setPreviewImage(`/api/clients/${data.selectedToken}/messages/${msg.id}`)} />
                                        )}
                                        {msg.attachment_filename && !isImageType(msg.attachment_type) && (
                                            <a href={`/api/clients/${data.selectedToken}/messages/${msg.id}`} className="chat-attachment" download>
                                                <span className="att-label">FILE</span><span className="att-name">{msg.attachment_original_name}</span><span className="att-size">{formatSize(msg.attachment_size)}</span>
                                            </a>
                                        )}
                                        <div className="chat-time">{formatDate(msg.created_at)}</div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="chat-input-bar">
                                <input value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="Написать клиенту..." onKeyDown={e => e.key === 'Enter' && handleSendMessage()} />
                                <input type="file" id="adminChatFile" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleSendMessage(f); e.target.value = ''; }} />
                                <label htmlFor="adminChatFile" className="attach-btn" title="Прикрепить файл" />
                                <button className="btn btn-primary" onClick={() => handleSendMessage()}>Отправить</button>
                            </div>
                        </div>
                    </div>
                )}

                {previewImage && <div className="img-preview-overlay" onClick={() => setPreviewImage(null)}><img src={previewImage} alt="Просмотр" /></div>}
                {toast && <div className={`toast toast-${toast.type}`}>{toast.text}</div>}
            </div>
        );
    }

    // ═══ CLIENT LIST VIEW ═══
    const totalDocs = data.clients.reduce((s, c) => s + c.doc_count, 0);
    const totalPending = data.clients.reduce((s, c) => s + c.pending_count, 0);
    const totalAccepted = data.clients.reduce((s, c) => s + c.accepted_count, 0);
    const totalRejected = data.clients.reduce((s, c) => s + c.rejected_count, 0);

    return (
        <div className="page-wrapper">
            <div className="app-header">
                <div className="app-header-left"><div className="app-logo">DF</div><div className="app-header-text"><h1>DocFlow</h1><p>Панель управления</p></div></div>
                <div className="app-header-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => { setShowCreateModal(true); setCreatedLink(''); }}>+ Клиент</button>
                    <button className="btn btn-ghost btn-sm" onClick={auth.handleLogout}>Выйти</button>
                </div>
            </div>

            <div className="stats-row">
                <div className="stat-item"><div className="stat-num">{data.clients.length}</div><div className="stat-label">Клиентов</div></div>
                <div className="stat-item"><div className="stat-num">{totalDocs}</div><div className="stat-label">Документов</div></div>
                <div className="stat-item"><div className="stat-num">{totalPending}</div><div className="stat-label">На проверке</div></div>
                <div className="stat-item"><div className="stat-num">{totalAccepted}</div><div className="stat-label">Принято</div></div>
                <div className="stat-item"><div className="stat-num">{totalRejected}</div><div className="stat-label">Отклонено</div></div>
            </div>

            <div className="search-box">
                <span className="search-icon" />
                <input value={data.searchQuery} onChange={e => data.setSearchQuery(e.target.value)} placeholder="Поиск по названию, ИНН, контактному лицу..." />
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 8px' }}>
                    <div className="card-title" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>Клиенты ({data.clients.length})</div>
                </div>
                {data.clients.length === 0 ? (
                    <div className="loading-center" style={{ padding: 30 }}><span>{data.searchQuery ? 'Ничего не найдено' : 'Нет клиентов — создайте первого'}</span></div>
                ) : (
                    data.clients.map(client => (
                        <div key={client.id} className="client-row" onClick={() => { data.setSelectedToken(client.token); setDetailTab('docs'); }}>
                            <div className="client-info">
                                <div className="client-name">
                                    {client.company_name || 'Без названия'}
                                    {client.unread_count > 0 && <span className="unread-dot">{client.unread_count}</span>}
                                </div>
                                <div className="client-meta">
                                    <span>{client.contact_person || '\u2014'}</span>
                                    {client.inn && <span>ИНН {client.inn}</span>}
                                    {client.employee_count > 0 && <span>{client.employee_count} сотр.</span>}
                                    {client.object_count > 0 && <span>{client.object_count} объ.</span>}
                                </div>
                                {client.doc_count > 0 && (
                                    <div style={{ maxWidth: 180, marginTop: 6 }}>
                                        <div className="progress-bar"><div className={`progress-fill ${client.accepted_count === client.doc_count ? 'complete' : ''}`} style={{ width: `${Math.round((client.accepted_count / client.doc_count) * 100)}%` }} /></div>
                                        <div className="progress-label">{client.accepted_count} из {client.doc_count} принято</div>
                                    </div>
                                )}
                            </div>
                            <div className="client-actions">
                                {client.pending_count > 0 && <span className="badge badge-pending">{client.pending_count} ожид.</span>}
                                <button className="btn btn-danger btn-xs" onClick={e => { e.stopPropagation(); handleDeleteClient(client.token); }}>Удалить</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* CREATE CLIENT MODAL */}
            {showCreateModal && (
                <div className="overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Новый клиент</h3>
                        {!createdLink ? (
                            <>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label>Название компании</label>
                                    <input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder='ООО «Строй-Инвест», ИП Петров А.С.' />
                                    <span className="hint">Клиент сможет отредактировать название позже</span>
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label>Контактное лицо</label>
                                    <input value={newContact} onChange={e => setNewContact(e.target.value)} placeholder="Фамилия Имя Отчество" />
                                </div>
                                <div className="btn-group">
                                    <button className="btn btn-primary" onClick={handleCreateClient}>Создать</button>
                                    <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Отмена</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>Клиент создан. Отправьте эту ссылку клиенту — по ней он зайдёт в личный кабинет.</p>
                                <div className="link-box">{createdLink}</div>
                                <div className="btn-group" style={{ marginTop: 12 }}>
                                    <button className="btn btn-primary" onClick={handleCopy}>{copied ? 'Скопировано' : 'Скопировать ссылку'}</button>
                                    <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Закрыть</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {previewImage && <div className="img-preview-overlay" onClick={() => setPreviewImage(null)}><img src={previewImage} alt="Просмотр" /></div>}
            {toast && <div className={`toast toast-${toast.type}`}>{toast.text}</div>}
        </div>
    );
}
