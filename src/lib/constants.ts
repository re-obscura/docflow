// Shared constants for DocFlow

export const DEFAULT_REQUIRED_DOCS = [
    { doc_name: 'Техническое задание', description: 'Техническое задание на выполнение работ' },
    { doc_name: 'Транспортная схема вывоза мусора', description: 'Схема транспортировки и вывоза строительного мусора' },
    { doc_name: 'Письмо о включении затрат в сводный сметный расчёт', description: 'Письмо о включении затрат в сводный сметный расчёт стоимости строительства (лимитированные затраты)' },
] as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const UPLOAD_DIR_NAME = 'uploads';
