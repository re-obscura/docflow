'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import type { Client, Employee, ObjectItem, Document, RequiredDoc, Message } from '@/lib/types';
import { formatSize, formatDate, getFileIcon, statusLabel, isImageType, validateINN, validateKPP, validateOGRN, validateBIK, validateAccount } from '@/lib/types';

export default function PortalPage() {
    const params = useParams();
    const token = params.token as string;

    // Auth state
    const [authChecked, setAuthChecked] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<{ id: number; full_name: string } | null>(null);
    const [empList, setEmpList] = useState<Employee[]>([]);
    const [loginEmpId, setLoginEmpId] = useState<string>('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [creatingFirst, setCreatingFirst] = useState(false);
    const [firstEmpName, setFirstEmpName] = useState('');
    const [firstEmpPassword, setFirstEmpPassword] = useState('');

    const [client, setClient] = useState<Client | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [objects, setObjects] = useState<ObjectItem[]>([]);
    const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [requiredDocs, setRequiredDocs] = useState<RequiredDoc[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingObj, setSavingObj] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: string; text: string } | null>(null);
    const [msgText, setMsgText] = useState('');
    const [activeTab, setActiveTab] = useState('info');

    const [newEmpName, setNewEmpName] = useState('');
    const [newEmpPosition, setNewEmpPosition] = useState('');
    const [newEmpPhone, setNewEmpPhone] = useState('');
    const [newEmpEmail, setNewEmpEmail] = useState('');
    const [newEmpPassword, setNewEmpPassword] = useState('');
    const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
    const [editEmp, setEditEmp] = useState<Partial<Employee & { password: string }>>({});

    const [showNewObjModal, setShowNewObjModal] = useState(false);
    const [newObjName, setNewObjName] = useState('');

    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [chatDragOver, setChatDragOver] = useState(false);
    const [initialClient, setInitialClient] = useState<string>('');

    const showToast = useCallback((type: string, text: string) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const selectedObject = objects.find(o => o.id === selectedObjectId) || null;

    // ===== AUTH: Check for stored session =====
    useEffect(() => {
        const stored = sessionStorage.getItem(`emp_${token}`);
        if (stored) {
            try { setCurrentEmployee(JSON.parse(stored)); } catch { /* ignore */ }
        }
        (async () => {
            try {
                const [empRes, cRes] = await Promise.all([
                    fetch(`/api/clients/${token}/employees`),
                    fetch(`/api/clients/${token}`),
                ]);
                if (empRes.ok) {
                    const emps = await empRes.json();
                    setEmpList(emps);
                    if (emps.length > 0 && !loginEmpId) setLoginEmpId(String(emps[0].id));
                }
                if (cRes.ok) {
                    const c = await cRes.json();
                    setCompanyName(c.company_name || '');
                }
            } catch { /* ignore */ }
            setAuthChecked(true);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const handleLogin = async () => {
        if (!loginEmpId) return;
        setLoginError('');
        try {
            const res = await fetch(`/api/clients/${token}/employees/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_id: Number(loginEmpId), password: loginPassword }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const emp = { id: data.employee.id, full_name: data.employee.full_name };
                sessionStorage.setItem(`emp_${token}`, JSON.stringify(emp));
                setCurrentEmployee(emp);
            } else {
                setLoginError(data.error || 'Ошибка входа');
            }
        } catch { setLoginError('Ошибка соединения'); }
    };

    const handleCreateFirstEmployee = async () => {
        if (!firstEmpName.trim()) { setLoginError('Введите ФИО'); return; }
        setLoginError('');
        try {
            const res = await fetch(`/api/clients/${token}/employees`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: firstEmpName, password: firstEmpPassword }),
            });
            if (res.ok) {
                const emp = await res.json();
                const session = { id: emp.id, full_name: emp.full_name };
                sessionStorage.setItem(`emp_${token}`, JSON.stringify(session));
                setCurrentEmployee(session);
            } else {
                const data = await res.json();
                setLoginError(data.error || 'Ошибка создания');
            }
        } catch { setLoginError('Ошибка соединения'); }
    };

    const handleLogout = () => {
        sessionStorage.removeItem(`emp_${token}`);
        setCurrentEmployee(null);
    };

    // ===== DATA FETCHING =====
    const fetchData = useCallback(async () => {
        try {
            const [cRes, empRes, objRes, mRes] = await Promise.all([
                fetch(`/api/clients/${token}`),
                fetch(`/api/clients/${token}/employees`),
                fetch(`/api/clients/${token}/objects`),
                fetch(`/api/clients/${token}/messages`),
            ]);
            if (!cRes.ok) throw new Error('Client not found');
            const clientData = await cRes.json();
            setClient(clientData);
            setInitialClient(JSON.stringify(clientData));
            setEmployees(await empRes.json());
            const objData: ObjectItem[] = await objRes.json();
            setObjects(objData);
            setMessages(await mRes.json());
            if (objData.length > 0) {
                setSelectedObjectId(prev => {
                    if (prev && objData.some(o => o.id === prev)) return prev;
                    return objData[0].id;
                });
            }
        } catch { setClient(null); } finally { setLoading(false); }
    }, [token]);

    const fetchObjectDocs = useCallback(async (objectId: number | null) => {
        if (!objectId) return;
        try {
            const [dRes, rRes] = await Promise.all([
                fetch(`/api/clients/${token}/documents?object_id=${objectId}`),
                fetch(`/api/clients/${token}/required-docs?object_id=${objectId}`),
            ]);
            if (dRes.ok) setDocuments(await dRes.json());
            if (rRes.ok) setRequiredDocs(await rRes.json());
        } catch { /* ignore */ }
    }, [token]);

    useEffect(() => { if (currentEmployee) fetchData(); }, [currentEmployee, fetchData]);
    useEffect(() => { fetchObjectDocs(selectedObjectId); }, [selectedObjectId, fetchObjectDocs]);

    useEffect(() => {
        if (!currentEmployee) return;
        const interval = setInterval(async () => {
            try {
                const [dRes, mRes] = await Promise.all([
                    selectedObjectId ? fetch(`/api/clients/${token}/documents?object_id=${selectedObjectId}`) : Promise.resolve(null),
                    fetch(`/api/clients/${token}/messages`),
                ]);
                if (dRes?.ok) setDocuments(await dRes.json());
                if (mRes.ok) setMessages(await mRes.json());
            } catch { /* ignore */ }
        }, 10000);
        return () => clearInterval(interval);
    }, [token, selectedObjectId, currentEmployee]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ===== HANDLERS =====
    const handleSaveClient = async () => {
        if (!client) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/clients/${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(client) });
            if (res.ok) {
                const saved = await res.json();
                setClient(saved);
                setInitialClient(JSON.stringify(saved));
                showToast('success', 'Данные сохранены');
            }
        } catch { showToast('error', 'Ошибка сохранения'); } finally { setSaving(false); }
    };

    const handleSaveObject = async () => {
        if (!selectedObject) return;
        setSavingObj(true);
        try {
            const res = await fetch(`/api/clients/${token}/objects/${selectedObject.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selectedObject) });
            if (res.ok) { const updated = await res.json(); setObjects(prev => prev.map(o => o.id === updated.id ? updated : o)); showToast('success', 'Данные объекта сохранены'); }
        } catch { showToast('error', 'Ошибка сохранения'); } finally { setSavingObj(false); }
    };

    const updateObject = (field: keyof ObjectItem, value: string) => {
        setObjects(prev => prev.map(o => o.id === selectedObjectId ? { ...o, [field]: value } : o));
    };

    const handleCreateObject = async () => {
        if (!newObjName.trim()) return;
        try {
            const res = await fetch(`/api/clients/${token}/objects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ object_name: newObjName }) });
            if (res.ok) { const obj = await res.json(); setObjects(prev => [...prev, obj]); setSelectedObjectId(obj.id); setNewObjName(''); setShowNewObjModal(false); showToast('success', 'Объект создан'); }
        } catch { showToast('error', 'Ошибка создания объекта'); }
    };

    const handleDeleteObject = async (id: number) => {
        if (!confirm('Удалить объект и все связанные документы?')) return;
        try {
            const res = await fetch(`/api/clients/${token}/objects/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setObjects(prev => { const next = prev.filter(o => o.id !== id); if (selectedObjectId === id && next.length > 0) setSelectedObjectId(next[0].id); else if (next.length === 0) setSelectedObjectId(null); return next; });
                showToast('success', 'Объект удалён');
            }
        } catch { showToast('error', 'Ошибка удаления'); }
    };

    const handleAddEmployee = async () => {
        if (!newEmpName.trim()) return;
        try {
            const res = await fetch(`/api/clients/${token}/employees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: newEmpName, position: newEmpPosition, phone: newEmpPhone, email: newEmpEmail, password: newEmpPassword }) });
            if (res.ok) { const emp = await res.json(); setEmployees(prev => [...prev, emp]); setNewEmpName(''); setNewEmpPosition(''); setNewEmpPhone(''); setNewEmpEmail(''); setNewEmpPassword(''); showToast('success', 'Сотрудник добавлен'); }
        } catch { showToast('error', 'Ошибка добавления'); }
    };

    const handleUpdateEmployee = async (id: number) => {
        try {
            const res = await fetch(`/api/clients/${token}/employees/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editEmp) });
            if (res.ok) { const updated = await res.json(); setEmployees(prev => prev.map(e => e.id === id ? updated : e)); setEditingEmpId(null); showToast('success', 'Данные обновлены'); }
        } catch { showToast('error', 'Ошибка обновления'); }
    };

    const handleDeleteEmployee = async (id: number) => {
        if (!confirm('Удалить сотрудника?')) return;
        try {
            const res = await fetch(`/api/clients/${token}/employees/${id}`, { method: 'DELETE' });
            if (res.ok) { setEmployees(prev => prev.filter(e => e.id !== id)); showToast('success', 'Сотрудник удалён'); }
        } catch { showToast('error', 'Ошибка удаления'); }
    };

    const handleUpload = async (file: File, category: string) => {
        if (!selectedObjectId || !currentEmployee) return;
        setUploading(category);
        try {
            const formData = new FormData();
            formData.append('file', file); formData.append('category', category);
            formData.append('object_id', String(selectedObjectId));
            formData.append('uploaded_by_employee_id', String(currentEmployee.id));
            formData.append('uploaded_by_name', currentEmployee.full_name);
            const res = await fetch(`/api/clients/${token}/documents`, { method: 'POST', body: formData });
            if (res.ok) { const newDoc = await res.json(); setDocuments(prev => [newDoc, ...prev]); showToast('success', 'Файл загружен'); }
            else { const err = await res.json(); showToast('error', err.error || 'Ошибка загрузки'); }
        } catch { showToast('error', 'Ошибка загрузки'); } finally { setUploading(null); }
    };

    const handleDropUpload = (e: React.DragEvent, category: string) => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files[0]; if (file) handleUpload(file, category); };

    const handleDeleteDoc = async (docId: number) => {
        try {
            const res = await fetch(`/api/clients/${token}/documents/${docId}`, { method: 'DELETE' });
            if (res.ok) { setDocuments(prev => prev.filter(d => d.id !== docId)); showToast('success', 'Документ удалён'); }
            else { const err = await res.json(); showToast('error', err.error || 'Ошибка удаления'); }
        } catch { showToast('error', 'Ошибка удаления'); }
    };

    const handleSendMessage = async (file?: File) => {
        if (!currentEmployee) return;
        if (!msgText.trim() && !file) return;
        try {
            const formData = new FormData();
            formData.append('text', msgText); formData.append('sender', 'client');
            formData.append('sender_name', currentEmployee.full_name);
            if (file) formData.append('file', file);
            const res = await fetch(`/api/clients/${token}/messages`, { method: 'POST', body: formData });
            if (res.ok) { const msg = await res.json(); setMessages(prev => [...prev, msg]); setMsgText(''); }
            else { const err = await res.json(); showToast('error', err.error || 'Ошибка отправки'); }
        } catch { showToast('error', 'Ошибка отправки'); }
    };

    const u = (field: keyof Client, value: string) => { setClient(prev => prev ? { ...prev, [field]: value } : prev); };

    // ===== RENDERING =====

    if (!authChecked) {
        return (
            <div className="auth-screen">
                <div className="auth-box" style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>Загрузка...</p>
                </div>
            </div>
        );
    }

    if (!currentEmployee) {
        if (empList.length === 0) {
            return (
                <div className="auth-screen">
                    <div className="auth-box">
                        <h2>DocFlow</h2>
                        <p className="auth-subtitle">{companyName || 'Портал клиента'}</p>
                        {!creatingFirst ? (
                            <>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                                    Для начала работы создайте аккаунт первого сотрудника. После этого вы сможете добавлять других участников.
                                </p>
                                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setCreatingFirst(true)}>Создать аккаунт</button>
                            </>
                        ) : (
                            <>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label>ФИО</label>
                                    <input value={firstEmpName} onChange={e => setFirstEmpName(e.target.value)} placeholder="Укажите полное имя, например: Петров Алексей Сергеевич" autoFocus />
                                    <span className="hint">Будет использоваться для входа и в истории действий</span>
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label>Пароль</label>
                                    <input type="password" value={firstEmpPassword} onChange={e => setFirstEmpPassword(e.target.value)} placeholder="Необязательно — можно оставить пустым" />
                                    <span className="hint">Если пароль не задан, вход будет по выбору имени без пароля</span>
                                </div>
                                {loginError && <p className="field-error" style={{ marginBottom: 8 }}>{loginError}</p>}
                                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleCreateFirstEmployee}>Создать и войти</button>
                            </>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="auth-screen">
                <div className="auth-box">
                    <h2>DocFlow</h2>
                    <p className="auth-subtitle">{companyName || 'Портал клиента'}</p>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                        <label>Сотрудник</label>
                        <select value={loginEmpId} onChange={e => setLoginEmpId(e.target.value)}>
                            {empList.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.full_name || `#${emp.id}`}</option>
                            ))}
                        </select>
                        <span className="hint">Выберите своё имя из списка</span>
                    </div>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                        <label>Пароль</label>
                        <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="Введите пароль, если он был задан" />
                    </div>
                    {loginError && <p className="field-error" style={{ marginBottom: 8 }}>{loginError}</p>}
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleLogin}>Войти</button>
                </div>
            </div>
        );
    }

    if (loading) return <div className="loading-center"><div className="spinner" /><span>Загрузка данных...</span></div>;
    if (!client) return <div className="loading-center"><span style={{ color: 'var(--text)' }}>Ссылка недействительна. Проверьте правильность или свяжитесь с менеджером.</span></div>;

    const getDocsForCategory = (category: string) => documents.filter(d => d.category === category);
    const hasUnsavedChanges = client ? JSON.stringify(client) !== initialClient : false;

    return (
        <div className="page-wrapper">
            {/* HEADER */}
            <div className="app-header">
                <div className="app-header-left">
                    <div className="app-logo">DF</div>
                    <div className="app-header-text">
                        <h1>{client.company_name || 'Личный кабинет'}</h1>
                        <p>{currentEmployee.full_name}</p>
                    </div>
                </div>
                <div className="app-header-actions">
                    <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Выйти</button>
                </div>
            </div>

            {/* TABS */}
            <div className="tabs">
                <button className={`tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>Реквизиты</button>
                <button className={`tab ${activeTab === 'employees' ? 'active' : ''}`} onClick={() => setActiveTab('employees')}>Сотрудники</button>
                <button className={`tab ${activeTab === 'object' ? 'active' : ''}`} onClick={() => setActiveTab('object')}>Объекты</button>
                <button className={`tab ${activeTab === 'docs' ? 'active' : ''}`} onClick={() => setActiveTab('docs')}>Документы</button>
                <button className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Сообщения</button>
            </div>

            {/* OBJECT SELECTOR for object/docs tabs */}
            {(activeTab === 'object' || activeTab === 'docs') && (
                <div className="obj-list">
                    {objects.map(o => {
                        const objDocs = documents.filter(d => d.object_id === o.id);
                        const accepted = objDocs.filter(d => d.status === 'accepted').length;
                        const total = objDocs.length;
                        const pct = total > 0 ? Math.round((accepted / total) * 100) : 0;
                        return (
                            <div key={o.id} className={`obj-item ${o.id === selectedObjectId ? 'active' : ''}`} onClick={() => setSelectedObjectId(o.id)}>
                                <div className="obj-item-name">{o.object_name || `Объект ${o.id}`}</div>
                                <div className="obj-item-addr">{o.object_address || 'Адрес не указан'}</div>
                                {total > 0 && (
                                    <div style={{ marginTop: 8 }}>
                                        <div className="progress-bar"><div className={`progress-fill ${pct === 100 ? 'complete' : ''}`} style={{ width: `${pct}%` }} /></div>
                                        <div className="progress-label">{accepted} из {total} принято</div>
                                    </div>
                                )}
                                {objects.length > 1 && (
                                    <button className="btn btn-danger btn-xs" style={{ position: 'absolute', top: 6, right: 6 }} onClick={e => { e.stopPropagation(); handleDeleteObject(o.id); }}>Удалить</button>
                                )}
                            </div>
                        );
                    })}
                    <div className="obj-item-add" onClick={() => setShowNewObjModal(true)}>
                        <span className="plus">+</span>
                        <span>Добавить объект</span>
                    </div>
                </div>
            )}

            {/* ===== REQUISITES TAB ===== */}
            {activeTab === 'info' && (
                <>
                    <div className="card">
                        <div className="card-title">Основные сведения об организации</div>
                        <div className="form-grid">
                            <div className="form-group full-width"><label>Полное наименование</label><input value={client.company_name} onChange={e => u('company_name', e.target.value)} placeholder="Общество с ограниченной ответственностью «Название»" /><span className="hint">Укажите полное наименование, включая организационно-правовую форму</span></div>
                            <div className="form-group"><label>Сокращённое наименование</label><input value={client.short_name} onChange={e => u('short_name', e.target.value)} placeholder='ООО «Название»' /></div>
                            <div className="form-group"><label>Организационно-правовая форма</label><input value={client.legal_form} onChange={e => u('legal_form', e.target.value)} placeholder="ООО, АО, ИП..." /></div>
                            <div className="form-group"><label>ИНН</label><input value={client.inn} onChange={e => u('inn', e.target.value)} placeholder="10 или 12 цифр" className={client.inn && !validateINN(client.inn) ? 'input-error' : ''} />{client.inn && !validateINN(client.inn) && <span className="field-error">ИНН должен содержать 10 или 12 цифр</span>}</div>
                            <div className="form-group"><label>КПП</label><input value={client.kpp} onChange={e => u('kpp', e.target.value)} placeholder="9 цифр" className={client.kpp && !validateKPP(client.kpp) ? 'input-error' : ''} />{client.kpp && !validateKPP(client.kpp) && <span className="field-error">КПП — 9 цифр</span>}</div>
                            <div className="form-group"><label>ОГРН / ОГРНИП</label><input value={client.ogrn} onChange={e => u('ogrn', e.target.value)} placeholder="13 цифр для ООО, 15 для ИП" className={client.ogrn && !validateOGRN(client.ogrn) ? 'input-error' : ''} />{client.ogrn && !validateOGRN(client.ogrn) && <span className="field-error">ОГРН — 13 или 15 цифр</span>}</div>
                            <div className="form-group"><label>ОКПО</label><input value={client.okpo} onChange={e => u('okpo', e.target.value)} placeholder="8 или 10 цифр" /></div>
                            <div className="form-group"><label>ОКВЭД</label><input value={client.okved} onChange={e => u('okved', e.target.value)} placeholder="Основной вид деятельности" /></div>
                            <div className="form-group"><label>Дата регистрации</label><input value={client.registration_date} onChange={e => u('registration_date', e.target.value)} placeholder="дд.мм.гггг" /></div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-title">Адреса</div>
                        <div className="form-grid">
                            <div className="form-group full-width"><label>Юридический адрес</label><input value={client.legal_address} onChange={e => u('legal_address', e.target.value)} placeholder="Индекс, город, улица, дом, офис" /><span className="hint">Адрес из учредительных документов</span></div>
                            <div className="form-group full-width"><label>Фактический адрес</label><input value={client.actual_address} onChange={e => u('actual_address', e.target.value)} placeholder="Заполните, если отличается от юридического" /></div>
                            <div className="form-group full-width"><label>Почтовый адрес</label><input value={client.postal_address} onChange={e => u('postal_address', e.target.value)} placeholder="Адрес для получения корреспонденции" /></div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-title">Банковские реквизиты</div>
                        <div className="form-grid">
                            <div className="form-group full-width"><label>Наименование банка</label><input value={client.bank_name} onChange={e => u('bank_name', e.target.value)} placeholder='Полное наименование, например: ПАО «Сбербанк»' /></div>
                            <div className="form-group"><label>Расчётный счёт</label><input value={client.bank_account} onChange={e => u('bank_account', e.target.value)} placeholder="20 цифр" className={client.bank_account && !validateAccount(client.bank_account) ? 'input-error' : ''} />{client.bank_account && !validateAccount(client.bank_account) && <span className="field-error">Расчётный счёт — 20 цифр</span>}</div>
                            <div className="form-group"><label>Корреспондентский счёт</label><input value={client.corr_account} onChange={e => u('corr_account', e.target.value)} placeholder="20 цифр" /></div>
                            <div className="form-group"><label>БИК</label><input value={client.bik} onChange={e => u('bik', e.target.value)} placeholder="9 цифр" className={client.bik && !validateBIK(client.bik) ? 'input-error' : ''} />{client.bik && !validateBIK(client.bik) && <span className="field-error">БИК — 9 цифр</span>}</div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-title">Руководство</div>
                        <div className="form-grid">
                            <div className="form-group"><label>ФИО руководителя</label><input value={client.director_name} onChange={e => u('director_name', e.target.value)} placeholder="Фамилия Имя Отчество" /></div>
                            <div className="form-group"><label>Должность</label><input value={client.director_title} onChange={e => u('director_title', e.target.value)} placeholder="Генеральный директор" /></div>
                            <div className="form-group full-width"><label>Действует на основании</label><input value={client.acts_on_basis} onChange={e => u('acts_on_basis', e.target.value)} placeholder="Устав, Доверенность и т.д." /></div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-title">Контактные данные</div>
                        <div className="form-grid">
                            <div className="form-group"><label>Контактное лицо</label><input value={client.contact_person} onChange={e => u('contact_person', e.target.value)} placeholder="ФИО ответственного за документооборот" /></div>
                            <div className="form-group"><label>Телефон</label><input value={client.phone} onChange={e => u('phone', e.target.value)} placeholder="+7 (___) ___-__-__" /></div>
                            <div className="form-group"><label>Email</label><input value={client.email} onChange={e => u('email', e.target.value)} placeholder="example@company.ru" /></div>
                            <div className="form-group"><label>Факс</label><input value={client.fax} onChange={e => u('fax', e.target.value)} placeholder="При наличии" /></div>
                            <div className="form-group full-width"><label>Сайт</label><input value={client.website} onChange={e => u('website', e.target.value)} placeholder="https://company.ru" /></div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-title">Дополнительные сведения</div>
                        <div className="form-grid">
                            <div className="form-group"><label>Система налогообложения</label><input value={client.tax_system} onChange={e => u('tax_system', e.target.value)} placeholder="ОСНО, УСН, ЕСХН..." /></div>
                            <div className="form-group full-width"><label>Наименование СРО</label><input value={client.sro_name} onChange={e => u('sro_name', e.target.value)} placeholder="Полное наименование саморегулируемой организации" /><span className="hint">Заполняется при наличии членства в СРО</span></div>
                            <div className="form-group"><label>Номер допуска СРО</label><input value={client.sro_number} onChange={e => u('sro_number', e.target.value)} placeholder="Номер свидетельства" /></div>
                        </div>
                    </div>

                    <button className={`btn btn-primary ${hasUnsavedChanges ? 'btn-unsaved' : ''}`} onClick={handleSaveClient} disabled={saving} style={{ marginTop: 8 }}>
                        {saving ? 'Сохранение...' : hasUnsavedChanges ? 'Сохранить изменения' : 'Сохранить реквизиты'}
                    </button>
                </>
            )}

            {/* ===== EMPLOYEES TAB ===== */}
            {activeTab === 'employees' && (
                <div className="card">
                    <div className="card-title">Сотрудники компании</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                        Каждый добавленный сотрудник может входить в портал под своим именем. Все загрузки и действия будут подписаны его именем.
                    </p>

                    {employees.map(emp => (
                        <div key={emp.id} className="emp-row">
                            {editingEmpId === emp.id ? (
                                <div style={{ flex: 1 }}>
                                    <div className="form-grid">
                                        <div className="form-group"><label>ФИО</label><input value={editEmp.full_name || ''} onChange={e => setEditEmp(p => ({ ...p, full_name: e.target.value }))} placeholder="Фамилия Имя Отчество" /></div>
                                        <div className="form-group"><label>Должность</label><input value={editEmp.position || ''} onChange={e => setEditEmp(p => ({ ...p, position: e.target.value }))} placeholder="Инженер, Прораб..." /></div>
                                        <div className="form-group"><label>Телефон</label><input value={editEmp.phone || ''} onChange={e => setEditEmp(p => ({ ...p, phone: e.target.value }))} placeholder="+7 (___) ___-__-__" /></div>
                                        <div className="form-group"><label>Email</label><input value={editEmp.email || ''} onChange={e => setEditEmp(p => ({ ...p, email: e.target.value }))} placeholder="email@example.ru" /></div>
                                        <div className="form-group"><label>Новый пароль</label><input type="password" value={editEmp.password || ''} onChange={e => setEditEmp(p => ({ ...p, password: e.target.value }))} placeholder="Оставьте пустым, чтобы не менять" /></div>
                                    </div>
                                    <div className="btn-group"><button className="btn btn-primary btn-sm" onClick={() => handleUpdateEmployee(emp.id)}>Сохранить</button><button className="btn btn-secondary btn-sm" onClick={() => setEditingEmpId(null)}>Отмена</button></div>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <div className="emp-name">{emp.full_name}</div>
                                        <div className="emp-detail">{[emp.position, emp.phone, emp.email].filter(Boolean).join(' · ') || 'Нет подробностей'}</div>
                                    </div>
                                    <div className="btn-group" style={{ marginTop: 0 }}>
                                        <button className="btn btn-ghost btn-xs" onClick={() => { setEditingEmpId(emp.id); setEditEmp(emp); }}>Изменить</button>
                                        <button className="btn btn-danger btn-xs" onClick={() => handleDeleteEmployee(emp.id)}>Удалить</button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}

                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16, marginTop: 16 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Добавить сотрудника</p>
                        <div className="form-grid">
                            <div className="form-group"><label>ФИО</label><input value={newEmpName} onChange={e => setNewEmpName(e.target.value)} placeholder="Фамилия Имя Отчество" /></div>
                            <div className="form-group"><label>Должность</label><input value={newEmpPosition} onChange={e => setNewEmpPosition(e.target.value)} placeholder="Инженер, Прораб..." /></div>
                            <div className="form-group"><label>Телефон</label><input value={newEmpPhone} onChange={e => setNewEmpPhone(e.target.value)} placeholder="+7 (___) ___-__-__" /></div>
                            <div className="form-group"><label>Email</label><input value={newEmpEmail} onChange={e => setNewEmpEmail(e.target.value)} placeholder="email@example.ru" /></div>
                            <div className="form-group"><label>Пароль</label><input type="password" value={newEmpPassword} onChange={e => setNewEmpPassword(e.target.value)} placeholder="Необязательно" /><span className="hint">Если не задан, вход будет без пароля</span></div>
                        </div>
                        <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={handleAddEmployee}>Добавить</button>
                    </div>
                </div>
            )}

            {/* ===== OBJECT TAB ===== */}
            {activeTab === 'object' && selectedObject && (
                <div className="card">
                    <div className="card-title">Сведения об объекте</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                        Заполните информацию о строительном объекте. Эти данные используются при формировании документации.
                    </p>
                    <div className="form-grid">
                        <div className="form-group full-width"><label>Наименование объекта</label><input value={selectedObject.object_name} onChange={e => updateObject('object_name', e.target.value)} placeholder='Например: Жилой дом «Солнечный», корпуc 3' /><span className="hint">Укажите краткое, понятное название для идентификации объекта</span></div>
                        <div className="form-group full-width"><label>Адрес объекта</label><input value={selectedObject.object_address} onChange={e => updateObject('object_address', e.target.value)} placeholder="Город, район, улица, номер участка" /></div>
                        <div className="form-group full-width"><label>Назначение объекта</label><input value={selectedObject.object_purpose} onChange={e => updateObject('object_purpose', e.target.value)} placeholder="Жилое, промышленное, коммерческое..." /></div>
                        <div className="form-group full-width"><label>Технико-экономические показатели</label><textarea value={selectedObject.tech_economic_indicators} onChange={e => updateObject('tech_economic_indicators', e.target.value)} placeholder="Общая площадь, этажность, количество квартир/помещений, год постройки" /><span className="hint">Основные параметры объекта, которые могут потребоваться для документации</span></div>
                        <div className="form-group full-width"><label>Тип строительства</label><input value={selectedObject.construction_type} onChange={e => updateObject('construction_type', e.target.value)} placeholder="Новое строительство, реконструкция, капитальный ремонт" /></div>
                        <div className="form-group full-width"><label>Финансирование</label><textarea value={selectedObject.financing_info} onChange={e => updateObject('financing_info', e.target.value)} placeholder="Источники финансирования, бюджет, контрактная стоимость" /></div>
                        <div className="form-group full-width"><label>Здания и сооружения</label><textarea value={selectedObject.buildings_info} onChange={e => updateObject('buildings_info', e.target.value)} placeholder="Перечень зданий и сооружений, входящих в состав объекта" /></div>
                        <div className="form-group full-width"><label>Обоснование стоимости</label><textarea value={selectedObject.cost_justification} onChange={e => updateObject('cost_justification', e.target.value)} placeholder="Обоснование сметной стоимости строительства" /></div>
                    </div>
                    <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleSaveObject} disabled={savingObj}>
                        {savingObj ? 'Сохранение...' : 'Сохранить данные объекта'}
                    </button>
                </div>
            )}

            {/* ===== DOCUMENTS TAB ===== */}
            {activeTab === 'docs' && (
                <>
                    {selectedObjectId ? (
                        <>
                            {requiredDocs.map(req => {
                                const docs = getDocsForCategory(req.doc_name);
                                return (
                                    <div key={req.id} className="req-category">
                                        <div className="req-category-head">
                                            <div className="req-category-name">{req.doc_name}</div>
                                            {docs.length > 0 && <span className={`badge badge-${docs.some(d => d.status === 'accepted') ? 'accepted' : docs.some(d => d.status === 'rejected') ? 'rejected' : 'pending'}`}>{docs.some(d => d.status === 'accepted') ? 'Принят' : docs.some(d => d.status === 'rejected') ? 'Отклонён' : 'На проверке'}</span>}
                                        </div>
                                        {req.description && <div className="req-category-desc">{req.description}</div>}

                                        {docs.map(doc => {
                                            const fIcon = getFileIcon(doc.file_type);
                                            return (
                                                <div key={doc.id} className="doc-item">
                                                    <div className={`doc-icon ${fIcon.cls}`}>{fIcon.label}</div>
                                                    <div className="doc-info">
                                                        <a href={`/api/clients/${token}/documents/${doc.id}`} className="doc-name" style={{ textDecoration: 'none', color: 'inherit' }} download>{doc.original_name}</a>
                                                        <div className="doc-meta">
                                                            {formatSize(doc.file_size)} · <span className="status-dot" style={{ display: 'inline-block' }}><span className={`status-dot ${doc.status}`} /></span> {statusLabel(doc.status)}
                                                            {doc.uploaded_by_name && ` · ${doc.uploaded_by_name}`}
                                                            {doc.status_comment && <span style={{ color: 'var(--red)' }}> — {doc.status_comment}</span>}
                                                        </div>
                                                    </div>
                                                    {doc.status === 'pending' && <button className="btn btn-danger btn-xs" onClick={() => handleDeleteDoc(doc.id)}>Удалить</button>}
                                                </div>
                                            );
                                        })}

                                        <div className="dropzone" style={{ marginTop: 6 }}
                                            onClick={() => fileInputRefs.current[req.doc_name]?.click()}
                                            onDragOver={e => e.preventDefault()} onDrop={e => handleDropUpload(e, req.doc_name)}>
                                            <input type="file" ref={el => { fileInputRefs.current[req.doc_name] = el; }} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, req.doc_name); e.target.value = ''; }} />
                                            {uploading === req.doc_name ? (
                                                <div className="spinner" style={{ margin: '4px auto' }} />
                                            ) : (
                                                <>
                                                    <div className="dropzone-label">{docs.length > 0 ? 'Загрузить новую версию' : 'Нажмите или перетащите файл'}</div>
                                                    <div className="dropzone-hint">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG — до 50 МБ</div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="req-category" style={{ borderStyle: 'dashed' }}>
                                <div className="req-category-name">Прочие документы</div>
                                <div className="req-category-desc" style={{ marginBottom: 8 }}>Загрузите документы, не входящие в обязательный перечень</div>
                                {getDocsForCategory('Прочее').map(doc => {
                                    const fIcon = getFileIcon(doc.file_type);
                                    return (
                                        <div key={doc.id} className="doc-item">
                                            <div className={`doc-icon ${fIcon.cls}`}>{fIcon.label}</div>
                                            <div className="doc-info">
                                                <a href={`/api/clients/${token}/documents/${doc.id}`} className="doc-name" style={{ textDecoration: 'none', color: 'inherit' }} download>{doc.original_name}</a>
                                                <div className="doc-meta">{formatSize(doc.file_size)} · {statusLabel(doc.status)}{doc.uploaded_by_name && ` · ${doc.uploaded_by_name}`}</div>
                                            </div>
                                            {doc.status === 'pending' && <button className="btn btn-danger btn-xs" onClick={() => handleDeleteDoc(doc.id)}>Удалить</button>}
                                        </div>
                                    );
                                })}
                                <div className="dropzone" style={{ marginTop: 6 }} onClick={() => fileInputRefs.current['_other']?.click()}
                                    onDragOver={e => e.preventDefault()} onDrop={e => handleDropUpload(e, 'Прочее')}>
                                    <input type="file" ref={el => { fileInputRefs.current['_other'] = el; }} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'Прочее'); e.target.value = ''; }} />
                                    <div className="dropzone-label">Загрузить дополнительный документ</div>
                                    <div className="dropzone-hint">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG — до 50 МБ</div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="card"><div className="loading-center"><span>Нет объектов. Сначала создайте объект на вкладке «Объекты».</span></div></div>
                    )}
                </>
            )}

            {/* ===== CHAT TAB ===== */}
            {activeTab === 'chat' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px 0' }}>
                        <div className="card-title" style={{ marginBottom: 12 }}>Переписка с менеджером</div>
                    </div>
                    <div className={`chat-wrap ${chatDragOver ? 'drag-over' : ''}`}
                        onDragOver={e => { e.preventDefault(); setChatDragOver(true); }}
                        onDragLeave={() => setChatDragOver(false)}
                        onDrop={e => { e.preventDefault(); setChatDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleSendMessage(f); }}
                    >
                        <div className="chat-messages">
                            {messages.length === 0 && <div className="loading-center" style={{ padding: 40 }}><span>Нет сообщений. Напишите менеджеру — он ответит в ближайшее время.</span></div>}
                            {messages.map(msg => (
                                <div key={msg.id} className={`chat-bubble ${msg.sender}`}>
                                    {msg.sender_name && <div className="chat-sender">{msg.sender_name}</div>}
                                    {msg.text && <div>{msg.text}</div>}
                                    {msg.attachment_filename && isImageType(msg.attachment_type) && (
                                        <img src={`/api/clients/${token}/messages/${msg.id}`} alt={msg.attachment_original_name} className="chat-img-thumb"
                                            onClick={() => setPreviewImage(`/api/clients/${token}/messages/${msg.id}`)} />
                                    )}
                                    {msg.attachment_filename && !isImageType(msg.attachment_type) && (
                                        <a href={`/api/clients/${token}/messages/${msg.id}`} className="chat-attachment" download>
                                            <span className="att-label">FILE</span>
                                            <span className="att-name">{msg.attachment_original_name}</span>
                                            <span className="att-size">{formatSize(msg.attachment_size)}</span>
                                        </a>
                                    )}
                                    <div className="chat-time">{formatDate(msg.created_at)}</div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="chat-input-bar">
                            <input value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="Введите сообщение..." onKeyDown={e => e.key === 'Enter' && handleSendMessage()} />
                            <input type="file" id="chatFileInput" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleSendMessage(f); e.target.value = ''; }} />
                            <label htmlFor="chatFileInput" className="attach-btn" title="Прикрепить файл" />
                            <button className="btn btn-primary" onClick={() => handleSendMessage()}>Отправить</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== NEW OBJECT MODAL ===== */}
            {showNewObjModal && (
                <div className="overlay" onClick={() => setShowNewObjModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Новый объект</h3>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label>Название объекта</label>
                            <input value={newObjName} onChange={e => setNewObjName(e.target.value)} placeholder='Жилой комплекс «Солнечный», корпус 2' autoFocus onKeyDown={e => e.key === 'Enter' && handleCreateObject()} />
                            <span className="hint">Укажите понятное название, чтобы вы и ваш менеджер могли легко его найти</span>
                        </div>
                        <div className="btn-group">
                            <button className="btn btn-primary" onClick={handleCreateObject}>Создать</button>
                            <button className="btn btn-secondary" onClick={() => setShowNewObjModal(false)}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}

            {previewImage && (
                <div className="img-preview-overlay" onClick={() => setPreviewImage(null)}>
                    <img src={previewImage} alt="Просмотр" />
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.text}</div>}
        </div>
    );
}
