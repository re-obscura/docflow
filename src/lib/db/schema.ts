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

      -- Объект (legacy – данные мигрируются в objects)
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

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      full_name TEXT DEFAULT '',
      position TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      password TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS objects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      object_name TEXT DEFAULT '',
      object_address TEXT DEFAULT '',
      object_purpose TEXT DEFAULT '',
      tech_economic_indicators TEXT DEFAULT '',
      construction_type TEXT DEFAULT '',
      financing_info TEXT DEFAULT '',
      buildings_info TEXT DEFAULT '',
      cost_justification TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      object_id INTEGER,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      category TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      status_comment TEXT DEFAULT '',
      uploaded_by_employee_id INTEGER,
      uploaded_by_name TEXT DEFAULT '',
      uploaded_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS required_docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      object_id INTEGER,
      doc_name TEXT NOT NULL,
      description TEXT DEFAULT '',
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      sender TEXT NOT NULL DEFAULT 'client',
      sender_name TEXT DEFAULT '',
      text TEXT NOT NULL DEFAULT '',
      attachment_filename TEXT DEFAULT '',
      attachment_original_name TEXT DEFAULT '',
      attachment_type TEXT DEFAULT '',
      attachment_size INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      actor_name TEXT DEFAULT '',
      actor_type TEXT DEFAULT 'admin',
      action TEXT NOT NULL,
      entity_type TEXT DEFAULT '',
      entity_id INTEGER,
      details TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );
  `);

  // ─── Migrations for existing databases ───
  const addColumnIfMissing = (table: string, col: string, type: string = "TEXT DEFAULT ''") => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some(c => c.name === col)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    }
  };

  // clients table migrations
  const clientNewCols = [
    'short_name', 'legal_form', 'ogrn', 'okpo', 'okved', 'registration_date',
    'actual_address', 'postal_address',
    'bank_name', 'bank_account', 'corr_account', 'bik',
    'director_name', 'director_title', 'acts_on_basis',
    'fax', 'website', 'tax_system', 'sro_name', 'sro_number',
    'construction_type', 'financing_info', 'buildings_info', 'cost_justification',
  ];
  for (const col of clientNewCols) {
    addColumnIfMissing('clients', col);
  }

  // documents + required_docs: add object_id
  addColumnIfMissing('documents', 'object_id', 'INTEGER');
  addColumnIfMissing('required_docs', 'object_id', 'INTEGER');

  // employees: add password
  addColumnIfMissing('employees', 'password');

  // documents: add uploaded_by fields
  addColumnIfMissing('documents', 'uploaded_by_employee_id', 'INTEGER');
  addColumnIfMissing('documents', 'uploaded_by_name');

  // messages: add sender_name + attachment columns
  addColumnIfMissing('messages', 'sender_name');
  addColumnIfMissing('messages', 'attachment_filename');
  addColumnIfMissing('messages', 'attachment_original_name');
  addColumnIfMissing('messages', 'attachment_type');
  addColumnIfMissing('messages', 'attachment_size', 'INTEGER DEFAULT 0');

  // ─── Migrate legacy object_* data from clients → objects ───
  migrateObjectData(db);
}

function migrateObjectData(db: Database.Database) {
  // Find clients that have object data but no corresponding objects row
  const clientsWithObjects = db.prepare(`
    SELECT c.id, c.object_name, c.object_address, c.object_purpose,
           c.tech_economic_indicators, c.construction_type, c.financing_info,
           c.buildings_info, c.cost_justification
    FROM clients c
    WHERE (c.object_name != '' AND c.object_name IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM objects o WHERE o.client_id = c.id)
  `).all() as {
    id: number; object_name: string; object_address: string;
    object_purpose: string; tech_economic_indicators: string;
    construction_type: string; financing_info: string;
    buildings_info: string; cost_justification: string;
  }[];

  if (clientsWithObjects.length === 0) return;

  const insertObj = db.prepare(`
    INSERT INTO objects (client_id, object_name, object_address, object_purpose,
      tech_economic_indicators, construction_type, financing_info, buildings_info, cost_justification)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateDocs = db.prepare(`UPDATE documents SET object_id = ? WHERE client_id = ? AND object_id IS NULL`);
  const updateReqDocs = db.prepare(`UPDATE required_docs SET object_id = ? WHERE client_id = ? AND object_id IS NULL`);

  const migrate = db.transaction(() => {
    for (const c of clientsWithObjects) {
      const result = insertObj.run(
        c.id, c.object_name, c.object_address, c.object_purpose,
        c.tech_economic_indicators, c.construction_type, c.financing_info,
        c.buildings_info, c.cost_justification,
      );
      const objectId = result.lastInsertRowid;
      updateDocs.run(objectId, c.id);
      updateReqDocs.run(objectId, c.id);
    }
  });

  migrate();
}
