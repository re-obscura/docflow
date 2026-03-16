'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Employee } from '@/lib/types';

interface AuthState {
    authChecked: boolean;
    currentEmployee: { id: number; full_name: string } | null;
    empList: Employee[];
    loginEmpId: string;
    loginPassword: string;
    loginError: string;
    companyName: string;
    creatingFirst: boolean;
    firstEmpName: string;
    firstEmpPassword: string;
}

export function usePortalAuth(token: string) {
    const [state, setState] = useState<AuthState>({
        authChecked: false,
        currentEmployee: null,
        empList: [],
        loginEmpId: '',
        loginPassword: '',
        loginError: '',
        companyName: '',
        creatingFirst: false,
        firstEmpName: '',
        firstEmpPassword: '',
    });

    const update = useCallback((patch: Partial<AuthState>) => {
        setState(prev => ({ ...prev, ...patch }));
    }, []);

    // Check stored session on mount
    useEffect(() => {
        const stored = sessionStorage.getItem(`emp_${token}`);
        if (stored) {
            try { update({ currentEmployee: JSON.parse(stored) }); } catch { /* ignore */ }
        }
        (async () => {
            try {
                const [empRes, cRes] = await Promise.all([
                    fetch(`/api/clients/${token}/employees`),
                    fetch(`/api/clients/${token}`),
                ]);
                const patch: Partial<AuthState> = {};
                if (empRes.ok) {
                    const emps = await empRes.json();
                    patch.empList = emps;
                    if (emps.length > 0) patch.loginEmpId = String(emps[0].id);
                }
                if (cRes.ok) {
                    const c = await cRes.json();
                    patch.companyName = c.company_name || '';
                }
                update(patch);
            } catch { /* ignore */ }
            update({ authChecked: true });
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const handleLogin = useCallback(async () => {
        if (!state.loginEmpId) return;
        update({ loginError: '' });
        try {
            const res = await fetch(`/api/clients/${token}/employees/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_id: Number(state.loginEmpId), password: state.loginPassword }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const emp = { id: data.employee.id, full_name: data.employee.full_name };
                sessionStorage.setItem(`emp_${token}`, JSON.stringify(emp));
                update({ currentEmployee: emp });
            } else {
                update({ loginError: data.error || 'Ошибка входа' });
            }
        } catch { update({ loginError: 'Ошибка соединения' }); }
    }, [token, state.loginEmpId, state.loginPassword, update]);

    const handleCreateFirstEmployee = useCallback(async () => {
        if (!state.firstEmpName.trim()) { update({ loginError: 'Введите ФИО' }); return; }
        update({ loginError: '' });
        try {
            const res = await fetch(`/api/clients/${token}/employees`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: state.firstEmpName, password: state.firstEmpPassword }),
            });
            if (res.ok) {
                const emp = await res.json();
                const session = { id: emp.id, full_name: emp.full_name };
                sessionStorage.setItem(`emp_${token}`, JSON.stringify(session));
                update({ currentEmployee: session });
            } else {
                const data = await res.json();
                update({ loginError: data.error || 'Ошибка создания' });
            }
        } catch { update({ loginError: 'Ошибка соединения' }); }
    }, [token, state.firstEmpName, state.firstEmpPassword, update]);

    const handleLogout = useCallback(() => {
        sessionStorage.removeItem(`emp_${token}`);
        update({ currentEmployee: null });
    }, [token, update]);

    return { ...state, update, handleLogin, handleCreateFirstEmployee, handleLogout };
}
