'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { Client, ObjectItem, Message } from '@/lib/types';

import { usePortalAuth } from './hooks/usePortalAuth';
import { usePortalData } from './hooks/usePortalData';
import PortalLogin from './components/PortalLogin';
import TabInfo from './components/TabInfo';
import TabEmployees from './components/TabEmployees';
import TabObject from './components/TabObject';
import TabDocs from './components/TabDocs';
import TabChat from './components/TabChat';

export default function PortalPage() {
    const params = useParams();
    const token = params.token as string;

    const auth = usePortalAuth(token);
    const data = usePortalData(token, !!auth.currentEmployee);

    const [activeTab, setActiveTab] = useState('info');
    const [saving, setSaving] = useState(false);
    const [savingObj, setSavingObj] = useState(false);
    const [toast, setToast] = useState<{ type: string; text: string } | null>(null);
    const [showNewObjModal, setShowNewObjModal] = useState(false);
    const [newObjName, setNewObjName] = useState('');

    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [data.messages]);

    const showToast = useCallback((type: string, text: string) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // ── Not authenticated ──
    if (!auth.currentEmployee) {
        return (
            <PortalLogin
                authChecked={auth.authChecked}
                empList={auth.empList}
                companyName={auth.companyName}
                creatingFirst={auth.creatingFirst}
                firstEmpName={auth.firstEmpName}
                firstEmpPassword={auth.firstEmpPassword}
                loginEmpId={auth.loginEmpId}
                loginPassword={auth.loginPassword}
                loginError={auth.loginError}
                onUpdate={auth.update}
                onLogin={auth.handleLogin}
                onCreateFirst={auth.handleCreateFirstEmployee}
            />
        );
    }

    if (data.loading) return <div className="loading-center"><div className="spinner" /><span>Загрузка данных...</span></div>;
    if (!data.client) return <div className="loading-center"><span style={{ color: 'var(--text)' }}>Ссылка недействительна. Проверьте правильность или свяжитесь с менеджером.</span></div>;

    // ── Handlers ──
    const handleSaveClient = async () => {
        if (!data.client) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/clients/${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.client) });
            if (res.ok) { const saved = await res.json(); data.setClient(saved); data.setInitialClient(JSON.stringify(saved)); showToast('success', 'Данные сохранены'); }
            else { const err = await res.json().catch(() => ({})); showToast('error', err.error || 'Ошибка сохранения'); }
        } catch { showToast('error', 'Ошибка сохранения'); } finally { setSaving(false); }
    };

    const handleSaveObject = async () => {
        if (!data.selectedObject) return;
        setSavingObj(true);
        try {
            const res = await fetch(`/api/clients/${token}/objects/${data.selectedObject.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.selectedObject) });
            if (res.ok) { const updated = await res.json(); data.setObjects(prev => prev.map(o => o.id === updated.id ? updated : o)); showToast('success', 'Данные объекта сохранены'); }
        } catch { showToast('error', 'Ошибка сохранения'); } finally { setSavingObj(false); }
    };

    const updateObject = (field: keyof ObjectItem, value: string) => {
        data.setObjects(prev => prev.map(o => o.id === data.selectedObjectId ? { ...o, [field]: value } : o));
    };

    const handleCreateObject = async () => {
        if (!newObjName.trim()) return;
        try {
            const res = await fetch(`/api/clients/${token}/objects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ object_name: newObjName }) });
            if (res.ok) { const obj = await res.json(); data.setObjects(prev => [...prev, obj]); data.setSelectedObjectId(obj.id); setNewObjName(''); setShowNewObjModal(false); showToast('success', 'Объект создан'); }
        } catch { showToast('error', 'Ошибка создания объекта'); }
    };

    const handleDeleteObject = async (id: number) => {
        if (!confirm('Удалить объект и все связанные документы?')) return;
        try {
            const res = await fetch(`/api/clients/${token}/objects/${id}`, { method: 'DELETE' });
            if (res.ok) {
                data.setObjects(prev => {
                    const next = prev.filter(o => o.id !== id);
                    if (data.selectedObjectId === id && next.length > 0) data.setSelectedObjectId(next[0].id);
                    else if (next.length === 0) data.setSelectedObjectId(null);
                    return next;
                });
                showToast('success', 'Объект удалён');
            }
        } catch { showToast('error', 'Ошибка удаления'); }
    };

    const handleFieldChange = (field: keyof Client, value: string) => {
        data.setClient(prev => prev ? { ...prev, [field]: value } : prev);
    };

    return (
        <div className="page-wrapper">
            {/* HEADER */}
            <div className="app-header">
                <div className="app-header-left">
                    <div className="app-logo">DF</div>
                    <div className="app-header-text">
                        <h1>{data.client.company_name || 'Личный кабинет'}</h1>
                        <p>{auth.currentEmployee.full_name}</p>
                    </div>
                </div>
                <div className="app-header-actions">
                    <button className="btn btn-ghost btn-sm" onClick={auth.handleLogout}>Выйти</button>
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
                    {data.objects.map(o => {
                        const objDocs = data.documents.filter(d => d.object_id === o.id);
                        const accepted = objDocs.filter(d => d.status === 'accepted').length;
                        const total = objDocs.length;
                        const pct = total > 0 ? Math.round((accepted / total) * 100) : 0;
                        return (
                            <div key={o.id} className={`obj-item ${o.id === data.selectedObjectId ? 'active' : ''}`} onClick={() => data.setSelectedObjectId(o.id)}>
                                <div className="obj-item-name">{o.object_name || `Объект ${o.id}`}</div>
                                <div className="obj-item-addr">{o.object_address || 'Адрес не указан'}</div>
                                {total > 0 && (
                                    <div style={{ marginTop: 8 }}>
                                        <div className="progress-bar"><div className={`progress-fill ${pct === 100 ? 'complete' : ''}`} style={{ width: `${pct}%` }} /></div>
                                        <div className="progress-label">{accepted} из {total} принято</div>
                                    </div>
                                )}
                                {data.objects.length > 1 && (
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

            {/* TAB CONTENT */}
            {activeTab === 'info' && <TabInfo client={data.client} saving={saving} hasUnsavedChanges={data.hasUnsavedChanges} onFieldChange={handleFieldChange} onSave={handleSaveClient} />}
            {activeTab === 'employees' && <TabEmployees token={token} employees={data.employees} onUpdate={data.setEmployees} showToast={showToast} />}
            {activeTab === 'object' && <TabObject selectedObject={data.selectedObject} saving={savingObj} onFieldChange={updateObject} onSave={handleSaveObject} />}
            {activeTab === 'docs' && <TabDocs token={token} selectedObjectId={data.selectedObjectId} documents={data.documents} requiredDocs={data.requiredDocs} currentEmployee={auth.currentEmployee} onDocumentsUpdate={data.setDocuments} showToast={showToast} />}
            {activeTab === 'chat' && <TabChat token={token} messages={data.messages} currentEmployeeName={auth.currentEmployee.full_name} onNewMessage={(msg: Message) => data.setMessages(prev => [...prev, msg])} showToast={showToast} chatEndRef={chatEndRef} />}

            {/* NEW OBJECT MODAL */}
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

            {toast && <div className={`toast toast-${toast.type}`}>{toast.text}</div>}
        </div>
    );
}
