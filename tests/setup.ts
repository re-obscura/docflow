// Global test setup
import { rmSync, mkdirSync } from 'fs';
import path from 'path';

// Set test environment
process.env.ADMIN_PASSWORD = 'test_admin_password_123';
(process.env as Record<string, string>).NODE_ENV = 'test';

// Use a separate test database
const TEST_DATA_DIR = path.join(process.cwd(), 'data-test');
const TEST_UPLOAD_DIR = path.join(process.cwd(), 'uploads-test');

// Clean up before tests
try { rmSync(TEST_DATA_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
try { rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
mkdirSync(TEST_DATA_DIR, { recursive: true });
mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
