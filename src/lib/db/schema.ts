import Database from 'better-sqlite3';

export function createTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,

      -- Основные реквизиты
      company_name TEXT DEFAULT '',
      short_name TEXT DEFAULT '',
      legal_form TEXT DEFAULT '',
      inn TEXT DEFAULT '',
      kpp TEXT DEFAULT '',
      ogrn TEXT DEFAULT '',
      okpo TEXT DEFAULT '',
      okved TEXT DEFAULT '',
      registration_date TEXT DEFAULT '',

      -- Адреса
      legal_address TEXT DEFAULT '',
      actual_address TEXT DEFAULT '',
      postal_address TEXT DEFAULT '',

      -- Банковские реквизиты
      bank_name TEXT DEFAULT '',
      bank_account TEXT DEFAULT '',
      corr_account TEXT DEFAULT '',
      bik TEXT DEFAULT '',

      -- Руководство
      director_name TEXT DEFAULT '',
      director_title TEXT DEFAULT '',
      acts_on_basis TEXT DEFAULT '',

      -- Контакты
      contact_person TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      fax TEXT DEFAULT '',
      website TEXT DEFAULT '',

      -- Дополнительно
      tax_system TEXT DEFAULT '',
      sro_name TEXT DEFAULT '',
      sro_number TEXT DEFAULT '',

      -- Объект
      object_name TEXT DEFAULT '',
      object_address TEXT DEFAULT '',
      object_purpose TEXT DEFAULT '',
      tech_economic_indicators TEXT DEFAULT '',
      construction_type TEXT DEFAULT '',
      financing_info TEXT DEFAULT '',
      buildings_info TEXT DEFAULT '',
      cost_justification TEXT DEFAULT '',

      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      category TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      status_comment TEXT DEFAULT '',
      uploaded_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS required_docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      doc_name TEXT NOT NULL,
      description TEXT DEFAULT '',
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      sender TEXT NOT NULL DEFAULT 'client',
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
  `);

  // Migration: add columns for existing databases
  const cols = db.prepare("PRAGMA table_info(clients)").all() as { name: string }[];
  const colNames = new Set(cols.map(c => c.name));
  const newCols = [
    'short_name', 'legal_form', 'ogrn', 'okpo', 'okved', 'registration_date',
    'actual_address', 'postal_address',
    'bank_name', 'bank_account', 'corr_account', 'bik',
    'director_name', 'director_title', 'acts_on_basis',
    'fax', 'website', 'tax_system', 'sro_name', 'sro_number',
    'construction_type', 'financing_info', 'buildings_info', 'cost_justification',
  ];
  for (const col of newCols) {
    if (!colNames.has(col)) {
      db.exec(`ALTER TABLE clients ADD COLUMN ${col} TEXT DEFAULT ''`);
    }
  }
}
