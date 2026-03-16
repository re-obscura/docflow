'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Client, Employee, ObjectItem, Document, RequiredDoc, Message } from '@/lib/types';

export function usePortalData(token: string, isAuthenticated: boolean) {
    const [client, setClient] = useState<Client | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [objects, setObjects] = useState<ObjectItem[]>([]);
    const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [requiredDocs, setRequiredDocs] = useState<RequiredDoc[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [initialClient, setInitialClient] = useState<string>('');

    const selectedObject = objects.find(o => o.id === selectedObjectId) || null;
    const hasUnsavedChanges = client ? JSON.stringify(client) !== initialClient : false;

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

    // Fetch data when authenticated
    useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, fetchData]);

    // Fetch docs when object selection changes
    useEffect(() => { fetchObjectDocs(selectedObjectId); }, [selectedObjectId, fetchObjectDocs]);

    // Polling for real-time updates
    useEffect(() => {
        if (!isAuthenticated) return;
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
    }, [token, selectedObjectId, isAuthenticated]);

    return {
        client, setClient,
        employees, setEmployees,
        objects, setObjects,
        selectedObjectId, setSelectedObjectId,
        selectedObject,
        documents, setDocuments,
        requiredDocs,
        messages, setMessages,
        loading,
        initialClient, setInitialClient,
        hasUnsavedChanges,
        fetchData,
    };
}
