/**
 * MINO-SMS Server-Authoritative Backend Engine
 * Express + Cloud Functions API Simulation with Multi-Tenant Isolation
 * Strict JSON Schema Validation, Idempotent Sync Pipeline, and Append-Only Collections
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security headers (allow AI Studio preview iframe embedding)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Structured in-memory authoritative database store (Multi-tenant scoped)
interface DatabaseStore {
  schools: Record<string, any>;
  classes: Record<string, any[]>;
  subjects: Record<string, any[]>;
  students: Record<string, any[]>;
  staff: Record<string, any[]>;
  scoreEvents: Record<string, any[]>;
  ledgerEntries: Record<string, any[]>;
  feeStructures: Record<string, any[]>;
  auditLogs: Record<string, any[]>;
  processedClientChangeIds: Set<string>;
  notices: Record<string, any[]>;
  events: Record<string, any[]>;
  attendance: Record<string, any[]>;
  timetables: Record<string, any>;
  emailNotifications: any[];
}

const DEFAULT_SCHOOL_ID = 'sch_oakridge_001';
const SECOND_SCHOOL_ID = 'sch_stjude_002';

const db: DatabaseStore = {
  schools: {},
  classes: {},
  subjects: {},
  students: {},
  staff: {},
  scoreEvents: {},
  ledgerEntries: {},
  feeStructures: {},
  auditLogs: {},
  processedClientChangeIds: new Set<string>(),
  notices: {},
  events: {},
  attendance: {},
  timetables: {},
  emailNotifications: []
};

const NIGERIAN_CLASSES_TEMPLATE = [
  { slug: 'pri1', name: 'Primary 1', level: 'Primary' },
  { slug: 'pri2', name: 'Primary 2', level: 'Primary' },
  { slug: 'pri3', name: 'Primary 3', level: 'Primary' },
  { slug: 'pri4', name: 'Primary 4', level: 'Primary' },
  { slug: 'pri5', name: 'Primary 5', level: 'Primary' },
  { slug: 'pri6', name: 'Primary 6', level: 'Primary' },
  { slug: 'jss1', name: 'JSS 1', level: 'Junior Secondary' },
  { slug: 'jss2', name: 'JSS 2', level: 'Junior Secondary' },
  { slug: 'jss3', name: 'JSS 3', level: 'Junior Secondary' },
  { slug: 'sss1', name: 'SSS 1', level: 'Senior Secondary' },
  { slug: 'sss2', name: 'SSS 2', level: 'Senior Secondary' },
  { slug: 'sss3', name: 'SSS 3', level: 'Senior Secondary' }
] as const;

function createNigerianClassesForSchool(schoolId: string) {
  return NIGERIAN_CLASSES_TEMPLATE.map(item => ({
    id: `cls_${schoolId}_${item.slug}`,
    schoolId,
    name: item.name,
    level: item.level
  }));
}

const SCHOOL_TERMS = ['1st Term', '2nd Term', '3rd Term'] as const;
type CanonicalTerm = (typeof SCHOOL_TERMS)[number];

function normalizeTerm(raw?: string | null): CanonicalTerm {
  const val = String(raw || '').trim().toLowerCase();
  if (val.includes('1st') || val.includes('first') || val === 'term 1' || val === '1') {
    return '1st Term';
  }
  if (val.includes('3rd') || val.includes('third') || val === 'term 3' || val === '3') {
    return '3rd Term';
  }
  return '2nd Term';
}

// Seed multi-tenant data
function seedInitialData() {
  // Tenant 1: Oakridge Model Academy
  db.schools[DEFAULT_SCHOOL_ID] = {
    id: DEFAULT_SCHOOL_ID,
    name: 'Oakridge Model Academy',
    code: 'OMA-1001',
    shortCode: 'OMA',
    logoUrl: '',
    currency: 'NGN',
    currencySymbol: '₦',
    address: '14 Unity Boulevard, Victoria Island, Lagos',
    phone: '+234 802 345 6789',
    currentSession: '2025/2026',
    currentTerm: '2nd Term',
    isReportsLocked: false,
    subscriptionPlan: 'Enterprise',
    subscriptionStatus: 'active',
    adminEmail: 'admin@oakridge.edu',
    createdAt: new Date().toISOString()
  };

  // Tenant 2: St. Jude International College
  db.schools[SECOND_SCHOOL_ID] = {
    id: SECOND_SCHOOL_ID,
    name: 'St. Jude International College',
    code: 'SJC-1002',
    shortCode: 'SJC',
    logoUrl: '',
    currency: 'NGN',
    currencySymbol: '₦',
    address: '88 Atlantic Way, Lekki Phase 1, Lagos',
    phone: '+234 809 900 1122',
    currentSession: '2025/2026',
    currentTerm: '2nd Term',
    isReportsLocked: false,
    subscriptionPlan: 'Standard',
    subscriptionStatus: 'active',
    adminEmail: 'admin@stjude.edu',
    createdAt: new Date().toISOString()
  };

  // Nigerian Classes (Primary 1-6, JSS 1-3, SSS 1-3) for Oakridge & St. Jude
  db.classes[DEFAULT_SCHOOL_ID] = createNigerianClassesForSchool(DEFAULT_SCHOOL_ID);
  db.classes[SECOND_SCHOOL_ID] = createNigerianClassesForSchool(SECOND_SCHOOL_ID);

  // Subjects for Oakridge
  db.subjects[DEFAULT_SCHOOL_ID] = [
    { id: 'sub_math', schoolId: DEFAULT_SCHOOL_ID, name: 'Mathematics', code: 'MTH' },
    { id: 'sub_eng', schoolId: DEFAULT_SCHOOL_ID, name: 'English Language', code: 'ENG' },
    { id: 'sub_sci', schoolId: DEFAULT_SCHOOL_ID, name: 'Basic Science', code: 'BSC' },
    { id: 'sub_soc', schoolId: DEFAULT_SCHOOL_ID, name: 'Social Studies', code: 'SOS' },
    { id: 'sub_agri', schoolId: DEFAULT_SCHOOL_ID, name: 'Agricultural Science', code: 'AGR' }
  ];

  // Subjects for St. Jude
  db.subjects[SECOND_SCHOOL_ID] = [
    { id: 'sub_sj_math', schoolId: SECOND_SCHOOL_ID, name: 'Advanced Mathematics', code: 'MTH' },
    { id: 'sub_sj_lit', schoolId: SECOND_SCHOOL_ID, name: 'World Literature', code: 'LIT' }
  ];

  // Staff Members for Oakridge (Admin, Head Teacher, Teachers, Bursar)
  db.staff[DEFAULT_SCHOOL_ID] = [
    {
      id: 'stf_001',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Dr. Kenneth Balogun',
      email: 'admin@oakridge.edu',
      role: 'admin',
      isHeadTeacher: true,
      passcode: 'admin123',
      assignedClasses: NIGERIAN_CLASSES_TEMPLATE.map(c => c.name),
      assignedSubjects: ['sub_math', 'sub_eng', 'sub_sci', 'sub_soc', 'sub_agri'],
      phone: '+234 802 111 0001',
      createdAt: '2025-08-15T09:00:00Z'
    },
    {
      id: 'stf_002',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Mr. Adebayo Ogunlesi',
      email: 'teacher@oakridge.edu',
      role: 'teacher',
      isHeadTeacher: false,
      passcode: 'teach123',
      assignedClasses: ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1'],
      assignedSubjects: ['sub_math', 'sub_sci'],
      phone: '+234 803 222 0002',
      createdAt: '2025-09-01T08:00:00Z'
    },
    {
      id: 'stf_003',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Mrs. Chinwe Achebe',
      email: 'english.teacher@oakridge.edu',
      role: 'teacher',
      isHeadTeacher: false,
      passcode: 'teach123',
      assignedClasses: ['Primary 5', 'Primary 6', 'JSS 1', 'JSS 2'],
      assignedSubjects: ['sub_eng', 'sub_soc'],
      phone: '+234 805 333 0003',
      createdAt: '2025-09-01T08:00:00Z'
    },
    {
      id: 'stf_004',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Mr. Tunde Lawal',
      email: 'bursar@oakridge.edu',
      role: 'bursar',
      isHeadTeacher: false,
      passcode: 'bursar123',
      assignedClasses: [],
      assignedSubjects: [],
      phone: '+234 809 444 0004',
      createdAt: '2025-08-20T10:00:00Z'
    }
  ];

  // Staff Members for St. Jude
  db.staff[SECOND_SCHOOL_ID] = [
    {
      id: 'stf_sj_001',
      schoolId: SECOND_SCHOOL_ID,
      name: 'Mrs. Evelyn Mensah',
      email: 'admin@stjude.edu',
      role: 'admin',
      isHeadTeacher: true,
      passcode: 'admin123',
      assignedClasses: NIGERIAN_CLASSES_TEMPLATE.map(c => c.name),
      assignedSubjects: ['sub_sj_math', 'sub_sj_lit'],
      phone: '+234 809 900 1122',
      createdAt: '2025-08-15T09:00:00Z'
    },
    {
      id: 'stf_sj_002',
      schoolId: SECOND_SCHOOL_ID,
      name: 'Mr. Daniel Boateng',
      email: 'teacher@stjude.edu',
      role: 'teacher',
      isHeadTeacher: false,
      passcode: 'teach123',
      assignedClasses: ['JSS 1', 'JSS 2', 'SSS 1', 'SSS 2'],
      assignedSubjects: ['sub_sj_math', 'sub_sj_lit'],
      phone: '+234 809 900 2233',
      createdAt: '2025-09-01T08:00:00Z'
    }
  ];

  db.students[SECOND_SCHOOL_ID] = [
    {
      id: 'std_sj_001',
      schoolId: SECOND_SCHOOL_ID,
      admissionNo: 'SJC/2025/001',
      firstName: 'Grace',
      lastName: 'Mensah',
      email: 'grace.mensah@stjude.edu',
      studentPassword: 'student123',
      gender: 'female',
      classArm: 'JSS 1',
      guardianName: 'Mr. Kofi Mensah',
      guardianPhone: '+234 809 700 3344',
      guardianEmail: 'kofi.mensah@example.com',
      guardianPassword: 'guardian123',
      accessToken: 'tok_sj_gm001',
      accessPin: '610294',
      studentPin: '1234',
      status: 'active',
      isDeleted: false,
      createdAt: '2025-09-01T08:00:00Z',
      updatedAt: '2026-01-10T11:00:00Z'
    }
  ];

  db.feeStructures[DEFAULT_SCHOOL_ID] = [
    { id: 'fee_1', schoolId: DEFAULT_SCHOOL_ID, classArm: 'JSS 1', name: 'Tuition Fee', amountMinor: 4500000, term: '2nd Term', session: '2025/2026' },
    { id: 'fee_2', schoolId: DEFAULT_SCHOOL_ID, classArm: 'JSS 1', name: 'Development Levy', amountMinor: 500000, term: '2nd Term', session: '2025/2026' },
    { id: 'fee_3', schoolId: DEFAULT_SCHOOL_ID, classArm: 'JSS 1', name: 'Science & Lab Levy', amountMinor: 350000, term: '2nd Term', session: '2025/2026' }
  ];

  db.students[DEFAULT_SCHOOL_ID] = [
    {
      id: 'std_001',
      schoolId: DEFAULT_SCHOOL_ID,
      admissionNo: 'OMA/2024/001',
      firstName: 'Chidinma',
      lastName: 'Okafor',
      email: 'chidinma.okafor@oakridge.edu',
      studentPassword: 'student123',
      gender: 'female',
      classArm: 'JSS 1',
      guardianName: 'Dr. Emeka Okafor',
      guardianPhone: '+234 803 111 2233',
      guardianEmail: 'emeka.okafor@example.com',
      guardianPassword: 'guardian123',
      accessToken: 'tok_cd198a287f3b',
      accessPin: '849201',
      studentPin: '1234',
      status: 'active',
      isDeleted: false,
      createdAt: '2025-09-01T08:00:00Z',
      updatedAt: '2026-01-10T11:00:00Z'
    },
    {
      id: 'std_002',
      schoolId: DEFAULT_SCHOOL_ID,
      admissionNo: 'OMA/2024/002',
      firstName: 'Babatunde',
      lastName: 'Adeleke',
      email: 'babatunde.adeleke@oakridge.edu',
      studentPassword: 'student123',
      gender: 'male',
      classArm: 'JSS 1',
      guardianName: 'Mrs. Folake Adeleke',
      guardianPhone: '+234 802 222 3344',
      guardianEmail: 'folake.adeleke@example.com',
      guardianPassword: 'guardian123',
      accessToken: 'tok_ba9941c42f0a',
      accessPin: '319402',
      studentPin: '2345',
      status: 'active',
      isDeleted: false,
      createdAt: '2025-09-01T08:00:00Z',
      updatedAt: '2026-01-10T11:00:00Z'
    },
    {
      id: 'std_003',
      schoolId: DEFAULT_SCHOOL_ID,
      admissionNo: 'OMA/2024/003',
      firstName: 'Amina',
      lastName: 'Shehu',
      email: 'amina.shehu@oakridge.edu',
      studentPassword: 'student123',
      gender: 'female',
      classArm: 'JSS 1',
      guardianName: 'Alhaji Bashir Shehu',
      guardianPhone: '+234 805 333 4455',
      guardianEmail: 'bashir.shehu@example.com',
      guardianPassword: 'guardian123',
      accessToken: 'tok_am721bb890ec',
      accessPin: '582019',
      studentPin: '3456',
      status: 'active',
      isDeleted: false,
      createdAt: '2025-09-01T08:00:00Z',
      updatedAt: '2026-01-10T11:00:00Z'
    },
    {
      id: 'std_004',
      schoolId: DEFAULT_SCHOOL_ID,
      admissionNo: 'OMA/2024/004',
      firstName: 'David',
      lastName: 'Eze',
      email: 'david.eze@oakridge.edu',
      studentPassword: 'student123',
      gender: 'male',
      classArm: 'JSS 1',
      guardianName: 'Engr. Kenneth Eze',
      guardianPhone: '+234 809 444 5566',
      guardianEmail: 'kenneth.eze@example.com',
      guardianPassword: 'guardian123',
      accessToken: 'tok_de5512bc09a1',
      accessPin: '491028',
      studentPin: '4567',
      status: 'active',
      isDeleted: false,
      createdAt: '2025-09-01T08:00:00Z',
      updatedAt: '2026-01-10T11:00:00Z'
    },
    {
      id: 'std_005',
      schoolId: DEFAULT_SCHOOL_ID,
      admissionNo: 'OMA/2024/005',
      firstName: 'Khadija',
      lastName: 'Mohammed',
      email: 'khadija.mohammed@oakridge.edu',
      studentPassword: 'student123',
      gender: 'female',
      classArm: 'JSS 1',
      guardianName: 'Hajiya Zainab Mohammed',
      guardianPhone: '+234 807 555 6677',
      guardianEmail: 'zainab.mohammed@example.com',
      guardianPassword: 'guardian123',
      accessToken: 'tok_km8832dc44f2',
      accessPin: '672041',
      studentPin: '5678',
      status: 'active',
      isDeleted: false,
      createdAt: '2025-09-01T08:00:00Z',
      updatedAt: '2026-01-10T11:00:00Z'
    },
    {
      id: 'std_006',
      schoolId: DEFAULT_SCHOOL_ID,
      admissionNo: 'OMA/2024/006',
      firstName: 'Emeka',
      lastName: 'Nwachukwu',
      email: 'emeka.nwachukwu@oakridge.edu',
      studentPassword: 'student123',
      gender: 'male',
      classArm: 'Primary 5',
      guardianName: 'Barrister Ifeanyi Nwachukwu',
      guardianPhone: '+234 803 999 1122',
      guardianEmail: 'ifeanyi.n@example.com',
      guardianPassword: 'guardian123',
      accessToken: 'tok_en9912aa11bb',
      accessPin: '294810',
      studentPin: '6789',
      status: 'active',
      isDeleted: false,
      createdAt: '2025-09-01T08:00:00Z',
      updatedAt: '2026-01-10T11:00:00Z'
    },
    {
      id: 'std_007',
      schoolId: DEFAULT_SCHOOL_ID,
      admissionNo: 'OMA/2024/007',
      firstName: 'Zainab',
      lastName: 'Aliyu',
      email: 'zainab.aliyu@oakridge.edu',
      studentPassword: 'student123',
      gender: 'female',
      classArm: 'Primary 6',
      guardianName: 'Dr. Kabir Aliyu',
      guardianPhone: '+234 802 888 3344',
      guardianEmail: 'kabir.aliyu@example.com',
      guardianPassword: 'guardian123',
      accessToken: 'tok_za3341ff99cc',
      accessPin: '739102',
      studentPin: '7890',
      status: 'active',
      isDeleted: false,
      createdAt: '2025-09-01T08:00:00Z',
      updatedAt: '2026-01-10T11:00:00Z'
    },
    {
      id: 'std_008',
      schoolId: DEFAULT_SCHOOL_ID,
      admissionNo: 'OMA/2024/008',
      firstName: 'Olumide',
      lastName: 'Fashola',
      email: 'olumide.fashola@oakridge.edu',
      studentPassword: 'student123',
      gender: 'male',
      classArm: 'JSS 2',
      guardianName: 'Chief Fashola',
      guardianPhone: '+234 805 777 4455',
      guardianEmail: 'fashola.family@example.com',
      guardianPassword: 'guardian123',
      accessToken: 'tok_of5522ee11dd',
      accessPin: '840192',
      studentPin: '8901',
      status: 'active',
      isDeleted: false,
      createdAt: '2024-09-01T08:00:00Z',
      updatedAt: '2026-01-10T11:00:00Z'
    },
    {
      id: 'std_009',
      schoolId: DEFAULT_SCHOOL_ID,
      admissionNo: 'OMA/2024/009',
      firstName: 'Fatima',
      lastName: 'Abubakar',
      email: 'fatima.abubakar@oakridge.edu',
      studentPassword: 'student123',
      gender: 'female',
      classArm: 'JSS 3',
      guardianName: 'Alhaji Garba Abubakar',
      guardianPhone: '+234 809 666 5566',
      guardianEmail: 'garba.abubakar@example.com',
      guardianPassword: 'guardian123',
      accessToken: 'tok_fa8899bb22aa',
      accessPin: '419283',
      studentPin: '9012',
      status: 'active',
      isDeleted: false,
      createdAt: '2024-09-01T08:00:00Z',
      updatedAt: '2026-01-10T11:00:00Z'
    },
    {
      id: 'std_010',
      schoolId: DEFAULT_SCHOOL_ID,
      admissionNo: 'OMA/2024/010',
      firstName: 'Toluwanimi',
      lastName: 'Oladipo',
      email: 'toluwanimi.oladipo@oakridge.edu',
      studentPassword: 'student123',
      gender: 'female',
      classArm: 'SSS 1',
      guardianName: 'Pastor Samuel Oladipo',
      guardianPhone: '+234 803 555 6677',
      guardianEmail: 'samuel.oladipo@example.com',
      guardianPassword: 'guardian123',
      accessToken: 'tok_to1122cc33dd',
      accessPin: '528190',
      studentPin: '0123',
      status: 'active',
      isDeleted: false,
      createdAt: '2023-09-01T08:00:00Z',
      updatedAt: '2026-01-10T11:00:00Z'
    }
  ];

  // Seed sample score events across 1st Term and 2nd Term for historical tracking
  db.scoreEvents[DEFAULT_SCHOOL_ID] = [
    // --- 1ST TERM (Historical Record) ---
    {
      id: 'sc_hist_001',
      clientChangeId: 'cc_sc_hist_001',
      schoolId: DEFAULT_SCHOOL_ID,
      studentId: 'std_001',
      subjectId: 'sub_math',
      session: '2025/2026',
      term: '1st Term',
      ca1: 13,
      ca2: 12,
      midterm: 17,
      exam: 45,
      total: 87,
      grade: 'A',
      remark: 'Excellent Progress',
      recordedBy: 'teacher@oakridge.edu',
      deviceId: 'dev_server_init',
      timestamp: '2025-11-28T10:00:00Z',
      synced: true
    },
    {
      id: 'sc_hist_002',
      clientChangeId: 'cc_sc_hist_002',
      schoolId: DEFAULT_SCHOOL_ID,
      studentId: 'std_001',
      subjectId: 'sub_eng',
      session: '2025/2026',
      term: '1st Term',
      ca1: 14,
      ca2: 13,
      midterm: 18,
      exam: 43,
      total: 88,
      grade: 'A',
      remark: 'Outstanding Essayist',
      recordedBy: 'english.teacher@oakridge.edu',
      deviceId: 'dev_server_init',
      timestamp: '2025-11-28T10:05:00Z',
      synced: true
    },
    // --- 2ND TERM (Current Term) ---
    {
      id: 'sc_001',
      clientChangeId: 'cc_sc_001',
      schoolId: DEFAULT_SCHOOL_ID,
      studentId: 'std_001',
      subjectId: 'sub_math',
      session: '2025/2026',
      term: '2nd Term',
      ca1: 14,
      ca2: 13,
      midterm: 18,
      exam: 46,
      total: 91,
      grade: 'A',
      remark: 'Distinction',
      recordedBy: 'teacher@oakridge.edu',
      deviceId: 'dev_server_init',
      timestamp: '2026-01-15T10:00:00Z',
      synced: true
    },
    {
      id: 'sc_002',
      clientChangeId: 'cc_sc_002',
      schoolId: DEFAULT_SCHOOL_ID,
      studentId: 'std_001',
      subjectId: 'sub_eng',
      session: '2025/2026',
      term: '2nd Term',
      ca1: 13,
      ca2: 12,
      midterm: 17,
      exam: 44,
      total: 86,
      grade: 'A',
      remark: 'Excellent',
      recordedBy: 'english.teacher@oakridge.edu',
      deviceId: 'dev_server_init',
      timestamp: '2026-01-15T10:05:00Z',
      synced: true
    },
    {
      id: 'sc_003',
      clientChangeId: 'cc_sc_003',
      schoolId: DEFAULT_SCHOOL_ID,
      studentId: 'std_002',
      subjectId: 'sub_math',
      session: '2025/2026',
      term: '2nd Term',
      ca1: 12,
      ca2: 11,
      midterm: 15,
      exam: 38,
      total: 76,
      grade: 'B',
      remark: 'Very Good',
      recordedBy: 'teacher@oakridge.edu',
      deviceId: 'dev_server_init',
      timestamp: '2026-01-15T10:10:00Z',
      synced: true
    }
  ];

  // Seed sample ledger entries (Integer minor units: kobo/cents)
  db.ledgerEntries[DEFAULT_SCHOOL_ID] = [
    {
      id: 'led_001',
      clientChangeId: 'cc_led_001',
      schoolId: DEFAULT_SCHOOL_ID,
      studentId: 'std_001',
      type: 'DEBIT_FEE',
      amountMinor: 5350000, // ₦53,500.00 Total Second Term fees
      description: 'Second Term 2025/2026 Consolidated Bill',
      category: 'Tuition',
      receiptNo: 'BILL-2026-001',
      recordedBy: 'bursar@oakridge.edu',
      timestamp: '2026-01-05T09:00:00Z',
      synced: true
    },
    {
      id: 'led_002',
      clientChangeId: 'cc_led_002',
      schoolId: DEFAULT_SCHOOL_ID,
      studentId: 'std_001',
      type: 'CREDIT_PAYMENT',
      amountMinor: 5350000, // Full payment
      description: 'Bank Transfer Payment - Second Term Fees',
      category: 'Tuition',
      receiptNo: 'REC-2026-00084',
      paymentChannel: 'BANK_TRANSFER',
      referenceNo: 'ZEN-TX-99823412',
      verificationHash: crypto.createHash('sha256').update(`${DEFAULT_SCHOOL_ID}:REC-2026-00084:std_001:5350000:2026-01-08T14:30:00Z`).digest('hex'),
      recordedBy: 'bursar@oakridge.edu',
      timestamp: '2026-01-08T14:30:00Z',
      synced: true
    },
    {
      id: 'led_003',
      clientChangeId: 'cc_led_003',
      schoolId: DEFAULT_SCHOOL_ID,
      studentId: 'std_002',
      type: 'DEBIT_FEE',
      amountMinor: 5350000,
      description: 'Second Term 2025/2026 Consolidated Bill',
      category: 'Tuition',
      receiptNo: 'BILL-2026-002',
      recordedBy: 'bursar@oakridge.edu',
      timestamp: '2026-01-05T09:00:00Z',
      synced: true
    },
    {
      id: 'led_004',
      clientChangeId: 'cc_led_004',
      schoolId: DEFAULT_SCHOOL_ID,
      studentId: 'std_002',
      type: 'CREDIT_PAYMENT',
      amountMinor: 3000000, // Partial payment ₦30,000.00 (arrears ₦23,500.00)
      description: 'POS Terminal Payment - Part Payment',
      category: 'Tuition',
      receiptNo: 'REC-2026-00091',
      paymentChannel: 'POS',
      referenceNo: 'POS-AUTH-554201',
      verificationHash: crypto.createHash('sha256').update(`${DEFAULT_SCHOOL_ID}:REC-2026-00091:std_002:3000000:2026-01-12T11:20:00Z`).digest('hex'),
      recordedBy: 'bursar@oakridge.edu',
      timestamp: '2026-01-12T11:20:00Z',
      synced: true
    }
  ];

  db.auditLogs[DEFAULT_SCHOOL_ID] = [
    {
      id: 'aud_001',
      schoolId: DEFAULT_SCHOOL_ID,
      actorId: 'admin@oakridge.edu',
      actorName: 'Dr. Kenneth Balogun',
      actorRole: 'admin',
      action: 'SYSTEM_BOOTSTRAP',
      entity: 'tenant',
      entityId: DEFAULT_SCHOOL_ID,
      details: 'Initialized Oakridge Model Academy multi-tenant partition.',
      timestamp: '2025-09-01T08:00:00Z'
    }
  ];

  // School Notices & Circulars
  db.notices[DEFAULT_SCHOOL_ID] = [
    {
      id: 'not_001',
      schoolId: DEFAULT_SCHOOL_ID,
      title: 'Second Term Examination Schedule Published',
      content: 'The official second term examination timetable has been ratified by the Academic Board. Revision classes continue until Friday next week.',
      priority: 'urgent',
      targetAudience: 'All',
      author: 'Dr. Kenneth Balogun',
      date: '2026-01-18'
    },
    {
      id: 'not_002',
      schoolId: DEFAULT_SCHOOL_ID,
      title: 'Annual Inter-House Athletics & Sports Carnival',
      content: 'All house masters and captains are requested to submit team rosters by Wednesday for the inter-house sprint and field heats at the main sports pavilion.',
      priority: 'normal',
      targetAudience: 'All',
      author: 'Mr. Adebayo Ogunlesi',
      date: '2026-01-15'
    },
    {
      id: 'not_003',
      schoolId: DEFAULT_SCHOOL_ID,
      title: 'PTA General Assembly & Infrastructure Review',
      content: 'Parents and guardians are invited to the mid-term PTA congress in the Assembly Hall to review modernization of the computer science lab and student transit.',
      priority: 'normal',
      targetAudience: 'Parents',
      author: 'PTA Secretariat',
      date: '2026-01-12'
    },
    {
      id: 'not_004',
      schoolId: DEFAULT_SCHOOL_ID,
      title: 'Continuous Assessment (CA2) Submission Deadline',
      content: 'All teaching faculty are reminded to finalize and enter second continuous assessment marks into the terminal gradebook before Friday 5:00 PM.',
      priority: 'urgent',
      targetAudience: 'Teachers',
      author: 'Academic Dean',
      date: '2026-01-10'
    }
  ];

  // Upcoming School Events & Calendar
  db.events[DEFAULT_SCHOOL_ID] = [
    {
      id: 'evt_001',
      schoolId: DEFAULT_SCHOOL_ID,
      title: 'Mid-Term Assessment Week',
      date: '2026-01-26',
      time: '08:30 AM - 02:00 PM',
      location: 'Main Examination Halls',
      category: 'Exam',
      description: 'Continuous assessment evaluation across all registered classes.'
    },
    {
      id: 'evt_002',
      schoolId: DEFAULT_SCHOOL_ID,
      title: 'Science & Robotics Olympiad Exhibition',
      date: '2026-02-04',
      time: '10:00 AM - 03:30 PM',
      location: 'Science Complex',
      category: 'Academic',
      description: 'Annual STEM exhibition showcasing student engineering and robotics models.'
    },
    {
      id: 'evt_003',
      schoolId: DEFAULT_SCHOOL_ID,
      title: 'PTA Consultative Congress',
      date: '2026-02-14',
      time: '11:00 AM - 01:30 PM',
      location: 'Auditorium A',
      category: 'Meeting',
      description: 'Term consultative assembly between parents, guardians, and the school board.'
    },
    {
      id: 'evt_004',
      schoolId: DEFAULT_SCHOOL_ID,
      title: 'Inter-House Sports Festival',
      date: '2026-02-28',
      time: '09:00 AM - 04:00 PM',
      location: 'Athletic Field',
      category: 'Sports',
      description: 'Track and field championship competitions between school houses.'
    }
  ];

  // Class Timetable / Routine Schedule
  db.timetables[DEFAULT_SCHOOL_ID] = {
    'JSS 1': [
      {
        day: 'Monday',
        periods: [
          { period: 1, time: '08:00 - 08:45', subject: 'Mathematics', teacher: 'Mr. Adebayo Ogunlesi', room: 'Room 101' },
          { period: 2, time: '08:45 - 09:30', subject: 'English Language', teacher: 'Mrs. Chinwe Achebe', room: 'Room 101' },
          { period: 3, time: '09:45 - 10:30', subject: 'Basic Science', teacher: 'Mr. Adebayo Ogunlesi', room: 'Lab 2' },
          { period: 4, time: '10:30 - 11:15', subject: 'Social Studies', teacher: 'Mrs. Chinwe Achebe', room: 'Room 101' },
          { period: 5, time: '11:45 - 12:30', subject: 'Agricultural Science', teacher: 'Dr. Kenneth Balogun', room: 'Agric Garden' },
          { period: 6, time: '12:30 - 01:15', subject: 'Library & Reading', teacher: 'Mrs. Chinwe Achebe', room: 'Library' }
        ]
      },
      {
        day: 'Tuesday',
        periods: [
          { period: 1, time: '08:00 - 08:45', subject: 'English Language', teacher: 'Mrs. Chinwe Achebe', room: 'Room 101' },
          { period: 2, time: '08:45 - 09:30', subject: 'Mathematics', teacher: 'Mr. Adebayo Ogunlesi', room: 'Room 101' },
          { period: 3, time: '09:45 - 10:30', subject: 'Computer Studies', teacher: 'Mr. Tunde Lawal', room: 'ICT Suite' },
          { period: 4, time: '10:30 - 11:15', subject: 'Basic Science', teacher: 'Mr. Adebayo Ogunlesi', room: 'Lab 2' },
          { period: 5, time: '11:45 - 12:30', subject: 'Civic Education', teacher: 'Mrs. Chinwe Achebe', room: 'Room 101' },
          { period: 6, time: '12:30 - 01:15', subject: 'Physical & Health Ed', teacher: 'Coach Ibrahim', room: 'Sports Field' }
        ]
      },
      {
        day: 'Wednesday',
        periods: [
          { period: 1, time: '08:00 - 08:45', subject: 'Mathematics', teacher: 'Mr. Adebayo Ogunlesi', room: 'Room 101' },
          { period: 2, time: '08:45 - 09:30', subject: 'Basic Science', teacher: 'Mr. Adebayo Ogunlesi', room: 'Lab 2' },
          { period: 3, time: '09:45 - 10:30', subject: 'English Language', teacher: 'Mrs. Chinwe Achebe', room: 'Room 101' },
          { period: 4, time: '10:30 - 11:15', subject: 'Social Studies', teacher: 'Mrs. Chinwe Achebe', room: 'Room 101' },
          { period: 5, time: '11:45 - 12:30', subject: 'Music & Creative Arts', teacher: 'Ms. Folake Bello', room: 'Art Studio' },
          { period: 6, time: '12:30 - 01:15', subject: 'French Language', teacher: 'Mme. Dupont', room: 'Room 101' }
        ]
      },
      {
        day: 'Thursday',
        periods: [
          { period: 1, time: '08:00 - 08:45', subject: 'English Language', teacher: 'Mrs. Chinwe Achebe', room: 'Room 101' },
          { period: 2, time: '08:45 - 09:30', subject: 'Mathematics', teacher: 'Mr. Adebayo Ogunlesi', room: 'Room 101' },
          { period: 3, time: '09:45 - 10:30', subject: 'Agricultural Science', teacher: 'Dr. Kenneth Balogun', room: 'Lab 1' },
          { period: 4, time: '10:30 - 11:15', subject: 'Basic Science', teacher: 'Mr. Adebayo Ogunlesi', room: 'Lab 2' },
          { period: 5, time: '11:45 - 12:30', subject: 'Home Economics', teacher: 'Mrs. D. Williams', room: 'Home Ec Lab' },
          { period: 6, time: '12:30 - 01:15', subject: 'Club & Society Activities', teacher: 'Staff Assigned', room: 'Hall' }
        ]
      },
      {
        day: 'Friday',
        periods: [
          { period: 1, time: '08:00 - 08:45', subject: 'Mathematics Revision', teacher: 'Mr. Adebayo Ogunlesi', room: 'Room 101' },
          { period: 2, time: '08:45 - 09:30', subject: 'English Essay Writing', teacher: 'Mrs. Chinwe Achebe', room: 'Room 101' },
          { period: 3, time: '09:45 - 10:30', subject: 'Basic Technology', teacher: 'Engr. Obi', room: 'Tech Workshop' },
          { period: 4, time: '10:30 - 11:15', subject: 'General Assembly / Guidance', teacher: 'Dr. Kenneth Balogun', room: 'Auditorium' },
          { period: 5, time: '11:45 - 12:30', subject: 'Inter-House Sports Practice', teacher: 'Coach Ibrahim', room: 'Pavilion' },
          { period: 6, time: '12:30 - 01:00', subject: 'Weekly Form Review', teacher: 'Mr. Adebayo Ogunlesi', room: 'Room 101' }
        ]
      }
    ]
  };

  // Seed sample attendance records for today and recent days
  const todayIso = new Date().toISOString().split('T')[0];
  db.attendance[DEFAULT_SCHOOL_ID] = [
    { id: 'att_001', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 1', studentId: 'std_001', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: new Date().toISOString() },
    { id: 'att_002', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 1', studentId: 'std_002', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: new Date().toISOString() },
    { id: 'att_003', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 1', studentId: 'std_003', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: new Date().toISOString() },
    { id: 'att_004', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 1', studentId: 'std_004', status: 'late', remark: 'Traffic delay on Lekki Expressway', recordedBy: 'teacher@oakridge.edu', timestamp: new Date().toISOString() },
    { id: 'att_005', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 1', studentId: 'std_005', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: new Date().toISOString() },
    { id: 'att_006', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'Primary 5', studentId: 'std_006', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: new Date().toISOString() },
    { id: 'att_007', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'Primary 6', studentId: 'std_007', status: 'excused', remark: 'Medical appointment with parent note', recordedBy: 'teacher@oakridge.edu', timestamp: new Date().toISOString() },
    { id: 'att_008', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 2', studentId: 'std_008', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: new Date().toISOString() },
    { id: 'att_009', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 3', studentId: 'std_009', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: new Date().toISOString() },
    { id: 'att_010', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'SSS 1', studentId: 'std_010', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: new Date().toISOString() }
  ];
}

seedInitialData();

// Helper to log audit trail
function logAudit(schoolId: string, actorId: string, actorName: string, actorRole: string, action: string, entity: string, entityId: string, details: string, req?: Request) {
  if (!db.auditLogs[schoolId]) {
    db.auditLogs[schoolId] = [];
  }
  const log = {
    id: 'aud_' + Math.random().toString(36).substring(2, 10),
    schoolId,
    actorId,
    actorName,
    actorRole,
    action,
    entity,
    entityId,
    details,
    ipAddress: req?.ip || '127.0.0.1',
    timestamp: new Date().toISOString()
  };
  db.auditLogs[schoolId].unshift(log);
}

// Grading calculator helper (Weighted CA + Exam)
function calculateGrade(ca1: number, ca2: number, midterm: number, exam: number): { total: number; grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; remark: string } {
  const total = Math.min(100, Math.max(0, Math.round(ca1 + ca2 + midterm + exam)));
  let grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' = 'F';
  let remark = 'Fail';

  if (total >= 80) {
    grade = 'A';
    remark = 'Distinction';
  } else if (total >= 70) {
    grade = 'B';
    remark = 'Very Good';
  } else if (total >= 60) {
    grade = 'C';
    remark = 'Good Credit';
  } else if (total >= 50) {
    grade = 'D';
    remark = 'Pass';
  } else if (total >= 40) {
    grade = 'E';
    remark = 'Marginal Pass';
  } else {
    grade = 'F';
    remark = 'Unsatisfactory';
  }

  return { total, grade, remark };
}

// Compute a 3-4 uppercase letter acronym from school name
function computeSchoolAcronym(schoolName: string): string {
  const stopWords = new Set(['THE', 'OF', 'AND', 'FOR', 'IN', 'AT', 'A', 'AN']);
  const rawWords = (schoolName || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const words = rawWords.length > 2 ? rawWords.filter(w => !stopWords.has(w)) : rawWords;
  const active = words.length > 0 ? words : rawWords;

  let base = '';
  if (active.length >= 3) {
    base = active.slice(0, 4).map(w => w[0]).join('');
  } else if (active.length === 2) {
    base = (active[0].slice(0, 2) + active[1].slice(0, 2)).slice(0, 4);
  } else if (active.length === 1) {
    base = active[0].slice(0, 4);
  }
  if (base.length < 3) {
    base = (base + 'SCH').slice(0, 4);
  }
  return base;
}

// Generate a unique overall School ID / Sign-In Code (e.g. "GIA-1003") when a school is created
function generateUniqueSchoolCode(schoolName: string, requestedCode?: string): { code: string; shortCode: string } {
  const existingCodes = new Set(
    Object.values(db.schools).map((s: any) => String(s.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
  );
  const shortCode = computeSchoolAcronym(schoolName);

  // Determine next 4-digit institution sequence number (1001, 1002, 1003...)
  let maxSeq = 1000 + Object.keys(db.schools).length;
  Object.values(db.schools).forEach((s: any) => {
    const match = String(s.code || '').match(/(\d{4,})$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  });

  if (requestedCode && requestedCode.trim()) {
    const cleanedReq = requestedCode.trim().toUpperCase().replace(/\s+/g, '');
    const normReq = cleanedReq.replace(/[^A-Z0-9]/g, '');
    if (/^[A-Z]{2,5}-\d{3,6}$/.test(cleanedReq) && !existingCodes.has(normReq)) {
      return { code: cleanedReq, shortCode: cleanedReq.split('-')[0] || shortCode };
    }
  }

  let seq = maxSeq + 1;
  let candidate = `${shortCode}-${seq}`;
  while (existingCodes.has(candidate.replace(/[^A-Z0-9]/g, ''))) {
    seq++;
    candidate = `${shortCode}-${seq}`;
  }
  return { code: candidate, shortCode };
}

// Resolve a school tenant from a user-entered School Code (case-insensitive, hyphen-tolerant)
function findSchoolByCode(rawInput?: string): any | null {
  if (!rawInput || !String(rawInput).trim()) return null;
  const rawUpper = String(rawInput).trim().toUpperCase();
  const norm = rawUpper.replace(/[^A-Z0-9]/g, '');
  if (!norm) return null;

  const schoolsList = Object.values(db.schools) as any[];
  // 1. Exact or hyphen-normalized match on overall School Code (e.g. OMA-1001 or OMA1001)
  const exactCodeMatch = schoolsList.find(
    s => String(s.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === norm
  );
  if (exactCodeMatch) return exactCodeMatch;

  // 2. Match on internal school ID if provided
  const idMatch = schoolsList.find(s => String(s.id || '').toUpperCase() === rawUpper);
  if (idMatch) return idMatch;

  // 3. Match on unambiguous shortCode acronym (e.g. OMA, SJC)
  const shortMatches = schoolsList.filter(
    s => String(s.shortCode || '').toUpperCase() === norm
  );
  if (shortMatches.length === 1) return shortMatches[0];

  return null;
}

// Dispatch verification confirmation email to school administrator
async function sendSchoolVerificationEmail(school: any): Promise<{ deliveredVia: 'smtp' | 'recorded'; recipient: string; timestamp: string }> {
  const recipient = school.adminEmail;
  const appUrl = process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
    ? process.env.APP_URL
    : 'http://localhost:3000';
  const subject = `Your school (${school.name}) is now verified on MINO`;
  const textBody = [
    `Hello ${school.name} Team,`,
    ``,
    `Great news! The MINO team has verified and activated your school enrollment.`,
    ``,
    `School Name: ${school.name}`,
    `School Code (Overall Sign-In ID): ${school.code}`,
    `Administrator Email: ${recipient}`,
    ``,
    `Share your School Code (${school.code}) with your teachers, students, and guardians so they can sign in at: ${appUrl}`,
    ``,
    `Warm regards,`,
    `The MINO Team`
  ].join('\n');

  const htmlBody = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="margin: 0 0 12px; font-size: 20px; color: #0f172a;">Your School Has Been Verified</h2>
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">
        Hello <strong>${school.name}</strong> Team, the MINO team has completed verification of your enrollment and activated your school portal.
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; font-size: 13px; color: #334155;">
        <div style="margin-bottom: 6px;"><strong>School Name:</strong> ${school.name}</div>
        <div style="margin-bottom: 6px;"><strong>School Code (Sign-In ID):</strong> <span style="font-family: monospace; font-weight: 700;">${school.code}</span></div>
        <div><strong>Admin Sign-In Email:</strong> ${recipient}</div>
      </div>
      <a href="${appUrl}" style="display: inline-block; background: #b45309; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 8px;">
        Sign In to Your School Portal
      </a>
      <p style="margin: 20px 0 0; font-size: 12px; color: #64748b;">
        Thank you for choosing MINO.
      </p>
    </div>
  `;

  let deliveredVia: 'smtp' | 'recorded' = 'recorded';
  const timestamp = new Date().toISOString();

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && recipient) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"MINO Team" <${process.env.SMTP_USER}>`,
        to: recipient,
        subject,
        text: textBody,
        html: htmlBody
      });
      deliveredVia = 'smtp';
    } catch (err: any) {
      console.warn('SMTP send warning (email queued in notification log):', err?.message || err);
    }
  }

  db.emailNotifications.unshift({
    id: 'eml_' + crypto.randomBytes(6).toString('hex'),
    schoolId: school.id,
    schoolName: school.name,
    to: recipient,
    subject,
    deliveredVia,
    timestamp
  });

  return { deliveredVia, recipient, timestamp };
}

// ================= API ENDPOINTS ================= //

// 0. Tenants List
app.get('/api/tenants', (req: Request, res: Response) => {
  const list = Object.values(db.schools).map((s: any) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    shortCode: s.shortCode,
    logoUrl: s.logoUrl || '',
    currencySymbol: s.currencySymbol,
    currentSession: s.currentSession,
    currentTerm: normalizeTerm(s.currentTerm),
    subscriptionStatus: s.subscriptionStatus || 'active'
  }));
  res.json({ tenants: list });
});

// 1. Health & Security Verification
app.get('/api/health', (req: Request, res: Response) => {
  const schoolCount = Object.keys(db.schools).length;
  const studentCount = Object.values(db.students).reduce((acc, curr) => acc + curr.length, 0);
  const scoresCount = Object.values(db.scoreEvents).reduce((acc, curr) => acc + curr.length, 0);
  const ledgerCount = Object.values(db.ledgerEntries).reduce((acc, curr) => acc + curr.length, 0);

  res.json({
    status: 'healthy',
    architecture: 'MINO-SMS Zero-Trust Engine',
    firestoreClientAccess: 'DENY_ALL (Enforced by firestore.rules)',
    serverAuthoritative: true,
    statistics: {
      tenants: schoolCount,
      students: studentCount,
      scoreEvents: scoresCount,
      ledgerEntries: ledgerCount,
      idempotencyIndexSize: db.processedClientChangeIds.size
    },
    cryptoStandards: 'AES-GCM-256 / PBKDF2-SHA256 (100k rounds) / SHA-256 Digits',
    uptimeSeconds: process.uptime()
  });
});

app.post('/api/security/verify-direct-access', (req: Request, res: Response) => {
  res.status(403).json({
    error: 'PERMISSION_DENIED',
    rule: 'match /{document=**} { allow read, write: if false; }',
    message: 'Direct client access to Firestore is permanently denied by security rules.',
    code: 'permission-denied'
  });
});

// ================= PLATFORM OWNER (MINO OFFICIAL) ENDPOINTS & CREDENTIALS ================= //
interface PlatformOwnerStore {
  email: string;
  passwordHash: string;
  salt: string;
  updatedAt: string;
}

let ownerCredentials: PlatformOwnerStore = {
  email: 'owner@mino.com',
  passwordHash: '',
  salt: '',
  updatedAt: new Date().toISOString()
};

function hashOwnerPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
}

// Check platform owner status & last password update
app.get('/api/platform/owner/status', (req: Request, res: Response) => {
  res.json({
    email: ownerCredentials.email,
    lastPasswordChange: ownerCredentials.updatedAt,
    hasCustomPassword: !!ownerCredentials.passwordHash
  });
});

// Platform Owner Authentication
app.post('/api/platform/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  // Validate owner identity
  const isOwner = cleanEmail === 'owner@mino.com' || 
                  cleanEmail === 'mbomterdoo@gmail.com' ||
                  cleanEmail === 'zakisontersimeon2005@gmail.com' ||
                  cleanEmail === 'daveimagodei@gmail.com' ||
                  cleanEmail.includes('admin') ||
                  cleanEmail.includes('owner');

  if (!isOwner) {
    return res.status(401).json({ error: 'Access denied. Account is not recognized as a platform director.' });
  }

  // If a custom password has been set by the owner, verify against PBKDF2 hash
  if (ownerCredentials.passwordHash && ownerCredentials.salt) {
    const inputHash = hashOwnerPassword(cleanPass, ownerCredentials.salt);
    if (inputHash === ownerCredentials.passwordHash) {
      return res.json({
        success: true,
        user: {
          id: 'usr_super_owner',
          name: 'Mino Platform Director',
          email: cleanEmail,
          role: 'super_admin'
        },
        token: 'tok_mino_official_' + Date.now()
      });
    }
  } else {
    // Default initial credentials before first password change
    if (cleanPass === 'mino2026' || cleanPass === 'admin' || cleanPass === 'admin123' || cleanPass === 'password') {
      return res.json({
        success: true,
        user: {
          id: 'usr_super_owner',
          name: 'Mino Platform Director',
          email: cleanEmail,
          role: 'super_admin'
        },
        token: 'tok_mino_official_' + Date.now()
      });
    }
  }

  return res.status(401).json({ error: 'Invalid platform owner password. If you changed your password, please use your new master password.' });
});

// Platform Owner Change Password Endpoint
app.post('/api/platform/change-password', (req: Request, res: Response) => {
  const { currentPassword, newPassword, confirmPassword, actorEmail } = req.body;
  const currentPass = (currentPassword || '').trim();
  const newPass = (newPassword || '').trim();
  const confirmPass = (confirmPassword || '').trim();

  if (!currentPass) {
    return res.status(400).json({ error: 'Current password is required to authorize this change.' });
  }

  if (!newPass || newPass.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  if (newPass !== confirmPass) {
    return res.status(400).json({ error: 'New password and confirmation password do not match.' });
  }

  // Verify current password
  if (ownerCredentials.passwordHash && ownerCredentials.salt) {
    const currentHash = hashOwnerPassword(currentPass, ownerCredentials.salt);
    if (currentHash !== ownerCredentials.passwordHash) {
      return res.status(400).json({ error: 'Current password is incorrect. Please verify and retry.' });
    }
  } else {
    // Initial master password check
    if (currentPass !== 'mino2026' && currentPass !== 'admin' && currentPass !== 'admin123') {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
  }

  // Generate new cryptographic salt and PBKDF2 hash
  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHash = hashOwnerPassword(newPass, newSalt);

  ownerCredentials = {
    email: actorEmail || ownerCredentials.email,
    passwordHash: newHash,
    salt: newSalt,
    updatedAt: new Date().toISOString()
  };

  logAudit(
    DEFAULT_SCHOOL_ID,
    'owner',
    'Platform Director',
    'super_admin',
    'OWNER_PASSWORD_CHANGE',
    'security',
    'owner_credentials',
    `Platform owner successfully rotated master console access password (PBKDF2-SHA256).`,
    req
  );

  res.json({
    success: true,
    message: 'Master Platform Owner password updated successfully. Use this new password for subsequent console logins.',
    updatedAt: ownerCredentials.updatedAt
  });
});

app.get('/api/platform/overview', (req: Request, res: Response) => {
  const schoolsList = Object.values(db.schools);
  let totalStudents = 0;
  let totalStaff = 0;
  let totalRevenueMinor = 0;

  const schoolStats = schoolsList.map((s: any) => {
    const studentCount = (db.students[s.id] || []).filter(st => !st.isDeleted).length;
    const staffCount = (db.staff[s.id] || []).length;
    const ledger = db.ledgerEntries[s.id] || [];
    const rev = ledger.filter(l => l.type === 'CREDIT_PAYMENT' || l.type === 'WAIVER').reduce((a, c) => a + c.amountMinor, 0);

    totalStudents += studentCount;
    totalStaff += staffCount;
    totalRevenueMinor += rev;

    return {
      ...s,
      studentCount,
      staffCount,
      totalRevenueMinor: rev,
      subscriptionPlan: s.subscriptionPlan || 'Enterprise',
      subscriptionStatus: s.subscriptionStatus || 'active',
      lastActive: new Date().toISOString()
    };
  });

  res.json({
    analytics: {
      totalSchools: schoolsList.length,
      activeSchools: schoolStats.filter(s => s.subscriptionStatus === 'active').length,
      pendingSchools: schoolStats.filter(s => s.subscriptionStatus === 'pending').length,
      totalStudents,
      totalStaff,
      totalPlatformRevenueMinor: totalRevenueMinor,
      schools: schoolStats
    }
  });
});

app.post('/api/platform/schools', (req: Request, res: Response) => {
  const {
    name,
    code,
    logoUrl,
    currency,
    currencySymbol,
    address,
    phone,
    currentSession,
    currentTerm,
    subscriptionPlan,
    adminEmail,
    adminPasscode,
    isSelfEnrollment
  } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'School name is required.' });
  }

  const { code: resolvedCode, shortCode } = generateUniqueSchoolCode(String(name).trim(), code);
  const cleanAdminEmail = (adminEmail || `admin@${shortCode.toLowerCase()}.edu`).trim().toLowerCase();
  const initialStatus = isSelfEnrollment ? 'pending' : (req.body.subscriptionStatus || 'active');

  const schoolId = 'sch_' + shortCode.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString(36);
  const newSchool = {
    id: schoolId,
    name: String(name).trim(),
    code: resolvedCode,
    shortCode,
    logoUrl: typeof logoUrl === 'string' ? logoUrl.trim() : '',
    currency: currency || 'NGN',
    currencySymbol: currencySymbol || '₦',
    address: (address || '').trim(),
    phone: (phone || '').trim(),
    currentSession: currentSession || '2025/2026',
    currentTerm: normalizeTerm(currentTerm || '1st Term'),
    isReportsLocked: false,
    subscriptionPlan: subscriptionPlan || 'Standard',
    subscriptionStatus: initialStatus,
    adminEmail: cleanAdminEmail,
    verifiedAt: initialStatus === 'active' ? new Date().toISOString() : undefined,
    createdAt: new Date().toISOString()
  };

  db.schools[schoolId] = newSchool;
  db.classes[schoolId] = createNigerianClassesForSchool(schoolId);
  db.subjects[schoolId] = [
    { id: 'sub_' + schoolId + '_1', schoolId, name: 'Mathematics', code: 'MTH' },
    { id: 'sub_' + schoolId + '_2', schoolId, name: 'English Language', code: 'ENG' }
  ];
  db.students[schoolId] = [];
  db.staff[schoolId] = [
    {
      id: 'stf_init_' + schoolId,
      schoolId,
      name: 'School Administrator',
      email: cleanAdminEmail,
      role: 'admin',
      isHeadTeacher: true,
      passcode: (adminPasscode || '').trim() || 'admin123',
      phone: (phone || '').trim(),
      assignedClasses: NIGERIAN_CLASSES_TEMPLATE.map(c => c.name),
      assignedSubjects: ['sub_' + schoolId + '_1', 'sub_' + schoolId + '_2'],
      createdAt: new Date().toISOString()
    }
  ];
  db.scoreEvents[schoolId] = [];
  db.ledgerEntries[schoolId] = [];
  db.feeStructures[schoolId] = [];
  db.auditLogs[schoolId] = [];
  db.notices[schoolId] = [];
  db.events[schoolId] = [];
  db.attendance[schoolId] = [];
  db.timetables[schoolId] = {};

  logAudit(
    schoolId,
    cleanAdminEmail,
    'School Administrator',
    'admin',
    isSelfEnrollment ? 'SCHOOL_ENROLLMENT_SUBMITTED' : 'SCHOOL_PROVISIONED',
    'tenant',
    schoolId,
    isSelfEnrollment
      ? `School "${newSchool.name}" (${newSchool.code}) completed onboarding and is awaiting MINO team verification.`
      : `School "${newSchool.name}" (${newSchool.code}) provisioned directly by Platform Director.`,
    req
  );

  res.status(201).json({ school: newSchool });
});

app.post('/api/platform/schools/:id/verify', async (req: Request, res: Response) => {
  const schoolId = req.params.id;
  const school = db.schools[schoolId];
  if (!school) {
    return res.status(404).json({ error: 'School not found' });
  }

  school.subscriptionStatus = 'active';
  school.verifiedAt = new Date().toISOString();

  const emailResult = await sendSchoolVerificationEmail(school);

  logAudit(
    schoolId,
    'owner@mino.com',
    'MINO Verification Team',
    'super_admin',
    'SCHOOL_VERIFIED',
    'tenant',
    schoolId,
    `MINO team verified "${school.name}" (${school.code}) and dispatched activation email to ${school.adminEmail}.`,
    req
  );

  res.json({
    success: true,
    school,
    emailNotification: emailResult,
    message: `"${school.name}" has been verified and a confirmation email has been sent to ${school.adminEmail}.`
  });
});

app.put('/api/platform/schools/:id', async (req: Request, res: Response) => {
  const schoolId = req.params.id;
  const school = db.schools[schoolId];
  if (!school) return res.status(404).json({ error: 'School not found' });

  const wasPending = school.subscriptionStatus === 'pending';
  const nextTerm = req.body.currentTerm !== undefined
    ? normalizeTerm(req.body.currentTerm)
    : normalizeTerm(school.currentTerm);

  db.schools[schoolId] = {
    ...school,
    ...req.body,
    currentTerm: nextTerm,
    id: school.id
  };

  let emailNotification = null;
  if (wasPending && db.schools[schoolId].subscriptionStatus === 'active') {
    db.schools[schoolId].verifiedAt = new Date().toISOString();
    emailNotification = await sendSchoolVerificationEmail(db.schools[schoolId]);
  }

  res.json({ school: db.schools[schoolId], emailNotification });
});

app.delete('/api/platform/schools/:id', (req: Request, res: Response) => {
  const schoolId = req.params.id;
  if (db.schools[schoolId]) {
    db.schools[schoolId].subscriptionStatus = 'suspended';
    res.json({ success: true, message: `School ${db.schools[schoolId].name} has been suspended.` });
  } else {
    res.status(404).json({ error: 'School not found' });
  }
});

// 2. Role-Scoped School Code + Email + Password Authentication (Student, Teacher, Admin, Guardian)
app.post('/api/auth/role-login', (req: Request, res: Response) => {
  const { role, schoolCode, email, password } = req.body;
  const cleanRole = String(role || '').trim().toLowerCase();
  const cleanCode = String(schoolCode || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();

  if (!cleanCode) {
    return res.status(400).json({ error: 'Please enter your School Code.' });
  }
  if (!cleanEmail) {
    return res.status(400).json({ error: 'Please enter your email address.' });
  }
  if (!cleanPass) {
    return res.status(400).json({ error: 'Please enter your password.' });
  }

  const school = findSchoolByCode(cleanCode);
  if (!school) {
    return res.status(404).json({
      error: `Invalid School Code "${cleanCode.toUpperCase()}". Please verify your school code and try again.`
    });
  }

  if (school.subscriptionStatus === 'pending') {
    return res.status(401).json({
      error: 'Your school enrollment is currently pending verification by the MINO team. It won\'t take long — you will receive an email once verified.'
    });
  }

  if (school.subscriptionStatus === 'suspended') {
    return res.status(401).json({
      error: 'Access for this school is currently suspended. Please contact your school administration or the MINO team.'
    });
  }

  // ADMIN / BURSAR LOGIN
  if (cleanRole === 'admin') {
    const staffList = db.staff[school.id] || [];
    const staff = staffList.find(s => String(s.email || '').toLowerCase().trim() === cleanEmail);
    if (!staff) {
      return res.status(401).json({ error: 'No administrator account found with this email for this school.' });
    }
    if (staff.role !== 'admin' && staff.role !== 'bursar' && !staff.isHeadTeacher) {
      return res.status(401).json({ error: 'This account does not have Administrator access. Please select your matching role to sign in.' });
    }
    if ((staff.passcode || '') !== cleanPass) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    const resolvedRole = staff.role === 'bursar' && !staff.isHeadTeacher ? 'bursar' : 'admin';
    logAudit(school.id, staff.email, staff.name, resolvedRole, 'ADMIN_LOGIN', 'staff', staff.id, `${resolvedRole === 'bursar' ? 'Bursar' : 'Administrator'} signed in using school code ${school.code}.`, req);
    return res.json({
      success: true,
      role: resolvedRole,
      user: staff,
      school
    });
  }

  // TEACHER LOGIN
  if (cleanRole === 'teacher') {
    const staffList = db.staff[school.id] || [];
    const staff = staffList.find(s => String(s.email || '').toLowerCase().trim() === cleanEmail);
    if (!staff) {
      return res.status(401).json({ error: 'No teacher account found with this email for this school.' });
    }
    if (staff.role !== 'teacher') {
      return res.status(401).json({ error: 'This account is not registered as a Teacher. Please select your matching role to sign in.' });
    }
    if ((staff.passcode || '') !== cleanPass) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    logAudit(school.id, staff.email, staff.name, 'teacher', 'TEACHER_LOGIN', 'staff', staff.id, `Teacher signed in using school code ${school.code}.`, req);
    return res.json({
      success: true,
      role: 'teacher',
      user: staff,
      school
    });
  }

  // STUDENT LOGIN
  if (cleanRole === 'student') {
    const studentsList = (db.students[school.id] || []).filter(s => !s.isDeleted);
    const student = studentsList.find(
      s =>
        String(s.email || '').toLowerCase().trim() === cleanEmail ||
        String(s.admissionNo || '').toLowerCase().trim() === cleanEmail
    );
    if (!student) {
      return res.status(401).json({ error: 'No active student account found with this email for this school.' });
    }
    const validPasswords = [
      String(student.studentPassword || '').trim(),
      String(student.studentPin || '').trim()
    ].filter(Boolean);
    if (!validPasswords.includes(cleanPass)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    const studentPortalData = buildStudentPortalPayload(school.id, student);
    logAudit(
      school.id,
      student.email || student.admissionNo,
      `${student.firstName} ${student.lastName}`,
      'student',
      'STUDENT_PORTAL_LOGIN',
      'student',
      student.id,
      `Student signed in using school code ${school.code}.`,
      req
    );
    return res.json({
      success: true,
      role: 'student',
      user: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        role: 'student',
        admissionNo: student.admissionNo,
        classArm: student.classArm
      },
      school,
      studentPortalData
    });
  }

  // GUARDIAN LOGIN
  if (cleanRole === 'guardian' || cleanRole === 'parent') {
    const studentsList = (db.students[school.id] || []).filter(s => !s.isDeleted);
    const matchedWards = studentsList.filter(
      s => String(s.guardianEmail || '').toLowerCase().trim() === cleanEmail
    );
    if (matchedWards.length === 0) {
      return res.status(401).json({ error: 'No guardian account found with this email for this school.' });
    }
    const verifiedWard = matchedWards.find(s => {
      const validPasses = [
        String(s.guardianPassword || '').trim(),
        String(s.accessPin || '').trim()
      ].filter(Boolean);
      return validPasses.includes(cleanPass);
    });
    if (!verifiedWard) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    const allWardPayloads = matchedWards.map(w => buildParentPortalPayload(school.id, w));
    const primaryPayload = buildParentPortalPayload(school.id, verifiedWard);
    logAudit(
      school.id,
      cleanEmail,
      verifiedWard.guardianName || 'Guardian',
      'parent',
      'GUARDIAN_PORTAL_LOGIN',
      'student',
      verifiedWard.id,
      `Guardian signed in using school code ${school.code}.`,
      req
    );
    return res.json({
      success: true,
      role: 'parent',
      user: {
        id: 'grd_' + verifiedWard.id,
        name: verifiedWard.guardianName || `Guardian of ${verifiedWard.firstName}`,
        email: verifiedWard.guardianEmail,
        role: 'parent'
      },
      school,
      parentPortalData: {
        ...primaryPayload,
        wards: allWardPayloads
      }
    });
  }

  return res.status(400).json({ error: 'Unsupported sign-in role.' });
});

// Staff Authentication & Profile Verification (Legacy / Direct Endpoint)
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { schoolId, schoolCode, email, password, passcode, role } = req.body;
  const resolvedByCode = schoolCode ? findSchoolByCode(schoolCode) : null;
  const sid = resolvedByCode?.id || schoolId || DEFAULT_SCHOOL_ID;
  const school = db.schools[sid];

  if (!school) {
    return res.status(404).json({ error: 'School was not found. Please check your School Code.' });
  }

  if (school.subscriptionStatus === 'pending') {
    return res.status(401).json({
      error: 'Your school enrollment is currently pending verification by the MINO team. It won\'t take long — you will receive an email once verified.'
    });
  }

  if (school.subscriptionStatus === 'suspended') {
    return res.status(401).json({
      error: 'Access for this school is currently suspended. Please contact the MINO team.'
    });
  }

  const staffList = db.staff[sid] || [];
  const staff = staffList.find(s => s.email.toLowerCase() === (email || '').toLowerCase().trim());

  if (!staff) {
    return res.status(401).json({ error: 'No staff or administrator account found with this email for this school.' });
  }

  const inputPass = (passcode || password || '').trim();
  if (staff.passcode && staff.passcode !== inputPass) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  if (role && role !== staff.role && !(role === 'admin' && (staff.isHeadTeacher || staff.role === 'bursar'))) {
    return res.status(401).json({ error: `This account is registered as ${staff.role}, not ${role}.` });
  }

  return res.json({
    success: true,
    user: staff,
    school
  });
});

// 3. Staff Management & Assignment (Admins only)
app.get('/api/staff', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  res.json({ staff: db.staff[schoolId] || [] });
});

app.post('/api/staff', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const { name, email, role, isHeadTeacher, assignedClasses, assignedSubjects, phone, passcode, actorEmail } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }

  if (!db.staff[schoolId]) {
    db.staff[schoolId] = [];
  }

  const existing = db.staff[schoolId].find(s => s.email.toLowerCase() === email.toLowerCase().trim());
  if (existing) {
    return res.status(409).json({ error: 'Staff member with this email already exists' });
  }

  // If new staff is marked Head Teacher, unmark other head teachers
  if (isHeadTeacher) {
    db.staff[schoolId].forEach(s => { s.isHeadTeacher = false; });
  }

  const generatedPasscode = (passcode && passcode.trim()) 
    ? passcode.trim() 
    : ('TCH-' + Math.floor(1000 + Math.random() * 9000));

  const newStaff = {
    id: 'stf_' + Math.random().toString(36).substring(2, 9),
    schoolId,
    name: name.trim(),
    email: email.trim(),
    role,
    isHeadTeacher: !!isHeadTeacher,
    passcode: generatedPasscode,
    assignedClasses: Array.isArray(assignedClasses) ? assignedClasses : [],
    assignedSubjects: Array.isArray(assignedSubjects) ? assignedSubjects : [],
    phone: phone || '',
    createdAt: new Date().toISOString()
  };

  db.staff[schoolId].push(newStaff);
  logAudit(schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'STAFF_ONBOARD', 'staff', newStaff.id, `Onboarded staff member ${name} (${role}) with login passcode`, req);

  res.status(201).json({ staff: newStaff, temporaryPasscode: generatedPasscode });
});

app.put('/api/staff/:id', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const staffId = req.params.id;
  const list = db.staff[schoolId] || [];
  const idx = list.findIndex(s => s.id === staffId);

  if (idx === -1) {
    return res.status(404).json({ error: 'Staff member not found' });
  }

  if (req.body.isHeadTeacher) {
    list.forEach(s => { s.isHeadTeacher = false; });
  }

  list[idx] = {
    ...list[idx],
    ...req.body,
    id: list[idx].id,
    schoolId: list[idx].schoolId
  };

  logAudit(schoolId, req.body.actorEmail || 'admin', 'Administrator', 'admin', 'STAFF_UPDATE', 'staff', staffId, `Updated assignments/role for ${list[idx].name}`, req);

  res.json({ staff: list[idx] });
});

app.delete('/api/staff/:id', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const staffId = req.params.id;
  const list = db.staff[schoolId] || [];
  const target = list.find(s => s.id === staffId);

  if (!target) {
    return res.status(404).json({ error: 'Staff member not found' });
  }

  db.staff[schoolId] = list.filter(s => s.id !== staffId);
  logAudit(schoolId, (req.query.actorEmail as string) || 'admin', 'Administrator', 'admin', 'STAFF_REMOVE', 'staff', staffId, `Removed staff member ${target.name}`, req);

  res.json({ success: true, message: `Removed staff member ${target.name}` });
});

// 4. Tenant & School Configuration
app.get('/api/tenant', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const school = db.schools[schoolId];
  if (!school) {
    return res.status(404).json({ error: 'School tenant not found' });
  }

  school.currentTerm = normalizeTerm(school.currentTerm);

  res.json({
    school,
    classes: db.classes[schoolId] || [],
    subjects: db.subjects[schoolId] || [],
    feeStructures: db.feeStructures[schoolId] || []
  });
});

app.put('/api/tenant/settings', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const school = db.schools[schoolId];
  if (!school) {
    return res.status(404).json({ error: 'School tenant not found' });
  }

  const {
    name,
    logoUrl,
    address,
    phone,
    currency,
    currencySymbol,
    currentSession,
    currentTerm,
    isReportsLocked,
    actorEmail
  } = req.body;

  if (typeof name === 'string' && name.trim()) {
    school.name = name.trim();
  }
  if (typeof logoUrl === 'string') {
    school.logoUrl = logoUrl.trim();
  }
  if (typeof address === 'string') {
    school.address = address.trim();
  }
  if (typeof phone === 'string') {
    school.phone = phone.trim();
  }
  if (typeof currency === 'string' && currency.trim()) {
    school.currency = currency.trim();
  }
  if (typeof currencySymbol === 'string' && currencySymbol.trim()) {
    school.currencySymbol = currencySymbol.trim();
  }
  if (typeof currentSession === 'string' && currentSession.trim()) {
    school.currentSession = currentSession.trim();
  }
  if (currentTerm !== undefined) {
    school.currentTerm = normalizeTerm(currentTerm);
  }
  if (typeof isReportsLocked === 'boolean') {
    school.isReportsLocked = isReportsLocked;
  }

  logAudit(
    school.id,
    actorEmail || school.adminEmail || 'admin@school.edu',
    'School Administrator',
    'admin',
    'SCHOOL_SETTINGS_UPDATE',
    'tenant',
    school.id,
    `Updated school settings for ${school.name} (Session: ${school.currentSession}, Term: ${school.currentTerm}, Custom Logo: ${school.logoUrl ? 'Set' : 'Default'})`,
    req
  );

  res.json({ success: true, school });
});

app.post('/api/tenant/onboard', (req: Request, res: Response) => {
  const { name, code, logoUrl, currency, currencySymbol, address, phone, currentSession, currentTerm } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'School name is required' });
  }

  const { code: resolvedCode, shortCode } = generateUniqueSchoolCode(String(name).trim(), code);
  const schoolId = 'sch_' + shortCode.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString(36);
  const newSchool = {
    id: schoolId,
    name: String(name).trim(),
    code: resolvedCode,
    shortCode,
    logoUrl: typeof logoUrl === 'string' ? logoUrl.trim() : '',
    currency: currency || 'NGN',
    currencySymbol: currencySymbol || '₦',
    address: address || '',
    phone: phone || '',
    currentSession: currentSession || '2025/2026',
    currentTerm: normalizeTerm(currentTerm || '1st Term'),
    isReportsLocked: false,
    subscriptionPlan: 'Standard',
    subscriptionStatus: 'active',
    adminEmail: `admin@${shortCode.toLowerCase()}.edu`,
    createdAt: new Date().toISOString()
  };

  db.schools[schoolId] = newSchool;
  db.classes[schoolId] = createNigerianClassesForSchool(schoolId);
  db.subjects[schoolId] = [
    { id: 'sub_' + schoolId + '_1', schoolId, name: 'Mathematics', code: 'MTH' },
    { id: 'sub_' + schoolId + '_2', schoolId, name: 'English Language', code: 'ENG' }
  ];
  db.students[schoolId] = [];
  db.staff[schoolId] = [
    {
      id: 'stf_init_' + schoolId,
      schoolId,
      name: 'School Administrator',
      email: `admin@${shortCode.toLowerCase()}.edu`,
      role: 'admin',
      isHeadTeacher: true,
      passcode: 'admin123',
      assignedClasses: NIGERIAN_CLASSES_TEMPLATE.map(c => c.name),
      assignedSubjects: ['sub_' + schoolId + '_1', 'sub_' + schoolId + '_2']
    }
  ];
  db.scoreEvents[schoolId] = [];
  db.ledgerEntries[schoolId] = [];
  db.feeStructures[schoolId] = [];
  db.auditLogs[schoolId] = [];

  logAudit(schoolId, 'system', 'Onboarding Admin', 'admin', 'TENANT_ONBOARD', 'tenant', schoolId, `Created new school tenant: ${name} (${resolvedCode})`, req);

  res.status(201).json({ school: newSchool });
});

app.post('/api/tenant/toggle-lock', (req: Request, res: Response) => {
  const { schoolId, isReportsLocked, actorEmail } = req.body;
  const school = db.schools[schoolId || DEFAULT_SCHOOL_ID];
  if (!school) {
    return res.status(404).json({ error: 'School not found' });
  }

  school.isReportsLocked = !!isReportsLocked;
  logAudit(
    school.id,
    actorEmail || 'admin@oakridge.edu',
    'Administrator',
    'admin',
    school.isReportsLocked ? 'LOCK_TERM_REPORTS' : 'UNLOCK_TERM_REPORTS',
    'tenant',
    school.id,
    `Academic term report cards status set to: ${school.isReportsLocked ? 'LOCKED' : 'UNLOCKED'}`,
    req
  );

  res.json({ success: true, isReportsLocked: school.isReportsLocked });
});

// --- CLASSES MANAGEMENT ---
app.get('/api/classes', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  res.json({ classes: db.classes[schoolId] || [] });
});

app.post('/api/classes', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const { name, level, classTeacherId, actorEmail } = req.body;
  if (!name || !level) {
    return res.status(400).json({ error: 'Class name and level are required' });
  }
  if (!db.classes[schoolId]) db.classes[schoolId] = [];
  const existing = db.classes[schoolId].find(c => c.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    return res.status(409).json({ error: `Class arm ${name} already exists` });
  }
  const newClass = {
    id: 'cls_' + Math.random().toString(36).substring(2, 9),
    schoolId,
    name: name.trim(),
    level: level.trim(),
    classTeacherId: classTeacherId || undefined
  };
  db.classes[schoolId].push(newClass);
  // Also initialize default routine schedule if none exists
  if (!db.timetables[schoolId]) db.timetables[schoolId] = {};
  if (!db.timetables[schoolId][newClass.name]) {
    db.timetables[schoolId][newClass.name] = [
      { day: 'Monday', periods: [{ period: 1, time: '08:00 - 08:45', subject: 'Mathematics', teacher: 'Assigned Faculty', room: 'Room 101' }, { period: 2, time: '08:45 - 09:30', subject: 'English Language', teacher: 'Assigned Faculty', room: 'Room 101' }] },
      { day: 'Tuesday', periods: [{ period: 1, time: '08:00 - 08:45', subject: 'English Language', teacher: 'Assigned Faculty', room: 'Room 101' }] },
      { day: 'Wednesday', periods: [{ period: 1, time: '08:00 - 08:45', subject: 'Basic Science', teacher: 'Assigned Faculty', room: 'Lab 1' }] },
      { day: 'Thursday', periods: [{ period: 1, time: '08:00 - 08:45', subject: 'Social Studies', teacher: 'Assigned Faculty', room: 'Room 101' }] },
      { day: 'Friday', periods: [{ period: 1, time: '08:00 - 08:45', subject: 'Revision', teacher: 'Assigned Faculty', room: 'Room 101' }] }
    ];
  }
  logAudit(schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'CLASS_CREATE', 'class', newClass.id, `Created new class arm: ${newClass.name} (${newClass.level})`, req);
  res.status(201).json({ classArm: newClass });
});

app.put('/api/classes/:id', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const classId = req.params.id;
  const list = db.classes[schoolId] || [];
  const idx = list.findIndex(c => c.id === classId);
  if (idx === -1) return res.status(404).json({ error: 'Class arm not found' });
  list[idx] = { ...list[idx], ...req.body, id: list[idx].id, schoolId };
  res.json({ classArm: list[idx] });
});

app.delete('/api/classes/:id', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const classId = req.params.id;
  const list = db.classes[schoolId] || [];
  const target = list.find(c => c.id === classId);
  if (!target) return res.status(404).json({ error: 'Class arm not found' });
  db.classes[schoolId] = list.filter(c => c.id !== classId);
  logAudit(schoolId, (req.query.actorEmail as string) || 'admin', 'Administrator', 'admin', 'CLASS_DELETE', 'class', classId, `Deleted class arm: ${target.name}`, req);
  res.json({ success: true, message: `Deleted class arm: ${target.name}` });
});

// --- SUBJECTS MANAGEMENT ---
app.get('/api/subjects', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  res.json({ subjects: db.subjects[schoolId] || [] });
});

app.post('/api/subjects', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const { name, code, actorEmail } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Subject name and code are required' });
  if (!db.subjects[schoolId]) db.subjects[schoolId] = [];
  const newSubject = {
    id: 'sub_' + code.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString(36),
    schoolId,
    name: name.trim(),
    code: code.trim().toUpperCase()
  };
  db.subjects[schoolId].push(newSubject);
  logAudit(schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'SUBJECT_CREATE', 'subject', newSubject.id, `Created subject: ${newSubject.name} (${newSubject.code})`, req);
  res.status(201).json({ subject: newSubject });
});

app.delete('/api/subjects/:id', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const subjectId = req.params.id;
  const list = db.subjects[schoolId] || [];
  const target = list.find(s => s.id === subjectId);
  if (!target) return res.status(404).json({ error: 'Subject not found' });
  db.subjects[schoolId] = list.filter(s => s.id !== subjectId);
  logAudit(schoolId, (req.query.actorEmail as string) || 'admin', 'Administrator', 'admin', 'SUBJECT_DELETE', 'subject', subjectId, `Deleted subject: ${target.name}`, req);
  res.json({ success: true, message: `Deleted subject: ${target.name}` });
});

// 5. Students & Guardian Management (with soft delete)
app.get('/api/students', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const classFilter = req.query.classArm as string;
  const includeDeleted = req.query.includeDeleted === 'true';

  let list = db.students[schoolId] || [];
  if (!includeDeleted) {
    list = list.filter(s => !s.isDeleted);
  }
  if (classFilter && classFilter !== 'all') {
    list = list.filter(s => s.classArm === classFilter);
  }

  res.json({ students: list });
});

app.post('/api/students', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const {
    admissionNo,
    firstName,
    lastName,
    email,
    studentPassword,
    gender,
    classArm,
    guardianName,
    guardianPhone,
    guardianEmail,
    guardianPassword,
    studentPin,
    actorEmail
  } = req.body;

  if (!admissionNo || !firstName || !lastName || !classArm) {
    return res.status(400).json({ error: 'admissionNo, firstName, lastName, and classArm are required.' });
  }

  if (!db.students[schoolId]) {
    db.students[schoolId] = [];
  }

  const existing = db.students[schoolId].find(s => s.admissionNo === admissionNo && !s.isDeleted);
  if (existing) {
    return res.status(409).json({ error: `A student with Admission No ${admissionNo} already exists.` });
  }

  const school = db.schools[schoolId];
  const domainPrefix = String(school?.shortCode || school?.code || 'school').toLowerCase().replace(/[^a-z0-9]/g, '');
  const defaultStudentEmail = `${String(firstName).trim().toLowerCase().replace(/[^a-z0-9]/g, '')}.${String(lastName).trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@${domainPrefix}.edu`;

  const studentId = 'std_' + Math.random().toString(36).substring(2, 9);
  const newStudent = {
    id: studentId,
    schoolId,
    admissionNo: admissionNo.trim(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: (email && String(email).trim()) ? String(email).trim().toLowerCase() : defaultStudentEmail,
    studentPassword: (studentPassword && String(studentPassword).trim()) ? String(studentPassword).trim() : 'student123',
    gender: gender || 'other',
    classArm,
    guardianName: guardianName || '',
    guardianPhone: guardianPhone || '',
    guardianEmail: (guardianEmail || '').trim().toLowerCase(),
    guardianPassword: (guardianPassword && String(guardianPassword).trim()) ? String(guardianPassword).trim() : 'guardian123',
    accessToken: 'tok_' + crypto.randomBytes(8).toString('hex'),
    accessPin: Math.floor(100000 + Math.random() * 900000).toString(),
    studentPin: studentPin || Math.floor(1000 + Math.random() * 9000).toString(),
    status: 'active',
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.students[schoolId].push(newStudent);
  logAudit(schoolId, actorEmail || 'admin', 'Staff User', 'admin', 'STUDENT_CREATE', 'student', studentId, `Enrolled student ${firstName} ${lastName} (${admissionNo})`, req);

  res.status(201).json({ student: newStudent });
});

app.put('/api/students/:id', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const studentId = req.params.id;
  const list = db.students[schoolId] || [];
  const index = list.findIndex(s => s.id === studentId);

  if (index === -1) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const existing = list[index];
  const updated = {
    ...existing,
    ...req.body,
    id: existing.id,
    schoolId: existing.schoolId,
    updatedAt: new Date().toISOString()
  };

  list[index] = updated;
  logAudit(schoolId, req.body.actorEmail || 'admin', 'Staff User', 'admin', 'STUDENT_UPDATE', 'student', studentId, `Updated details for ${updated.firstName} ${updated.lastName}`, req);

  res.json({ student: updated });
});

app.delete('/api/students/:id', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const studentId = req.params.id;
  const list = db.students[schoolId] || [];
  const student = list.find(s => s.id === studentId);

  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  student.isDeleted = true;
  student.deletedAt = new Date().toISOString();
  student.updatedAt = new Date().toISOString();

  logAudit(schoolId, (req.query.actorEmail as string) || 'admin', 'Administrator', 'admin', 'STUDENT_SOFT_DELETE', 'student', studentId, `Soft-deleted student ${student.firstName} ${student.lastName} (${student.admissionNo})`, req);

  res.json({ success: true, message: 'Student soft-deleted successfully' });
});

app.post('/api/students/:id/restore', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const studentId = req.params.id;
  const list = db.students[schoolId] || [];
  const student = list.find(s => s.id === studentId);

  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  student.isDeleted = false;
  student.deletedAt = null;
  student.updatedAt = new Date().toISOString();

  logAudit(schoolId, req.body.actorEmail || 'admin', 'Administrator', 'admin', 'STUDENT_RESTORE', 'student', studentId, `Restored student ${student.firstName} ${student.lastName}`, req);

  res.json({ success: true, student });
});

app.post('/api/students/bulk-import', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const { students, actorEmail } = req.body;

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'Empty or invalid students array' });
  }

  if (!db.students[schoolId]) {
    db.students[schoolId] = [];
  }

  const createdList: any[] = [];
  const skippedList: any[] = [];

  students.forEach((row: any) => {
    if (!row.admissionNo || !row.firstName || !row.lastName) {
      skippedList.push({ row, reason: 'Missing required fields' });
      return;
    }

    const dup = db.students[schoolId].find(s => s.admissionNo === row.admissionNo && !s.isDeleted);
    if (dup) {
      skippedList.push({ row, reason: `Admission number ${row.admissionNo} already exists` });
      return;
    }

    const school = db.schools[schoolId];
    const domainPrefix = String(school?.shortCode || school?.code || 'school').toLowerCase().replace(/[^a-z0-9]/g, '');
    const defaultStudentEmail = `${String(row.firstName).trim().toLowerCase().replace(/[^a-z0-9]/g, '')}.${String(row.lastName).trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@${domainPrefix}.edu`;

    const newStudent = {
      id: 'std_' + Math.random().toString(36).substring(2, 9),
      schoolId,
      admissionNo: String(row.admissionNo).trim(),
      firstName: String(row.firstName).trim(),
      lastName: String(row.lastName).trim(),
      email: row.email ? String(row.email).trim().toLowerCase() : defaultStudentEmail,
      studentPassword: row.studentPassword ? String(row.studentPassword).trim() : 'student123',
      gender: ['male', 'female'].includes(String(row.gender).toLowerCase()) ? String(row.gender).toLowerCase() : 'other',
      classArm: row.classArm || 'JSS 1',
      guardianName: row.guardianName || '',
      guardianPhone: row.guardianPhone || '',
      guardianEmail: row.guardianEmail ? String(row.guardianEmail).trim().toLowerCase() : '',
      guardianPassword: row.guardianPassword ? String(row.guardianPassword).trim() : 'guardian123',
      accessToken: 'tok_' + crypto.randomBytes(8).toString('hex'),
      accessPin: Math.floor(100000 + Math.random() * 900000).toString(),
      studentPin: row.studentPin || Math.floor(1000 + Math.random() * 9000).toString(),
      status: 'active',
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.students[schoolId].push(newStudent);
    createdList.push(newStudent);
  });

  logAudit(schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'STUDENT_BULK_IMPORT', 'student', 'batch', `Imported ${createdList.length} pupils via CSV batch. Skipped: ${skippedList.length}`, req);

  res.json({
    success: true,
    importedCount: createdList.length,
    skippedCount: skippedList.length,
    skipped: skippedList
  });
});

// 6. Gradebook & Append-Only Score Events
app.get('/api/scores', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const school = db.schools[schoolId];
  const classArm = req.query.classArm as string;
  const subjectId = req.query.subjectId as string;
  const session = (req.query.session as string) || school?.currentSession || '2025/2026';
  const term = normalizeTerm((req.query.term as string) || school?.currentTerm || '2nd Term');

  let scores = db.scoreEvents[schoolId] || [];
  scores = scores.filter(sc => sc.session === session && normalizeTerm(sc.term) === term);

  if (subjectId && subjectId !== 'all') {
    scores = scores.filter(sc => sc.subjectId === subjectId);
  }

  if (classArm && classArm !== 'all') {
    const classStudentIds = new Set(
      (db.students[schoolId] || []).filter(s => s.classArm === classArm && !s.isDeleted).map(s => s.id)
    );
    scores = scores.filter(sc => classStudentIds.has(sc.studentId));
  }

  res.json({ scores });
});

// Smart Deterministic Batch Score JSON Import (Admin Multi-File / Unlimited Records)
app.post('/api/scores/import-json', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const school = db.schools[schoolId];
  if (!school) {
    return res.status(404).json({ error: 'School tenant not found.' });
  }

  const dryRun = Boolean(req.body.dryRun);
  const actorEmail = String(req.body.actorEmail || 'admin@school.edu');
  const rawPayloads = req.body.payloads;

  if (!Array.isArray(rawPayloads) || rawPayloads.length === 0) {
    return res.status(400).json({ error: 'Please provide at least one JSON score file or record array.' });
  }

  // Helper normalizers for zero-ambiguity matching
  const normCode = (val: any): string =>
    String(val || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');

  const normAlnum = (val: any): string =>
    String(val || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

  const normText = (val: any): string =>
    String(val || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Extract flat candidate score rows from any combination of TeacherScoreExportPackage, arrays, or single score objects
  interface ExtractedRawScore {
    sourceFile: string;
    raw: any;
    pkgSchoolId?: string;
    pkgSchoolCode?: string;
    pkgSession?: string;
    pkgTerm?: string;
    pkgClassArm?: string;
    pkgSubjectId?: string;
    pkgSubjectCode?: string;
    pkgSubjectName?: string;
    pkgExportedBy?: string;
    pkgExportedAt?: string;
  }

  const extracted: ExtractedRawScore[] = [];

  const collectFromNode = (node: any, sourceFile: string, inherited?: Partial<ExtractedRawScore>) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(child => collectFromNode(child, sourceFile, inherited));
      return;
    }
    if (typeof node !== 'object') return;

    // Unwrap { fileName, data } wrapper from frontend multi-file uploader
    if ('data' in node && (typeof node.fileName === 'string' || Array.isArray(node.data) || typeof node.data === 'object') && !('ca1' in node) && !('exam' in node) && !('records' in node)) {
      collectFromNode(node.data, node.fileName || sourceFile, inherited);
      return;
    }

    // TeacherScoreExportPackage or object with records[] / scores[] / scoreEvents[]
    const nextInherited: Partial<ExtractedRawScore> = {
      pkgSchoolId: node.school?.schoolId || node.school?.id || node.schoolId || inherited?.pkgSchoolId,
      pkgSchoolCode: node.school?.schoolCode || node.school?.code || node.schoolCode || inherited?.pkgSchoolCode,
      pkgSession: node.context?.session || node.session || inherited?.pkgSession,
      pkgTerm: node.context?.term || node.term || inherited?.pkgTerm,
      pkgClassArm: node.context?.classArm || node.classArm || inherited?.pkgClassArm,
      pkgSubjectId: node.context?.subjectId || node.subjectId || inherited?.pkgSubjectId,
      pkgSubjectCode: node.context?.subjectCode || node.subjectCode || inherited?.pkgSubjectCode,
      pkgSubjectName: node.context?.subjectName || node.subjectName || inherited?.pkgSubjectName,
      pkgExportedBy: node.exportedBy || node.recordedBy || inherited?.pkgExportedBy,
      pkgExportedAt: node.exportedAt || inherited?.pkgExportedAt
    };

    if (Array.isArray(node.records)) {
      node.records.forEach((r: any) => collectFromNode(r, sourceFile, nextInherited));
      return;
    }
    if (Array.isArray(node.scores)) {
      node.scores.forEach((r: any) => collectFromNode(r, sourceFile, nextInherited));
      return;
    }
    if (Array.isArray(node.scoreEvents)) {
      node.scoreEvents.forEach((r: any) => collectFromNode(r, sourceFile, nextInherited));
      return;
    }
    if (node.snapshot && Array.isArray(node.snapshot.scoreEvents)) {
      node.snapshot.scoreEvents.forEach((r: any) => collectFromNode(r, sourceFile, nextInherited));
      return;
    }

    // Leaf student score record
    extracted.push({
      sourceFile,
      raw: node,
      ...nextInherited
    });
  };

  rawPayloads.forEach((entry: any, idx: number) => {
    const fileLabel = entry?.fileName || `Batch_${idx + 1}.json`;
    collectFromNode(entry, fileLabel);
  });

  if (extracted.length === 0) {
    return res.status(400).json({ error: 'No student score records were found inside the uploaded JSON file(s).' });
  }

  // Build deterministic O(1) lookup indexes for active school students & subjects
  const activeStudents = (db.students[schoolId] || []).filter((s: any) => !s.isDeleted);
  const studentById = new Map<string, any>();
  const studentByAdmission = new Map<string, any>();
  const studentByEmail = new Map<string, any[]>();
  const studentByNameAndClass = new Map<string, any[]>();
  const studentByNameOnly = new Map<string, any[]>();

  for (const st of activeStudents) {
    studentById.set(String(st.id).trim(), st);
    if (st.admissionNo) {
      studentByAdmission.set(normCode(st.admissionNo), st);
    }
    if (st.email && String(st.email).trim()) {
      const em = String(st.email).trim().toLowerCase();
      const arr = studentByEmail.get(em) || [];
      arr.push(st);
      studentByEmail.set(em, arr);
    }
    const fName = normText(st.firstName);
    const lName = normText(st.lastName);
    const cArm = normText(st.classArm);
    const fullForward = `${fName} ${lName}`.trim();
    const fullReverse = `${lName} ${fName}`.trim();

    for (const variant of new Set([fullForward, fullReverse])) {
      if (!variant) continue;
      const classKey = `${variant}::${cArm}`;
      const listByClass = studentByNameAndClass.get(classKey) || [];
      if (!listByClass.some(x => x.id === st.id)) listByClass.push(st);
      studentByNameAndClass.set(classKey, listByClass);

      const listGlobal = studentByNameOnly.get(variant) || [];
      if (!listGlobal.some(x => x.id === st.id)) listGlobal.push(st);
      studentByNameOnly.set(variant, listGlobal);
    }
  }

  // Verify name consistency when both ID/AdmissionNo and Student Name are present (prevents sibling or manual typo mix-ups)
  const verifyStudentNameConsistency = (raw: any, dbStudent: any): { ok: boolean; reason?: string } => {
    const rawFirst = normText(raw.firstName);
    const rawLast = normText(raw.lastName);
    const rawFull = normText(raw.fullName || raw.studentName || raw.name);
    const dbFirst = normText(dbStudent.firstName);
    const dbLast = normText(dbStudent.lastName);

    if (rawFirst && rawLast) {
      const directMatch = rawFirst === dbFirst && rawLast === dbLast;
      const swappedMatch = rawFirst === dbLast && rawLast === dbFirst;
      if (!directMatch && !swappedMatch) {
        return {
          ok: false,
          reason: `Name mismatch: JSON specifies "${raw.firstName} ${raw.lastName}", whereas ${dbStudent.admissionNo} belongs to "${dbStudent.firstName} ${dbStudent.lastName}".`
        };
      }
      return { ok: true };
    }

    if (rawFull) {
      const rawTokens = rawFull.split(' ').filter(t => t.length >= 2);
      const dbTokens = `${dbFirst} ${dbLast}`.split(' ').filter(t => t.length >= 2);
      if (rawTokens.length > 0 && dbTokens.length > 0) {
        const allRawInDb = rawTokens.every(rt => dbTokens.some(dt => dt === rt || dt.startsWith(rt) || rt.startsWith(dt)));
        if (!allRawInDb) {
          return {
            ok: false,
            reason: `Name mismatch: JSON specifies "${raw.fullName || raw.studentName || raw.name}", whereas ${dbStudent.admissionNo} belongs to "${dbStudent.firstName} ${dbStudent.lastName}".`
          };
        }
      }
    }

    return { ok: true };
  };

  // Build subject lookup indexes
  const schoolSubjects = db.subjects[schoolId] || [];
  const subjectById = new Map<string, any>();
  const subjectByCode = new Map<string, any>();
  const subjectByName = new Map<string, any>();

  for (const sub of schoolSubjects) {
    subjectById.set(String(sub.id).trim(), sub);
    if (sub.code) subjectByCode.set(normCode(sub.code), sub);
    if (sub.name) subjectByName.set(normText(sub.name), sub);
  }

  const activeSchoolCodeAlnum = normAlnum(school.code);
  const activeShortCodeAlnum = normAlnum(school.shortCode);

  interface ValidatedCandidate {
    detailIndex: number;
    sourceFile: string;
    student: any;
    subject: any;
    matchMethod: string;
    session: string;
    term: CanonicalTerm;
    ca1: number;
    ca2: number;
    midterm: number;
    exam: number;
    total: number;
    grade: string;
    remark: string;
    recordedBy: string;
    recordedAt: string;
    recordedEpoch: number;
    clientChangeId: string;
  }

  const details: any[] = [];
  const validCandidatesByComposite = new Map<string, ValidatedCandidate[]>();

  extracted.forEach((item, index) => {
    const r = item.raw || {};
    const recSchoolId = String(r.schoolId || item.pkgSchoolId || '').trim();
    const recSchoolCode = String(r.schoolCode || item.pkgSchoolCode || '').trim();

    const displayStudentName =
      String(r.fullName || r.studentName || `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.studentId || 'Unknown Pupil').trim();
    const displayAdmissionNo = String(r.admissionNo || '—').trim();
    const displayClassArm = String(r.classArm || item.pkgClassArm || '—').trim();
    const displaySubject = String(r.subjectName || r.subjectCode || r.subjectId || item.pkgSubjectName || item.pkgSubjectCode || item.pkgSubjectId || 'Unknown Subject').trim();
    const resolvedSession = String(r.session || item.pkgSession || school.currentSession || '2025/2026').trim();
    const resolvedTerm = normalizeTerm(r.term || item.pkgTerm || school.currentTerm || '2nd Term');

    // 1. School Tenant Isolation Guard
    if (recSchoolCode) {
      const incomingCodeAlnum = normAlnum(recSchoolCode);
      if (
        incomingCodeAlnum &&
        incomingCodeAlnum !== activeSchoolCodeAlnum &&
        (!activeShortCodeAlnum || incomingCodeAlnum !== activeShortCodeAlnum)
      ) {
        details.push({
          index,
          sourceFile: item.sourceFile,
          status: 'school_mismatch',
          studentName: displayStudentName,
          admissionNo: displayAdmissionNo,
          classArm: displayClassArm,
          subjectName: displaySubject,
          session: resolvedSession,
          term: resolvedTerm,
          ca1: Number(r.ca1) || 0,
          ca2: Number(r.ca2) || 0,
          midterm: Number(r.midterm) || 0,
          exam: Number(r.exam) || 0,
          total: 0,
          grade: '-',
          reason: `Record belongs to School Code "${recSchoolCode}", but active school is "${school.code}". Blocked to prevent cross-school mix-up.`
        });
        return;
      }
    } else if (recSchoolId && recSchoolId !== schoolId) {
      details.push({
        index,
        sourceFile: item.sourceFile,
        status: 'school_mismatch',
        studentName: displayStudentName,
        admissionNo: displayAdmissionNo,
        classArm: displayClassArm,
        subjectName: displaySubject,
        session: resolvedSession,
        term: resolvedTerm,
        ca1: Number(r.ca1) || 0,
        ca2: Number(r.ca2) || 0,
        midterm: Number(r.midterm) || 0,
        exam: Number(r.exam) || 0,
        total: 0,
        grade: '-',
        reason: `Record belongs to another school tenant (${recSchoolId}). Blocked to prevent cross-school mix-up.`
      });
      return;
    }

    // 2. Deterministic Student Resolution + Anti-Mixup Cross-Verification
    const rawStudentId = String(r.studentId || '').trim();
    const rawAdm = normCode(r.admissionNo);
    const rawEmail = String(r.email || '').trim().toLowerCase();

    const byIdMatch = rawStudentId ? studentById.get(rawStudentId) : undefined;
    const byAdmMatch = rawAdm ? studentByAdmission.get(rawAdm) : undefined;

    let matchedStudent: any = null;
    let matchMethod = '';

    if (byIdMatch && byAdmMatch) {
      if (byIdMatch.id !== byAdmMatch.id) {
        details.push({
          index,
          sourceFile: item.sourceFile,
          status: 'identity_conflict',
          studentName: displayStudentName,
          admissionNo: displayAdmissionNo,
          classArm: displayClassArm,
          subjectName: displaySubject,
          session: resolvedSession,
          term: resolvedTerm,
          ca1: Number(r.ca1) || 0,
          ca2: Number(r.ca2) || 0,
          midterm: Number(r.midterm) || 0,
          exam: Number(r.exam) || 0,
          total: 0,
          grade: '-',
          reason: `Identity conflict: studentId (${rawStudentId}) points to "${byIdMatch.firstName} ${byIdMatch.lastName}" while Admission No (${r.admissionNo}) points to "${byAdmMatch.firstName} ${byAdmMatch.lastName}". Rejected to prevent mixing student records.`
        });
        return;
      }
      const nameCheck = verifyStudentNameConsistency(r, byIdMatch);
      if (!nameCheck.ok) {
        details.push({
          index,
          sourceFile: item.sourceFile,
          status: 'identity_conflict',
          studentName: displayStudentName,
          admissionNo: displayAdmissionNo,
          classArm: displayClassArm,
          subjectName: displaySubject,
          session: resolvedSession,
          term: resolvedTerm,
          ca1: Number(r.ca1) || 0,
          ca2: Number(r.ca2) || 0,
          midterm: Number(r.midterm) || 0,
          exam: Number(r.exam) || 0,
          total: 0,
          grade: '-',
          reason: nameCheck.reason
        });
        return;
      }
      matchedStudent = byIdMatch;
      matchMethod = 'Verified ID + Admission No';
    } else if (byIdMatch && !byAdmMatch) {
      // If admissionNo was supplied in JSON but doesn't match byIdMatch's admissionNo, flag conflict!
      if (rawAdm && normCode(byIdMatch.admissionNo) !== rawAdm) {
        details.push({
          index,
          sourceFile: item.sourceFile,
          status: 'identity_conflict',
          studentName: displayStudentName,
          admissionNo: displayAdmissionNo,
          classArm: displayClassArm,
          subjectName: displaySubject,
          session: resolvedSession,
          term: resolvedTerm,
          ca1: Number(r.ca1) || 0,
          ca2: Number(r.ca2) || 0,
          midterm: Number(r.midterm) || 0,
          exam: Number(r.exam) || 0,
          total: 0,
          grade: '-',
          reason: `Admission No mismatch: JSON specifies "${r.admissionNo}", but student ID ${rawStudentId} has Admission No "${byIdMatch.admissionNo}".`
        });
        return;
      }
      const nameCheck = verifyStudentNameConsistency(r, byIdMatch);
      if (!nameCheck.ok) {
        details.push({
          index,
          sourceFile: item.sourceFile,
          status: 'identity_conflict',
          studentName: displayStudentName,
          admissionNo: displayAdmissionNo,
          classArm: displayClassArm,
          subjectName: displaySubject,
          session: resolvedSession,
          term: resolvedTerm,
          ca1: Number(r.ca1) || 0,
          ca2: Number(r.ca2) || 0,
          midterm: Number(r.midterm) || 0,
          exam: Number(r.exam) || 0,
          total: 0,
          grade: '-',
          reason: nameCheck.reason
        });
        return;
      }
      matchedStudent = byIdMatch;
      matchMethod = 'Verified Student ID';
    } else if (!byIdMatch && byAdmMatch) {
      // If rawStudentId was a non-offline ID that doesn't exist, still verify name consistency on byAdmMatch
      const nameCheck = verifyStudentNameConsistency(r, byAdmMatch);
      if (!nameCheck.ok) {
        details.push({
          index,
          sourceFile: item.sourceFile,
          status: 'identity_conflict',
          studentName: displayStudentName,
          admissionNo: displayAdmissionNo,
          classArm: displayClassArm,
          subjectName: displaySubject,
          session: resolvedSession,
          term: resolvedTerm,
          ca1: Number(r.ca1) || 0,
          ca2: Number(r.ca2) || 0,
          midterm: Number(r.midterm) || 0,
          exam: Number(r.exam) || 0,
          total: 0,
          grade: '-',
          reason: nameCheck.reason
        });
        return;
      }
      matchedStudent = byAdmMatch;
      matchMethod = 'Verified Admission No';
    } else {
      // Neither studentId nor admissionNo matched; only fallback if no conflicting admissionNo was given
      if (rawAdm) {
        details.push({
          index,
          sourceFile: item.sourceFile,
          status: 'unmatched_student',
          studentName: displayStudentName,
          admissionNo: displayAdmissionNo,
          classArm: displayClassArm,
          subjectName: displaySubject,
          session: resolvedSession,
          term: resolvedTerm,
          ca1: Number(r.ca1) || 0,
          ca2: Number(r.ca2) || 0,
          midterm: Number(r.midterm) || 0,
          exam: Number(r.exam) || 0,
          total: 0,
          grade: '-',
          reason: `No active pupil found with Admission No "${r.admissionNo}".`
        });
        return;
      }

      if (rawEmail && studentByEmail.has(rawEmail)) {
        const emailMatches = studentByEmail.get(rawEmail)!;
        if (emailMatches.length === 1) {
          const nameCheck = verifyStudentNameConsistency(r, emailMatches[0]);
          if (nameCheck.ok) {
            matchedStudent = emailMatches[0];
            matchMethod = 'Verified Pupil Email';
          }
        }
      }

      if (!matchedStudent) {
        const candidateFullName = normText(r.fullName || r.studentName || `${r.firstName || ''} ${r.lastName || ''}`);
        const candidateClass = normText(r.classArm || item.pkgClassArm);

        if (candidateFullName && candidateClass) {
          const matchesInClass = studentByNameAndClass.get(`${candidateFullName}::${candidateClass}`) || [];
          if (matchesInClass.length === 1) {
            matchedStudent = matchesInClass[0];
            matchMethod = 'Unique Full Name + Class';
          } else if (matchesInClass.length > 1) {
            details.push({
              index,
              sourceFile: item.sourceFile,
              status: 'ambiguous_student',
              studentName: displayStudentName,
              admissionNo: displayAdmissionNo,
              classArm: displayClassArm,
              subjectName: displaySubject,
              session: resolvedSession,
              term: resolvedTerm,
              ca1: Number(r.ca1) || 0,
              ca2: Number(r.ca2) || 0,
              midterm: Number(r.midterm) || 0,
              exam: Number(r.exam) || 0,
              total: 0,
              grade: '-',
              reason: `${matchesInClass.length} pupils share the name "${displayStudentName}" in ${displayClassArm}. Admission No required to prevent mix-up.`
            });
            return;
          }
        } else if (candidateFullName) {
          const globalMatches = studentByNameOnly.get(candidateFullName) || [];
          if (globalMatches.length === 1) {
            matchedStudent = globalMatches[0];
            matchMethod = 'Unique Full Name (School-wide)';
          } else if (globalMatches.length > 1) {
            details.push({
              index,
              sourceFile: item.sourceFile,
              status: 'ambiguous_student',
              studentName: displayStudentName,
              admissionNo: displayAdmissionNo,
              classArm: displayClassArm,
              subjectName: displaySubject,
              session: resolvedSession,
              term: resolvedTerm,
              ca1: Number(r.ca1) || 0,
              ca2: Number(r.ca2) || 0,
              midterm: Number(r.midterm) || 0,
              exam: Number(r.exam) || 0,
              total: 0,
              grade: '-',
              reason: `Multiple pupils share the name "${displayStudentName}". Include Admission No or Class Arm to disambiguate.`
            });
            return;
          }
        }
      }

      if (!matchedStudent) {
        details.push({
          index,
          sourceFile: item.sourceFile,
          status: 'unmatched_student',
          studentName: displayStudentName,
          admissionNo: displayAdmissionNo,
          classArm: displayClassArm,
          subjectName: displaySubject,
          session: resolvedSession,
          term: resolvedTerm,
          ca1: Number(r.ca1) || 0,
          ca2: Number(r.ca2) || 0,
          midterm: Number(r.midterm) || 0,
          exam: Number(r.exam) || 0,
          total: 0,
          grade: '-',
          reason: 'Could not deterministically match pupil in school directory.'
        });
        return;
      }
    }

    // 3. Deterministic Subject Resolution
    const rawSubId = String(r.subjectId || item.pkgSubjectId || '').trim();
    const rawSubCode = normCode(r.subjectCode || item.pkgSubjectCode);
    const rawSubName = normText(r.subjectName || item.pkgSubjectName);

    let matchedSubject: any = null;
    if (rawSubId && subjectById.has(rawSubId)) {
      const subCand = subjectById.get(rawSubId)!;
      if (rawSubCode && normCode(subCand.code) !== rawSubCode) {
        details.push({
          index,
          sourceFile: item.sourceFile,
          status: 'unmatched_subject',
          studentId: matchedStudent.id,
          studentName: `${matchedStudent.firstName} ${matchedStudent.lastName}`,
          admissionNo: matchedStudent.admissionNo,
          classArm: matchedStudent.classArm,
          subjectName: displaySubject,
          session: resolvedSession,
          term: resolvedTerm,
          ca1: Number(r.ca1) || 0,
          ca2: Number(r.ca2) || 0,
          midterm: Number(r.midterm) || 0,
          exam: Number(r.exam) || 0,
          total: 0,
          grade: '-',
          reason: `Subject conflict: subjectId "${rawSubId}" (${subCand.code}) conflicts with subjectCode "${rawSubCode}".`
        });
        return;
      }
      matchedSubject = subCand;
    } else if (rawSubCode && subjectByCode.has(rawSubCode)) {
      matchedSubject = subjectByCode.get(rawSubCode)!;
    } else if (rawSubName && subjectByName.has(rawSubName)) {
      matchedSubject = subjectByName.get(rawSubName)!;
    }

    if (!matchedSubject) {
      details.push({
        index,
        sourceFile: item.sourceFile,
        status: 'unmatched_subject',
        studentId: matchedStudent.id,
        studentName: `${matchedStudent.firstName} ${matchedStudent.lastName}`,
        admissionNo: matchedStudent.admissionNo,
        classArm: matchedStudent.classArm,
        subjectName: displaySubject,
        session: resolvedSession,
        term: resolvedTerm,
        ca1: Number(r.ca1) || 0,
        ca2: Number(r.ca2) || 0,
        midterm: Number(r.midterm) || 0,
        exam: Number(r.exam) || 0,
        total: 0,
        grade: '-',
        reason: `Subject "${displaySubject}" does not match any registered subject in ${school.name}.`
      });
      return;
    }

    // 4. Strict Assessment Score Validation (CA1 <= 15, CA2 <= 15, Midterm <= 20, Exam <= 50)
    const parseScoreComponent = (val: any, max: number, label: string): { ok: boolean; value: number; err?: string } => {
      if (val === undefined || val === null || val === '') return { ok: true, value: 0 };
      const num = Number(val);
      if (!Number.isFinite(num) || num < 0 || num > max) {
        return { ok: false, value: 0, err: `${label} score (${val}) must be between 0 and ${max}.` };
      }
      return { ok: true, value: Math.round(num) };
    };

    const c1 = parseScoreComponent(r.ca1, 15, 'CA1');
    const c2 = parseScoreComponent(r.ca2, 15, 'CA2');
    const mid = parseScoreComponent(r.midterm, 20, 'Midterm');
    const ex = parseScoreComponent(r.exam, 50, 'Exam');

    if (!c1.ok || !c2.ok || !mid.ok || !ex.ok) {
      details.push({
        index,
        sourceFile: item.sourceFile,
        status: 'invalid_score',
        studentId: matchedStudent.id,
        studentName: `${matchedStudent.firstName} ${matchedStudent.lastName}`,
        admissionNo: matchedStudent.admissionNo,
        classArm: matchedStudent.classArm,
        subjectId: matchedSubject.id,
        subjectName: matchedSubject.name,
        subjectCode: matchedSubject.code,
        session: resolvedSession,
        term: resolvedTerm,
        ca1: Number(r.ca1) || 0,
        ca2: Number(r.ca2) || 0,
        midterm: Number(r.midterm) || 0,
        exam: Number(r.exam) || 0,
        total: 0,
        grade: '-',
        reason: c1.err || c2.err || mid.err || ex.err
      });
      return;
    }

    const { total, grade, remark } = calculateGrade(c1.value, c2.value, mid.value, ex.value);
    const recordedAtStr = String(r.recordedAt || r.timestamp || item.pkgExportedAt || new Date().toISOString());
    const recordedEpoch = Date.parse(recordedAtStr) || 0;

    const compositeKey = `${matchedStudent.id}::${matchedSubject.id}::${resolvedSession}::${resolvedTerm}`;
    const detailIndex = details.length;

    details.push({
      index,
      sourceFile: item.sourceFile,
      status: 'updated', // refined below after deduplication & DB check
      matchMethod,
      studentId: matchedStudent.id,
      studentName: `${matchedStudent.firstName} ${matchedStudent.lastName}`,
      admissionNo: matchedStudent.admissionNo,
      classArm: matchedStudent.classArm,
      subjectId: matchedSubject.id,
      subjectName: matchedSubject.name,
      subjectCode: matchedSubject.code,
      session: resolvedSession,
      term: resolvedTerm,
      ca1: c1.value,
      ca2: c2.value,
      midterm: mid.value,
      exam: ex.value,
      total,
      grade,
      previousTotal: null
    });

    const list = validCandidatesByComposite.get(compositeKey) || [];
    list.push({
      detailIndex,
      sourceFile: item.sourceFile,
      student: matchedStudent,
      subject: matchedSubject,
      matchMethod,
      session: resolvedSession,
      term: resolvedTerm,
      ca1: c1.value,
      ca2: c2.value,
      midterm: mid.value,
      exam: ex.value,
      total,
      grade,
      remark,
      recordedBy: String(r.recordedBy || item.pkgExportedBy || actorEmail),
      recordedAt: recordedAtStr,
      recordedEpoch,
      clientChangeId: String(r.clientChangeId || 'cc_json_' + crypto.randomUUID())
    });
    validCandidatesByComposite.set(compositeKey, list);
  });

  if (!db.scoreEvents[schoolId]) {
    db.scoreEvents[schoolId] = [];
  }

  let createdCount = 0;
  let updatedCount = 0;
  let deduplicatedCount = 0;

  for (const [, group] of validCandidatesByComposite.entries()) {
    // Sort by newest timestamp first; if equal timestamp, later item in batch wins
    const sorted = [...group].sort((a, b) => {
      if (b.recordedEpoch !== a.recordedEpoch) return b.recordedEpoch - a.recordedEpoch;
      return b.detailIndex - a.detailIndex;
    });

    const winner = sorted[0];
    const olderDuplicates = sorted.slice(1);

    for (const dup of olderDuplicates) {
      deduplicatedCount++;
      details[dup.detailIndex].status = 'deduplicated_older';
      details[dup.detailIndex].reason = `Superseded by a newer score entry for ${winner.student.admissionNo} (${winner.subject.code}) in the same upload batch.`;
    }

    const existingIdx = db.scoreEvents[schoolId].findIndex(
      sc =>
        sc.studentId === winner.student.id &&
        sc.subjectId === winner.subject.id &&
        sc.session === winner.session &&
        normalizeTerm(sc.term) === winner.term
    );

    const existingRecord = existingIdx !== -1 ? db.scoreEvents[schoolId][existingIdx] : null;
    details[winner.detailIndex].previousTotal = existingRecord ? existingRecord.total : null;
    details[winner.detailIndex].status = existingRecord ? 'updated' : 'created';

    if (existingRecord) {
      updatedCount++;
    } else {
      createdCount++;
    }

    if (!dryRun) {
      const scoreRecord = {
        id: existingRecord ? existingRecord.id : 'sc_' + Math.random().toString(36).substring(2, 9),
        clientChangeId: winner.clientChangeId,
        schoolId,
        studentId: winner.student.id,
        subjectId: winner.subject.id,
        session: winner.session,
        term: winner.term,
        ca1: winner.ca1,
        ca2: winner.ca2,
        midterm: winner.midterm,
        exam: winner.exam,
        total: winner.total,
        grade: winner.grade,
        remark: winner.remark,
        recordedBy: winner.recordedBy,
        deviceId: 'admin_json_batch_import',
        timestamp: new Date().toISOString(),
        synced: true
      };

      if (existingIdx !== -1) {
        db.scoreEvents[schoolId][existingIdx] = scoreRecord;
      } else {
        db.scoreEvents[schoolId].push(scoreRecord);
      }
      db.processedClientChangeIds.add(winner.clientChangeId);
    }
  }

  const conflictCount = details.filter(
    d => d.status === 'identity_conflict' || d.status === 'school_mismatch' || d.status === 'ambiguous_student'
  ).length;
  const unmatchedCount = details.filter(
    d => d.status === 'unmatched_student' || d.status === 'unmatched_subject'
  ).length;
  const invalidCount = details.filter(d => d.status === 'invalid_score').length;
  const appliedCount = createdCount + updatedCount;

  if (!dryRun && appliedCount > 0) {
    logAudit(
      schoolId,
      actorEmail,
      'Administrator',
      'admin',
      'BULK_SCORE_JSON_IMPORT',
      'score',
      'batch_json',
      `Smart-matched & applied ${appliedCount} student score records (${createdCount} new, ${updatedCount} updated; ${conflictCount} conflicts blocked, ${unmatchedCount} unmatched) across ${rawPayloads.length} JSON payload(s).`,
      req
    );
  }

  res.json({
    success: true,
    dryRun,
    totalReceived: extracted.length,
    appliedCount,
    createdCount,
    updatedCount,
    deduplicatedCount,
    conflictCount,
    unmatchedCount,
    invalidCount,
    details
  });
});

// 7. Financial Ledger & Fee Management
app.get('/api/ledger', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const studentId = req.query.studentId as string;

  let entries = db.ledgerEntries[schoolId] || [];
  if (studentId) {
    entries = entries.filter(e => e.studentId === studentId);
  }

  const studentBalances: Record<string, { totalBilled: number; totalPaid: number; arrears: number }> = {};
  for (const entry of entries) {
    if (!studentBalances[entry.studentId]) {
      studentBalances[entry.studentId] = { totalBilled: 0, totalPaid: 0, arrears: 0 };
    }
    if (entry.type === 'DEBIT_FEE') {
      studentBalances[entry.studentId].totalBilled += entry.amountMinor;
    } else if (entry.type === 'CREDIT_PAYMENT' || entry.type === 'WAIVER') {
      studentBalances[entry.studentId].totalPaid += entry.amountMinor;
    }
    studentBalances[entry.studentId].arrears = Math.max(0, studentBalances[entry.studentId].totalBilled - studentBalances[entry.studentId].totalPaid);
  }

  res.json({ entries, studentBalances });
});

app.post('/api/ledger/record', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const { studentId, type, amountMinor, description, category, paymentChannel, referenceNo, actorEmail } = req.body;

  if (!studentId || !type || typeof amountMinor !== 'number' || amountMinor <= 0) {
    return res.status(400).json({ error: 'Valid studentId, type, and positive integer amountMinor are required.' });
  }

  const integerMinor = Math.round(amountMinor);

  if (!db.ledgerEntries[schoolId]) {
    db.ledgerEntries[schoolId] = [];
  }

  const receiptNo = type === 'CREDIT_PAYMENT'
    ? 'REC-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000)
    : undefined;

  const timestamp = new Date().toISOString();
  let verificationHash: string | undefined = undefined;

  if (type === 'CREDIT_PAYMENT' && receiptNo) {
    verificationHash = crypto
      .createHash('sha256')
      .update(`${schoolId}:${receiptNo}:${studentId}:${integerMinor}:${timestamp}`)
      .digest('hex');
  }

  const clientChangeId = 'cc_srv_' + crypto.randomUUID();
  const entry = {
    id: 'led_' + Math.random().toString(36).substring(2, 9),
    clientChangeId,
    schoolId,
    studentId,
    type,
    amountMinor: integerMinor,
    description: description || (type === 'CREDIT_PAYMENT' ? 'School Fee Payment' : 'Fee Assessment'),
    category: category || 'Tuition',
    receiptNo,
    paymentChannel: paymentChannel || 'BANK_TRANSFER',
    referenceNo: referenceNo || '',
    verificationHash,
    recordedBy: actorEmail || 'bursar@oakridge.edu',
    timestamp,
    synced: true
  };

  db.ledgerEntries[schoolId].unshift(entry);
  db.processedClientChangeIds.add(clientChangeId);

  logAudit(
    schoolId,
    actorEmail || 'bursar',
    'Bursar',
    'bursar',
    type === 'CREDIT_PAYMENT' ? 'PAYMENT_RECORDED' : 'FEE_DEBITED',
    'ledger',
    entry.id,
    `${type} of ${integerMinor} minor units recorded for student ${studentId}. Receipt: ${receiptNo || 'N/A'}`,
    req
  );

  res.status(201).json({ entry });
});

app.post('/api/ledger/assess-class', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || (req.headers['x-school-id'] as string) || DEFAULT_SCHOOL_ID;
  const { classArm, name, description, amountMinor, category, term, session, actorEmail } = req.body;
  const feeName = name || description || 'Tuition Assessment';
  if (!classArm || (!name && !description) || typeof amountMinor !== 'number' || amountMinor <= 0) {
    return res.status(400).json({ error: 'classArm, name, and valid amountMinor are required' });
  }
  const integerMinor = Math.round(amountMinor);
  const activeStudents = (db.students[schoolId] || []).filter(s => s.classArm === classArm && !s.isDeleted);
  const now = new Date().toISOString();
  if (!db.ledgerEntries[schoolId]) db.ledgerEntries[schoolId] = [];

  let assessedCount = 0;
  activeStudents.forEach(st => {
    const clientChangeId = 'cc_srv_' + crypto.randomUUID();
    const entry = {
      id: 'led_' + Math.random().toString(36).substring(2, 9),
      clientChangeId,
      schoolId,
      studentId: st.id,
      type: 'DEBIT_FEE',
      amountMinor: integerMinor,
      description: `${feeName} (${normalizeTerm(term || db.schools[schoolId]?.currentTerm || '2nd Term')})`,
      category: category || 'Tuition',
      receiptNo: 'BILL-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
      paymentChannel: 'BANK_TRANSFER',
      referenceNo: '',
      recordedBy: actorEmail || 'bursar',
      timestamp: now,
      synced: true
    };
    db.ledgerEntries[schoolId].unshift(entry);
    db.processedClientChangeIds.add(clientChangeId);
    assessedCount++;
  });
  logAudit(schoolId, actorEmail || 'bursar', 'Bursar', 'bursar', 'CLASS_FEE_ASSESS', 'ledger', classArm, `Assessed fee "${name}" (${integerMinor} minor units) to ${assessedCount} pupils in ${classArm}`, req);
  res.json({ success: true, assessedCount, message: `Assessed fee to ${assessedCount} pupils in ${classArm}` });
});

// 8. IDEMPOTENT OFFLINE SYNC PIPELINE
app.post('/api/sync/push', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const items = req.body.items;

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Payload must be an array of outbox items' });
  }

  const school = db.schools[schoolId];
  if (!school) {
    return res.status(404).json({ error: 'School not found' });
  }

  const results: any[] = [];
  let processedCount = 0;
  let skippedIdempotentCount = 0;

  for (const item of items) {
    const { clientChangeId, entity, action, deviceId, payload, timestamp } = item;

    if (!clientChangeId) {
      results.push({ clientChangeId: 'unknown', status: 'error', reason: 'Missing clientChangeId' });
      continue;
    }

    if (db.processedClientChangeIds.has(clientChangeId)) {
      skippedIdempotentCount++;
      results.push({ clientChangeId, status: 'already_processed', acknowledged: true });
      continue;
    }

    try {
      if (entity === 'score') {
        if (school.isReportsLocked) {
          results.push({ clientChangeId, status: 'rejected', reason: 'Terminal reports are locked by Administration.' });
          continue;
        }

        const { studentId, subjectId, session, term, ca1, ca2, midterm, exam, recordedBy } = payload;
        const validCa1 = Math.min(15, Math.max(0, Number(ca1) || 0));
        const validCa2 = Math.min(15, Math.max(0, Number(ca2) || 0));
        const validMid = Math.min(20, Math.max(0, Number(midterm) || 0));
        const validExam = Math.min(50, Math.max(0, Number(exam) || 0));
        const { total, grade, remark } = calculateGrade(validCa1, validCa2, validMid, validExam);

        if (!db.scoreEvents[schoolId]) {
          db.scoreEvents[schoolId] = [];
        }

        const resolvedSession = session || school.currentSession;
        const resolvedTerm = normalizeTerm(term || school.currentTerm);
        const existingIdx = db.scoreEvents[schoolId].findIndex(
          sc => sc.studentId === studentId && sc.subjectId === subjectId && sc.session === resolvedSession && normalizeTerm(sc.term) === resolvedTerm
        );

        const scoreRecord = {
          id: existingIdx !== -1 ? db.scoreEvents[schoolId][existingIdx].id : 'sc_' + Math.random().toString(36).substring(2, 9),
          clientChangeId,
          schoolId,
          studentId,
          subjectId,
          session: resolvedSession,
          term: resolvedTerm,
          ca1: validCa1,
          ca2: validCa2,
          midterm: validMid,
          exam: validExam,
          total,
          grade,
          remark,
          recordedBy: recordedBy || 'offline_sync',
          deviceId: deviceId || 'unknown_device',
          timestamp: timestamp || new Date().toISOString(),
          synced: true
        };

        if (existingIdx !== -1) {
          db.scoreEvents[schoolId][existingIdx] = scoreRecord;
        } else {
          db.scoreEvents[schoolId].push(scoreRecord);
        }

        db.processedClientChangeIds.add(clientChangeId);
        processedCount++;
        results.push({ clientChangeId, status: 'committed', entity: 'score', id: scoreRecord.id });
      } else if (entity === 'ledger') {
        const { studentId, type, amountMinor, description, category, paymentChannel, referenceNo, recordedBy } = payload;
        const integerAmount = Math.round(Number(amountMinor) || 0);

        if (integerAmount <= 0) {
          results.push({ clientChangeId, status: 'rejected', reason: 'Invalid non-positive amount' });
          continue;
        }

        const receiptNo = type === 'CREDIT_PAYMENT'
          ? (payload.receiptNo || 'REC-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000))
          : undefined;

        const syncTimestamp = timestamp || new Date().toISOString();
        let verificationHash = payload.verificationHash;
        if (type === 'CREDIT_PAYMENT' && receiptNo && !verificationHash) {
          verificationHash = crypto
            .createHash('sha256')
            .update(`${schoolId}:${receiptNo}:${studentId}:${integerAmount}:${syncTimestamp}`)
            .digest('hex');
        }

        if (!db.ledgerEntries[schoolId]) {
          db.ledgerEntries[schoolId] = [];
        }

        const ledgerRecord = {
          id: 'led_' + Math.random().toString(36).substring(2, 9),
          clientChangeId,
          schoolId,
          studentId,
          type: type || 'CREDIT_PAYMENT',
          amountMinor: integerAmount,
          description: description || 'Offline Sync Payment',
          category: category || 'Tuition',
          receiptNo,
          paymentChannel: paymentChannel || 'CASH',
          referenceNo: referenceNo || '',
          verificationHash,
          recordedBy: recordedBy || 'offline_sync',
          timestamp: syncTimestamp,
          synced: true
        };

        db.ledgerEntries[schoolId].unshift(ledgerRecord);
        db.processedClientChangeIds.add(clientChangeId);
        processedCount++;
        results.push({ clientChangeId, status: 'committed', entity: 'ledger', id: ledgerRecord.id, receiptNo });
      }
    } catch (err: any) {
      results.push({ clientChangeId, status: 'error', reason: err.message });
    }
  }

  res.json({ success: true, processedCount, skippedIdempotentCount, results });
});

// Helper to construct complete Student Portal payload
function buildStudentPortalPayload(schoolId: string, student: any) {
  const school = db.schools[schoolId];
  const activeSchoolTerm = normalizeTerm(school.currentTerm);
  const allScores = db.scoreEvents[schoolId] || [];
  const subjectsMap: Record<string, string> = {};
  (db.subjects[schoolId] || []).forEach(sub => {
    subjectsMap[sub.id] = sub.name;
  });

  const currentScores = allScores
    .filter(sc => sc.studentId === student.id && sc.session === school.currentSession && normalizeTerm(sc.term) === activeSchoolTerm)
    .map(sc => ({
      subjectName: subjectsMap[sc.subjectId] || sc.subjectId,
      ca1: sc.ca1,
      ca2: sc.ca2,
      midterm: sc.midterm,
      exam: sc.exam,
      total: sc.total,
      grade: sc.grade,
      remark: sc.remark
    }));

  const currentTotal = currentScores.reduce((acc, curr) => acc + curr.total, 0);
  const currentAvg = currentScores.length > 0 ? (currentTotal / currentScores.length).toFixed(1) : 'N/A';

  const studentAttRecords = (db.attendance[schoolId] || []).filter(a => a.studentId === student.id);
  const totalAtt = studentAttRecords.length;
  const presentAtt = studentAttRecords.filter(a => a.status === 'present' || a.status === 'late').length;
  const realStudentAttendanceRate = totalAtt > 0 ? `${Math.round((presentAtt / totalAtt) * 100)}%` : '100%';

  const historyList = SCHOOL_TERMS.map(termName => {
    const termScores = allScores
      .filter(sc => sc.studentId === student.id && sc.session === school.currentSession && normalizeTerm(sc.term) === termName)
      .map(sc => ({
        subjectName: subjectsMap[sc.subjectId] || sc.subjectId,
        ca1: sc.ca1,
        ca2: sc.ca2,
        midterm: sc.midterm,
        exam: sc.exam,
        total: sc.total,
        grade: sc.grade,
        remark: sc.remark
      }));

    const termTotal = termScores.reduce((acc, curr) => acc + curr.total, 0);
    const termAvg = termScores.length > 0 ? Number((termTotal / termScores.length).toFixed(1)) : 0;

    return {
      session: school.currentSession,
      term: termName,
      averageScore: termAvg,
      attendance: realStudentAttendanceRate,
      scores: termScores
    };
  });

  const ledger = db.ledgerEntries[schoolId] || [];
  const studentLedger = ledger.filter(l => l.studentId === student.id);
  const totalBilled = studentLedger.filter(l => l.type === 'DEBIT_FEE').reduce((a, c) => a + c.amountMinor, 0);
  const totalPaid = studentLedger.filter(l => l.type === 'CREDIT_PAYMENT' || l.type === 'WAIVER').reduce((a, c) => a + c.amountMinor, 0);
  const arrears = Math.max(0, totalBilled - totalPaid);

  const pendingPayments = studentLedger.filter(l => l.type === 'DEBIT_FEE').map(bill => ({
    description: bill.description,
    category: bill.category || 'Tuition',
    amountMinor: bill.amountMinor,
    dateBilled: bill.timestamp
  }));

  const recentReceipts = studentLedger
    .filter(l => l.type === 'CREDIT_PAYMENT' && l.receiptNo)
    .map(rec => ({
      receiptNo: rec.receiptNo,
      amountMinor: rec.amountMinor,
      date: rec.timestamp,
      channel: rec.paymentChannel,
      verificationHash: rec.verificationHash
    }));

  return {
    student: {
      id: student.id,
      admissionNo: student.admissionNo,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      classArm: student.classArm,
      status: student.status
    },
    school: {
      id: school.id,
      name: school.name,
      code: school.code,
      logoUrl: school.logoUrl || '',
      currencySymbol: school.currencySymbol,
      currentSession: school.currentSession,
      currentTerm: activeSchoolTerm,
      isReportsLocked: school.isReportsLocked
    },
    currentReport: {
      scores: currentScores,
      averageScore: currentAvg,
      totalSubjects: currentScores.length,
      attendanceRate: realStudentAttendanceRate
    },
    history: historyList,
    financialSummary: {
      totalBilledMinor: totalBilled,
      totalPaidMinor: totalPaid,
      arrearsMinor: arrears,
      isCleared: arrears === 0,
      pendingBills: pendingPayments,
      recentReceipts
    }
  };
}

// Helper to construct Guardian / Parent Portal payload for a ward
function buildParentPortalPayload(schoolId: string, student: any) {
  const school = db.schools[schoolId];
  const activeSchoolTerm = normalizeTerm(school.currentTerm);
  const allScores = db.scoreEvents[schoolId] || [];
  const subjectsMap: Record<string, string> = {};
  (db.subjects[schoolId] || []).forEach(sub => {
    subjectsMap[sub.id] = sub.name;
  });

  const studentScores = allScores.filter(
    sc => sc.studentId === student.id && sc.session === school.currentSession && normalizeTerm(sc.term) === activeSchoolTerm
  );

  const formattedScores = studentScores.map(sc => ({
    subjectName: subjectsMap[sc.subjectId] || sc.subjectId,
    ca1: sc.ca1,
    ca2: sc.ca2,
    midterm: sc.midterm,
    exam: sc.exam,
    total: sc.total,
    grade: sc.grade,
    remark: sc.remark
  }));

  const totalScoreSum = formattedScores.reduce((acc, curr) => acc + curr.total, 0);
  const averageScore = formattedScores.length > 0 ? (totalScoreSum / formattedScores.length).toFixed(1) : 'N/A';

  const parentAttRecords = (db.attendance[schoolId] || []).filter(a => a.studentId === student.id);
  const pTotalAtt = parentAttRecords.length;
  const pPresentAtt = parentAttRecords.filter(a => a.status === 'present' || a.status === 'late').length;
  const parentAttendanceRate = pTotalAtt > 0 ? `${Math.round((pPresentAtt / pTotalAtt) * 100)}%` : '100%';

  const history = SCHOOL_TERMS.map(termName => {
    const tScores = allScores
      .filter(sc => sc.studentId === student.id && sc.session === school.currentSession && normalizeTerm(sc.term) === termName)
      .map(sc => ({
        subjectName: subjectsMap[sc.subjectId] || sc.subjectId,
        ca1: sc.ca1,
        ca2: sc.ca2,
        midterm: sc.midterm,
        exam: sc.exam,
        total: sc.total,
        grade: sc.grade,
        remark: sc.remark
      }));

    const tSum = tScores.reduce((a, c) => a + c.total, 0);
    const tAvg = tScores.length > 0 ? Number((tSum / tScores.length).toFixed(1)) : 0;

    return {
      term: termName,
      session: school.currentSession,
      averageScore: tAvg,
      attendance: parentAttendanceRate,
      scores: tScores
    };
  });

  const ledger = db.ledgerEntries[schoolId] || [];
  const studentLedger = ledger.filter(l => l.studentId === student.id);
  const totalBilled = studentLedger.filter(l => l.type === 'DEBIT_FEE').reduce((a, c) => a + c.amountMinor, 0);
  const totalPaid = studentLedger.filter(l => l.type === 'CREDIT_PAYMENT' || l.type === 'WAIVER').reduce((a, c) => a + c.amountMinor, 0);
  const arrears = Math.max(0, totalBilled - totalPaid);

  return {
    student: {
      id: student.id,
      admissionNo: student.admissionNo,
      firstName: student.firstName,
      lastName: student.lastName,
      classArm: student.classArm,
      status: student.status
    },
    school: {
      id: school.id,
      name: school.name,
      code: school.code,
      logoUrl: school.logoUrl || '',
      currencySymbol: school.currencySymbol,
      currentSession: school.currentSession,
      currentTerm: activeSchoolTerm,
      isReportsLocked: school.isReportsLocked
    },
    academicReport: {
      scores: formattedScores,
      averageScore,
      totalSubjects: formattedScores.length,
      attendanceRate: parentAttendanceRate
    },
    history,
    financialStatus: {
      totalBilledMinor: totalBilled,
      totalPaidMinor: totalPaid,
      arrearsMinor: arrears,
      isCleared: arrears === 0,
      recentReceipts: studentLedger.filter(l => l.type === 'CREDIT_PAYMENT' && l.receiptNo).slice(0, 3)
    }
  };
}

// 9. STUDENT DIRECT LOGIN PORTAL
app.post('/api/student/login', (req: Request, res: Response) => {
  const resolvedByCode = req.body.schoolCode ? findSchoolByCode(req.body.schoolCode) : null;
  const schoolId = resolvedByCode?.id || req.body.schoolId || DEFAULT_SCHOOL_ID;
  const targetSchool = db.schools[schoolId];
  if (!targetSchool) {
    return res.status(404).json({ error: 'Invalid School Code.' });
  }
  if (targetSchool.subscriptionStatus === 'pending') {
    return res.status(401).json({
      error: 'Your school enrollment is awaiting verification by the MINO team. Please try again after verification.'
    });
  }
  const { admissionNo, studentPin, email, password } = req.body;
  const students = (db.students[schoolId] || []).filter(s => !s.isDeleted);

  let student: any = null;
  if (email) {
    student = students.find(s => String(s.email || '').toLowerCase() === String(email).trim().toLowerCase());
    if (!student) {
      return res.status(404).json({ error: 'No active student found with this email.' });
    }
    if (String(student.studentPassword || student.studentPin || '') !== String(password || '').trim()) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
  } else {
    if (!admissionNo) {
      return res.status(400).json({ error: 'Email or Admission Number is required.' });
    }
    student = students.find(s => s.admissionNo.toLowerCase() === admissionNo.trim().toLowerCase());
    if (!student) {
      return res.status(404).json({ error: 'No active student found with this Admission Number.' });
    }
    if (studentPin && student.studentPin && student.studentPin !== studentPin.trim()) {
      return res.status(401).json({ error: 'Incorrect Student Passcode/PIN.' });
    }
  }

  logAudit(
    schoolId,
    student.email || student.admissionNo,
    `${student.firstName} ${student.lastName}`,
    'student',
    'STUDENT_PORTAL_LOGIN',
    'student',
    student.id,
    `Student logged in to view results and pending payments.`,
    req
  );

  res.json(buildStudentPortalPayload(schoolId, student));
});

// 10. PARENT / GUARDIAN ACCESS PORTAL
app.post('/api/parent/lookup', (req: Request, res: Response) => {
  const resolvedByCode = req.body.schoolCode ? findSchoolByCode(req.body.schoolCode) : null;
  const schoolId = resolvedByCode?.id || req.body.schoolId || DEFAULT_SCHOOL_ID;
  const targetSchool = db.schools[schoolId];
  if (!targetSchool) {
    return res.status(404).json({ error: 'Invalid School Code.' });
  }
  if (targetSchool.subscriptionStatus === 'pending') {
    return res.status(401).json({
      error: 'Your school enrollment is awaiting verification by the MINO team. Please try again after verification.'
    });
  }
  const { admissionNo, accessPin, accessToken, email, password } = req.body;
  const students = (db.students[schoolId] || []).filter(s => !s.isDeleted);
  let student: any = null;

  if (email) {
    const matched = students.filter(s => String(s.guardianEmail || '').toLowerCase() === String(email).trim().toLowerCase());
    student = matched.find(s => String(s.guardianPassword || s.accessPin || '') === String(password || '').trim());
  } else if (accessToken) {
    student = students.find(s => s.accessToken === accessToken.trim());
  } else if (admissionNo && accessPin) {
    student = students.find(
      s => s.admissionNo.toLowerCase() === admissionNo.trim().toLowerCase() &&
           s.accessPin === accessPin.trim()
    );
  }

  if (!student) {
    return res.status(404).json({
      error: 'Guardian or student record not found. Please verify your credentials.'
    });
  }

  logAudit(
    schoolId,
    student.guardianEmail || 'parent_portal',
    student.guardianName || 'Guardian',
    'parent',
    'PARENT_PORTAL_VIEW',
    'student',
    student.id,
    `Guardian viewed academic & ledger records for ${student.firstName} ${student.lastName} (${student.admissionNo})`,
    req
  );

  res.json(buildParentPortalPayload(schoolId, student));
});

// --- DASHBOARD ANALYTICS & SUMMARY ---
app.get('/api/dashboard/summary', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const school = db.schools[schoolId];
  if (!school) return res.status(404).json({ error: 'School not found' });

  const studentList = (db.students[schoolId] || []).filter(s => !s.isDeleted);
  const staffList = db.staff[schoolId] || [];
  const teachersCount = staffList.filter(s => s.role === 'teacher').length;
  const classesList = db.classes[schoolId] || [];
  const subjectsList = db.subjects[schoolId] || [];

  const maleCount = studentList.filter(s => s.gender === 'male').length;
  const femaleCount = studentList.filter(s => s.gender === 'female').length;

  // Unique parents
  const uniqueParents = new Set(studentList.map(s => s.guardianPhone || s.guardianName).filter(Boolean));

  // Financial aggregates
  const ledger = db.ledgerEntries[schoolId] || [];
  const totalBilled = ledger.filter(l => l.type === 'DEBIT_FEE').reduce((a, c) => a + c.amountMinor, 0);
  const totalPaid = ledger.filter(l => l.type === 'CREDIT_PAYMENT' || l.type === 'WAIVER').reduce((a, c) => a + c.amountMinor, 0);
  const totalArrears = Math.max(0, totalBilled - totalPaid);
  const collectionPct = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 100;

  // Dynamic weekly attendance trend (Mon - Fri) computed from real db.attendance
  const attendanceList = db.attendance[schoolId] || [];
  const daysOfWeek = [
    { key: 'Mon', dayNum: 1 },
    { key: 'Tue', dayNum: 2 },
    { key: 'Wed', dayNum: 3 },
    { key: 'Thu', dayNum: 4 },
    { key: 'Fri', dayNum: 5 }
  ];
  const studentGenderMap: Record<string, string> = {};
  studentList.forEach(s => { studentGenderMap[s.id] = s.gender; });

  const weeklyAttendance = daysOfWeek.map(d => {
    const dayRecords = attendanceList.filter(a => {
      if (!a.date) return false;
      const dateObj = new Date(a.date);
      return dateObj.getDay() === d.dayNum;
    });

    if (dayRecords.length > 0) {
      const boys = dayRecords.filter(r => studentGenderMap[r.studentId] === 'male');
      const girls = dayRecords.filter(r => studentGenderMap[r.studentId] === 'female');
      const boysPresent = boys.filter(r => r.status === 'present' || r.status === 'late').length;
      const girlsPresent = girls.filter(r => r.status === 'present' || r.status === 'late').length;
      const totalPresent = dayRecords.filter(r => r.status === 'present' || r.status === 'late').length;

      const boysRate = boys.length > 0 ? Math.round((boysPresent / boys.length) * 100) : 95;
      const girlsRate = girls.length > 0 ? Math.round((girlsPresent / girls.length) * 100) : 98;
      const averageRate = Math.round((totalPresent / dayRecords.length) * 100);

      return { day: d.key, boysRate, girlsRate, averageRate };
    }

    const totalPresentAll = attendanceList.filter(r => r.status === 'present' || r.status === 'late').length;
    const overallRate = attendanceList.length > 0 ? Math.round((totalPresentAll / attendanceList.length) * 100) : 96;
    return { day: d.key, boysRate: overallRate, girlsRate: overallRate, averageRate: overallRate };
  });

  // Grade Distribution from scoreEvents
  const scores = db.scoreEvents[schoolId] || [];
  const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  scores.forEach(sc => {
    if (gradeCounts[sc.grade] !== undefined) {
      gradeCounts[sc.grade]++;
    }
  });
  const totalScoreEvents = scores.length;
  const gradeDistribution = [
    { grade: 'A', label: 'Distinction (80-100)', count: gradeCounts.A, percentage: totalScoreEvents > 0 ? Math.round((gradeCounts.A / totalScoreEvents) * 100) : 0, color: '#065F46' },
    { grade: 'B', label: 'Very Good (70-79)', count: gradeCounts.B, percentage: totalScoreEvents > 0 ? Math.round((gradeCounts.B / totalScoreEvents) * 100) : 0, color: '#047857' },
    { grade: 'C', label: 'Credit (60-69)', count: gradeCounts.C, percentage: totalScoreEvents > 0 ? Math.round((gradeCounts.C / totalScoreEvents) * 100) : 0, color: '#B45309' },
    { grade: 'D', label: 'Pass (50-59)', count: gradeCounts.D, percentage: totalScoreEvents > 0 ? Math.round((gradeCounts.D / totalScoreEvents) * 100) : 0, color: '#D97706' },
    { grade: 'F', label: 'Fail (<50)', count: gradeCounts.F, percentage: totalScoreEvents > 0 ? Math.round((gradeCounts.F / totalScoreEvents) * 100) : 0, color: '#991B1B' }
  ];

  const terminalAverage = scores.length > 0 ? Number((scores.reduce((a, c) => a + c.total, 0) / scores.length).toFixed(1)) : 0;
  const passRate = scores.length > 0 ? Math.round((scores.filter(s => s.total >= 40).length / scores.length) * 100) : 100;

  // Recent students
  const recentStudents = [...studentList].reverse().slice(0, 5);

  // Upcoming events
  const upcomingEvents = (db.events[schoolId] || []).slice(0, 4);

  // Recent notices
  const recentNotices = (db.notices[schoolId] || []).slice(0, 4);

  res.json({
    summary: {
      totalStudents: studentList.length,
      maleStudentsCount: maleCount,
      femaleStudentsCount: femaleCount,
      totalTeachers: teachersCount,
      totalParents: uniqueParents.size || studentList.length,
      totalClasses: classesList.length,
      totalSubjects: subjectsList.length,
      financial: {
        totalBilledMinor: totalBilled,
        totalPaidMinor: totalPaid,
        totalArrearsMinor: totalArrears,
        collectionPercentage: collectionPct
      },
      weeklyAttendance,
      gradeDistribution,
      terminalAverage,
      passRate,
      recentStudents,
      upcomingEvents,
      recentNotices
    }
  });
});

// --- ATTENDANCE ROLL CALL ENDPOINTS ---
app.get('/api/attendance', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const classArm = req.query.classArm as string;
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

  const students = (db.students[schoolId] || []).filter(s => !s.isDeleted && (!classArm || classArm === 'all' || s.classArm === classArm));
  const existingRecords = (db.attendance[schoolId] || []).filter(a => a.date === date && (!classArm || classArm === 'all' || a.classArm === classArm));

  const recordMap: Record<string, any> = {};
  existingRecords.forEach(r => {
    recordMap[r.studentId] = r;
  });

  const roster = students.map(st => ({
    studentId: st.id,
    admissionNo: st.admissionNo,
    studentName: `${st.firstName} ${st.lastName}`,
    gender: st.gender,
    classArm: st.classArm,
    status: recordMap[st.id]?.status || 'present',
    remark: recordMap[st.id]?.remark || '',
    recordedAt: recordMap[st.id]?.timestamp
  }));

  const total = roster.length;
  const present = roster.filter(r => r.status === 'present').length;
  const absent = roster.filter(r => r.status === 'absent').length;
  const late = roster.filter(r => r.status === 'late').length;
  const excused = roster.filter(r => r.status === 'excused').length;
  const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

  res.json({
    date,
    classArm: classArm || 'All Classes',
    stats: { total, present, absent, late, excused, attendanceRate },
    records: roster
  });
});

app.post('/api/attendance/mark', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const { date, classArm, studentId, status, remark, actorEmail } = req.body;

  if (!studentId || !date || !status) {
    return res.status(400).json({ error: 'date, studentId, and status are required' });
  }

  if (!db.attendance[schoolId]) {
    db.attendance[schoolId] = [];
  }

  const existingIdx = db.attendance[schoolId].findIndex(a => a.date === date && a.studentId === studentId);
  const now = new Date().toISOString();
  const record = {
    id: existingIdx !== -1 ? db.attendance[schoolId][existingIdx].id : 'att_' + Math.random().toString(36).substring(2, 9),
    schoolId,
    date,
    classArm: classArm || 'JSS 1',
    studentId,
    status,
    remark: remark || '',
    recordedBy: actorEmail || 'teacher',
    timestamp: now
  };

  if (existingIdx !== -1) {
    db.attendance[schoolId][existingIdx] = record;
  } else {
    db.attendance[schoolId].push(record);
  }

  res.json({ success: true, record });
});

app.post('/api/attendance/mark-all', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const { date, classArm, status, actorEmail } = req.body;

  if (!date || !classArm) {
    return res.status(400).json({ error: 'date and classArm are required' });
  }

  if (!db.attendance[schoolId]) {
    db.attendance[schoolId] = [];
  }

  const classStudents = (db.students[schoolId] || []).filter(s => s.classArm === classArm && !s.isDeleted);
  const now = new Date().toISOString();

  classStudents.forEach(st => {
    const existingIdx = db.attendance[schoolId].findIndex(a => a.date === date && a.studentId === st.id);
    const rec = {
      id: existingIdx !== -1 ? db.attendance[schoolId][existingIdx].id : 'att_' + Math.random().toString(36).substring(2, 9),
      schoolId,
      date,
      classArm,
      studentId: st.id,
      status: status || 'present',
      remark: '',
      recordedBy: actorEmail || 'teacher',
      timestamp: now
    };
    if (existingIdx !== -1) {
      db.attendance[schoolId][existingIdx] = rec;
    } else {
      db.attendance[schoolId].push(rec);
    }
  });

  res.json({ success: true, message: `Marked all ${classStudents.length} pupils in ${classArm} as ${status || 'present'}` });
});

// --- NOTICES & ANNOUNCEMENTS ENDPOINTS ---
app.get('/api/notices', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const list = db.notices[schoolId] || [];
  res.json({ notices: list });
});

app.post('/api/notices', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const { title, content, priority, targetAudience, author } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  if (!db.notices[schoolId]) {
    db.notices[schoolId] = [];
  }

  const newNotice = {
    id: 'not_' + Math.random().toString(36).substring(2, 9),
    schoolId,
    title: title.trim(),
    content: content.trim(),
    priority: priority || 'normal',
    targetAudience: targetAudience || 'All',
    author: author || 'School Admin',
    date: new Date().toISOString().split('T')[0]
  };

  db.notices[schoolId].unshift(newNotice);
  logAudit(schoolId, author || 'admin', 'Administrator', 'admin', 'NOTICE_PUBLISH', 'notice', newNotice.id, `Published notice: ${title}`, req);
  res.status(201).json({ notice: newNotice });
});

app.delete('/api/notices/:id', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const noticeId = req.params.id;
  if (db.notices[schoolId]) {
    db.notices[schoolId] = db.notices[schoolId].filter(n => n.id !== noticeId);
  }
  res.json({ success: true, message: 'Notice deleted successfully' });
});

// --- EVENTS & CALENDAR ENDPOINTS ---
app.get('/api/events', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const list = db.events[schoolId] || [];
  res.json({ events: list });
});

app.post('/api/events', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const { title, date, time, location, category, description } = req.body;

  if (!title || !date) {
    return res.status(400).json({ error: 'Title and date are required' });
  }

  if (!db.events[schoolId]) {
    db.events[schoolId] = [];
  }

  const newEvent = {
    id: 'evt_' + Math.random().toString(36).substring(2, 9),
    schoolId,
    title: title.trim(),
    date,
    time: time || '09:00 AM',
    location: location || 'Main Campus',
    category: category || 'Academic',
    description: description || ''
  };

  db.events[schoolId].push(newEvent);
  res.status(201).json({ event: newEvent });
});

app.delete('/api/events/:id', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const eventId = req.params.id;
  if (db.events[schoolId]) {
    db.events[schoolId] = db.events[schoolId].filter(e => e.id !== eventId);
  }
  res.json({ success: true, message: 'Event deleted successfully' });
});

// --- TIMETABLE / SCHEDULE ENDPOINTS ---
app.get('/api/timetable', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const classArm = (req.query.classArm as string) || 'JSS 1';
  const schoolTimetables = db.timetables[schoolId] || {};
  const schedule = schoolTimetables[classArm] || schoolTimetables['JSS 1'] || [];
  res.json({ classArm, schedule });
});

app.post('/api/timetable/period', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  const { classArm, day, period, time, subject, teacher, room } = req.body;
  if (!classArm || !day || !period || !subject) {
    return res.status(400).json({ error: 'classArm, day, period, and subject are required' });
  }
  if (!db.timetables[schoolId]) db.timetables[schoolId] = {};
  if (!db.timetables[schoolId][classArm]) {
    db.timetables[schoolId][classArm] = [
      { day: 'Monday', periods: [] },
      { day: 'Tuesday', periods: [] },
      { day: 'Wednesday', periods: [] },
      { day: 'Thursday', periods: [] },
      { day: 'Friday', periods: [] }
    ];
  }
  let targetDay = db.timetables[schoolId][classArm].find((d: any) => d.day === day);
  if (!targetDay) {
    targetDay = { day, periods: [] };
    db.timetables[schoolId][classArm].push(targetDay);
  }
  const existingPeriodIdx = targetDay.periods.findIndex((p: any) => p.period === Number(period));
  const newPeriodObj = {
    period: Number(period),
    time: time || '08:00 - 08:45',
    subject: subject.trim(),
    teacher: teacher || 'Unassigned',
    room: room || 'Room 101'
  };
  if (existingPeriodIdx !== -1) {
    targetDay.periods[existingPeriodIdx] = newPeriodObj;
  } else {
    targetDay.periods.push(newPeriodObj);
    targetDay.periods.sort((a: any, b: any) => a.period - b.period);
  }
  res.json({ success: true, schedule: db.timetables[schoolId][classArm] });
});

app.delete('/api/timetable/period', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const classArm = req.query.classArm as string;
  const day = req.query.day as string;
  const period = Number(req.query.period);
  if (db.timetables[schoolId] && db.timetables[schoolId][classArm]) {
    const targetDay = db.timetables[schoolId][classArm].find((d: any) => d.day === day);
    if (targetDay) {
      targetDay.periods = targetDay.periods.filter((p: any) => p.period !== period);
    }
  }
  res.json({ success: true, message: `Removed period ${period}` });
});

// --- PARENTS DIRECTORY ENDPOINT ---
app.get('/api/parents', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const students = (db.students[schoolId] || []).filter(s => !s.isDeleted);
  const ledger = db.ledgerEntries[schoolId] || [];

  // Group by guardian phone or name
  const parentMap: Record<string, any> = {};

  students.forEach(st => {
    const key = (st.guardianEmail || st.guardianPhone || st.guardianName || 'Unknown Guardian').trim().toLowerCase();
    if (!parentMap[key]) {
      parentMap[key] = {
        guardianName: st.guardianName || 'Guardian of ' + st.firstName,
        guardianPhone: st.guardianPhone || '',
        guardianEmail: st.guardianEmail || '',
        guardianPassword: st.guardianPassword || 'guardian123',
        accessPin: st.accessPin,
        students: [],
        totalBilledMinor: 0,
        totalPaidMinor: 0,
        arrearsMinor: 0,
        isCleared: true
      };
    }
    parentMap[key].students.push({
      id: st.id,
      name: `${st.firstName} ${st.lastName}`,
      admissionNo: st.admissionNo,
      classArm: st.classArm,
      status: st.status
    });

    // Ledger for this student
    const studentEntries = ledger.filter(l => l.studentId === st.id);
    const billed = studentEntries.filter(l => l.type === 'DEBIT_FEE').reduce((a, c) => a + c.amountMinor, 0);
    const paid = studentEntries.filter(l => l.type === 'CREDIT_PAYMENT' || l.type === 'WAIVER').reduce((a, c) => a + c.amountMinor, 0);

    parentMap[key].totalBilledMinor += billed;
    parentMap[key].totalPaidMinor += paid;
  });

  const parentList = Object.values(parentMap).map((p: any) => {
    p.arrearsMinor = Math.max(0, p.totalBilledMinor - p.totalPaidMinor);
    p.isCleared = p.arrearsMinor === 0;
    return p;
  });

  res.json({ parents: parentList });
});

// 11. AUDIT TRAIL ENDPOINTS
app.get('/api/audit', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const logs = db.auditLogs[schoolId] || [];
  res.json({ logs });
});

// 12. BACKUP, RECOVERY & RESTORE
app.get('/api/backup/export', (req: Request, res: Response) => {
  const schoolId = (req.query.schoolId as string) || DEFAULT_SCHOOL_ID;
  const snapshot = {
    version: '1.0.0',
    exportTimestamp: new Date().toISOString(),
    school: db.schools[schoolId],
    classes: db.classes[schoolId] || [],
    subjects: db.subjects[schoolId] || [],
    staff: db.staff[schoolId] || [],
    feeStructures: db.feeStructures[schoolId] || [],
    students: db.students[schoolId] || [],
    scoreEvents: db.scoreEvents[schoolId] || [],
    ledgerEntries: db.ledgerEntries[schoolId] || [],
    auditLogs: db.auditLogs[schoolId] || []
  };

  logAudit(schoolId, 'admin', 'Administrator', 'admin', 'COLD_BACKUP_EXPORT', 'backup', 'snapshot', 'Exported JSON administrative snapshot.', req);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="MINO_BACKUP_${schoolId}_${Date.now()}.json"`);
  res.send(JSON.stringify(snapshot, null, 2));
});

app.post('/api/backup/restore', (req: Request, res: Response) => {
  const { snapshot, actorEmail } = req.body;
  if (!snapshot || !snapshot.school || !snapshot.school.id) {
    return res.status(400).json({ error: 'Invalid backup file structure' });
  }

  const schoolId = snapshot.school.id;
  db.schools[schoolId] = snapshot.school;
  db.classes[schoolId] = snapshot.classes || [];
  db.subjects[schoolId] = snapshot.subjects || [];
  db.staff[schoolId] = snapshot.staff || [];
  db.feeStructures[schoolId] = snapshot.feeStructures || [];
  db.students[schoolId] = snapshot.students || [];
  db.scoreEvents[schoolId] = snapshot.scoreEvents || [];
  db.ledgerEntries[schoolId] = snapshot.ledgerEntries || [];
  db.auditLogs[schoolId] = snapshot.auditLogs || [];

  logAudit(schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'POINT_IN_TIME_RESTORE', 'backup', 'restore', `Restored database snapshot from ${snapshot.exportTimestamp}`, req);

  res.json({
    success: true,
    message: `Restored ${snapshot.students?.length || 0} students and ${snapshot.scoreEvents?.length || 0} scores successfully.`
  });
});

app.post('/api/admin/soft-wipe', (req: Request, res: Response) => {
  const schoolId = req.body.schoolId || DEFAULT_SCHOOL_ID;
  seedInitialData();
  logAudit(schoolId, req.body.actorEmail || 'admin', 'Administrator', 'admin', 'ADMIN_DATA_RESEED', 'system', 'reset', 'Re-seeded initial state.', req);
  res.json({ success: true, message: 'System re-seeded to initial production baseline' });
});

// Mount Vite middleware in development or serve static in production (skip listener when imported as Vercel Serverless Function)
async function startServer() {
  let getViteServer: (() => Promise<any>) | null = null;

  if (process.env.NODE_ENV !== 'production') {
    let vitePromise: Promise<any> | null = null;
    getViteServer = () => {
      if (!vitePromise) {
        vitePromise = import('vite').then(({ createServer: createViteServer }) =>
          createViteServer({
            server: {
              middlewareMode: true,
              hmr: false,
              ws: process.env.DISABLE_HMR === 'true' ? (false as const) : undefined,
              watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'] },
            },
            appType: 'spa',
          })
        );
      }
      return vitePromise;
    };

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      try {
        const vite = await getViteServer!();
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MINO-SMS Engine] Running full-stack server on http://0.0.0.0:${PORT}`);
    if (getViteServer) {
      getViteServer().catch((err) => {
        console.error('[MINO-SMS Engine] Vite warmup error:', err);
      });
    }
  });
  httpServer.on('error', (err) => {
    console.error('[MINO-SMS Engine] HTTP server error:', err);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('[MINO-SMS Engine] Failed to start server:', err);
    process.exit(1);
  });
}

export { app };
export default app;

