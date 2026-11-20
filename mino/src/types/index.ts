/**
 * MINO-SMS Core Type Definitions
 * Strict types for multi-tenancy, independent portals, gradebook, and financial ledger.
 */

export type UserRole = 'super_admin' | 'admin' | 'head_teacher' | 'teacher' | 'bursar' | 'parent' | 'student';
export type LoginRole = 'student' | 'teacher' | 'admin' | 'guardian';

export interface StaffUser {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  role: UserRole;
  isHeadTeacher?: boolean;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  phone?: string;
  passcode?: string;
  createdAt?: string;
}

export const ACADEMIC_TERMS = ['1st Term', '2nd Term', '3rd Term'] as const;
export type AcademicTerm = (typeof ACADEMIC_TERMS)[number];

export function normalizeAcademicTerm(raw?: string | null): AcademicTerm {
  const val = String(raw || '').trim().toLowerCase();
  if (val.includes('1st') || val.includes('first') || val === 'term 1' || val === '1') {
    return '1st Term';
  }
  if (val.includes('3rd') || val.includes('third') || val === 'term 3' || val === '3') {
    return '3rd Term';
  }
  return '2nd Term';
}

export const DEFAULT_SCHOOL_FALLBACK_LOGO = '/assets/aistudio/logo_234aadf4.png';

export function getSchoolLogoUrl(school?: { logoUrl?: string | null } | null): string {
  const custom = school?.logoUrl?.trim();
  return custom ? custom : DEFAULT_SCHOOL_FALLBACK_LOGO;
}

export interface SchoolTenant {
  id: string;
  name: string;
  code: string; // Overall unique School ID / Sign-In Code (e.g. "OMA-1001")
  shortCode?: string; // Acronym prefix (e.g. "OMA")
  logoUrl?: string; // Custom per-school logo (Data URL or HTTPS URL)
  currency: string;
  currencySymbol: string;
  address: string;
  phone: string;
  currentSession: string; // e.g. "2025/2026"
  currentTerm: AcademicTerm;
  isReportsLocked: boolean;
  subscriptionPlan?: 'Basic' | 'Standard' | 'Professional' | 'Enterprise';
  subscriptionStatus?: 'pending' | 'active' | 'trial' | 'suspended';
  adminEmail?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface PlatformSchoolStats extends SchoolTenant {
  studentCount: number;
  staffCount: number;
  totalRevenueMinor: number;
  lastActive: string;
  status?: 'pending' | 'active' | 'suspended';
}

export interface PlatformAnalytics {
  totalSchools: number;
  activeSchools: number;
  pendingSchools?: number;
  totalStudents: number;
  totalStaff: number;
  totalPlatformRevenueMinor: number;
  schools: PlatformSchoolStats[];
}

export const NIGERIAN_CLASS_LEVELS = [
  { name: 'Primary 1', level: 'Primary' },
  { name: 'Primary 2', level: 'Primary' },
  { name: 'Primary 3', level: 'Primary' },
  { name: 'Primary 4', level: 'Primary' },
  { name: 'Primary 5', level: 'Primary' },
  { name: 'Primary 6', level: 'Primary' },
  { name: 'JSS 1', level: 'Junior Secondary' },
  { name: 'JSS 2', level: 'Junior Secondary' },
  { name: 'JSS 3', level: 'Junior Secondary' },
  { name: 'SSS 1', level: 'Senior Secondary' },
  { name: 'SSS 2', level: 'Senior Secondary' },
  { name: 'SSS 3', level: 'Senior Secondary' }
] as const;

export interface ClassArm {
  id: string;
  schoolId: string;
  name: string; // e.g. "Primary 1"-"Primary 6", "JSS 1"-"JSS 3", "SSS 1"-"SSS 3"
  level: string; // "Primary" | "Junior Secondary" | "Senior Secondary"
  classTeacherId?: string;
  studentCount?: number;
}

export interface Subject {
  id: string;
  schoolId: string;
  name: string; // e.g. "Mathematics", "English Language", "Basic Science"
  code: string;
}

export interface Student {
  id: string;
  schoolId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  email?: string;
  studentPassword?: string;
  gender: 'male' | 'female' | 'other';
  classArm: string; // classArm id or name
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianPassword?: string;
  accessToken: string; // 128-bit or secure token for parent portal lookup
  accessPin: string; // 6-digit access PIN for guardian portal
  studentPin: string; // Passcode for direct student login
  status: 'active' | 'suspended' | 'graduated' | 'withdrawn';
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScoreEvent {
  id: string;
  clientChangeId: string; // UUID for idempotency
  schoolId: string;
  studentId: string;
  subjectId: string;
  session: string;
  term: string;
  ca1: number; // 0 - 15
  ca2: number; // 0 - 15
  midterm: number; // 0 - 20
  exam: number; // 0 - 50
  total: number; // 0 - 100
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  remark: string;
  recordedBy: string;
  deviceId: string;
  timestamp: string;
  synced: boolean;
}

export interface TeacherScoreExportRecord {
  recordKey: string;
  schoolId: string;
  schoolCode: string;
  schoolName: string;
  studentId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender?: string;
  email?: string;
  classArm: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  session: string;
  term: AcademicTerm;
  ca1: number;
  ca2: number;
  midterm: number;
  exam: number;
  total: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  remark: string;
  recordedBy: string;
  recordedAt: string;
  clientChangeId?: string;
}

export interface TeacherScoreExportPackage {
  schemaVersion: 'MINO_SCORE_PACKAGE_V1';
  packageId: string;
  exportedAt: string;
  exportedBy: string;
  deviceId: string;
  school: {
    schoolId: string;
    schoolCode: string;
    schoolName: string;
  };
  context: {
    session: string;
    term: string;
    classArm?: string;
    subjectId?: string;
    subjectCode?: string;
    subjectName?: string;
    scope: 'single_sheet' | 'multi_sheet';
  };
  recordCount: number;
  integrityFingerprint: string;
  records: TeacherScoreExportRecord[];
}

export type ScoreImportRecordStatus =
  | 'updated'
  | 'created'
  | 'deduplicated_older'
  | 'identity_conflict'
  | 'school_mismatch'
  | 'ambiguous_student'
  | 'unmatched_student'
  | 'unmatched_subject'
  | 'invalid_score';

export interface ScoreJsonImportDetail {
  index: number;
  sourceFile: string;
  status: ScoreImportRecordStatus;
  matchMethod?: string;
  studentId?: string;
  studentName: string;
  admissionNo: string;
  classArm: string;
  subjectId?: string;
  subjectName: string;
  subjectCode?: string;
  session: string;
  term: string;
  ca1: number;
  ca2: number;
  midterm: number;
  exam: number;
  total: number;
  grade: string;
  previousTotal?: number | null;
  reason?: string;
}

export interface ScoreJsonImportResponse {
  success: boolean;
  dryRun: boolean;
  totalReceived: number;
  appliedCount: number;
  createdCount: number;
  updatedCount: number;
  deduplicatedCount: number;
  conflictCount: number;
  unmatchedCount: number;
  invalidCount: number;
  details: ScoreJsonImportDetail[];
}

export type PaymentChannel = 'CASH' | 'BANK_TRANSFER' | 'POS' | 'ONLINE';

export interface LedgerEntry {
  id: string;
  clientChangeId: string; // UUID for idempotency
  schoolId: string;
  studentId: string;
  type: 'DEBIT_FEE' | 'CREDIT_PAYMENT' | 'WAIVER';
  amountMinor: number; // Stored in integer kobo/cents. E.g., 5000000 = 50,000.00
  description: string;
  category?: string; // "Tuition", "Uniform", "Books", "PTA", "Development"
  receiptNo?: string;
  paymentChannel?: PaymentChannel;
  referenceNo?: string;
  verificationHash?: string; // SHA-256 HMAC for tamper-evident offline receipts
  recordedBy: string;
  timestamp: string;
  synced: boolean;
}

export interface FeeStructure {
  id: string;
  schoolId: string;
  classArm: string;
  name: string;
  amountMinor: number;
  term: string;
  session: string;
}

export interface OutboxItem {
  id?: number;
  clientChangeId: string;
  schoolId: string;
  entity: 'student' | 'score' | 'ledger';
  action: 'create' | 'update' | 'delete';
  deviceId: string;
  payloadCipher: string; // AES-GCM encrypted payload
  iv: string;
  timestamp: string;
  syncAttempts: number;
  status: 'pending' | 'in_flight' | 'synced' | 'failed';
  lastError?: string;
}

export interface AuditLog {
  id: string;
  schoolId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

export interface VaultMeta {
  isConfigured: boolean;
  saltHex: string;
  canaryCipherHex: string;
  canaryIvHex: string;
  lastUnlockedAt?: string;
}

export interface HistoricalTermReport {
  session: string;
  term: string;
  averageScore: number;
  attendance: string;
  scores: {
    subjectName: string;
    ca1: number;
    ca2: number;
    midterm: number;
    exam: number;
    total: number;
    grade: string;
    remark: string;
  }[];
  totalBilledMinor: number;
  totalPaidMinor: number;
  arrearsMinor: number;
}

export type NoticePriority = 'urgent' | 'normal' | 'info';
export type NoticeAudience = 'All' | 'Teachers' | 'Parents' | 'Students';

export interface Notice {
  id: string;
  schoolId: string;
  title: string;
  content: string;
  priority: NoticePriority;
  targetAudience: NoticeAudience;
  author: string;
  date: string;
}

export interface SchoolEvent {
  id: string;
  schoolId: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: 'Academic' | 'Exam' | 'Sports' | 'Meeting' | 'Holiday';
  description?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  schoolId: string;
  date: string; // YYYY-MM-DD
  classArm: string;
  studentId: string;
  status: AttendanceStatus;
  remark?: string;
  recordedBy: string;
  timestamp: string;
}

export interface TimetablePeriod {
  period: number;
  time: string;
  subject: string;
  teacher: string;
  room?: string;
}

export interface ClassDaySchedule {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  periods: TimetablePeriod[];
}

export interface ParentSummary {
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianPassword?: string;
  accessPin: string;
  students: {
    id: string;
    name: string;
    admissionNo: string;
    classArm: string;
    status: string;
  }[];
  totalBilledMinor: number;
  totalPaidMinor: number;
  arrearsMinor: number;
  isCleared: boolean;
}

export interface DashboardSummary {
  totalStudents: number;
  maleStudentsCount: number;
  femaleStudentsCount: number;
  totalTeachers: number;
  totalParents: number;
  totalClasses: number;
  totalSubjects: number;
  financial: {
    totalBilledMinor: number;
    totalPaidMinor: number;
    totalArrearsMinor: number;
    collectionPercentage: number;
  };
  weeklyAttendance: {
    day: string;
    boysRate: number;
    girlsRate: number;
    averageRate: number;
  }[];
  gradeDistribution: {
    grade: string;
    label: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  recentStudents: Student[];
  upcomingEvents: SchoolEvent[];
  recentNotices: Notice[];
  terminalAverage: number;
  passRate: number;
}

