'use client';

import { useRef, useState } from 'react';
import type { Document, RequiredDoc } from '@/lib/types';
import { formatSize, statusLabel, getFileIcon } from '@/lib/types';

interface TabDocsProps {
    token: string;
    selectedObjectId: number | null;
    documents: Document[];
    requiredDocs: RequiredDoc[];
    currentEmployee: { id: number; full_name: string };
    onDocumentsUpdate: (docs: Document[]) => void;
    showToast: (type: string, text: string) => void;
}

export default function TabDocs({ token, selectedObjectId, documents, requiredDocs, currentEmployee, onDocumentsUpdate, showToast }: TabDocsProps) {
    const [uploading, setUploading] = useState<string | null>(null);
    const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    if (!selectedObjectId) {
        return <div className="card"><div className="loading-center"><span>Нет объектов. Сначала создайте объект на вкладке «Объекты».</span></div></div>;
    }

    const getDocsForCategory = (category: string) => documents.filter(d => d.category === category);

    const handleUpload = async (file: File, category: string) => {
        setUploading(category);
        try {
            const formData = new FormData();
            formData.append('file', file); formData.append('category', category);
            formData.append('object_id', String(selectedObjectId));
            formData.append('uploaded_by_employee_id', String(currentEmployee.id));
            formData.append('uploaded_by_name', currentEmployee.full_name);
            const res = await fetch(`/api/clients/${token}/documents`, { method: 'POST', body: formData });
            if (res.ok) { const newDoc = await res.json(); onDocumentsUpdate([newDoc, ...documents]); showToast('success', 'Файл загружен'); }
            else { const err = await res.json(); showToast('error', err.error || 'Ошибка загрузки'); }
        } catch { showToast('error', 'Ошибка загрузки'); } finally { setUploading(null); }
    };

    const handleDropUpload = (e: React.DragEvent, category: string) => {
        e.preventDefault(); e.stopPropagation();
        const file = e.dataTransfer.files[0]; if (file) handleUpload(file, category);
    };

    const handleDeleteDoc = async (docId: number) => {
        try {
            const res = await fetch(`/api/clients/${token}/documents/${docId}`, { method: 'DELETE' });
            if (res.ok) { onDocumentsUpdate(documents.filter(d => d.id !== docId)); showToast('success', 'Документ удалён'); }
            else { const err = await res.json(); showToast('error', err.error || 'Ошибка удаления'); }
        } catch { showToast('error', 'Ошибка удаления'); }
    };

    const renderDocItem = (doc: Document) => {
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
    };

    const renderDropzone = (category: string, refKey: string, label: string) => (
        <div className="dropzone" style={{ marginTop: 6 }}
            onClick={() => fileInputRefs.current[refKey]?.click()}
            onDragOver={e => e.preventDefault()} onDrop={e => handleDropUpload(e, category)}>
            <input type="file" ref={el => { fileInputRefs.current[refKey] = el; }} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, category); e.target.value = ''; }} />
            {uploading === category ? (
                <div className="spinner" style={{ margin: '4px auto' }} />
            ) : (
                <>
                    <div className="dropzone-label">{label}</div>
                    <div className="dropzone-hint">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG — до 50 МБ</div>
                </>
            )}
        </div>
    );

    return (
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
                        {docs.map(renderDocItem)}
                        {renderDropzone(req.doc_name, req.doc_name, docs.length > 0 ? 'Загрузить новую версию' : 'Нажмите или перетащите файл')}
                    </div>
                );
            })}

            <div className="req-category" style={{ borderStyle: 'dashed' }}>
                <div className="req-category-name">Прочие документы</div>
                <div className="req-category-desc" style={{ marginBottom: 8 }}>Загрузите документы, не входящие в обязательный перечень</div>
                {getDocsForCategory('Прочее').map(renderDocItem)}
                {renderDropzone('Прочее', '_other', 'Загрузить дополнительный документ')}
            </div>
        </>
    );
}
