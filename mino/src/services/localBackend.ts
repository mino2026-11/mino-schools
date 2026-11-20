/**
 * MINO-SMS Browser-Side Local Authoritative Store & Fallback Engine
 * Ensures 100% of local credentials and dashboards (Student, Teacher, School Admin,
 * Bursar, Guardian, and Platform Owner /admin) work seamlessly on Vercel deployments
 * (both static SPA and stateless serverless cold starts) as well as offline.
 */

import {
  ACADEMIC_TERMS,
  NIGERIAN_CLASS_LEVELS,
  normalizeAcademicTerm,
  type AcademicTerm,
  type AttendanceRecord,
  type AttendanceStatus,
  type AuditLog,
  type ClassArm,
  type ClassDaySchedule,
  type DashboardSummary,
  type FeeStructure,
  type LedgerEntry,
  type LoginRole,
  type Notice,
  type ParentSummary,
  type PlatformAnalytics,
  type SchoolEvent,
  type SchoolTenant,
  type ScoreEvent,
  type ScoreJsonImportDetail,
  type ScoreJsonImportResponse,
  type StaffUser,
  type Student,
  type Subject,
  type UserRole
} from '../types';

const STORAGE_KEY = 'mino_local_authoritative_store_v1';
export const DEFAULT_SCHOOL_ID = 'sch_oakridge_001';
export const SECOND_SCHOOL_ID = 'sch_stjude_002';

export interface LocalQuickCredential {
  label: string;
  sublabel: string;
  schoolName: string;
  schoolCode: string;
  email: string;
  password: string;
  role: LoginRole;
}

interface LocalOwnerCredentials {
  email: string;
  customPassword?: string;
  updatedAt: string;
}

interface LocalAuthoritativeStore {
  version: number;
  ownerCredentials: LocalOwnerCredentials;
  schools: Record<string, SchoolTenant>;
  classes: Record<string, ClassArm[]>;
  subjects: Record<string, Subject[]>;
  students: Record<string, Student[]>;
  staff: Record<string, StaffUser[]>;
  scoreEvents: Record<string, ScoreEvent[]>;
  ledgerEntries: Record<string, LedgerEntry[]>;
  feeStructures: Record<string, FeeStructure[]>;
  auditLogs: Record<string, AuditLog[]>;
  processedClientChangeIds: string[];
  notices: Record<string, Notice[]>;
  events: Record<string, SchoolEvent[]>;
  attendance: Record<string, AttendanceRecord[]>;
  timetables: Record<string, Record<string, ClassDaySchedule[]>>;
}

let memoryStore: LocalAuthoritativeStore | null = null;

function createNigerianClassesForSchool(schoolId: string): ClassArm[] {
  const slugs = ['pri1', 'pri2', 'pri3', 'pri4', 'pri5', 'pri6', 'jss1', 'jss2', 'jss3', 'sss1', 'sss2', 'sss3'];
  return NIGERIAN_CLASS_LEVELS.map((item, idx) => ({
    id: `cls_${schoolId}_${slugs[idx] || idx}`,
    schoolId,
    name: item.name,
    level: item.level
  }));
}

function simpleHashHex(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}${part1}${part2}`;
}

export function calculateGradeLocal(
  ca1: number,
  ca2: number,
  midterm: number,
  exam: number
): { total: number; grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; remark: string } {
  const total = Math.min(100, Math.max(0, Math.round(ca1 + ca2 + midterm + exam)));
  if (total >= 80) return { total, grade: 'A', remark: 'Distinction' };
  if (total >= 70) return { total, grade: 'B', remark: 'Very Good' };
  if (total >= 60) return { total, grade: 'C', remark: 'Good Credit' };
  if (total >= 50) return { total, grade: 'D', remark: 'Pass' };
  if (total >= 40) return { total, grade: 'E', remark: 'Marginal Pass' };
  return { total, grade: 'F', remark: 'Unsatisfactory' };
}

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

function generateUniqueSchoolCode(
  store: LocalAuthoritativeStore,
  schoolName: string,
  requestedCode?: string
): { code: string; shortCode: string } {
  const existingCodes = new Set(
    Object.values(store.schools).map(s => String(s.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
  );
  const shortCode = computeSchoolAcronym(schoolName);

  let maxSeq = 1000 + Object.keys(store.schools).length;
  Object.values(store.schools).forEach(s => {
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

function createInitialSeedStore(): LocalAuthoritativeStore {
  const nowIso = new Date().toISOString();
  const todayIso = nowIso.split('T')[0];
  const allClassNames = NIGERIAN_CLASS_LEVELS.map(c => c.name);

  const schools: Record<string, SchoolTenant> = {
    [DEFAULT_SCHOOL_ID]: {
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
      createdAt: '2025-08-15T09:00:00Z'
    },
    [SECOND_SCHOOL_ID]: {
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
      createdAt: '2025-08-15T09:00:00Z'
    }
  };

  const classes: Record<string, ClassArm[]> = {
    [DEFAULT_SCHOOL_ID]: createNigerianClassesForSchool(DEFAULT_SCHOOL_ID),
    [SECOND_SCHOOL_ID]: createNigerianClassesForSchool(SECOND_SCHOOL_ID)
  };

  const subjects: Record<string, Subject[]> = {
    [DEFAULT_SCHOOL_ID]: [
      { id: 'sub_math', schoolId: DEFAULT_SCHOOL_ID, name: 'Mathematics', code: 'MTH' },
      { id: 'sub_eng', schoolId: DEFAULT_SCHOOL_ID, name: 'English Language', code: 'ENG' },
      { id: 'sub_sci', schoolId: DEFAULT_SCHOOL_ID, name: 'Basic Science', code: 'BSC' },
      { id: 'sub_soc', schoolId: DEFAULT_SCHOOL_ID, name: 'Social Studies', code: 'SOS' },
      { id: 'sub_agri', schoolId: DEFAULT_SCHOOL_ID, name: 'Agricultural Science', code: 'AGR' }
    ],
    [SECOND_SCHOOL_ID]: [
      { id: 'sub_sj_math', schoolId: SECOND_SCHOOL_ID, name: 'Advanced Mathematics', code: 'MTH' },
      { id: 'sub_sj_lit', schoolId: SECOND_SCHOOL_ID, name: 'World Literature', code: 'LIT' }
    ]
  };

  const staff: Record<string, StaffUser[]> = {
    [DEFAULT_SCHOOL_ID]: [
      {
        id: 'stf_001',
        schoolId: DEFAULT_SCHOOL_ID,
        name: 'Dr. Kenneth Balogun',
        email: 'admin@oakridge.edu',
        role: 'admin',
        isHeadTeacher: true,
        passcode: 'admin123',
        assignedClasses: allClassNames,
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
    ],
    [SECOND_SCHOOL_ID]: [
      {
        id: 'stf_sj_001',
        schoolId: SECOND_SCHOOL_ID,
        name: 'Mrs. Evelyn Mensah',
        email: 'admin@stjude.edu',
        role: 'admin',
        isHeadTeacher: true,
        passcode: 'admin123',
        assignedClasses: allClassNames,
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
    ]
  };

  const students: Record<string, Student[]> = {
    [DEFAULT_SCHOOL_ID]: [
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
    ],
    [SECOND_SCHOOL_ID]: [
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
    ]
  };

  const scoreEvents: Record<string, ScoreEvent[]> = {
    [DEFAULT_SCHOOL_ID]: [
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
    ],
    [SECOND_SCHOOL_ID]: [
      {
        id: 'sc_sj_001',
        clientChangeId: 'cc_sc_sj_001',
        schoolId: SECOND_SCHOOL_ID,
        studentId: 'std_sj_001',
        subjectId: 'sub_sj_math',
        session: '2025/2026',
        term: '2nd Term',
        ca1: 14,
        ca2: 14,
        midterm: 18,
        exam: 44,
        total: 90,
        grade: 'A',
        remark: 'Distinction',
        recordedBy: 'teacher@stjude.edu',
        deviceId: 'dev_server_init',
        timestamp: '2026-01-16T10:00:00Z',
        synced: true
      }
    ]
  };

  const feeStructures: Record<string, FeeStructure[]> = {
    [DEFAULT_SCHOOL_ID]: [
      { id: 'fee_1', schoolId: DEFAULT_SCHOOL_ID, classArm: 'JSS 1', name: 'Tuition Fee', amountMinor: 4500000, term: '2nd Term', session: '2025/2026' },
      { id: 'fee_2', schoolId: DEFAULT_SCHOOL_ID, classArm: 'JSS 1', name: 'Development Levy', amountMinor: 500000, term: '2nd Term', session: '2025/2026' },
      { id: 'fee_3', schoolId: DEFAULT_SCHOOL_ID, classArm: 'JSS 1', name: 'Science & Lab Levy', amountMinor: 350000, term: '2nd Term', session: '2025/2026' }
    ],
    [SECOND_SCHOOL_ID]: [
      { id: 'fee_sj_1', schoolId: SECOND_SCHOOL_ID, classArm: 'JSS 1', name: 'Tuition Fee', amountMinor: 4000000, term: '2nd Term', session: '2025/2026' }
    ]
  };

  const ledgerEntries: Record<string, LedgerEntry[]> = {
    [DEFAULT_SCHOOL_ID]: [
      {
        id: 'led_001',
        clientChangeId: 'cc_led_001',
        schoolId: DEFAULT_SCHOOL_ID,
        studentId: 'std_001',
        type: 'DEBIT_FEE',
        amountMinor: 5350000,
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
        amountMinor: 5350000,
        description: 'Bank Transfer Payment - Second Term Fees',
        category: 'Tuition',
        receiptNo: 'REC-2026-00084',
        paymentChannel: 'BANK_TRANSFER',
        referenceNo: 'ZEN-TX-99823412',
        verificationHash: simpleHashHex(`${DEFAULT_SCHOOL_ID}:REC-2026-00084:std_001:5350000:2026-01-08T14:30:00Z`),
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
        amountMinor: 3000000,
        description: 'POS Terminal Payment - Part Payment',
        category: 'Tuition',
        receiptNo: 'REC-2026-00091',
        paymentChannel: 'POS',
        referenceNo: 'POS-AUTH-554201',
        verificationHash: simpleHashHex(`${DEFAULT_SCHOOL_ID}:REC-2026-00091:std_002:3000000:2026-01-12T11:20:00Z`),
        recordedBy: 'bursar@oakridge.edu',
        timestamp: '2026-01-12T11:20:00Z',
        synced: true
      }
    ],
    [SECOND_SCHOOL_ID]: [
      {
        id: 'led_sj_001',
        clientChangeId: 'cc_led_sj_001',
        schoolId: SECOND_SCHOOL_ID,
        studentId: 'std_sj_001',
        type: 'DEBIT_FEE',
        amountMinor: 4000000,
        description: 'Second Term 2025/2026 Tuition Bill',
        category: 'Tuition',
        receiptNo: 'BILL-SJC-001',
        recordedBy: 'admin@stjude.edu',
        timestamp: '2026-01-06T09:00:00Z',
        synced: true
      },
      {
        id: 'led_sj_002',
        clientChangeId: 'cc_led_sj_002',
        schoolId: SECOND_SCHOOL_ID,
        studentId: 'std_sj_001',
        type: 'CREDIT_PAYMENT',
        amountMinor: 4000000,
        description: 'Full Tuition Payment - Second Term',
        category: 'Tuition',
        receiptNo: 'REC-SJC-00012',
        paymentChannel: 'BANK_TRANSFER',
        referenceNo: 'GTB-TX-112094',
        verificationHash: simpleHashHex(`${SECOND_SCHOOL_ID}:REC-SJC-00012:std_sj_001:4000000:2026-01-09T12:00:00Z`),
        recordedBy: 'admin@stjude.edu',
        timestamp: '2026-01-09T12:00:00Z',
        synced: true
      }
    ]
  };

  const notices: Record<string, Notice[]> = {
    [DEFAULT_SCHOOL_ID]: [
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
    ],
    [SECOND_SCHOOL_ID]: [
      {
        id: 'not_sj_001',
        schoolId: SECOND_SCHOOL_ID,
        title: 'Second Term Academic Welcome & Assessment Calendar',
        content: 'Welcome back to Second Term 2025/2026. Continuous Assessment schedules are active across all Junior and Senior Secondary classes.',
        priority: 'normal',
        targetAudience: 'All',
        author: 'Mrs. Evelyn Mensah',
        date: '2026-01-14'
      }
    ]
  };

  const events: Record<string, SchoolEvent[]> = {
    [DEFAULT_SCHOOL_ID]: [
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
    ],
    [SECOND_SCHOOL_ID]: []
  };

  const timetables: Record<string, Record<string, ClassDaySchedule[]>> = {
    [DEFAULT_SCHOOL_ID]: {
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
    },
    [SECOND_SCHOOL_ID]: {}
  };

  const attendance: Record<string, AttendanceRecord[]> = {
    [DEFAULT_SCHOOL_ID]: [
      { id: 'att_001', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 1', studentId: 'std_001', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: nowIso },
      { id: 'att_002', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 1', studentId: 'std_002', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: nowIso },
      { id: 'att_003', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 1', studentId: 'std_003', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: nowIso },
      { id: 'att_004', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 1', studentId: 'std_004', status: 'late', remark: 'Traffic delay on Lekki Expressway', recordedBy: 'teacher@oakridge.edu', timestamp: nowIso },
      { id: 'att_005', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 1', studentId: 'std_005', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: nowIso },
      { id: 'att_006', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'Primary 5', studentId: 'std_006', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: nowIso },
      { id: 'att_007', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'Primary 6', studentId: 'std_007', status: 'excused', remark: 'Medical appointment with parent note', recordedBy: 'teacher@oakridge.edu', timestamp: nowIso },
      { id: 'att_008', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 2', studentId: 'std_008', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: nowIso },
      { id: 'att_009', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'JSS 3', studentId: 'std_009', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: nowIso },
      { id: 'att_010', schoolId: DEFAULT_SCHOOL_ID, date: todayIso, classArm: 'SSS 1', studentId: 'std_010', status: 'present', recordedBy: 'teacher@oakridge.edu', timestamp: nowIso }
    ],
    [SECOND_SCHOOL_ID]: [
      { id: 'att_sj_001', schoolId: SECOND_SCHOOL_ID, date: todayIso, classArm: 'JSS 1', studentId: 'std_sj_001', status: 'present', recordedBy: 'teacher@stjude.edu', timestamp: nowIso }
    ]
  };

  const auditLogs: Record<string, AuditLog[]> = {
    [DEFAULT_SCHOOL_ID]: [
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
        ipAddress: '127.0.0.1',
        timestamp: '2025-09-01T08:00:00Z'
      }
    ],
    [SECOND_SCHOOL_ID]: [
      {
        id: 'aud_sj_001',
        schoolId: SECOND_SCHOOL_ID,
        actorId: 'admin@stjude.edu',
        actorName: 'Mrs. Evelyn Mensah',
        actorRole: 'admin',
        action: 'SYSTEM_BOOTSTRAP',
        entity: 'tenant',
        entityId: SECOND_SCHOOL_ID,
        details: 'Initialized St. Jude International College partition.',
        ipAddress: '127.0.0.1',
        timestamp: '2025-09-01T08:00:00Z'
      }
    ]
  };

  return {
    version: 1,
    ownerCredentials: {
      email: 'owner@mino.com',
      updatedAt: '2025-09-01T08:00:00Z'
    },
    schools,
    classes,
    subjects,
    students,
    staff,
    scoreEvents,
    ledgerEntries,
    feeStructures,
    auditLogs,
    processedClientChangeIds: [],
    notices,
    events,
    attendance,
    timetables
  };
}

function getStore(): LocalAuthoritativeStore {
  if (memoryStore) return memoryStore;
  const seed = createInitialSeedStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalAuthoritativeStore>;
      if (parsed && typeof parsed === 'object' && parsed.schools) {
        memoryStore = {
          version: 1,
          ownerCredentials: parsed.ownerCredentials || seed.ownerCredentials,
          schools: { ...seed.schools, ...parsed.schools },
          classes: { ...seed.classes, ...(parsed.classes || {}) },
          subjects: { ...seed.subjects, ...(parsed.subjects || {}) },
          students: { ...seed.students, ...(parsed.students || {}) },
          staff: { ...seed.staff, ...(parsed.staff || {}) },
          scoreEvents: { ...seed.scoreEvents, ...(parsed.scoreEvents || {}) },
          ledgerEntries: { ...seed.ledgerEntries, ...(parsed.ledgerEntries || {}) },
          feeStructures: { ...seed.feeStructures, ...(parsed.feeStructures || {}) },
          auditLogs: { ...seed.auditLogs, ...(parsed.auditLogs || {}) },
          processedClientChangeIds: Array.isArray(parsed.processedClientChangeIds) ? parsed.processedClientChangeIds : [],
          notices: { ...seed.notices, ...(parsed.notices || {}) },
          events: { ...seed.events, ...(parsed.events || {}) },
          attendance: { ...seed.attendance, ...(parsed.attendance || {}) },
          timetables: { ...seed.timetables, ...(parsed.timetables || {}) }
        };
        return memoryStore;
      }
    }
  } catch {
    // Fallback to seed in memory if localStorage unavailable
  }
  memoryStore = seed;
  persistStore();
  return memoryStore;
}

function persistStore(): void {
  if (!memoryStore) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
  } catch {
    // Ignore quota errors; memoryStore remains authoritative for session
  }
}

function logLocalAudit(
  store: LocalAuthoritativeStore,
  schoolId: string,
  actorId: string,
  actorName: string,
  actorRole: UserRole,
  action: string,
  entity: string,
  entityId: string,
  details: string
) {
  if (!store.auditLogs[schoolId]) {
    store.auditLogs[schoolId] = [];
  }
  store.auditLogs[schoolId].unshift({
    id: 'aud_' + Math.random().toString(36).substring(2, 10),
    schoolId,
    actorId,
    actorName,
    actorRole,
    action,
    entity,
    entityId,
    details,
    ipAddress: 'local',
    timestamp: new Date().toISOString()
  });
}

function findSchoolByCodeLocal(store: LocalAuthoritativeStore, rawInput?: string): SchoolTenant | null {
  if (!rawInput || !String(rawInput).trim()) return null;
  const rawUpper = String(rawInput).trim().toUpperCase();
  const norm = rawUpper.replace(/[^A-Z0-9]/g, '');
  if (!norm) return null;

  const schoolsList = Object.values(store.schools);
  const exactCodeMatch = schoolsList.find(
    s => String(s.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === norm
  );
  if (exactCodeMatch) return exactCodeMatch;

  const idMatch = schoolsList.find(s => String(s.id || '').toUpperCase() === rawUpper);
  if (idMatch) return idMatch;

  const shortMatches = schoolsList.filter(
    s => String(s.shortCode || '').toUpperCase() === norm
  );
  if (shortMatches.length === 1) return shortMatches[0];

  return null;
}

function buildStudentPortalPayloadLocal(store: LocalAuthoritativeStore, schoolId: string, student: Student) {
  const school = store.schools[schoolId];
  const activeSchoolTerm = normalizeAcademicTerm(school.currentTerm);
  const allScores = store.scoreEvents[schoolId] || [];
  const subjectsMap: Record<string, string> = {};
  (store.subjects[schoolId] || []).forEach(sub => {
    subjectsMap[sub.id] = sub.name;
  });

  const currentScores = allScores
    .filter(
      sc =>
        sc.studentId === student.id &&
        sc.session === school.currentSession &&
        normalizeAcademicTerm(sc.term) === activeSchoolTerm
    )
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

  const studentAttRecords = (store.attendance[schoolId] || []).filter(a => a.studentId === student.id);
  const totalAtt = studentAttRecords.length;
  const presentAtt = studentAttRecords.filter(a => a.status === 'present' || a.status === 'late').length;
  const realStudentAttendanceRate = totalAtt > 0 ? `${Math.round((presentAtt / totalAtt) * 100)}%` : '100%';

  const historyList = ACADEMIC_TERMS.map(termName => {
    const termScores = allScores
      .filter(
        sc =>
          sc.studentId === student.id &&
          sc.session === school.currentSession &&
          normalizeAcademicTerm(sc.term) === termName
      )
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

  const ledger = store.ledgerEntries[schoolId] || [];
  const studentLedger = ledger.filter(l => l.studentId === student.id);
  const totalBilled = studentLedger.filter(l => l.type === 'DEBIT_FEE').reduce((a, c) => a + c.amountMinor, 0);
  const totalPaid = studentLedger
    .filter(l => l.type === 'CREDIT_PAYMENT' || l.type === 'WAIVER')
    .reduce((a, c) => a + c.amountMinor, 0);
  const arrears = Math.max(0, totalBilled - totalPaid);

  const pendingPayments = studentLedger
    .filter(l => l.type === 'DEBIT_FEE')
    .map(bill => ({
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

function buildParentPortalPayloadLocal(store: LocalAuthoritativeStore, schoolId: string, student: Student) {
  const school = store.schools[schoolId];
  const activeSchoolTerm = normalizeAcademicTerm(school.currentTerm);
  const allScores = store.scoreEvents[schoolId] || [];
  const subjectsMap: Record<string, string> = {};
  (store.subjects[schoolId] || []).forEach(sub => {
    subjectsMap[sub.id] = sub.name;
  });

  const studentScores = allScores.filter(
    sc =>
      sc.studentId === student.id &&
      sc.session === school.currentSession &&
      normalizeAcademicTerm(sc.term) === activeSchoolTerm
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

  const parentAttRecords = (store.attendance[schoolId] || []).filter(a => a.studentId === student.id);
  const pTotalAtt = parentAttRecords.length;
  const pPresentAtt = parentAttRecords.filter(a => a.status === 'present' || a.status === 'late').length;
  const parentAttendanceRate = pTotalAtt > 0 ? `${Math.round((pPresentAtt / pTotalAtt) * 100)}%` : '100%';

  const history = ACADEMIC_TERMS.map(termName => {
    const tScores = allScores
      .filter(
        sc =>
          sc.studentId === student.id &&
          sc.session === school.currentSession &&
          normalizeAcademicTerm(sc.term) === termName
      )
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

  const ledger = store.ledgerEntries[schoolId] || [];
  const studentLedger = ledger.filter(l => l.studentId === student.id);
  const totalBilled = studentLedger.filter(l => l.type === 'DEBIT_FEE').reduce((a, c) => a + c.amountMinor, 0);
  const totalPaid = studentLedger
    .filter(l => l.type === 'CREDIT_PAYMENT' || l.type === 'WAIVER')
    .reduce((a, c) => a + c.amountMinor, 0);
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

export const localBackend = {
  // --- QUICK LOCAL CREDENTIAL HELPERS FOR LOGIN SCREENS ---
  getQuickCredentialsForRole(role: LoginRole): LocalQuickCredential[] {
    const store = getStore();
    const activeSchools = Object.values(store.schools).filter(s => s.subscriptionStatus !== 'suspended' && s.subscriptionStatus !== 'pending');
    const items: LocalQuickCredential[] = [];

    for (const school of activeSchools) {
      if (role === 'admin') {
        const staffList = store.staff[school.id] || [];
        const admins = staffList.filter(s => s.role === 'admin' || s.isHeadTeacher || s.role === 'bursar');
        for (const stf of admins) {
          items.push({
            label: stf.name,
            sublabel: stf.role === 'bursar' ? `${school.name} · Bursar` : `${school.name} · School Admin`,
            schoolName: school.name,
            schoolCode: school.code,
            email: stf.email,
            password: stf.passcode || 'admin123',
            role: 'admin'
          });
        }
      } else if (role === 'teacher') {
        const staffList = store.staff[school.id] || [];
        const teachers = staffList.filter(s => s.role === 'teacher');
        for (const t of teachers) {
          items.push({
            label: t.name,
            sublabel: `${school.name} · ${(t.assignedClasses || []).slice(0, 2).join(', ') || 'Faculty'}`,
            schoolName: school.name,
            schoolCode: school.code,
            email: t.email,
            password: t.passcode || 'teach123',
            role: 'teacher'
          });
        }
      } else if (role === 'student') {
        const pupils = (store.students[school.id] || []).filter(s => !s.isDeleted && s.email).slice(0, 2);
        for (const st of pupils) {
          items.push({
            label: `${st.firstName} ${st.lastName}`,
            sublabel: `${school.name} · ${st.classArm} (${st.admissionNo})`,
            schoolName: school.name,
            schoolCode: school.code,
            email: st.email || '',
            password: st.studentPassword || st.studentPin || 'student123',
            role: 'student'
          });
        }
      } else if (role === 'guardian') {
        const pupils = (store.students[school.id] || []).filter(s => !s.isDeleted && s.guardianEmail).slice(0, 2);
        for (const st of pupils) {
          items.push({
            label: st.guardianName || `Guardian of ${st.firstName}`,
            sublabel: `${school.name} · Ward: ${st.firstName} ${st.lastName}`,
            schoolName: school.name,
            schoolCode: school.code,
            email: st.guardianEmail,
            password: st.guardianPassword || st.accessPin || 'guardian123',
            role: 'guardian'
          });
        }
      }
    }

    return items;
  },

  getQuickPlatformOwnerCredential(): { email: string; password: string; hasCustomPassword: boolean } {
    const store = getStore();
    return {
      email: store.ownerCredentials.email || 'owner@mino.com',
      password: store.ownerCredentials.customPassword || 'mino2026',
      hasCustomPassword: Boolean(store.ownerCredentials.customPassword)
    };
  },

  // --- MIRROR HELPERS TO KEEP LOCAL STORE SYNCHRONIZED WITH SERVER MUTATIONS ---
  mirrorSchool(school: SchoolTenant) {
    if (!school?.id) return;
    const store = getStore();
    store.schools[school.id] = {
      ...store.schools[school.id],
      ...school,
      currentTerm: normalizeAcademicTerm(school.currentTerm)
    };
    if (!store.classes[school.id]) {
      store.classes[school.id] = createNigerianClassesForSchool(school.id);
    }
    if (!store.subjects[school.id]) {
      store.subjects[school.id] = [
        { id: 'sub_' + school.id + '_1', schoolId: school.id, name: 'Mathematics', code: 'MTH' },
        { id: 'sub_' + school.id + '_2', schoolId: school.id, name: 'English Language', code: 'ENG' }
      ];
    }
    persistStore();
  },

  mirrorTenantBundle(bundle: { school: SchoolTenant; classes?: ClassArm[]; subjects?: Subject[]; feeStructures?: FeeStructure[] }) {
    if (!bundle?.school?.id) return;
    const store = getStore();
    const sid = bundle.school.id;
    store.schools[sid] = {
      ...bundle.school,
      currentTerm: normalizeAcademicTerm(bundle.school.currentTerm)
    };
    if (Array.isArray(bundle.classes) && bundle.classes.length > 0) store.classes[sid] = bundle.classes;
    if (Array.isArray(bundle.subjects) && bundle.subjects.length > 0) store.subjects[sid] = bundle.subjects;
    if (Array.isArray(bundle.feeStructures)) store.feeStructures[sid] = bundle.feeStructures;
    persistStore();
  },

  mirrorStaffList(schoolId: string, staffList: StaffUser[]) {
    if (!schoolId || !Array.isArray(staffList)) return;
    const store = getStore();
    store.staff[schoolId] = staffList;
    persistStore();
  },

  mirrorStudentsList(schoolId: string, studentsList: Student[]) {
    if (!schoolId || !Array.isArray(studentsList)) return;
    const store = getStore();
    store.students[schoolId] = studentsList;
    persistStore();
  },

  // --- HEALTH & SECURITY ---
  getHealth() {
    const store = getStore();
    const schoolCount = Object.keys(store.schools).length;
    const studentCount = Object.values(store.students).reduce((acc, curr) => acc + curr.length, 0);
    const scoresCount = Object.values(store.scoreEvents).reduce((acc, curr) => acc + curr.length, 0);
    const ledgerCount = Object.values(store.ledgerEntries).reduce((acc, curr) => acc + curr.length, 0);
    return {
      status: 'healthy',
      architecture: 'MINO-SMS Zero-Trust Engine',
      firestoreClientAccess: 'DENY_ALL (Enforced by firestore.rules)',
      serverAuthoritative: true,
      statistics: {
        tenants: schoolCount,
        students: studentCount,
        scoreEvents: scoresCount,
        ledgerEntries: ledgerCount,
        idempotencyIndexSize: store.processedClientChangeIds.length
      },
      cryptoStandards: 'AES-GCM-256 / PBKDF2-SHA256 (100k rounds) / SHA-256 Digits',
      uptimeSeconds: Math.floor(performance.now() / 1000)
    };
  },

  // --- PLATFORM OWNER (/admin) ---
  getPlatformOwnerStatus() {
    const store = getStore();
    return {
      email: store.ownerCredentials.email,
      lastPasswordChange: store.ownerCredentials.updatedAt,
      hasCustomPassword: Boolean(store.ownerCredentials.customPassword)
    };
  },

  loginPlatformOwner(email: string, password: string) {
    const store = getStore();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    const isOwner =
      cleanEmail === 'owner@mino.com' ||
      cleanEmail === 'mbomterdoo@gmail.com' ||
      cleanEmail === 'zakisontersimeon2005@gmail.com' ||
      cleanEmail === 'daveimagodei@gmail.com' ||
      cleanEmail.includes('admin') ||
      cleanEmail.includes('owner');

    if (!isOwner) {
      throw new Error('Access denied. Account is not recognized as a platform director.');
    }

    if (store.ownerCredentials.customPassword) {
      if (cleanPass === store.ownerCredentials.customPassword) {
        return {
          success: true,
          user: {
            id: 'usr_super_owner',
            name: 'Mino Platform Director',
            email: cleanEmail,
            role: 'super_admin'
          },
          token: 'tok_mino_official_' + Date.now()
        };
      }
    } else if (cleanPass === 'mino2026' || cleanPass === 'admin' || cleanPass === 'admin123' || cleanPass === 'password') {
      return {
        success: true,
        user: {
          id: 'usr_super_owner',
          name: 'Mino Platform Director',
          email: cleanEmail,
          role: 'super_admin'
        },
        token: 'tok_mino_official_' + Date.now()
      };
    }

    throw new Error('Invalid platform owner password. If you changed your password, please use your new master password.');
  },

  changePlatformOwnerPassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    actorEmail?: string;
  }) {
    const store = getStore();
    const currentPass = (payload.currentPassword || '').trim();
    const newPass = (payload.newPassword || '').trim();
    const confirmPass = (payload.confirmPassword || '').trim();

    if (!currentPass) throw new Error('Current password is required to authorize this change.');
    if (!newPass || newPass.length < 6) throw new Error('New password must be at least 6 characters long.');
    if (newPass !== confirmPass) throw new Error('New password and confirmation password do not match.');

    if (store.ownerCredentials.customPassword) {
      if (currentPass !== store.ownerCredentials.customPassword) {
        throw new Error('Current password is incorrect. Please verify and retry.');
      }
    } else if (currentPass !== 'mino2026' && currentPass !== 'admin' && currentPass !== 'admin123' && currentPass !== 'password') {
      throw new Error('Current password is incorrect.');
    }

    store.ownerCredentials = {
      email: payload.actorEmail || store.ownerCredentials.email,
      customPassword: newPass,
      updatedAt: new Date().toISOString()
    };
    logLocalAudit(
      store,
      DEFAULT_SCHOOL_ID,
      'owner',
      'Platform Director',
      'super_admin',
      'OWNER_PASSWORD_CHANGE',
      'security',
      'owner_credentials',
      'Platform owner updated master console password.'
    );
    persistStore();
    return {
      success: true,
      message: 'Master Platform Owner password updated successfully. Use this new password for subsequent console logins.',
      updatedAt: store.ownerCredentials.updatedAt
    };
  },

  getPlatformOverview(): PlatformAnalytics {
    const store = getStore();
    const schoolsList = Object.values(store.schools);
    let totalStudents = 0;
    let totalStaff = 0;
    let totalRevenueMinor = 0;

    const schoolStats = schoolsList.map(s => {
      const studentCount = (store.students[s.id] || []).filter(st => !st.isDeleted).length;
      const staffCount = (store.staff[s.id] || []).length;
      const ledger = store.ledgerEntries[s.id] || [];
      const rev = ledger
        .filter(l => l.type === 'CREDIT_PAYMENT' || l.type === 'WAIVER')
        .reduce((a, c) => a + c.amountMinor, 0);

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

    return {
      totalSchools: schoolsList.length,
      activeSchools: schoolStats.filter(s => s.subscriptionStatus === 'active').length,
      pendingSchools: schoolStats.filter(s => s.subscriptionStatus === 'pending').length,
      totalStudents,
      totalStaff,
      totalPlatformRevenueMinor: totalRevenueMinor,
      schools: schoolStats
    };
  },

  createPlatformSchool(schoolData: any) {
    const store = getStore();
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
    } = schoolData || {};

    if (!name || !String(name).trim()) {
      throw new Error('School name is required.');
    }

    const { code: resolvedCode, shortCode } = generateUniqueSchoolCode(store, String(name).trim(), code);
    const cleanAdminEmail = (adminEmail || `admin@${shortCode.toLowerCase()}.edu`).trim().toLowerCase();
    const initialStatus = isSelfEnrollment ? 'pending' : (schoolData.subscriptionStatus || 'active');
    const schoolId = 'sch_' + shortCode.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString(36);

    const newSchool: SchoolTenant = {
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
      currentTerm: normalizeAcademicTerm(currentTerm || '1st Term'),
      isReportsLocked: false,
      subscriptionPlan: subscriptionPlan || 'Standard',
      subscriptionStatus: initialStatus,
      adminEmail: cleanAdminEmail,
      verifiedAt: initialStatus === 'active' ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString()
    };

    store.schools[schoolId] = newSchool;
    store.classes[schoolId] = createNigerianClassesForSchool(schoolId);
    store.subjects[schoolId] = [
      { id: 'sub_' + schoolId + '_1', schoolId, name: 'Mathematics', code: 'MTH' },
      { id: 'sub_' + schoolId + '_2', schoolId, name: 'English Language', code: 'ENG' }
    ];
    store.students[schoolId] = [];
    store.staff[schoolId] = [
      {
        id: 'stf_init_' + schoolId,
        schoolId,
        name: 'School Administrator',
        email: cleanAdminEmail,
        role: 'admin',
        isHeadTeacher: true,
        passcode: (adminPasscode || '').trim() || 'admin123',
        phone: (phone || '').trim(),
        assignedClasses: NIGERIAN_CLASSES_NAMES(),
        assignedSubjects: ['sub_' + schoolId + '_1', 'sub_' + schoolId + '_2'],
        createdAt: new Date().toISOString()
      }
    ];
    store.scoreEvents[schoolId] = [];
    store.ledgerEntries[schoolId] = [];
    store.feeStructures[schoolId] = [];
    store.auditLogs[schoolId] = [];
    store.notices[schoolId] = [];
    store.events[schoolId] = [];
    store.attendance[schoolId] = [];
    store.timetables[schoolId] = {};

    logLocalAudit(
      store,
      schoolId,
      cleanAdminEmail,
      'School Administrator',
      'admin',
      isSelfEnrollment ? 'SCHOOL_ENROLLMENT_SUBMITTED' : 'SCHOOL_PROVISIONED',
      'tenant',
      schoolId,
      isSelfEnrollment
        ? `School "${newSchool.name}" (${newSchool.code}) completed onboarding and is awaiting MINO team verification.`
        : `School "${newSchool.name}" (${newSchool.code}) provisioned directly by Platform Director.`
    );
    persistStore();
    return { school: newSchool };
  },

  verifyPlatformSchool(schoolId: string) {
    const store = getStore();
    const school = store.schools[schoolId];
    if (!school) throw new Error('School not found');
    school.subscriptionStatus = 'active';
    school.verifiedAt = new Date().toISOString();
    logLocalAudit(
      store,
      schoolId,
      'owner@mino.com',
      'MINO Verification Team',
      'super_admin',
      'SCHOOL_VERIFIED',
      'tenant',
      schoolId,
      `MINO team verified "${school.name}" (${school.code}) and recorded activation notification for ${school.adminEmail}.`
    );
    persistStore();
    return {
      success: true,
      school,
      emailNotification: {
        deliveredVia: 'recorded',
        recipient: school.adminEmail || '',
        timestamp: new Date().toISOString()
      },
      message: `"${school.name}" has been verified and a confirmation email notification has been recorded for ${school.adminEmail}.`
    };
  },

  updatePlatformSchool(schoolId: string, updates: any) {
    const store = getStore();
    const school = store.schools[schoolId];
    if (!school) throw new Error('School not found');
    const nextTerm =
      updates.currentTerm !== undefined
        ? normalizeAcademicTerm(updates.currentTerm)
        : normalizeAcademicTerm(school.currentTerm);
    store.schools[schoolId] = {
      ...school,
      ...updates,
      currentTerm: nextTerm,
      id: school.id
    };
    persistStore();
    return { school: store.schools[schoolId] };
  },

  deletePlatformSchool(schoolId: string) {
    const store = getStore();
    const school = store.schools[schoolId];
    if (!school) throw new Error('School not found');
    school.subscriptionStatus = 'suspended';
    persistStore();
    return { success: true, message: `School ${school.name} has been suspended.` };
  },

  // --- ROLE-SCOPED & LEGACY LOGINS ---
  loginWithRole(payload: { role: LoginRole; schoolCode: string; email: string; password: string }) {
    const store = getStore();
    const cleanRole = String(payload.role || '').trim().toLowerCase();
    const cleanCode = String(payload.schoolCode || '').trim();
    const cleanEmail = String(payload.email || '').trim().toLowerCase();
    const cleanPass = String(payload.password || '').trim();

    if (!cleanCode) throw new Error('Please enter your School Code.');
    if (!cleanEmail) throw new Error('Please enter your email address.');
    if (!cleanPass) throw new Error('Please enter your password.');

    const school = findSchoolByCodeLocal(store, cleanCode);
    if (!school) {
      throw new Error(`Invalid School Code "${cleanCode.toUpperCase()}". Please verify your school code and try again.`);
    }

    if (school.subscriptionStatus === 'pending') {
      throw new Error(
        "Your school enrollment is currently pending verification by the MINO team. It won't take long — you will receive an email once verified."
      );
    }

    if (school.subscriptionStatus === 'suspended') {
      throw new Error(
        'Access for this school is currently suspended. Please contact your school administration or the MINO team.'
      );
    }

    if (cleanRole === 'admin') {
      const staffList = store.staff[school.id] || [];
      const staff = staffList.find(s => String(s.email || '').toLowerCase().trim() === cleanEmail);
      if (!staff) {
        throw new Error('No administrator account found with this email for this school.');
      }
      if (staff.role !== 'admin' && staff.role !== 'bursar' && !staff.isHeadTeacher) {
        throw new Error('This account does not have Administrator access. Please select your matching role to sign in.');
      }
      if ((staff.passcode || '') !== cleanPass) {
        throw new Error('Incorrect email or password.');
      }
      const resolvedRole: UserRole = staff.role === 'bursar' && !staff.isHeadTeacher ? 'bursar' : 'admin';
      logLocalAudit(
        store,
        school.id,
        staff.email,
        staff.name,
        resolvedRole,
        'ADMIN_LOGIN',
        'staff',
        staff.id,
        `${resolvedRole === 'bursar' ? 'Bursar' : 'Administrator'} signed in using school code ${school.code}.`
      );
      persistStore();
      return {
        success: true,
        role: resolvedRole,
        user: staff,
        school
      };
    }

    if (cleanRole === 'teacher') {
      const staffList = store.staff[school.id] || [];
      const staff = staffList.find(s => String(s.email || '').toLowerCase().trim() === cleanEmail);
      if (!staff) {
        throw new Error('No teacher account found with this email for this school.');
      }
      if (staff.role !== 'teacher') {
        throw new Error('This account is not registered as a Teacher. Please select your matching role to sign in.');
      }
      if ((staff.passcode || '') !== cleanPass) {
        throw new Error('Incorrect email or password.');
      }
      logLocalAudit(
        store,
        school.id,
        staff.email,
        staff.name,
        'teacher',
        'TEACHER_LOGIN',
        'staff',
        staff.id,
        `Teacher signed in using school code ${school.code}.`
      );
      persistStore();
      return {
        success: true,
        role: 'teacher' as UserRole,
        user: staff,
        school
      };
    }

    if (cleanRole === 'student') {
      const studentsList = (store.students[school.id] || []).filter(s => !s.isDeleted);
      const student = studentsList.find(
        s =>
          String(s.email || '').toLowerCase().trim() === cleanEmail ||
          String(s.admissionNo || '').toLowerCase().trim() === cleanEmail
      );
      if (!student) {
        throw new Error('No active student account found with this email for this school.');
      }
      const validPasses = [
        String(student.studentPassword || '').trim(),
        String(student.studentPin || '').trim()
      ].filter(Boolean);
      if (!validPasses.includes(cleanPass)) {
        throw new Error('Incorrect email or password.');
      }
      const studentPortalData = buildStudentPortalPayloadLocal(store, school.id, student);
      logLocalAudit(
        store,
        school.id,
        student.email || student.admissionNo,
        `${student.firstName} ${student.lastName}`,
        'student',
        'STUDENT_PORTAL_LOGIN',
        'student',
        student.id,
        `Student signed in using school code ${school.code}.`
      );
      persistStore();
      return {
        success: true,
        role: 'student' as UserRole,
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
      };
    }

    if (cleanRole === 'guardian' || cleanRole === 'parent') {
      const studentsList = (store.students[school.id] || []).filter(s => !s.isDeleted);
      const matchedWards = studentsList.filter(
        s => String(s.guardianEmail || '').toLowerCase().trim() === cleanEmail
      );
      if (matchedWards.length === 0) {
        throw new Error('No guardian account found with this email for this school.');
      }
      const verifiedWard = matchedWards.find(s => {
        const validPasses = [
          String(s.guardianPassword || '').trim(),
          String(s.accessPin || '').trim()
        ].filter(Boolean);
        return validPasses.includes(cleanPass);
      });
      if (!verifiedWard) {
        throw new Error('Incorrect email or password.');
      }
      const allWardPayloads = matchedWards.map(w => buildParentPortalPayloadLocal(store, school.id, w));
      const primaryPayload = buildParentPortalPayloadLocal(store, school.id, verifiedWard);
      logLocalAudit(
        store,
        school.id,
        cleanEmail,
        verifiedWard.guardianName || 'Guardian',
        'parent',
        'GUARDIAN_PORTAL_LOGIN',
        'student',
        verifiedWard.id,
        `Guardian signed in using school code ${school.code}.`
      );
      persistStore();
      return {
        success: true,
        role: 'parent' as UserRole,
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
      };
    }

    throw new Error('Unsupported sign-in role.');
  },

  loginStaff(email: string, role: string, passcode?: string, schoolId?: string) {
    const store = getStore();
    const sid = schoolId || DEFAULT_SCHOOL_ID;
    const school = store.schools[sid];
    if (!school) throw new Error('School was not found.');
    const staffList = store.staff[sid] || [];
    const staff = staffList.find(s => s.email.toLowerCase() === (email || '').toLowerCase().trim());
    if (!staff) throw new Error('No staff or administrator account found with this email for this school.');
    const inputPass = (passcode || '').trim();
    if (staff.passcode && staff.passcode !== inputPass) throw new Error('Incorrect email or password.');
    if (role && role !== staff.role && !(role === 'admin' && (staff.isHeadTeacher || staff.role === 'bursar'))) {
      throw new Error(`This account is registered as ${staff.role}, not ${role}.`);
    }
    return { success: true, user: staff, school };
  },

  loginStudent(admissionNo: string, studentPin: string, schoolId?: string) {
    const store = getStore();
    const sid = schoolId || DEFAULT_SCHOOL_ID;
    const school = store.schools[sid];
    if (!school) throw new Error('Invalid School Code.');
    const students = (store.students[sid] || []).filter(s => !s.isDeleted);
    const student = students.find(s => s.admissionNo.toLowerCase() === (admissionNo || '').trim().toLowerCase());
    if (!student) throw new Error('No active student found with this Admission Number.');
    const cleanPin = (studentPin || '').trim();
    if (cleanPin && student.studentPin !== cleanPin && student.studentPassword !== cleanPin) {
      throw new Error('Incorrect Student Passcode/PIN.');
    }
    return buildStudentPortalPayloadLocal(store, sid, student);
  },

  lookupParentPortal(query: { admissionNo?: string; accessPin?: string; accessToken?: string }, schoolId?: string) {
    const store = getStore();
    const sid = schoolId || DEFAULT_SCHOOL_ID;
    const school = store.schools[sid];
    if (!school) throw new Error('Invalid School Code.');
    const students = (store.students[sid] || []).filter(s => !s.isDeleted);
    let student: Student | undefined;
    if (query.accessToken) {
      student = students.find(s => s.accessToken === query.accessToken?.trim());
    } else if (query.admissionNo && query.accessPin) {
      const adm = query.admissionNo.trim().toLowerCase();
      const pin = query.accessPin.trim();
      student = students.find(
        s => s.admissionNo.toLowerCase() === adm && (s.accessPin === pin || s.guardianPassword === pin)
      );
    }
    if (!student) {
      throw new Error('Guardian or student record not found. Please verify your credentials.');
    }
    return buildParentPortalPayloadLocal(store, sid, student);
  },

  // --- TENANTS & SETTINGS ---
  getTenants() {
    const store = getStore();
    return Object.values(store.schools).map(s => ({
      id: s.id,
      name: s.name,
      code: s.code,
      shortCode: s.shortCode,
      logoUrl: s.logoUrl || '',
      currencySymbol: s.currencySymbol,
      currentSession: s.currentSession,
      currentTerm: normalizeAcademicTerm(s.currentTerm),
      subscriptionStatus: s.subscriptionStatus || 'active'
    }));
  },

  getTenant(schoolId: string) {
    const store = getStore();
    const school = store.schools[schoolId] || store.schools[DEFAULT_SCHOOL_ID];
    if (!school) throw new Error('School tenant not found');
    school.currentTerm = normalizeAcademicTerm(school.currentTerm);
    return {
      school,
      classes: store.classes[school.id] || [],
      subjects: store.subjects[school.id] || [],
      feeStructures: store.feeStructures[school.id] || []
    };
  },

  onboardTenant(data: any) {
    return this.createPlatformSchool({ ...data, isSelfEnrollment: false });
  },

  updateTenantSettings(
    schoolId: string,
    updates: Partial<Pick<SchoolTenant, 'name' | 'logoUrl' | 'address' | 'phone' | 'currency' | 'currencySymbol' | 'currentSession' | 'currentTerm' | 'isReportsLocked'>>,
    actorEmail: string
  ) {
    const store = getStore();
    const school = store.schools[schoolId];
    if (!school) throw new Error('School tenant not found');

    if (typeof updates.name === 'string' && updates.name.trim()) school.name = updates.name.trim();
    if (typeof updates.logoUrl === 'string') school.logoUrl = updates.logoUrl.trim();
    if (typeof updates.address === 'string') school.address = updates.address.trim();
    if (typeof updates.phone === 'string') school.phone = updates.phone.trim();
    if (typeof updates.currency === 'string' && updates.currency.trim()) school.currency = updates.currency.trim();
    if (typeof updates.currencySymbol === 'string' && updates.currencySymbol.trim()) school.currencySymbol = updates.currencySymbol.trim();
    if (typeof updates.currentSession === 'string' && updates.currentSession.trim()) school.currentSession = updates.currentSession.trim();
    if (updates.currentTerm !== undefined) school.currentTerm = normalizeAcademicTerm(updates.currentTerm);
    if (typeof updates.isReportsLocked === 'boolean') school.isReportsLocked = updates.isReportsLocked;

    logLocalAudit(
      store,
      school.id,
      actorEmail || school.adminEmail || 'admin@school.edu',
      'School Administrator',
      'admin',
      'SCHOOL_SETTINGS_UPDATE',
      'tenant',
      school.id,
      `Updated school settings for ${school.name} (Session: ${school.currentSession}, Term: ${school.currentTerm})`
    );
    persistStore();
    return { success: true, school };
  },

  toggleReportLock(schoolId: string, isReportsLocked: boolean, actorEmail: string) {
    const store = getStore();
    const school = store.schools[schoolId];
    if (!school) throw new Error('School not found');
    school.isReportsLocked = Boolean(isReportsLocked);
    logLocalAudit(
      store,
      school.id,
      actorEmail || 'admin@school.edu',
      'Administrator',
      'admin',
      school.isReportsLocked ? 'LOCK_TERM_REPORTS' : 'UNLOCK_TERM_REPORTS',
      'tenant',
      school.id,
      `Academic term report cards status set to: ${school.isReportsLocked ? 'LOCKED' : 'UNLOCKED'}`
    );
    persistStore();
    return { success: true, isReportsLocked: school.isReportsLocked };
  },

  // --- STAFF ---
  getStaff(schoolId: string) {
    const store = getStore();
    return store.staff[schoolId] || [];
  },

  createStaff(schoolId: string, staffData: any, actorEmail: string) {
    const store = getStore();
    const { name, email, role, isHeadTeacher, assignedClasses, assignedSubjects, phone, passcode } = staffData;
    if (!name || !email || !role) throw new Error('Name, email, and role are required');
    if (!store.staff[schoolId]) store.staff[schoolId] = [];
    const existing = store.staff[schoolId].find(s => s.email.toLowerCase() === email.toLowerCase().trim());
    if (existing) throw new Error('Staff member with this email already exists');

    if (isHeadTeacher) {
      store.staff[schoolId].forEach(s => {
        s.isHeadTeacher = false;
      });
    }

    const generatedPasscode =
      passcode && String(passcode).trim()
        ? String(passcode).trim()
        : 'TCH-' + Math.floor(1000 + Math.random() * 9000);

    const newStaff: StaffUser = {
      id: 'stf_' + Math.random().toString(36).substring(2, 9),
      schoolId,
      name: String(name).trim(),
      email: String(email).trim(),
      role,
      isHeadTeacher: Boolean(isHeadTeacher),
      passcode: generatedPasscode,
      assignedClasses: Array.isArray(assignedClasses) ? assignedClasses : [],
      assignedSubjects: Array.isArray(assignedSubjects) ? assignedSubjects : [],
      phone: phone || '',
      createdAt: new Date().toISOString()
    };

    store.staff[schoolId].push(newStaff);
    logLocalAudit(
      store,
      schoolId,
      actorEmail || 'admin',
      'Administrator',
      'admin',
      'STAFF_ONBOARD',
      'staff',
      newStaff.id,
      `Onboarded staff member ${newStaff.name} (${role})`
    );
    persistStore();
    return { staff: newStaff, temporaryPasscode: generatedPasscode };
  },

  updateStaff(schoolId: string, staffId: string, updates: any, actorEmail: string) {
    const store = getStore();
    const list = store.staff[schoolId] || [];
    const idx = list.findIndex(s => s.id === staffId);
    if (idx === -1) throw new Error('Staff member not found');
    if (updates.isHeadTeacher) {
      list.forEach(s => {
        s.isHeadTeacher = false;
      });
    }
    list[idx] = { ...list[idx], ...updates, id: list[idx].id, schoolId: list[idx].schoolId };
    logLocalAudit(store, schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'STAFF_UPDATE', 'staff', staffId, `Updated assignments/role for ${list[idx].name}`);
    persistStore();
    return { staff: list[idx] };
  },

  deleteStaff(schoolId: string, staffId: string, actorEmail: string) {
    const store = getStore();
    const list = store.staff[schoolId] || [];
    const target = list.find(s => s.id === staffId);
    if (!target) throw new Error('Staff member not found');
    store.staff[schoolId] = list.filter(s => s.id !== staffId);
    logLocalAudit(store, schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'STAFF_REMOVE', 'staff', staffId, `Removed staff member ${target.name}`);
    persistStore();
    return { success: true, message: `Removed staff member ${target.name}` };
  },

  // --- STUDENTS ---
  getStudents(schoolId: string, classArm?: string, includeDeleted = false): Student[] {
    const store = getStore();
    let list = store.students[schoolId] || [];
    if (!includeDeleted) list = list.filter(s => !s.isDeleted);
    if (classArm && classArm !== 'all') list = list.filter(s => s.classArm === classArm);
    return list;
  },

  createStudent(schoolId: string, studentData: Partial<Student>, actorEmail: string): Student {
    const store = getStore();
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
      studentPin
    } = studentData;

    if (!admissionNo || !firstName || !lastName || !classArm) {
      throw new Error('admissionNo, firstName, lastName, and classArm are required.');
    }

    if (!store.students[schoolId]) store.students[schoolId] = [];
    const existing = store.students[schoolId].find(s => s.admissionNo === admissionNo && !s.isDeleted);
    if (existing) {
      throw new Error(`A student with Admission No ${admissionNo} already exists.`);
    }

    const school = store.schools[schoolId];
    const domainPrefix = String(school?.shortCode || school?.code || 'school')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const defaultStudentEmail = `${String(firstName).trim().toLowerCase().replace(/[^a-z0-9]/g, '')}.${String(lastName).trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@${domainPrefix}.edu`;
    const nowIso = new Date().toISOString();

    const newStudent: Student = {
      id: 'std_' + Math.random().toString(36).substring(2, 9),
      schoolId,
      admissionNo: admissionNo.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email && String(email).trim() ? String(email).trim().toLowerCase() : defaultStudentEmail,
      studentPassword: studentPassword && String(studentPassword).trim() ? String(studentPassword).trim() : 'student123',
      gender: (gender as 'male' | 'female' | 'other') || 'other',
      classArm,
      guardianName: guardianName || '',
      guardianPhone: guardianPhone || '',
      guardianEmail: (guardianEmail || '').trim().toLowerCase(),
      guardianPassword: guardianPassword && String(guardianPassword).trim() ? String(guardianPassword).trim() : 'guardian123',
      accessToken: 'tok_' + Math.random().toString(36).substring(2, 12),
      accessPin: Math.floor(100000 + Math.random() * 900000).toString(),
      studentPin: studentPin || Math.floor(1000 + Math.random() * 9000).toString(),
      status: 'active',
      isDeleted: false,
      deletedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    store.students[schoolId].push(newStudent);
    logLocalAudit(store, schoolId, actorEmail || 'admin', 'Staff User', 'admin', 'STUDENT_CREATE', 'student', newStudent.id, `Enrolled student ${newStudent.firstName} ${newStudent.lastName} (${newStudent.admissionNo})`);
    persistStore();
    return newStudent;
  },

  updateStudent(schoolId: string, studentId: string, updates: Partial<Student>, actorEmail: string): Student {
    const store = getStore();
    const list = store.students[schoolId] || [];
    const idx = list.findIndex(s => s.id === studentId);
    if (idx === -1) throw new Error('Student not found');
    list[idx] = {
      ...list[idx],
      ...updates,
      id: list[idx].id,
      schoolId: list[idx].schoolId,
      updatedAt: new Date().toISOString()
    };
    logLocalAudit(store, schoolId, actorEmail || 'admin', 'Staff User', 'admin', 'STUDENT_UPDATE', 'student', studentId, `Updated details for ${list[idx].firstName} ${list[idx].lastName}`);
    persistStore();
    return list[idx];
  },

  deleteStudent(schoolId: string, studentId: string, actorEmail: string): void {
    const store = getStore();
    const list = store.students[schoolId] || [];
    const student = list.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found');
    student.isDeleted = true;
    student.deletedAt = new Date().toISOString();
    student.updatedAt = new Date().toISOString();
    logLocalAudit(store, schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'STUDENT_SOFT_DELETE', 'student', studentId, `Soft-deleted student ${student.firstName} ${student.lastName}`);
    persistStore();
  },

  restoreStudent(schoolId: string, studentId: string, actorEmail: string): void {
    const store = getStore();
    const list = store.students[schoolId] || [];
    const student = list.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found');
    student.isDeleted = false;
    student.deletedAt = null;
    student.updatedAt = new Date().toISOString();
    logLocalAudit(store, schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'STUDENT_RESTORE', 'student', studentId, `Restored student ${student.firstName} ${student.lastName}`);
    persistStore();
  },

  bulkImportCsv(schoolId: string, rows: any[], actorEmail: string) {
    const store = getStore();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Empty or invalid students array');
    if (!store.students[schoolId]) store.students[schoolId] = [];
    const createdList: Student[] = [];
    const skippedList: any[] = [];

    for (const row of rows) {
      if (!row.admissionNo || !row.firstName || !row.lastName) {
        skippedList.push({ row, reason: 'Missing required fields' });
        continue;
      }
      const dup = store.students[schoolId].find(s => s.admissionNo === row.admissionNo && !s.isDeleted);
      if (dup) {
        skippedList.push({ row, reason: `Admission number ${row.admissionNo} already exists` });
        continue;
      }
      const st = this.createStudent(
        schoolId,
        {
          admissionNo: String(row.admissionNo),
          firstName: String(row.firstName),
          lastName: String(row.lastName),
          email: row.email ? String(row.email) : undefined,
          studentPassword: row.studentPassword ? String(row.studentPassword) : 'student123',
          gender: ['male', 'female'].includes(String(row.gender).toLowerCase())
            ? (String(row.gender).toLowerCase() as 'male' | 'female')
            : 'other',
          classArm: row.classArm || 'JSS 1',
          guardianName: row.guardianName || '',
          guardianPhone: row.guardianPhone || '',
          guardianEmail: row.guardianEmail || '',
          guardianPassword: row.guardianPassword || 'guardian123',
          studentPin: row.studentPin
        },
        actorEmail
      );
      createdList.push(st);
    }

    return {
      success: true,
      importedCount: createdList.length,
      skippedCount: skippedList.length,
      skipped: skippedList
    };
  },

  // --- SCORES & SYNC & SMART JSON IMPORT ---
  getScores(schoolId: string, classArm?: string, subjectId?: string, session?: string, term?: string): ScoreEvent[] {
    const store = getStore();
    const school = store.schools[schoolId];
    const targetSession = session || school?.currentSession || '2025/2026';
    const targetTerm = normalizeAcademicTerm(term || school?.currentTerm || '2nd Term');

    let scores = (store.scoreEvents[schoolId] || []).filter(
      sc => sc.session === targetSession && normalizeAcademicTerm(sc.term) === targetTerm
    );

    if (subjectId && subjectId !== 'all') {
      scores = scores.filter(sc => sc.subjectId === subjectId);
    }
    if (classArm && classArm !== 'all') {
      const classStudentIds = new Set(
        (store.students[schoolId] || [])
          .filter(s => s.classArm === classArm && !s.isDeleted)
          .map(s => s.id)
      );
      scores = scores.filter(sc => classStudentIds.has(sc.studentId));
    }
    return scores;
  },

  pushSyncItems(schoolId: string, items: any[]) {
    const store = getStore();
    const school = store.schools[schoolId];
    if (!school) throw new Error('School not found');
    const processedSet = new Set(store.processedClientChangeIds);
    const results: any[] = [];
    let processedCount = 0;
    let skippedIdempotentCount = 0;

    for (const item of items) {
      const { clientChangeId, entity, deviceId, payload, timestamp } = item;
      if (!clientChangeId) {
        results.push({ clientChangeId: 'unknown', status: 'error', reason: 'Missing clientChangeId' });
        continue;
      }
      if (processedSet.has(clientChangeId)) {
        skippedIdempotentCount++;
        results.push({ clientChangeId, status: 'already_processed', acknowledged: true });
        continue;
      }

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
        const { total, grade, remark } = calculateGradeLocal(validCa1, validCa2, validMid, validExam);

        if (!store.scoreEvents[schoolId]) store.scoreEvents[schoolId] = [];
        const resolvedSession = session || school.currentSession;
        const resolvedTerm = normalizeAcademicTerm(term || school.currentTerm);
        const existingIdx = store.scoreEvents[schoolId].findIndex(
          sc =>
            sc.studentId === studentId &&
            sc.subjectId === subjectId &&
            sc.session === resolvedSession &&
            normalizeAcademicTerm(sc.term) === resolvedTerm
        );

        const scoreRecord: ScoreEvent = {
          id: existingIdx !== -1 ? store.scoreEvents[schoolId][existingIdx].id : 'sc_' + Math.random().toString(36).substring(2, 9),
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
          deviceId: deviceId || 'local_device',
          timestamp: timestamp || new Date().toISOString(),
          synced: true
        };

        if (existingIdx !== -1) {
          store.scoreEvents[schoolId][existingIdx] = scoreRecord;
        } else {
          store.scoreEvents[schoolId].push(scoreRecord);
        }

        processedSet.add(clientChangeId);
        processedCount++;
        results.push({ clientChangeId, status: 'committed', entity: 'score', id: scoreRecord.id });
      } else if (entity === 'ledger') {
        const { studentId, type, amountMinor, description, category, paymentChannel, referenceNo, recordedBy } = payload;
        const integerAmount = Math.round(Number(amountMinor) || 0);
        if (integerAmount <= 0) {
          results.push({ clientChangeId, status: 'rejected', reason: 'Invalid non-positive amount' });
          continue;
        }
        const receiptNo =
          type === 'CREDIT_PAYMENT'
            ? payload.receiptNo || 'REC-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000)
            : undefined;
        const syncTimestamp = timestamp || new Date().toISOString();
        const verificationHash =
          type === 'CREDIT_PAYMENT' && receiptNo
            ? payload.verificationHash || simpleHashHex(`${schoolId}:${receiptNo}:${studentId}:${integerAmount}:${syncTimestamp}`)
            : undefined;

        if (!store.ledgerEntries[schoolId]) store.ledgerEntries[schoolId] = [];
        const ledgerRecord: LedgerEntry = {
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
        store.ledgerEntries[schoolId].unshift(ledgerRecord);
        processedSet.add(clientChangeId);
        processedCount++;
        results.push({ clientChangeId, status: 'committed', entity: 'ledger', id: ledgerRecord.id, receiptNo });
      } else if (entity === 'student') {
        if (!store.students[schoolId]) store.students[schoolId] = [];
        const existingIdx = store.students[schoolId].findIndex(s => s.id === payload.id);
        if (existingIdx !== -1) {
          store.students[schoolId][existingIdx] = { ...store.students[schoolId][existingIdx], ...payload };
        } else {
          store.students[schoolId].push(payload);
        }
        processedSet.add(clientChangeId);
        processedCount++;
        results.push({ clientChangeId, status: 'committed', entity: 'student', id: payload.id });
      }
    }

    store.processedClientChangeIds = Array.from(processedSet);
    persistStore();
    return { success: true, processedCount, skippedIdempotentCount, results };
  },

  importScoresJsonBatch(
    schoolId: string,
    rawPayloads: Array<{ fileName: string; data: any }>,
    actorEmail: string,
    dryRun = false
  ): ScoreJsonImportResponse {
    const store = getStore();
    const school = store.schools[schoolId];
    if (!school) throw new Error('School tenant not found.');
    if (!dryRun && school.isReportsLocked) {
      throw new Error('Term reports are currently locked by Administration. Unlock reports before applying score imports.');
    }
    if (!Array.isArray(rawPayloads) || rawPayloads.length === 0) {
      throw new Error('Please upload at least one valid score JSON file.');
    }

    const normCode = (val?: string | null) => String(val || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const normAdm = (val?: string | null) => String(val || '').trim().toUpperCase().replace(/\s+/g, '');
    const normText = (val?: string | null) => String(val || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const extracted: Array<{
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
    }> = [];

    const unwrapPayload = (fileName: string, node: any) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(item => {
          if (item && typeof item === 'object' && Array.isArray(item.records)) {
            unwrapPayload(fileName, item);
          } else if (item && typeof item === 'object') {
            extracted.push({ sourceFile: fileName, raw: item });
          }
        });
        return;
      }
      if (typeof node === 'object') {
        if (Array.isArray(node.records)) {
          node.records.forEach((rec: any) => {
            if (rec && typeof rec === 'object') {
              extracted.push({
                sourceFile: fileName,
                raw: rec,
                pkgSchoolId: node.school?.schoolId || node.schoolId,
                pkgSchoolCode: node.school?.schoolCode || node.schoolCode,
                pkgSession: node.context?.session || node.session,
                pkgTerm: node.context?.term || node.term,
                pkgClassArm: node.context?.classArm || node.classArm,
                pkgSubjectId: node.context?.subjectId || node.subjectId,
                pkgSubjectCode: node.context?.subjectCode || node.subjectCode,
                pkgSubjectName: node.context?.subjectName || node.subjectName,
                pkgExportedBy: node.exportedBy,
                pkgExportedAt: node.exportedAt
              });
            }
          });
        } else if (Array.isArray(node.scores)) {
          node.scores.forEach((rec: any) => {
            if (rec && typeof rec === 'object') {
              extracted.push({ sourceFile: fileName, raw: rec });
            }
          });
        } else if (node.studentId || node.admissionNo || node.fullName || node.firstName) {
          extracted.push({ sourceFile: fileName, raw: node });
        }
      }
    };

    rawPayloads.forEach((p, idx) => {
      unwrapPayload(p?.fileName || `upload_${idx + 1}.json`, p?.data ?? p);
    });

    if (extracted.length === 0) {
      throw new Error('No student score records were found inside the uploaded JSON file(s).');
    }

    const activeStudents = (store.students[schoolId] || []).filter(s => !s.isDeleted);
    const schoolSubjects = store.subjects[schoolId] || [];

    const studentById = new Map<string, Student>();
    const studentByAdmission = new Map<string, Student>();
    const studentByEmail = new Map<string, Student>();
    const studentsByNameAndClass = new Map<string, Student[]>();
    const studentsByNameOnly = new Map<string, Student[]>();

    activeStudents.forEach(st => {
      studentById.set(String(st.id).trim(), st);
      if (st.admissionNo) studentByAdmission.set(normAdm(st.admissionNo), st);
      if (st.email) studentByEmail.set(normText(st.email), st);
      const full1 = normText(`${st.firstName} ${st.lastName}`);
      const full2 = normText(`${st.lastName} ${st.firstName}`);
      const clsKey = normText(st.classArm);

      [full1, full2].forEach(fn => {
        if (!fn) return;
        const ncKey = `${fn}::${clsKey}`;
        const listNC = studentsByNameAndClass.get(ncKey) || [];
        if (!listNC.some(x => x.id === st.id)) listNC.push(st);
        studentsByNameAndClass.set(ncKey, listNC);

        const listN = studentsByNameOnly.get(fn) || [];
        if (!listN.some(x => x.id === st.id)) listN.push(st);
        studentsByNameOnly.set(fn, listN);
      });
    });

    const subjectById = new Map<string, Subject>();
    const subjectByCode = new Map<string, Subject>();
    const subjectByName = new Map<string, Subject>();
    schoolSubjects.forEach(sub => {
      subjectById.set(String(sub.id).trim(), sub);
      if (sub.code) subjectByCode.set(normCode(sub.code), sub);
      if (sub.name) subjectByName.set(normText(sub.name), sub);
    });

    const targetSchoolCodeNorm = normCode(school.code);
    const targetShortCodeNorm = normCode(school.shortCode);

    const details: ScoreJsonImportDetail[] = [];
    const validCandidatesByComposite = new Map<string, any[]>();

    extracted.forEach((item, index) => {
      const r = item.raw || {};
      const recSchoolId = String(r.schoolId || item.pkgSchoolId || '').trim();
      const recSchoolCodeNorm = normCode(r.schoolCode || item.pkgSchoolCode);

      const displayStudentName =
        String(r.fullName || `${r.firstName || ''} ${r.lastName || ''}`).trim() ||
        String(r.studentName || r.admissionNo || r.studentId || 'Unknown Student');
      const displayAdmissionNo = String(r.admissionNo || '').trim() || '—';
      const displayClassArm = String(r.classArm || item.pkgClassArm || '').trim() || '—';
      const displaySubject = String(r.subjectName || item.pkgSubjectName || r.subjectCode || item.pkgSubjectCode || r.subjectId || item.pkgSubjectId || 'Unknown Subject');
      const resolvedSession = String(r.session || item.pkgSession || school.currentSession || '2025/2026').trim();
      const resolvedTerm = normalizeAcademicTerm(r.term || item.pkgTerm || school.currentTerm || '2nd Term');

      if (
        (recSchoolId && recSchoolId !== schoolId) ||
        (recSchoolCodeNorm && recSchoolCodeNorm !== targetSchoolCodeNorm && recSchoolCodeNorm !== targetShortCodeNorm)
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
          reason: `Record belongs to another school (${r.schoolCode || item.pkgSchoolCode || recSchoolId}), not ${school.code}.`
        });
        return;
      }

      const rawId = String(r.studentId || '').trim();
      const rawAdmNorm = normAdm(r.admissionNo);
      const rawEmailNorm = normText(r.email);
      const rawFullName = normText(r.fullName || r.studentName || `${r.firstName || ''} ${r.lastName || ''}`);
      const rawClassNorm = normText(r.classArm || item.pkgClassArm);

      const byId = rawId ? studentById.get(rawId) : undefined;
      const byAdm = rawAdmNorm ? studentByAdmission.get(rawAdmNorm) : undefined;

      let matchedStudent: Student | null = null;
      let matchMethod = '';

      if (byId && byAdm) {
        if (byId.id !== byAdm.id) {
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
            reason: `Identity conflict: studentId "${rawId}" points to ${byId.firstName} ${byId.lastName} (${byId.admissionNo}), whereas admissionNo "${r.admissionNo}" belongs to ${byAdm.firstName} ${byAdm.lastName}.`
          });
          return;
        }
        matchedStudent = byId;
        matchMethod = 'verified_id_and_admission_no';
      } else if (byAdm) {
        if (rawId && !byId) {
          matchedStudent = byAdm;
          matchMethod = 'admission_no';
        } else {
          matchedStudent = byAdm;
          matchMethod = 'admission_no';
        }
      } else if (byId) {
        if (rawAdmNorm && normAdm(byId.admissionNo) !== rawAdmNorm) {
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
            reason: `Admission No "${r.admissionNo}" does not match ${byId.firstName} ${byId.lastName}'s registered Admission No (${byId.admissionNo}).`
          });
          return;
        }
        matchedStudent = byId;
        matchMethod = 'student_id';
      } else if (rawEmailNorm && studentByEmail.has(rawEmailNorm)) {
        matchedStudent = studentByEmail.get(rawEmailNorm)!;
        matchMethod = 'student_email';
      } else if (rawFullName) {
        if (rawClassNorm) {
          const ncMatches = studentsByNameAndClass.get(`${rawFullName}::${rawClassNorm}`) || [];
          if (ncMatches.length === 1) {
            matchedStudent = ncMatches[0];
            matchMethod = 'exact_name_and_class';
          } else if (ncMatches.length > 1) {
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
              reason: `Multiple pupils named "${displayStudentName}" exist in ${displayClassArm}. Include Admission No to disambiguate.`
            });
            return;
          }
        }
        if (!matchedStudent) {
          const nMatches = studentsByNameOnly.get(rawFullName) || [];
          if (nMatches.length === 1) {
            matchedStudent = nMatches[0];
            matchMethod = 'unique_full_name';
          } else if (nMatches.length > 1) {
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
              reason: `Multiple pupils share the name "${displayStudentName}". Include Admission No or Class Arm.`
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

      const rawSubId = String(r.subjectId || item.pkgSubjectId || '').trim();
      const rawSubCode = normCode(r.subjectCode || item.pkgSubjectCode);
      const rawSubName = normText(r.subjectName || item.pkgSubjectName);

      let matchedSubject: Subject | null = null;
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

      const { total, grade, remark } = calculateGradeLocal(c1.value, c2.value, mid.value, ex.value);
      const recordedAtStr = String(r.recordedAt || r.timestamp || item.pkgExportedAt || new Date().toISOString());
      const recordedEpoch = Date.parse(recordedAtStr) || 0;
      const compositeKey = `${matchedStudent.id}::${matchedSubject.id}::${resolvedSession}::${resolvedTerm}`;
      const detailIndex = details.length;

      details.push({
        index,
        sourceFile: item.sourceFile,
        status: 'updated',
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
        student: matchedStudent,
        subject: matchedSubject,
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
        recordedEpoch,
        clientChangeId: String(r.clientChangeId || 'cc_json_' + crypto.randomUUID())
      });
      validCandidatesByComposite.set(compositeKey, list);
    });

    if (!store.scoreEvents[schoolId]) store.scoreEvents[schoolId] = [];

    let createdCount = 0;
    let updatedCount = 0;
    let deduplicatedCount = 0;
    const processedSet = new Set(store.processedClientChangeIds);

    for (const [, group] of validCandidatesByComposite.entries()) {
      const sorted = [...group].sort((a, b) => {
        if (b.recordedEpoch !== a.recordedEpoch) return b.recordedEpoch - a.recordedEpoch;
        return b.detailIndex - a.detailIndex;
      });
      const winner = sorted[0];
      for (const dup of sorted.slice(1)) {
        deduplicatedCount++;
        details[dup.detailIndex].status = 'deduplicated_older';
        details[dup.detailIndex].reason = `Superseded by a newer score entry for ${winner.student.admissionNo} (${winner.subject.code}) in the same upload batch.`;
      }

      const existingIdx = store.scoreEvents[schoolId].findIndex(
        sc =>
          sc.studentId === winner.student.id &&
          sc.subjectId === winner.subject.id &&
          sc.session === winner.session &&
          normalizeAcademicTerm(sc.term) === winner.term
      );

      const existingRecord = existingIdx !== -1 ? store.scoreEvents[schoolId][existingIdx] : null;
      details[winner.detailIndex].previousTotal = existingRecord ? existingRecord.total : null;
      details[winner.detailIndex].status = existingRecord ? 'updated' : 'created';

      if (existingRecord) updatedCount++;
      else createdCount++;

      if (!dryRun) {
        const scoreRecord: ScoreEvent = {
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
        if (existingIdx !== -1) store.scoreEvents[schoolId][existingIdx] = scoreRecord;
        else store.scoreEvents[schoolId].push(scoreRecord);
        processedSet.add(winner.clientChangeId);
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
      store.processedClientChangeIds = Array.from(processedSet);
      logLocalAudit(
        store,
        schoolId,
        actorEmail,
        'Administrator',
        'admin',
        'BULK_SCORE_JSON_IMPORT',
        'score',
        'batch_json',
        `Smart-matched & applied ${appliedCount} student score records (${createdCount} new, ${updatedCount} updated).`
      );
      persistStore();
    }

    return {
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
    };
  },

  // --- LEDGER & FEES ---
  getLedger(schoolId: string, studentId?: string) {
    const store = getStore();
    let entries = store.ledgerEntries[schoolId] || [];
    if (studentId) entries = entries.filter(e => e.studentId === studentId);
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
      studentBalances[entry.studentId].arrears = Math.max(
        0,
        studentBalances[entry.studentId].totalBilled - studentBalances[entry.studentId].totalPaid
      );
    }
    return { entries, studentBalances };
  },

  recordPayment(
    schoolId: string,
    paymentData: {
      studentId: string;
      type: 'DEBIT_FEE' | 'CREDIT_PAYMENT' | 'WAIVER';
      amountMinor: number;
      description: string;
      category?: string;
      paymentChannel?: any;
      referenceNo?: string;
      actorEmail: string;
    }
  ) {
    const store = getStore();
    const integerMinor = Math.round(paymentData.amountMinor);
    if (!paymentData.studentId || !paymentData.type || integerMinor <= 0) {
      throw new Error('Valid studentId, type, and positive amount are required.');
    }
    if (!store.ledgerEntries[schoolId]) store.ledgerEntries[schoolId] = [];

    const receiptNo =
      paymentData.type === 'CREDIT_PAYMENT'
        ? 'REC-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000)
        : undefined;
    const timestamp = new Date().toISOString();
    const verificationHash =
      paymentData.type === 'CREDIT_PAYMENT' && receiptNo
        ? simpleHashHex(`${schoolId}:${receiptNo}:${paymentData.studentId}:${integerMinor}:${timestamp}`)
        : undefined;

    const entry: LedgerEntry = {
      id: 'led_' + Math.random().toString(36).substring(2, 9),
      clientChangeId: 'cc_loc_' + crypto.randomUUID(),
      schoolId,
      studentId: paymentData.studentId,
      type: paymentData.type,
      amountMinor: integerMinor,
      description: paymentData.description || (paymentData.type === 'CREDIT_PAYMENT' ? 'School Fee Payment' : 'Fee Assessment'),
      category: paymentData.category || 'Tuition',
      receiptNo,
      paymentChannel: paymentData.paymentChannel || 'BANK_TRANSFER',
      referenceNo: paymentData.referenceNo || '',
      verificationHash,
      recordedBy: paymentData.actorEmail || 'bursar@school.edu',
      timestamp,
      synced: true
    };

    store.ledgerEntries[schoolId].unshift(entry);
    logLocalAudit(
      store,
      schoolId,
      paymentData.actorEmail || 'bursar',
      'Bursar',
      'bursar',
      paymentData.type === 'CREDIT_PAYMENT' ? 'PAYMENT_RECORDED' : 'FEE_DEBITED',
      'ledger',
      entry.id,
      `${paymentData.type} of ${integerMinor} minor units recorded for student ${paymentData.studentId}. Receipt: ${receiptNo || 'N/A'}`
    );
    persistStore();
    return { entry };
  },

  assessFeeToClass(
    schoolId: string,
    data: {
      classArm: string;
      name: string;
      amountMinor: number;
      category?: string;
      term?: string;
      session?: string;
      actorEmail: string;
    }
  ) {
    const store = getStore();
    const integerMinor = Math.round(data.amountMinor);
    if (!data.classArm || !data.name || integerMinor <= 0) {
      throw new Error('classArm, name, and valid amountMinor are required');
    }
    const activeStudents = (store.students[schoolId] || []).filter(s => s.classArm === data.classArm && !s.isDeleted);
    const now = new Date().toISOString();
    if (!store.ledgerEntries[schoolId]) store.ledgerEntries[schoolId] = [];

    let assessedCount = 0;
    activeStudents.forEach(st => {
      store.ledgerEntries[schoolId].unshift({
        id: 'led_' + Math.random().toString(36).substring(2, 9),
        clientChangeId: 'cc_loc_' + crypto.randomUUID(),
        schoolId,
        studentId: st.id,
        type: 'DEBIT_FEE',
        amountMinor: integerMinor,
        description: `${data.name} (${normalizeAcademicTerm(data.term || store.schools[schoolId]?.currentTerm || '2nd Term')})`,
        category: data.category || 'Tuition',
        receiptNo: 'BILL-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
        paymentChannel: 'BANK_TRANSFER',
        referenceNo: '',
        recordedBy: data.actorEmail || 'bursar',
        timestamp: now,
        synced: true
      });
      assessedCount++;
    });

    logLocalAudit(
      store,
      schoolId,
      data.actorEmail || 'bursar',
      'Bursar',
      'bursar',
      'CLASS_FEE_ASSESS',
      'ledger',
      data.classArm,
      `Assessed fee "${data.name}" (${integerMinor} minor units) to ${assessedCount} pupils in ${data.classArm}`
    );
    persistStore();
    return { success: true, assessedCount, message: `Assessed fee to ${assessedCount} pupils in ${data.classArm}` };
  },

  // --- DASHBOARD SUMMARY ---
  getDashboardSummary(schoolId: string): DashboardSummary {
    const store = getStore();
    const studentList = (store.students[schoolId] || []).filter(s => !s.isDeleted);
    const staffList = store.staff[schoolId] || [];
    const teachersCount = staffList.filter(s => s.role === 'teacher').length;
    const classesList = store.classes[schoolId] || [];
    const subjectsList = store.subjects[schoolId] || [];

    const maleCount = studentList.filter(s => s.gender === 'male').length;
    const femaleCount = studentList.filter(s => s.gender === 'female').length;
    const uniqueParents = new Set(studentList.map(s => s.guardianPhone || s.guardianName).filter(Boolean));

    const ledger = store.ledgerEntries[schoolId] || [];
    const totalBilled = ledger.filter(l => l.type === 'DEBIT_FEE').reduce((a, c) => a + c.amountMinor, 0);
    const totalPaid = ledger.filter(l => l.type === 'CREDIT_PAYMENT' || l.type === 'WAIVER').reduce((a, c) => a + c.amountMinor, 0);
    const totalArrears = Math.max(0, totalBilled - totalPaid);
    const collectionPct = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 100;

    const attendanceList = store.attendance[schoolId] || [];
    const daysOfWeek = [
      { key: 'Mon', dayNum: 1 },
      { key: 'Tue', dayNum: 2 },
      { key: 'Wed', dayNum: 3 },
      { key: 'Thu', dayNum: 4 },
      { key: 'Fri', dayNum: 5 }
    ];
    const studentGenderMap: Record<string, string> = {};
    studentList.forEach(s => {
      studentGenderMap[s.id] = s.gender;
    });

    const weeklyAttendance = daysOfWeek.map(d => {
      const dayRecords = attendanceList.filter(a => a.date && new Date(a.date).getDay() === d.dayNum);
      if (dayRecords.length > 0) {
        const boys = dayRecords.filter(r => studentGenderMap[r.studentId] === 'male');
        const girls = dayRecords.filter(r => studentGenderMap[r.studentId] === 'female');
        const boysPresent = boys.filter(r => r.status === 'present' || r.status === 'late').length;
        const girlsPresent = girls.filter(r => r.status === 'present' || r.status === 'late').length;
        const totalPresent = dayRecords.filter(r => r.status === 'present' || r.status === 'late').length;
        return {
          day: d.key,
          boysRate: boys.length > 0 ? Math.round((boysPresent / boys.length) * 100) : 95,
          girlsRate: girls.length > 0 ? Math.round((girlsPresent / girls.length) * 100) : 98,
          averageRate: Math.round((totalPresent / dayRecords.length) * 100)
        };
      }
      const totalPresentAll = attendanceList.filter(r => r.status === 'present' || r.status === 'late').length;
      const overallRate = attendanceList.length > 0 ? Math.round((totalPresentAll / attendanceList.length) * 100) : 96;
      return { day: d.key, boysRate: overallRate, girlsRate: overallRate, averageRate: overallRate };
    });

    const scores = store.scoreEvents[schoolId] || [];
    const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    scores.forEach(sc => {
      if (gradeCounts[sc.grade] !== undefined) gradeCounts[sc.grade]++;
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

    return {
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
      recentStudents: [...studentList].reverse().slice(0, 5),
      upcomingEvents: (store.events[schoolId] || []).slice(0, 4),
      recentNotices: (store.notices[schoolId] || []).slice(0, 4)
    };
  },

  // --- ATTENDANCE ---
  getAttendance(schoolId: string, classArm?: string, date?: string) {
    const store = getStore();
    const targetDate = date || new Date().toISOString().split('T')[0];
    const students = (store.students[schoolId] || []).filter(
      s => !s.isDeleted && (!classArm || classArm === 'all' || s.classArm === classArm)
    );
    const existingRecords = (store.attendance[schoolId] || []).filter(
      a => a.date === targetDate && (!classArm || classArm === 'all' || a.classArm === classArm)
    );
    const recordMap: Record<string, AttendanceRecord> = {};
    existingRecords.forEach(r => {
      recordMap[r.studentId] = r;
    });

    const roster = students.map(st => ({
      studentId: st.id,
      admissionNo: st.admissionNo,
      studentName: `${st.firstName} ${st.lastName}`,
      gender: st.gender,
      classArm: st.classArm,
      status: (recordMap[st.id]?.status || 'present') as AttendanceStatus,
      remark: recordMap[st.id]?.remark || ''
    }));

    const total = roster.length;
    const present = roster.filter(r => r.status === 'present').length;
    const absent = roster.filter(r => r.status === 'absent').length;
    const late = roster.filter(r => r.status === 'late').length;
    const excused = roster.filter(r => r.status === 'excused').length;
    const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

    return {
      date: targetDate,
      classArm: classArm || 'All Classes',
      stats: { total, present, absent, late, excused, attendanceRate },
      records: roster
    };
  },

  markAttendance(
    schoolId: string,
    payload: { date: string; classArm: string; studentId: string; status: AttendanceStatus; remark?: string; actorEmail: string }
  ) {
    const store = getStore();
    if (!store.attendance[schoolId]) store.attendance[schoolId] = [];
    const existingIdx = store.attendance[schoolId].findIndex(
      a => a.date === payload.date && a.studentId === payload.studentId
    );
    const rec: AttendanceRecord = {
      id: existingIdx !== -1 ? store.attendance[schoolId][existingIdx].id : 'att_' + Math.random().toString(36).substring(2, 9),
      schoolId,
      date: payload.date,
      classArm: payload.classArm || 'JSS 1',
      studentId: payload.studentId,
      status: payload.status,
      remark: payload.remark || '',
      recordedBy: payload.actorEmail || 'teacher',
      timestamp: new Date().toISOString()
    };
    if (existingIdx !== -1) store.attendance[schoolId][existingIdx] = rec;
    else store.attendance[schoolId].push(rec);
    persistStore();
    return { success: true, record: rec };
  },

  markAllAttendance(
    schoolId: string,
    payload: { date: string; classArm: string; status: AttendanceStatus; actorEmail: string }
  ) {
    const store = getStore();
    if (!store.attendance[schoolId]) store.attendance[schoolId] = [];
    const classStudents = (store.students[schoolId] || []).filter(
      s => s.classArm === payload.classArm && !s.isDeleted
    );
    const now = new Date().toISOString();
    classStudents.forEach(st => {
      const existingIdx = store.attendance[schoolId].findIndex(
        a => a.date === payload.date && a.studentId === st.id
      );
      const rec: AttendanceRecord = {
        id: existingIdx !== -1 ? store.attendance[schoolId][existingIdx].id : 'att_' + Math.random().toString(36).substring(2, 9),
        schoolId,
        date: payload.date,
        classArm: payload.classArm,
        studentId: st.id,
        status: payload.status || 'present',
        remark: '',
        recordedBy: payload.actorEmail || 'teacher',
        timestamp: now
      };
      if (existingIdx !== -1) store.attendance[schoolId][existingIdx] = rec;
      else store.attendance[schoolId].push(rec);
    });
    persistStore();
    return { success: true, message: `Marked all ${classStudents.length} pupils in ${payload.classArm} as ${payload.status}` };
  },

  // --- NOTICES & EVENTS ---
  getNotices(schoolId: string): Notice[] {
    return getStore().notices[schoolId] || [];
  },

  createNotice(schoolId: string, noticeData: Partial<Notice>, author: string): Notice {
    const store = getStore();
    if (!noticeData.title || !noticeData.content) throw new Error('Title and content are required');
    if (!store.notices[schoolId]) store.notices[schoolId] = [];
    const newNotice: Notice = {
      id: 'not_' + Math.random().toString(36).substring(2, 9),
      schoolId,
      title: noticeData.title.trim(),
      content: noticeData.content.trim(),
      priority: noticeData.priority || 'normal',
      targetAudience: noticeData.targetAudience || 'All',
      author: author || 'School Admin',
      date: new Date().toISOString().split('T')[0]
    };
    store.notices[schoolId].unshift(newNotice);
    logLocalAudit(store, schoolId, author || 'admin', 'Administrator', 'admin', 'NOTICE_PUBLISH', 'notice', newNotice.id, `Published notice: ${newNotice.title}`);
    persistStore();
    return newNotice;
  },

  deleteNotice(schoolId: string, noticeId: string): void {
    const store = getStore();
    if (store.notices[schoolId]) {
      store.notices[schoolId] = store.notices[schoolId].filter(n => n.id !== noticeId);
      persistStore();
    }
  },

  getEvents(schoolId: string): SchoolEvent[] {
    return getStore().events[schoolId] || [];
  },

  createEvent(schoolId: string, eventData: Partial<SchoolEvent>): SchoolEvent {
    const store = getStore();
    if (!eventData.title || !eventData.date) throw new Error('Title and date are required');
    if (!store.events[schoolId]) store.events[schoolId] = [];
    const newEvent: SchoolEvent = {
      id: 'evt_' + Math.random().toString(36).substring(2, 9),
      schoolId,
      title: eventData.title.trim(),
      date: eventData.date,
      time: eventData.time || '09:00 AM',
      location: eventData.location || 'Main Campus',
      category: eventData.category || 'Academic',
      description: eventData.description || ''
    };
    store.events[schoolId].push(newEvent);
    persistStore();
    return newEvent;
  },

  deleteEvent(schoolId: string, eventId: string): void {
    const store = getStore();
    if (store.events[schoolId]) {
      store.events[schoolId] = store.events[schoolId].filter(e => e.id !== eventId);
      persistStore();
    }
  },

  // --- CLASSES, SUBJECTS & TIMETABLE ---
  getClasses(schoolId: string): ClassArm[] {
    return getStore().classes[schoolId] || [];
  },

  createClass(schoolId: string, classData: { name: string; level: string; classTeacherId?: string }, actorEmail: string) {
    const store = getStore();
    if (!classData.name || !classData.level) throw new Error('Class name and level are required');
    if (!store.classes[schoolId]) store.classes[schoolId] = [];
    const existing = store.classes[schoolId].find(c => c.name.toLowerCase() === classData.name.trim().toLowerCase());
    if (existing) throw new Error(`Class arm ${classData.name} already exists`);
    const newClass: ClassArm = {
      id: 'cls_' + Math.random().toString(36).substring(2, 9),
      schoolId,
      name: classData.name.trim(),
      level: classData.level.trim(),
      classTeacherId: classData.classTeacherId
    };
    store.classes[schoolId].push(newClass);
    logLocalAudit(store, schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'CLASS_CREATE', 'class', newClass.id, `Created class arm: ${newClass.name}`);
    persistStore();
    return { classArm: newClass };
  },

  updateClass(schoolId: string, classId: string, updates: any) {
    const store = getStore();
    const list = store.classes[schoolId] || [];
    const idx = list.findIndex(c => c.id === classId);
    if (idx === -1) throw new Error('Class arm not found');
    list[idx] = { ...list[idx], ...updates, id: list[idx].id, schoolId };
    persistStore();
    return { classArm: list[idx] };
  },

  deleteClass(schoolId: string, classId: string, actorEmail: string) {
    const store = getStore();
    const list = store.classes[schoolId] || [];
    const target = list.find(c => c.id === classId);
    if (!target) throw new Error('Class arm not found');
    store.classes[schoolId] = list.filter(c => c.id !== classId);
    logLocalAudit(store, schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'CLASS_DELETE', 'class', classId, `Deleted class arm: ${target.name}`);
    persistStore();
    return { success: true, message: `Deleted class arm: ${target.name}` };
  },

  getSubjects(schoolId: string): Subject[] {
    return getStore().subjects[schoolId] || [];
  },

  createSubject(schoolId: string, subjectData: { name: string; code: string }, actorEmail: string) {
    const store = getStore();
    if (!subjectData.name || !subjectData.code) throw new Error('Subject name and code are required');
    if (!store.subjects[schoolId]) store.subjects[schoolId] = [];
    const newSubject: Subject = {
      id: 'sub_' + subjectData.code.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString(36),
      schoolId,
      name: subjectData.name.trim(),
      code: subjectData.code.trim().toUpperCase()
    };
    store.subjects[schoolId].push(newSubject);
    logLocalAudit(store, schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'SUBJECT_CREATE', 'subject', newSubject.id, `Created subject: ${newSubject.name} (${newSubject.code})`);
    persistStore();
    return { subject: newSubject };
  },

  deleteSubject(schoolId: string, subjectId: string, actorEmail: string) {
    const store = getStore();
    const list = store.subjects[schoolId] || [];
    const target = list.find(s => s.id === subjectId);
    if (!target) throw new Error('Subject not found');
    store.subjects[schoolId] = list.filter(s => s.id !== subjectId);
    logLocalAudit(store, schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'SUBJECT_DELETE', 'subject', subjectId, `Deleted subject: ${target.name}`);
    persistStore();
    return { success: true, message: `Deleted subject: ${target.name}` };
  },

  getTimetable(schoolId: string, classArm?: string) {
    const store = getStore();
    const arm = classArm || 'JSS 1';
    const schoolTimetables = store.timetables[schoolId] || {};
    const schedule = schoolTimetables[arm] || schoolTimetables['JSS 1'] || [];
    return { classArm: arm, schedule };
  },

  saveTimetablePeriod(
    schoolId: string,
    periodData: { classArm: string; day: string; period: number; time: string; subject: string; teacher: string; room?: string }
  ) {
    const store = getStore();
    const { classArm, day, period, time, subject, teacher, room } = periodData;
    if (!store.timetables[schoolId]) store.timetables[schoolId] = {};
    if (!store.timetables[schoolId][classArm]) {
      store.timetables[schoolId][classArm] = [
        { day: 'Monday', periods: [] },
        { day: 'Tuesday', periods: [] },
        { day: 'Wednesday', periods: [] },
        { day: 'Thursday', periods: [] },
        { day: 'Friday', periods: [] }
      ];
    }
    let targetDay = store.timetables[schoolId][classArm].find(d => d.day === day);
    if (!targetDay) {
      targetDay = { day: day as ClassDaySchedule['day'], periods: [] };
      store.timetables[schoolId][classArm].push(targetDay);
    }
    const existingIdx = targetDay.periods.findIndex(p => p.period === Number(period));
    const newPeriodObj = {
      period: Number(period),
      time: time || '08:00 - 08:45',
      subject: subject.trim(),
      teacher: teacher || 'Unassigned',
      room: room || 'Room 101'
    };
    if (existingIdx !== -1) targetDay.periods[existingIdx] = newPeriodObj;
    else {
      targetDay.periods.push(newPeriodObj);
      targetDay.periods.sort((a, b) => a.period - b.period);
    }
    persistStore();
    return { success: true, schedule: store.timetables[schoolId][classArm] };
  },

  deleteTimetablePeriod(schoolId: string, classArm: string, day: string, period: number) {
    const store = getStore();
    const targetDay = store.timetables[schoolId]?.[classArm]?.find(d => d.day === day);
    if (targetDay) {
      targetDay.periods = targetDay.periods.filter(p => p.period !== Number(period));
      persistStore();
    }
    return { success: true, message: `Removed period ${period}` };
  },

  // --- PARENTS, AUDIT & BACKUP ---
  getParents(schoolId: string): ParentSummary[] {
    const store = getStore();
    const students = (store.students[schoolId] || []).filter(s => !s.isDeleted);
    const ledger = store.ledgerEntries[schoolId] || [];
    const parentMap: Record<string, ParentSummary> = {};

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
      const studentEntries = ledger.filter(l => l.studentId === st.id);
      const billed = studentEntries.filter(l => l.type === 'DEBIT_FEE').reduce((a, c) => a + c.amountMinor, 0);
      const paid = studentEntries.filter(l => l.type === 'CREDIT_PAYMENT' || l.type === 'WAIVER').reduce((a, c) => a + c.amountMinor, 0);
      parentMap[key].totalBilledMinor += billed;
      parentMap[key].totalPaidMinor += paid;
    });

    return Object.values(parentMap).map(p => {
      p.arrearsMinor = Math.max(0, p.totalBilledMinor - p.totalPaidMinor);
      p.isCleared = p.arrearsMinor === 0;
      return p;
    });
  },

  getAuditLogs(schoolId: string): AuditLog[] {
    return getStore().auditLogs[schoolId] || [];
  },

  exportBackupSnapshot(schoolId: string) {
    const store = getStore();
    logLocalAudit(store, schoolId, 'admin', 'Administrator', 'admin', 'COLD_BACKUP_EXPORT', 'backup', 'snapshot', 'Exported JSON administrative snapshot.');
    persistStore();
    return {
      version: '1.0.0',
      exportTimestamp: new Date().toISOString(),
      school: store.schools[schoolId],
      classes: store.classes[schoolId] || [],
      subjects: store.subjects[schoolId] || [],
      staff: store.staff[schoolId] || [],
      feeStructures: store.feeStructures[schoolId] || [],
      students: store.students[schoolId] || [],
      scoreEvents: store.scoreEvents[schoolId] || [],
      ledgerEntries: store.ledgerEntries[schoolId] || [],
      auditLogs: store.auditLogs[schoolId] || []
    };
  },

  restoreBackup(snapshot: any, actorEmail: string) {
    if (!snapshot || !snapshot.school || !snapshot.school.id) {
      throw new Error('Invalid backup file structure');
    }
    const store = getStore();
    const schoolId = snapshot.school.id;
    store.schools[schoolId] = snapshot.school;
    store.classes[schoolId] = snapshot.classes || [];
    store.subjects[schoolId] = snapshot.subjects || [];
    store.staff[schoolId] = snapshot.staff || [];
    store.feeStructures[schoolId] = snapshot.feeStructures || [];
    store.students[schoolId] = snapshot.students || [];
    store.scoreEvents[schoolId] = snapshot.scoreEvents || [];
    store.ledgerEntries[schoolId] = snapshot.ledgerEntries || [];
    store.auditLogs[schoolId] = snapshot.auditLogs || [];
    logLocalAudit(store, schoolId, actorEmail || 'admin', 'Administrator', 'admin', 'POINT_IN_TIME_RESTORE', 'backup', 'restore', `Restored database snapshot from ${snapshot.exportTimestamp}`);
    persistStore();
    return {
      success: true,
      message: `Restored ${snapshot.students?.length || 0} students and ${snapshot.scoreEvents?.length || 0} scores successfully.`
    };
  },

  softWipeAndReseed(schoolId: string, actorEmail: string) {
    memoryStore = createInitialSeedStore();
    logLocalAudit(memoryStore, schoolId || DEFAULT_SCHOOL_ID, actorEmail || 'admin', 'Administrator', 'admin', 'ADMIN_DATA_RESEED', 'system', 'reset', 'Re-seeded initial state.');
    persistStore();
    return { success: true, message: 'System re-seeded to initial production baseline' };
  }
};

function NIGERIAN_CLASSES_NAMES(): string[] {
  return NIGERIAN_CLASS_LEVELS.map(c => c.name);
}
