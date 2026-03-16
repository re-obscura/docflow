'use client';

import type { Client } from '@/lib/types';
import { validateINN, validateKPP, validateOGRN, validateBIK, validateAccount } from '@/lib/types';

interface TabInfoProps {
    client: Client;
    saving: boolean;
    hasUnsavedChanges: boolean;
    onFieldChange: (field: keyof Client, value: string) => void;
    onSave: () => void;
}

export default function TabInfo({ client, saving, hasUnsavedChanges, onFieldChange, onSave }: TabInfoProps) {
    const u = (field: keyof Client, value: string) => onFieldChange(field, value);

    return (
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

            <button className={`btn btn-primary ${hasUnsavedChanges ? 'btn-unsaved' : ''}`} onClick={onSave} disabled={saving} style={{ marginTop: 8 }}>
                {saving ? 'Сохранение...' : hasUnsavedChanges ? 'Сохранить изменения' : 'Сохранить реквизиты'}
            </button>
        </>
    );
}
