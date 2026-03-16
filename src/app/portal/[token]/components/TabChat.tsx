'use client';

import { useRef, useState } from 'react';
import type { Message } from '@/lib/types';
import { formatSize, formatDate, isImageType } from '@/lib/types';

interface TabChatProps {
    token: string;
    messages: Message[];
    currentEmployeeName: string;
    onNewMessage: (msg: Message) => void;
    showToast: (type: string, text: string) => void;
    chatEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function TabChat({ token, messages, currentEmployeeName, onNewMessage, showToast, chatEndRef }: TabChatProps) {
    const [msgText, setMsgText] = useState('');
    const [chatDragOver, setChatDragOver] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const handleSendMessage = async (file?: File) => {
        if (!msgText.trim() && !file) return;
        try {
            const formData = new FormData();
            formData.append('text', msgText); formData.append('sender', 'client');
            formData.append('sender_name', currentEmployeeName);
            if (file) formData.append('file', file);
            const res = await fetch(`/api/clients/${token}/messages`, { method: 'POST', body: formData });
            if (res.ok) { const msg = await res.json(); onNewMessage(msg); setMsgText(''); }
            else { const err = await res.json(); showToast('error', err.error || 'Ошибка отправки'); }
        } catch { showToast('error', 'Ошибка отправки'); }
    };

    return (
        <>
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

            {previewImage && (
                <div className="img-preview-overlay" onClick={() => setPreviewImage(null)}>
                    <img src={previewImage} alt="Просмотр" />
                </div>
            )}
        </>
    );
}
