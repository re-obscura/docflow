'use client';

import type { Employee } from '@/lib/types';

interface PortalLoginProps {
    authChecked: boolean;
    empList: Employee[];
    companyName: string;
    creatingFirst: boolean;
    firstEmpName: string;
    firstEmpPassword: string;
    loginEmpId: string;
    loginPassword: string;
    loginError: string;
    onUpdate: (patch: Record<string, unknown>) => void;
    onLogin: () => void;
    onCreateFirst: () => void;
}

export default function PortalLogin({
    authChecked, empList, companyName, creatingFirst, firstEmpName, firstEmpPassword,
    loginEmpId, loginPassword, loginError, onUpdate, onLogin, onCreateFirst,
}: PortalLoginProps) {
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
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onUpdate({ creatingFirst: true })}>Создать аккаунт</button>
                        </>
                    ) : (
                        <>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label>ФИО</label>
                                <input value={firstEmpName} onChange={e => onUpdate({ firstEmpName: e.target.value })} placeholder="Укажите полное имя, например: Петров Алексей Сергеевич" autoFocus />
                                <span className="hint">Будет использоваться для входа и в истории действий</span>
                            </div>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label>Пароль</label>
                                <input type="password" value={firstEmpPassword} onChange={e => onUpdate({ firstEmpPassword: e.target.value })} placeholder="Необязательно — можно оставить пустым" />
                                <span className="hint">Если пароль не задан, вход будет по выбору имени без пароля</span>
                            </div>
                            {loginError && <p className="field-error" style={{ marginBottom: 8 }}>{loginError}</p>}
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={onCreateFirst}>Создать и войти</button>
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
                    <select value={loginEmpId} onChange={e => onUpdate({ loginEmpId: e.target.value })}>
                        {empList.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.full_name || `#${emp.id}`}</option>
                        ))}
                    </select>
                    <span className="hint">Выберите своё имя из списка</span>
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                    <label>Пароль</label>
                    <input type="password" value={loginPassword} onChange={e => onUpdate({ loginPassword: e.target.value })} onKeyDown={e => e.key === 'Enter' && onLogin()} placeholder="Введите пароль, если он был задан" />
                </div>
                {loginError && <p className="field-error" style={{ marginBottom: 8 }}>{loginError}</p>}
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={onLogin}>Войти</button>
            </div>
        </div>
    );
}
