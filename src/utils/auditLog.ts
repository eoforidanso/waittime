import { collection, addDoc, query, orderBy, limit, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AuditEntry {
  id?: string;
  uid: string;
  displayName: string;
  action: string;
  summary: string;
  timestamp: number;
}

export type AuditUser = { uid: string; displayName: string } | null;

/** Fire-and-forget — writes one entry to the audit_log collection */
export function logAudit(user: AuditUser, action: string, summary: string): void {
  if (!user) return;
  addDoc(collection(db, 'audit_log'), {
    uid: user.uid,
    displayName: user.displayName || user.uid,
    action,
    summary,
    timestamp: Date.now(),
  }).catch(() => { /* offline — skip silently */ });
}

/** Subscribe to the latest N audit entries in real-time */
export function subscribeAuditLog(
  maxEntries: number,
  callback: (entries: AuditEntry[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'audit_log'),
    orderBy('timestamp', 'desc'),
    limit(maxEntries),
  );
  return onSnapshot(q, snap => {
    callback(
      snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AuditEntry, 'id'>) })),
    );
  }, () => callback([]));
}
