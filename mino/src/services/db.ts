/**
 * MINO-SMS Local Offline Database Engine
 * Built on Dexie.js (IndexedDB wrapper) with hardware-accelerated encrypted storage.
 */

import Dexie, { type Table } from 'dexie';
import type { OutboxItem, Student, Subject, TeacherScoreExportRecord } from '../types';

export interface LocalEncryptedRecord {
  id: string;
  schoolId: string;
  entityType: 'student' | 'score' | 'ledger' | 'class' | 'subject';
  secondaryKey?: string; // e.g. admissionNo, or studentId+subjectId
  cipherHex: string;
  ivHex: string;
  isDeleted: number; // 0 or 1 for indexing
  updatedAt: string;
}

export interface LocalVaultConfig {
  id: string;
  saltHex: string;
  canaryCipherHex: string;
  canaryIvHex: string;
  isConfigured: boolean;
  updatedAt: string;
}

export interface LocalOfflineScoreRecord extends TeacherScoreExportRecord {
  synced: number; // 0 = saved offline (unsynced), 1 = synced with server
  deviceId: string;
}

export class MinoOfflineDatabase extends Dexie {
  vault_meta!: Table<LocalVaultConfig, string>;
  encrypted_records!: Table<LocalEncryptedRecord, string>;
  outbox!: Table<OutboxItem, number>;
  offline_scores!: Table<LocalOfflineScoreRecord, string>;
  cached_students!: Table<Student, string>;
  cached_subjects!: Table<Subject, string>;

  constructor() {
    super('mino_sms_offline_vault_v1');
    this.version(1).stores({
      vault_meta: '&id',
      encrypted_records: '&id, [schoolId+entityType], entityType, secondaryKey, isDeleted, updatedAt',
      outbox: '++id, &clientChangeId, schoolId, entity, status, timestamp'
    });
    this.version(2).stores({
      vault_meta: '&id',
      encrypted_records: '&id, [schoolId+entityType], entityType, secondaryKey, isDeleted, updatedAt',
      outbox: '++id, &clientChangeId, schoolId, entity, status, timestamp',
      offline_scores: '&recordKey, schoolId, [schoolId+session+term], [schoolId+classArm+subjectId+session+term], studentId, subjectId, synced, recordedAt',
      cached_students: '&id, schoolId, [schoolId+classArm], admissionNo',
      cached_subjects: '&id, schoolId, code'
    });
  }
}

export const localDb = new MinoOfflineDatabase();

/**
 * Get device fingerprint or generate persistent device identifier
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem('mino_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
    localStorage.setItem('mino_device_id', deviceId);
  }
  return deviceId;
}
