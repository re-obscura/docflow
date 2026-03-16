'use client';

import { useState } from 'react';
import type { Employee } from '@/lib/types';

interface TabEmployeesProps {
    token: string;
    employees: Employee[];
    onUpdate: (employees: Employee[]) => void;
    showToast: (type: string, text: string) => void;
}

export default function TabEmployees({ token, employees, onUpdate, showToast }: TabEmployeesProps) {
    const [newEmpName, setNewEmpName] = useState('');
    const [newEmpPosition, setNewEmpPosition] = useState('');
    const [newEmpPhone, setNewEmpPhone] = useState('');
    const [newEmpEmail, setNewEmpEmail] = useState('');
    const [newEmpPassword, setNewEmpPassword] = useState('');
    const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
    const [editEmp, setEditEmp] = useState<Partial<Employee & { password: string }>>({});

    const handleAddEmployee = async () => {
        if (!newEmpName.trim()) return;
        try {
            const res = await fetch(`/api/clients/${token}/employees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: newEmpName, position: newEmpPosition, phone: newEmpPhone, email: newEmpEmail, password: newEmpPassword }) });
            if (res.ok) { const emp = await res.json(); onUpdate([...employees, emp]); setNewEmpName(''); setNewEmpPosition(''); setNewEmpPhone(''); setNewEmpEmail(''); setNewEmpPassword(''); showToast('success', 'Сотрудник добавлен'); }
        } catch { showToast('error', 'Ошибка добавления'); }
    };

    const handleUpdateEmployee = async (id: number) => {
        try {
            const res = await fetch(`/api/clients/${token}/employees/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editEmp) });
            if (res.ok) { const updated = await res.json(); onUpdate(employees.map(e => e.id === id ? updated : e)); setEditingEmpId(null); showToast('success', 'Данные обновлены'); }
        } catch { showToast('error', 'Ошибка обновления'); }
    };

    const handleDeleteEmployee = async (id: number) => {
        if (!confirm('Удалить сотрудника?')) return;
        try {
            const res = await fetch(`/api/clients/${token}/employees/${id}`, { method: 'DELETE' });
            if (res.ok) { onUpdate(employees.filter(e => e.id !== id)); showToast('success', 'Сотрудник удалён'); }
        } catch { showToast('error', 'Ошибка удаления'); }
    };

    return (
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
    );
}
