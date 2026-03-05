'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';

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
    if (s === 'pending') return 'На проверке';
    if (s === 'accepted') return 'Принят';
    return 'Отклонён';
}

function Hint({ text }: { text: string }) {
    return <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2, lineHeight: 1.4 }}>{text}</span>;
}

export default function PortalPage() {
    const params = useParams();
    const token = params.token as string;

    const [client, setClient] = useState<Client | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [requiredDocs, setRequiredDocs] = useState<RequiredDoc[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: string; text: string } | null>(null);
    const [msgText, setMsgText] = useState('');
    const [activeTab, setActiveTab] = useState('info');

    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    const showToast = useCallback((type: string, text: string) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const [cRes, dRes, rRes, mRes] = await Promise.all([
                fetch(`/api/clients/${token}`),
                fetch(`/api/clients/${token}/documents`),
                fetch(`/api/clients/${token}/required-docs`),
                fetch(`/api/clients/${token}/messages`),
            ]);
            if (!cRes.ok) throw new Error('Client not found');
            setClient(await cRes.json());
            setDocuments(await dRes.json());
            setRequiredDocs(await rRes.json());
            setMessages(await mRes.json());
        } catch {
            setClient(null);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const [dRes, mRes] = await Promise.all([
                    fetch(`/api/clients/${token}/documents`),
                    fetch(`/api/clients/${token}/messages`),
                ]);
                if (dRes.ok) setDocuments(await dRes.json());
                if (mRes.ok) setMessages(await mRes.json());
            } catch { /* ignore */ }
        }, 10000);
        return () => clearInterval(interval);
    }, [token]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSaveClient = async () => {
        if (!client) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/clients/${token}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(client),
            });
            if (res.ok) {
                setClient(await res.json());
                showToast('success', 'Данные сохранены');
            }
        } catch {
            showToast('error', 'Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    const handleUpload = async (file: File, category: string) => {
        setUploading(category);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('category', category);
            const res = await fetch(`/api/clients/${token}/documents`, { method: 'POST', body: formData });
            if (res.ok) {
                const newDoc = await res.json();
                setDocuments(prev => [newDoc, ...prev]);
                showToast('success', 'Файл загружен');
            } else {
                const err = await res.json();
                showToast('error', err.error || 'Ошибка загрузки');
            }
        } catch {
            showToast('error', 'Ошибка загрузки');
        } finally {
            setUploading(null);
        }
    };

    const handleDropUpload = (e: React.DragEvent, category: string) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file, category);
    };

    const handleDeleteDoc = async (docId: number) => {
        try {
            const res = await fetch(`/api/clients/${token}/documents/${docId}`, { method: 'DELETE' });
            if (res.ok) {
                setDocuments(prev => prev.filter(d => d.id !== docId));
                showToast('success', 'Документ удалён');
            }
        } catch {
            showToast('error', 'Ошибка удаления');
        }
    };

    const handleSendMessage = async () => {
        if (!msgText.trim()) return;
        try {
            const res = await fetch(`/api/clients/${token}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: msgText, sender: 'client' }),
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

    const u = (field: keyof Client, value: string) => {
        setClient(prev => prev ? { ...prev, [field]: value } : prev);
    };

    if (loading) {
        return (
            <div className="page-wrapper" style={{ textAlign: 'center', paddingTop: '100px' }}>
                <div className="loader" style={{ width: 32, height: 32 }}></div>
                <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Загрузка...</p>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="page-wrapper" style={{ textAlign: 'center', paddingTop: '100px' }}>
                <h2>Ссылка недействительна</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Проверьте правильность ссылки или свяжитесь с менеджером.</p>
            </div>
        );
    }

    const getDocsForCategory = (category: string) => documents.filter(d => d.category === category);

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <h1>DocFlow — Личный кабинет</h1>
                <p>Заполните все разделы и загрузите необходимые документы. Если что-то непонятно — напишите менеджеру в разделе «Сообщения».</p>
            </div>

            <div className="tabs">
                <button className={`tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>Данные</button>
                <button className={`tab ${activeTab === 'docs' ? 'active' : ''}`} onClick={() => setActiveTab('docs')}>Документы</button>
                <button className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Сообщения</button>
            </div>

            {activeTab === 'info' && (
                <>
                    {/* ===== 1. Основные реквизиты ===== */}
                    <div className="card section-gap">
                        <div className="card-header">
                            <h2><span className="icon">|</span> Основные реквизиты</h2>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                            Заполните данные организации в соответствии с учредительными документами и выпиской из ЕГРЮЛ/ЕГРИП.
                        </p>
                        <div className="form-grid">
                            <div className="form-group full-width">
                                <label>Полное наименование организации</label>
                                <Hint text='Как в ЕГРЮЛ. Например: Общество с ограниченной ответственностью «СтройИнвест»' />
                                <input value={client.company_name} onChange={e => u('company_name', e.target.value)} placeholder='Общество с ограниченной ответственностью «Пример»' />
                            </div>
                            <div className="form-group">
                                <label>Сокращённое наименование</label>
                                <Hint text='Краткое название. Например: ООО «СтройИнвест»' />
                                <input value={client.short_name} onChange={e => u('short_name', e.target.value)} placeholder='ООО «Пример»' />
                            </div>
                            <div className="form-group">
                                <label>Организационно-правовая форма</label>
                                <Hint text="ООО, АО, ПАО, ИП, ГУП, МУП и т.д." />
                                <input value={client.legal_form} onChange={e => u('legal_form', e.target.value)} placeholder="ООО" />
                            </div>
                            <div className="form-group">
                                <label>ИНН</label>
                                <Hint text="10 цифр для юрлица, 12 для ИП" />
                                <input value={client.inn} onChange={e => u('inn', e.target.value)} placeholder="1234567890" />
                            </div>
                            <div className="form-group">
                                <label>КПП</label>
                                <Hint text="9 цифр, код причины постановки на учёт" />
                                <input value={client.kpp} onChange={e => u('kpp', e.target.value)} placeholder="123456789" />
                            </div>
                            <div className="form-group">
                                <label>ОГРН / ОГРНИП</label>
                                <Hint text="13 цифр для юрлица (ОГРН), 15 для ИП (ОГРНИП)" />
                                <input value={client.ogrn} onChange={e => u('ogrn', e.target.value)} placeholder="1234567890123" />
                            </div>
                            <div className="form-group">
                                <label>ОКПО</label>
                                <Hint text="Код по общероссийскому классификатору предприятий, 8 или 10 цифр" />
                                <input value={client.okpo} onChange={e => u('okpo', e.target.value)} placeholder="12345678" />
                            </div>
                            <div className="form-group">
                                <label>ОКВЭД (основной)</label>
                                <Hint text="Основной код вида экономической деятельности, например: 41.20" />
                                <input value={client.okved} onChange={e => u('okved', e.target.value)} placeholder="41.20" />
                            </div>
                            <div className="form-group">
                                <label>Дата регистрации</label>
                                <Hint text="Дата государственной регистрации юрлица" />
                                <input value={client.registration_date} onChange={e => u('registration_date', e.target.value)} placeholder="01.01.2020" />
                            </div>
                        </div>
                    </div>

                    {/* ===== 2. Адреса ===== */}
                    <div className="card section-gap">
                        <div className="card-header">
                            <h2><span className="icon">|</span> Адреса</h2>
                        </div>
                        <div className="form-grid">
                            <div className="form-group full-width">
                                <label>Юридический адрес</label>
                                <Hint text="Адрес регистрации по ЕГРЮЛ с индексом" />
                                <input value={client.legal_address} onChange={e => u('legal_address', e.target.value)} placeholder="123456, г. Москва, ул. Строителей, д. 1, оф. 101" />
                            </div>
                            <div className="form-group full-width">
                                <label>Фактический адрес</label>
                                <Hint text="Адрес, по которому фактически находится организация. Если совпадает с юридическим — укажите то же самое" />
                                <input value={client.actual_address} onChange={e => u('actual_address', e.target.value)} placeholder="Если совпадает с юридическим — укажите то же самое" />
                            </div>
                            <div className="form-group full-width">
                                <label>Почтовый адрес</label>
                                <Hint text="Адрес для корреспонденции, если отличается от юридического" />
                                <input value={client.postal_address} onChange={e => u('postal_address', e.target.value)} placeholder="Адрес для получения почтовой корреспонденции" />
                            </div>
                        </div>
                    </div>

                    {/* ===== 3. Банковские реквизиты ===== */}
                    <div className="card section-gap">
                        <div className="card-header">
                            <h2><span className="icon">|</span> Банковские реквизиты</h2>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                            Реквизиты расчётного счёта для составления договоров и выставления счетов.
                        </p>
                        <div className="form-grid">
                            <div className="form-group full-width">
                                <label>Наименование банка</label>
                                <Hint text='Полное название банка с указанием города. Например: ПАО «Сбербанк», г. Москва' />
                                <input value={client.bank_name} onChange={e => u('bank_name', e.target.value)} placeholder='ПАО «Сбербанк», г. Москва' />
                            </div>
                            <div className="form-group">
                                <label>Расчётный счёт</label>
                                <Hint text="20 цифр, начинается с 40702 для юрлиц" />
                                <input value={client.bank_account} onChange={e => u('bank_account', e.target.value)} placeholder="40702810000000000000" />
                            </div>
                            <div className="form-group">
                                <label>Корреспондентский счёт</label>
                                <Hint text="20 цифр, начинается с 30101" />
                                <input value={client.corr_account} onChange={e => u('corr_account', e.target.value)} placeholder="30101810000000000000" />
                            </div>
                            <div className="form-group">
                                <label>БИК</label>
                                <Hint text="Банковский идентификационный код, 9 цифр" />
                                <input value={client.bik} onChange={e => u('bik', e.target.value)} placeholder="044525225" />
                            </div>
                        </div>
                    </div>

                    {/* ===== 4. Руководство ===== */}
                    <div className="card section-gap">
                        <div className="card-header">
                            <h2><span className="icon">|</span> Руководство</h2>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>ФИО руководителя</label>
                                <Hint text="ФИО генерального директора или ИП" />
                                <input value={client.director_name} onChange={e => u('director_name', e.target.value)} placeholder="Иванов Иван Иванович" />
                            </div>
                            <div className="form-group">
                                <label>Должность руководителя</label>
                                <Hint text="Генеральный директор, Директор, Индивидуальный предприниматель" />
                                <input value={client.director_title} onChange={e => u('director_title', e.target.value)} placeholder="Генеральный директор" />
                            </div>
                            <div className="form-group full-width">
                                <label>Действует на основании</label>
                                <Hint text="Устав, Доверенность № и дата, Свидетельство о регистрации ИП" />
                                <input value={client.acts_on_basis} onChange={e => u('acts_on_basis', e.target.value)} placeholder="Устав" />
                            </div>
                        </div>
                    </div>

                    {/* ===== 5. Контактные данные ===== */}
                    <div className="card section-gap">
                        <div className="card-header">
                            <h2><span className="icon">|</span> Контактные данные</h2>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Контактное лицо</label>
                                <Hint text="ФИО ответственного за документооборот по проекту" />
                                <input value={client.contact_person} onChange={e => u('contact_person', e.target.value)} placeholder="Петров Пётр Петрович" />
                            </div>
                            <div className="form-group">
                                <label>Телефон</label>
                                <input value={client.phone} onChange={e => u('phone', e.target.value)} placeholder="+7 (999) 123-45-67" />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <Hint text="Основной адрес электронной почты" />
                                <input type="email" value={client.email} onChange={e => u('email', e.target.value)} placeholder="info@example.com" />
                            </div>
                            <div className="form-group">
                                <label>Факс</label>
                                <Hint text="Если есть факсимильная связь" />
                                <input value={client.fax} onChange={e => u('fax', e.target.value)} placeholder="+7 (495) 123-45-67" />
                            </div>
                            <div className="form-group full-width">
                                <label>Сайт</label>
                                <Hint text="Адрес официального сайта организации" />
                                <input value={client.website} onChange={e => u('website', e.target.value)} placeholder="https://example.com" />
                            </div>
                        </div>
                    </div>

                    {/* ===== 6. Дополнительные сведения ===== */}
                    <div className="card section-gap">
                        <div className="card-header">
                            <h2><span className="icon">|</span> Дополнительные сведения</h2>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Система налогообложения</label>
                                <Hint text="ОСНО, УСН (6% или 15%), ЕНВД, ПСН" />
                                <input value={client.tax_system} onChange={e => u('tax_system', e.target.value)} placeholder="ОСНО" />
                            </div>
                            <div className="form-group full-width">
                                <label>Наименование СРО</label>
                                <Hint text="Саморегулируемая организация, в которой состоит компания (для строительных работ)" />
                                <input value={client.sro_name} onChange={e => u('sro_name', e.target.value)} placeholder='Ассоциация «СРО Строителей»' />
                            </div>
                            <div className="form-group">
                                <label>Номер допуска / свидетельства СРО</label>
                                <Hint text="Регистрационный номер допуска к определённым видам работ" />
                                <input value={client.sro_number} onChange={e => u('sro_number', e.target.value)} placeholder="СРО-С-123-45678901" />
                            </div>
                        </div>
                    </div>

                    {/* ===== 7. Обоснование сметной стоимости ===== */}
                    <div className="card section-gap">
                        <div className="card-header">
                            <h2><span className="icon">|</span> Обоснование особенностей определения сметной стоимости</h2>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                            Укажите коэффициенты и условия, учитывающие особенности производства работ на вашем объекте.
                        </p>
                        <div className="form-group">
                            <label>Коэффициенты, учитывающие условия производства работ</label>
                            <Hint text="Стеснённость, вредность, высотность, зимнее удорожание, индексы-дефляторы. Например: К=1.15 за стеснённость (МДС 81-35.2004 п.4.7)" />
                            <textarea
                                value={client.cost_justification}
                                onChange={e => u('cost_justification', e.target.value)}
                                placeholder={"К=1.15 за стеснённость условий (МДС 81-35.2004 п.4.7)\nИндекс пересчёта в текущие цены — 8.34"}
                                style={{ minHeight: 120 }}
                            />
                        </div>
                    </div>

                    {/* ===== 8. Сведения об объекте ===== */}
                    <div className="card section-gap">
                        <div className="card-header">
                            <h2><span className="icon">|</span> Сведения об объекте</h2>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                            Заполните информацию об объекте строительства в соответствии с проектной документацией.
                        </p>
                        <div className="form-grid">
                            <div className="form-group full-width">
                                <label>Наименование объекта</label>
                                <Hint text="Полное название объекта строительства, как в проектной документации" />
                                <input value={client.object_name} onChange={e => u('object_name', e.target.value)} placeholder={'Жилой комплекс «Солнечный»'} />
                            </div>
                            <div className="form-group">
                                <label>Вид строительства</label>
                                <Hint text="Новое строительство, реконструкция, капитальный ремонт, техническое перевооружение, снос" />
                                <input value={client.construction_type} onChange={e => u('construction_type', e.target.value)} placeholder="Новое строительство" />
                            </div>
                            <div className="form-group">
                                <label>Почтовый (строительный) адрес</label>
                                <Hint text="Фактическое местоположение объекта строительства" />
                                <input value={client.object_address} onChange={e => u('object_address', e.target.value)} placeholder="г. Москва, ул. Примерная, д. 1" />
                            </div>
                            <div className="form-group full-width">
                                <label>Сведения об источнике и размере финансирования</label>
                                <Hint text="Источник (бюджет, частные инвестиции, кредит) и общий объём" />
                                <textarea value={client.financing_info} onChange={e => u('financing_info', e.target.value)} placeholder="Федеральный бюджет, 500 млн руб." />
                            </div>
                            <div className="form-group full-width">
                                <label>Сведения о функциональном назначении</label>
                                <Hint text="Жильё, торговля, промышленность, социальный объект и т.п." />
                                <textarea value={client.object_purpose} onChange={e => u('object_purpose', e.target.value)} placeholder="Многоквартирный жилой дом с нежилыми помещениями на первом этаже" />
                            </div>
                            <div className="form-group full-width">
                                <label>Технико-экономические показатели (ТЭП)</label>
                                <Hint text="Общая площадь, этажность, строительный объём, площадь застройки, количество квартир/помещений" />
                                <textarea
                                    value={client.tech_economic_indicators}
                                    onChange={e => u('tech_economic_indicators', e.target.value)}
                                    placeholder={"Общая площадь: 12 500 м²\nЭтажность: 16 этажей\nСтроительный объём: 45 000 м³"}
                                    style={{ minHeight: 100 }}
                                />
                            </div>
                            <div className="form-group full-width">
                                <label>Сведения о зданиях и сооружениях, входящих в состав объекта</label>
                                <Hint text="Все здания и сооружения: корпуса, паркинги, подстанции, инженерные сети" />
                                <textarea
                                    value={client.buildings_info}
                                    onChange={e => u('buildings_info', e.target.value)}
                                    placeholder={"1. Жилой дом — 16 этажей, 12 500 м²\n2. Подземный паркинг — 3 000 м²\n3. Трансформаторная подстанция"}
                                    style={{ minHeight: 100 }}
                                />
                            </div>
                        </div>
                    </div>

                    <button className="btn btn-primary" onClick={handleSaveClient} disabled={saving} style={{ marginTop: 8 }}>
                        {saving ? <><span className="loader"></span> Сохранение...</> : 'Сохранить все данные'}
                    </button>
                </>
            )}

            {activeTab === 'docs' && (
                <>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                        Загрузите каждый из требуемых документов. Нажмите на область загрузки или перетащите файл.
                    </p>

                    {requiredDocs.map(rd => {
                        const catDocs = getDocsForCategory(rd.doc_name);
                        const hasDoc = catDocs.length > 0;
                        return (
                            <div key={rd.id} className="card section-gap">
                                <div className="card-header">
                                    <h2><span className="icon">|</span> {rd.doc_name}</h2>
                                    {hasDoc && <span className="badge badge-accepted">Загружен</span>}
                                </div>
                                {rd.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{rd.description}</p>}

                                {catDocs.map(doc => {
                                    const fi = getFileIcon(doc.file_type);
                                    return (
                                        <div key={doc.id} className="doc-row">
                                            <div className={`file-icon ${fi.cls}`}>{fi.label}</div>
                                            <div className="doc-info">
                                                <div className="doc-name">{doc.original_name}</div>
                                                <div className="doc-meta">{formatSize(doc.file_size)} &middot; {formatDate(doc.uploaded_at)}</div>
                                                {doc.status === 'rejected' && doc.status_comment && (
                                                    <div className="doc-comment">Причина отклонения: {doc.status_comment}</div>
                                                )}
                                            </div>
                                            <div className="doc-actions">
                                                <span className={`badge badge-${doc.status}`}>{statusLabel(doc.status)}</span>
                                                <a href={`/api/clients/${token}/documents/${doc.id}`} className="btn btn-secondary btn-sm" download>Скачать</a>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDoc(doc.id)}>Удалить</button>
                                            </div>
                                        </div>
                                    );
                                })}

                                <div
                                    className={`dropzone dropzone-sm ${uploading === rd.doc_name ? 'drag-over' : ''}`}
                                    style={{ marginTop: catDocs.length > 0 ? 12 : 0 }}
                                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                                    onDrop={e => handleDropUpload(e, rd.doc_name)}
                                    onClick={() => fileInputRefs.current[rd.doc_name]?.click()}
                                >
                                    <input type="file" ref={el => { fileInputRefs.current[rd.doc_name] = el; }} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, rd.doc_name); e.target.value = ''; }} />
                                    {uploading === rd.doc_name ? <span className="loader"></span> : <span className="dropzone-icon">&uarr;</span>}
                                    <div>
                                        <div className="dropzone-text">{hasDoc ? 'Загрузить другой файл' : 'Нажмите или перетащите файл'}</div>
                                        <div className="dropzone-hint">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG — до 50 МБ</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <div className="card section-gap">
                        <div className="card-header"><h2><span className="icon">|</span> Прочие документы</h2></div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Дополнительные документы, которых нет в списке выше.</p>
                        {documents.filter(d => !requiredDocs.some(rd => rd.doc_name === d.category)).map(doc => {
                            const fi = getFileIcon(doc.file_type);
                            return (
                                <div key={doc.id} className="doc-row">
                                    <div className={`file-icon ${fi.cls}`}>{fi.label}</div>
                                    <div className="doc-info">
                                        <div className="doc-name">{doc.original_name}</div>
                                        <div className="doc-meta">{formatSize(doc.file_size)} &middot; {formatDate(doc.uploaded_at)}</div>
                                    </div>
                                    <div className="doc-actions">
                                        <span className={`badge badge-${doc.status}`}>{statusLabel(doc.status)}</span>
                                        <a href={`/api/clients/${token}/documents/${doc.id}`} className="btn btn-secondary btn-sm" download>Скачать</a>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDoc(doc.id)}>Удалить</button>
                                    </div>
                                </div>
                            );
                        })}
                        <div className="dropzone dropzone-sm" style={{ marginTop: 12 }}
                            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={e => handleDropUpload(e, 'Прочее')}
                            onClick={() => fileInputRefs.current['_other']?.click()}>
                            <input type="file" ref={el => { fileInputRefs.current['_other'] = el; }} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'Прочее'); e.target.value = ''; }} />
                            <span className="dropzone-icon">&uarr;</span>
                            <div>
                                <div className="dropzone-text">Загрузить дополнительный документ</div>
                                <div className="dropzone-hint">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG — до 50 МБ</div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'chat' && (
                <div className="card">
                    <div className="card-header"><h2><span className="icon">|</span> Переписка с менеджером</h2></div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Задайте вопрос менеджеру, если что-то непонятно.</p>
                    <div className="chat-container">
                        <div className="chat-messages">
                            {messages.length === 0 && <div className="empty-state"><p>Нет сообщений. Напишите менеджеру!</p></div>}
                            {messages.map(msg => (
                                <div key={msg.id} className={`chat-bubble ${msg.sender}`}>
                                    <div>{msg.text}</div>
                                    <div className="chat-time">{formatDate(msg.created_at)}</div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="chat-input-row">
                            <input value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="Введите сообщение..." onKeyDown={e => e.key === 'Enter' && handleSendMessage()} />
                            <button className="btn btn-primary" onClick={handleSendMessage}>Отправить</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.text}</div>}
        </div>
    );
}
