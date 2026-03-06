import { getDb } from '@/lib/db';

export function logAudit(
    clientId: number | null,
    actorName: string,
    actorType: 'admin' | 'employee',
    action: string,
    entityType: string = '',
    entityId: number | null = null,
    details: string = '',
) {
    try {
        const db = getDb();
        db.prepare(`
            INSERT INTO audit_log (client_id, actor_name, actor_type, action, entity_type, entity_id, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(clientId, actorName, actorType, action, entityType, entityId, details);
    } catch {
        // Don't let audit logging break the main flow
    }
}
