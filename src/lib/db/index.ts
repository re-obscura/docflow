import Database from 'better-sqlite3';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { createTables } from './schema';

const DB_PATH = path.join(process.cwd(), 'data', 'database.sqlite');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (!db) {
        const dir = path.dirname(DB_PATH);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        createTables(db);
    }
    return db;
}
