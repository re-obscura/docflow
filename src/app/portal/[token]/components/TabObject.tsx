'use client';

import type { ObjectItem } from '@/lib/types';

interface TabObjectProps {
    selectedObject: ObjectItem | null;
    saving: boolean;
    onFieldChange: (field: keyof ObjectItem, value: string) => void;
    onSave: () => void;
}

export default function TabObject({ selectedObject, saving, onFieldChange, onSave }: TabObjectProps) {
    if (!selectedObject) return null;

    const u = (field: keyof ObjectItem, value: string) => onFieldChange(field, value);

    return (
        <div className="card">
            <div className="card-title">Сведения об объекте</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                Заполните информацию о строительном объекте. Эти данные используются при формировании документации.
            </p>
            <div className="form-grid">
                <div className="form-group full-width"><label>Наименование объекта</label><input value={selectedObject.object_name} onChange={e => u('object_name', e.target.value)} placeholder='Например: Жилой дом «Солнечный», корпуc 3' /><span className="hint">Укажите краткое, понятное название для идентификации объекта</span></div>
                <div className="form-group full-width"><label>Адрес объекта</label><input value={selectedObject.object_address} onChange={e => u('object_address', e.target.value)} placeholder="Город, район, улица, номер участка" /></div>
                <div className="form-group full-width"><label>Назначение объекта</label><input value={selectedObject.object_purpose} onChange={e => u('object_purpose', e.target.value)} placeholder="Жилое, промышленное, коммерческое..." /></div>
                <div className="form-group full-width"><label>Технико-экономические показатели</label><textarea value={selectedObject.tech_economic_indicators} onChange={e => u('tech_economic_indicators', e.target.value)} placeholder="Общая площадь, этажность, количество квартир/помещений, год постройки" /><span className="hint">Основные параметры объекта, которые могут потребоваться для документации</span></div>
                <div className="form-group full-width"><label>Тип строительства</label><input value={selectedObject.construction_type} onChange={e => u('construction_type', e.target.value)} placeholder="Новое строительство, реконструкция, капитальный ремонт" /></div>
                <div className="form-group full-width"><label>Финансирование</label><textarea value={selectedObject.financing_info} onChange={e => u('financing_info', e.target.value)} placeholder="Источники финансирования, бюджет, контрактная стоимость" /></div>
                <div className="form-group full-width"><label>Здания и сооружения</label><textarea value={selectedObject.buildings_info} onChange={e => u('buildings_info', e.target.value)} placeholder="Перечень зданий и сооружений, входящих в состав объекта" /></div>
                <div className="form-group full-width"><label>Обоснование стоимости</label><textarea value={selectedObject.cost_justification} onChange={e => u('cost_justification', e.target.value)} placeholder="Обоснование сметной стоимости строительства" /></div>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onSave} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить данные объекта'}
            </button>
        </div>
    );
}
