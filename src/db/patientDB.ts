import type { Ticket } from '../types';

const DB_NAME = 'MediQueueER';
const DB_VERSION = 1;
const STORE_NAME = 'dailyRecords';

export interface DailyRecord {
  id: string; // date string YYYY-MM-DD
  date: string;
  patients: SerializedTicket[];
  totalPatients: number;
  totalCompleted: number;
  totalNoShow: number;
  totalDeceased: number;
  avgWaitTime: number; // minutes
  savedAt: string;
}

// Tickets with dates serialized as strings for IndexedDB storage
export interface SerializedTicket {
  id: string;
  ticketNumber: string;
  patientName: string;
  age?: number;
  service: string;
  priority: string;
  status: string;
  createdAt: string;
  triagedAt: string;
  calledAt?: string;
  completedAt?: string;
  estimatedWait: number;
  counterNumber?: number;
  notes?: string;
  chiefComplaint?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function serializeTicket(ticket: Ticket): SerializedTicket {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    patientName: ticket.patientName,
    age: ticket.age,
    service: ticket.service,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: new Date(ticket.createdAt).toISOString(),
    triagedAt: new Date(ticket.triagedAt).toISOString(),
    calledAt: ticket.calledAt ? new Date(ticket.calledAt).toISOString() : undefined,
    completedAt: ticket.completedAt ? new Date(ticket.completedAt).toISOString() : undefined,
    estimatedWait: ticket.estimatedWait,
    counterNumber: ticket.counterNumber,
    notes: ticket.notes,
    chiefComplaint: ticket.chiefComplaint,
  };
}

export async function saveDailyRecord(tickets: Ticket[]): Promise<DailyRecord> {
  const db = await openDB();
  const today = new Date().toISOString().slice(0, 10);

  const record: DailyRecord = {
    id: today,
    date: today,
    patients: tickets.map(serializeTicket),
    totalPatients: tickets.length,
    totalCompleted: tickets.filter(t => t.status === 'completed').length,
    totalNoShow: tickets.filter(t => t.status === 'no-show').length,
    totalDeceased: tickets.filter(t => t.status === 'deceased').length,
    avgWaitTime: (() => {
      const withWait = tickets.filter(t => t.calledAt && t.createdAt);
      if (withWait.length === 0) return 0;
      const total = withWait.reduce((sum, t) => {
        return sum + (new Date(t.calledAt!).getTime() - new Date(t.createdAt).getTime()) / 60000;
      }, 0);
      return Math.round(total / withWait.length);
    })(),
    savedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllRecords(): Promise<DailyRecord[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const records = request.result as DailyRecord[];
      records.sort((a, b) => b.date.localeCompare(a.date));
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getRecordByDate(date: string): Promise<DailyRecord | undefined> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(date);
    request.onsuccess = () => resolve(request.result as DailyRecord | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecord(date: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(date);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
