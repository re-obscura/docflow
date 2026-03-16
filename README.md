# DocFlow

**Платформа для обмена строительной документацией** между генподрядчиком и субподрядными организациями.

Позволяет управлять клиентами (субподрядчиками), их сотрудниками, объектами строительства, документооборотом и перепиской — всё в одном месте.

---

## Возможности

### Админ-панель
- Авторизация по паролю с rate-limiting и защитой от брутфорса
- Управление клиентами (CRUD) с поиском и пагинацией
- Просмотр/принятие/отклонение загруженных документов
- Чат с клиентами (текст + файлы)
- Управление требуемыми документами (чеклист для клиента)
- Журнал аудита всех действий

### Портал клиента
- Доступ по уникальной ссылке (UUID-токен)
- Авторизация сотрудников с паролем (bcrypt)
- Заполнение реквизитов компании (ИНН, КПП, ОГРН, банковские реквизиты и т.д.)
- Управление объектами строительства (множественные объекты)
- Загрузка документов с привязкой к объектам
- Чат с администратором (с вложениями)
- Управление сотрудниками

---

## Технологический стек

| Компонент | Технология |
|-----------|------------|
| Фреймворк | [Next.js 16](https://nextjs.org) (App Router) |
| Язык | TypeScript |
| База данных | SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)) |
| Аутентификация | Сессии в SQLite + bcrypt ([bcryptjs](https://github.com/dcodeIO/bcrypt.js)) |
| Тестирование | [Vitest](https://vitest.dev/) |
| Стилизация | Vanilla CSS |

---

## Структура проекта

```
docflow/
├── src/
│   ├── app/
│   │   ├── api/                    # REST API
│   │   │   ├── admin/              
│   │   │   │   ├── auth/           # POST — вход администратора
│   │   │   │   ├── audit/          # GET — журнал аудита
│   │   │   │   └── logout/         # POST — выход
│   │   │   └── clients/            
│   │   │       ├── route.ts        # GET/POST — список/создание клиентов
│   │   │       └── [token]/        
│   │   │           ├── route.ts    # GET/PUT/DELETE — клиент
│   │   │           ├── documents/  # GET/POST + [id] GET/DELETE/PATCH
│   │   │           ├── employees/  # GET/POST + [id] PUT/DELETE + auth/
│   │   │           ├── messages/   # GET/POST + [id] GET (вложения)
│   │   │           ├── objects/    # GET/POST + [id] GET/PUT/DELETE
│   │   │           └── required-docs/ # GET/POST + [id] DELETE
│   │   ├── admin/                  # Страница админ-панели
│   │   ├── portal/[token]/         # Портал клиента
│   │   │   ├── components/         # React-компоненты вкладок
│   │   │   └── hooks/              # Кастомные React-хуки
│   │   ├── layout.tsx              # Корневой layout
│   │   ├── page.tsx                # Landing page
│   │   └── globals.css             # Глобальные стили
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts            # Подключение к SQLite (singleton)
│   │   │   └── schema.ts           # Схема БД + миграции
│   │   ├── audit.ts                # Запись в журнал аудита
│   │   ├── constants.ts            # Константы (лимиты, дефолтные документы)
│   │   ├── helpers.ts              # Вспомогательные API-функции
│   │   ├── logger.ts               # Структурированный JSON-логгер
│   │   ├── security.ts             # Сессии, rate-limit, санитизация, валидация
│   │   └── types.ts                # TypeScript-интерфейсы + валидаторы
│   └── proxy.ts                    # Middleware для fast-reject
├── tests/                          # Тесты (Vitest)
│   ├── setup.ts                    # Настройка тестовой БД
│   ├── helpers.ts                  # Утилиты для тестов
│   ├── security.test.ts            # Тесты security-модуля (37 тестов)
│   ├── types.test.ts               # Тесты валидаторов и форматтеров (30 тестов)
│   ├── api-admin.test.ts           # Тесты admin API (5 тестов)
│   ├── api-clients.test.ts         # Тесты clients API (13 тестов)
│   ├── api-documents.test.ts       # Тесты documents API (12 тестов)
│   ├── api-employees.test.ts       # Тесты employees API (9 тестов)
│   ├── api-messages.test.ts        # Тесты messages API (9 тестов)
│   └── api-objects.test.ts         # Тесты objects API (9 тестов)
├── data/                           # SQLite БД (в .gitignore)
├── uploads/                        # Загруженные файлы (в .gitignore)
├── public/                         # Статические ресурсы
├── .env.example                    # Пример переменных окружения
├── next.config.ts                  # Конфигурация Next.js
├── vitest.config.ts                # Конфигурация Vitest
├── tsconfig.json                   # Конфигурация TypeScript
└── package.json
```

---

## Установка и запуск

### Требования
- Node.js 18+
- npm

### 1. Клонирование
```bash
git clone https://github.com/re-obscura/docflow.git
cd docflow
```

### 2. Установка зависимостей
```bash
npm install
```

### 3. Настройка окружения
```bash
cp .env.example .env
```

Отредактируйте `.env` — обязательно задайте `ADMIN_PASSWORD`:
```env
ADMIN_PASSWORD=ваш_надёжный_пароль
PORT=3000
NODE_ENV=production
```

### 4. Запуск в режиме разработки
```bash
npm run dev
```

Приложение доступно по адресу: [http://localhost:3000](http://localhost:3000)

### 5. Сборка для продакшена
```bash
npm run build
npm start
```

---

## Тестирование

Проект содержит **124 теста** (8 тест-сьютов):

```bash
# Запуск всех тестов
npm test

# Запуск в watch-режиме
npm run test:watch
```

Тесты покрывают:
- **Security** — сессии, rate-limiting, санитизация, валидация токенов, проверка файлов, хеширование паролей, миграция паролей
- **Types** — валидаторы ИНН/КПП/ОГРН/БИК/счетов, форматирование дат/размеров, определение иконок файлов
- **API** — полные CRUD-тесты для всех сущностей (клиенты, документы, сотрудники, сообщения, объекты)

---

## API

Все эндпоинты возвращают JSON. Формат ошибки: `{ "error": "сообщение" }`.

### Аутентификация администратора

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/admin/auth` | Вход (тело: `{ password }`) → `{ token }` |
| POST | `/api/admin/logout` | Выход (заголовок: `Authorization: Bearer <token>`) |
| GET | `/api/admin/audit` | Журнал аудита (`?client_id=&limit=&offset=`) |

### Клиенты (требуется admin-токен)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/clients` | Список клиентов (`?q=&limit=&offset=`) |
| POST | `/api/clients` | Создать клиента (`{ company_name, contact_person }`) |
| GET | `/api/clients/:token` | Получить клиента |
| PUT | `/api/clients/:token` | Обновить реквизиты |
| DELETE | `/api/clients/:token` | Удалить клиента (admin) |

### Сотрудники

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/clients/:token/employees` | Список сотрудников |
| POST | `/api/clients/:token/employees` | Добавить сотрудника |
| PUT | `/api/clients/:token/employees/:id` | Обновить сотрудника |
| DELETE | `/api/clients/:token/employees/:id` | Удалить сотрудника |
| POST | `/api/clients/:token/employees/auth` | Авторизация сотрудника |

### Объекты строительства

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/clients/:token/objects` | Список объектов |
| POST | `/api/clients/:token/objects` | Создать объект |
| GET | `/api/clients/:token/objects/:id` | Получить объект |
| PUT | `/api/clients/:token/objects/:id` | Обновить объект |
| DELETE | `/api/clients/:token/objects/:id` | Удалить объект |

### Документы

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/clients/:token/documents` | Список документов (`?object_id=`) |
| POST | `/api/clients/:token/documents` | Загрузить документ (multipart/form-data) |
| GET | `/api/clients/:token/documents/:id` | Скачать документ |
| DELETE | `/api/clients/:token/documents/:id` | Удалить документ |
| PATCH | `/api/clients/:token/documents/:id` | Изменить статус (admin) |

### Сообщения

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/clients/:token/messages` | Список сообщений |
| POST | `/api/clients/:token/messages` | Отправить сообщение (JSON или multipart) |
| GET | `/api/clients/:token/messages/:id` | Скачать вложение |

### Требуемые документы

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/clients/:token/required-docs` | Список (`?object_id=`) |
| POST | `/api/clients/:token/required-docs` | Добавить (admin) |
| DELETE | `/api/clients/:token/required-docs/:id` | Удалить (admin) |

---

## База данных

SQLite с автоматической инициализацией и миграциями. Таблицы:

- **clients** — клиенты (реквизиты, контакты, адреса, банковские данные, СРО)
- **employees** — сотрудники клиентов (с паролями bcrypt)
- **objects** — объекты строительства
- **documents** — загруженные документы (привязка к клиенту и объекту)
- **required_docs** — чеклист требуемых документов
- **messages** — переписка (с вложениями)
- **audit_log** — журнал аудита
- **admin_sessions** — сессии администратора

Миграции выполняются автоматически при старте (добавление новых колонок, перенос данных из legacy-полей).

---

## Безопасность

- **Аутентификация**: сессии в SQLite (8 часов TTL) + bcrypt для паролей сотрудников
- **Rate limiting**: защита от брутфорса на login (5 попыток/мин), API-эндпоинты (20–30 запросов/мин)
- **Санитизация**: все входные данные очищаются от HTML/XSS, ограничены по длине
- **Валидация файлов**: проверка MIME-типа и расширения, лимит 50 МБ
- **Защита от path traversal**: `path.basename()` + `path.resolve()` проверки
- **HTTP-заголовки**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- **Timing-safe сравнение**: пароль администратора сравнивается через `crypto.timingSafeEqual`
- **Автомиграция паролей**: legacy plain-text пароли автоматически мигрируются в bcrypt при входе

---

## Разрешённые типы файлов

PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG

---

## Переменные окружения

| Переменная | Описание | Обязательная |
|------------|----------|:---:|
| `ADMIN_PASSWORD` | Пароль администратора | ✅ |
| `PORT` | Порт сервера (по умолчанию 3000) | ❌ |
| `NODE_ENV` | Режим (`development` / `production`) | ❌ |

---

## Лицензия

Проприетарное ПО. Все права защищены.
