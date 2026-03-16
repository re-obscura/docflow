// Shared API helpers for DocFlow route handlers

import type Database from 'better-sqlite3';
import { NextResponse } from 'next/server';

interface ClientRow {
    id: number;
}

/**
 * Look up client by token. Returns { id } or undefined.
 */
export function getClientByToken(db: Database.Database, token: string): ClientRow | undefined {
    return db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as ClientRow | undefined;
}

/**
 * Shorthand for returning a JSON error response.
 */
export function apiError(message: string, status: number): NextResponse {
    return NextResponse.json({ error: message }, { status });
}
