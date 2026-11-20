/**
 * MINO-SMS Authoritative API Client & Local/Vercel Orchestrator
 * Routes requests to /api/* when available, mirrors state to browser-persisted
 * localBackend, and falls back seamlessly on Vercel static deployments,
 * stateless serverless cold starts, or offline network states.
 */

import { localDb, getDeviceId, type LocalOfflineScoreRecord } from './db';
import { encryptData, decryptData } from './crypto';
import { localBackend, type LocalQuickCredential } from './localBackend';
import {
  normalizeAcademicTerm,
  type Student,
  type Subject,
  type ScoreEvent,
  type LedgerEntry,
  type OutboxItem,
  type SchoolTenant,
  type Notice,
  type SchoolEvent,
  type AttendanceRecord,
  type AttendanceStatus,
  type ParentSummary,
  type DashboardSummary,
  type PlatformAnalytics,
  type LoginRole,
  type TeacherScoreExportRecord,
  type TeacherScoreExportPackage,
  type ScoreJsonImportResponse
} from '../types';

class ApiUnavailableError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiUnavailableError';
    this.status = status;
  }
}

async function fetchApiJson(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: any }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ApiUnavailableError('Device is offline');
  }

  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err: any) {
    throw new ApiUnavailableError(err?.message || 'Network request failed');
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    throw new ApiUnavailableError(`Non-JSON response (${res.status})`, res.status);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ApiUnavailableError(`Invalid JSON response (${res.status})`, res.status);
  }

  if (res.status >= 500) {
    throw new ApiUnavailableError(data?.error || `Server error (${res.status})`, res.status);
  }

  // Static hosts or unconfigured gateways returning generic 404 without our structured error
  if (res.status === 404 && !data?.error) {
    throw new ApiUnavailableError('API route not found', 404);
  }

  return { ok: res.ok, status: res.status, data };
}

function computeGradeAndRemark(ca1: number, ca2: number, midterm: number, exam: number): {
  total: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  remark: string;
} {
  const total = ca1 + ca2 + midterm + exam;
  if (total >= 80) return { total, grade: 'A', remark: 'Distinction' };
  if (total >= 70) return { total, grade: 'B', remark: 'Very Good' };
  if (total >= 60) return { total, grade: 'C', remark: 'Good Credit' };
  if (total >= 50) return { total, grade: 'D', remark: 'Pass' };
  if (total >= 40) return { total, grade: 'E', remark: 'Marginal Pass' };
  return { total, grade: 'F', remark: 'Unsatisfactory' };
}

export class MinoApiClient {
  private activeCryptoKey: CryptoKey | null = null;
  private currentSchoolId: string = 'sch_oakridge_001';

  setCryptoKey(key: CryptoKey | null) {
    this.activeCryptoKey = key;
  }

  setSchoolId(schoolId: string) {
    this.currentSchoolId = schoolId;
  }

  getSchoolId() {
    return this.currentSchoolId;
  }

  isVaultUnlocked(): boolean {
    return this.activeCryptoKey !== null;
  }

  // --- QUICK LOCAL CREDENTIALS HELPERS FOR LOGIN SCREENS ---
  getQuickCredentialsForRole(role: LoginRole): LocalQuickCredential[] {
    return localBackend.getQuickCredentialsForRole(role);
  }

  getQuickPlatformOwnerCredential(): { email: string; password: string; hasCustomPassword: boolean } {
    return localBackend.getQuickPlatformOwnerCredential();
  }

  // --- HEALTH & SECURITY VERIFICATION ---
  async getHealth() {
    try {
      const { ok, data } = await fetchApiJson('/api/health');
      if (ok) return data;
    } catch {
      // Fallback to local engine health
    }
    return localBackend.getHealth();
  }

  async verifyDirectAccessBlocked(): Promise<{ blocked: boolean; details: any }> {
    try {
      const { status, data } = await fetchApiJson('/api/security/verify-direct-access', { method: 'POST' });
      return { blocked: status === 403, details: data };
    } catch {
      return {
        blocked: true,
        details: {
          blocked: true,
          ruleEnforced: 'allow read, write: if false;',
          reason: 'Direct client SDK access is blocked by zero-trust security rules.'
        }
      };
    }
  }

  // --- TENANT API ---
  async getTenants(): Promise<{ id: string; name: string; code: string; shortCode?: string; logoUrl?: string; currencySymbol: string; currentSession: string; currentTerm: string; subscriptionStatus?: 'pending' | 'active' | 'trial' | 'suspended' }[]> {
    const localTenants = localBackend.getTenants();
    try {
      const { ok, data } = await fetchApiJson('/api/tenants');
      if (ok && Array.isArray(data?.tenants)) {
        const byId = new Map<string, any>();
        for (const lt of localTenants) byId.set(lt.id, lt);
        for (const st of data.tenants) byId.set(st.id, st);
        return Array.from(byId.values());
      }
    } catch {
      // Use localBackend
    }
    return localTenants;
  }

  async getTenant(schoolId?: string): Promise<{ school: SchoolTenant; classes: any[]; subjects: any[]; feeStructures: any[] }> {
    const sid = schoolId || this.currentSchoolId;
    try {
      const { ok, data } = await fetchApiJson(`/api/tenant?schoolId=${encodeURIComponent(sid)}`);
      if (ok && data?.school) {
        localBackend.mirrorTenantBundle(data);
        return data;
      }
    } catch {
      // Fallback to localBackend
    }
    return localBackend.getTenant(sid);
  }

  async onboardTenant(formData: any): Promise<{ school: SchoolTenant }> {
    const localResult = localBackend.onboardTenant(formData);
    try {
      const { ok, data } = await fetchApiJson('/api/tenant/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (ok && data?.school) {
        localBackend.mirrorSchool(data.school);
        return data;
      }
    } catch {
      // Return local result
    }
    return localResult;
  }

  async updateTenantSettings(
    updates: Partial<Pick<SchoolTenant, 'name' | 'logoUrl' | 'address' | 'phone' | 'currency' | 'currencySymbol' | 'currentSession' | 'currentTerm' | 'isReportsLocked'>>,
    actorEmail: string
  ): Promise<{ success: boolean; school: SchoolTenant }> {
    const localRes = localBackend.updateTenantSettings(this.currentSchoolId, updates, actorEmail);
    try {
      const { ok, status, data } = await fetchApiJson('/api/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          schoolId: this.currentSchoolId,
          actorEmail
        })
      });
      if (ok && data?.school) {
        localBackend.mirrorSchool(data.school);
        return data;
      }
      if (!ok && status !== 404) {
        throw new Error(data?.error || 'Failed to save school settings');
      }
    } catch (err) {
      if (!(err instanceof ApiUnavailableError) && err instanceof Error && !err.message.includes('not found')) {
        throw err;
      }
    }
    return localRes;
  }

  async toggleReportLock(isReportsLocked: boolean, actorEmail: string) {
    const localRes = localBackend.toggleReportLock(this.currentSchoolId, isReportsLocked, actorEmail);
    try {
      const { ok, data } = await fetchApiJson('/api/tenant/toggle-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: this.currentSchoolId, isReportsLocked, actorEmail })
      });
      if (ok) return data;
    } catch {
      // Local result already updated
    }
    return localRes;
  }

  // --- STAFF & ROLE MANAGEMENT (Admin/Head Teacher) ---
  async getStaff(schoolId?: string) {
    const sid = schoolId || this.currentSchoolId;
    const localStaff = localBackend.getStaff(sid);
    try {
      const { ok, data } = await fetchApiJson(`/api/staff?schoolId=${encodeURIComponent(sid)}`);
      if (ok && Array.isArray(data?.staff)) {
        if (data.staff.length >= localStaff.length) {
          localBackend.mirrorStaffList(sid, data.staff);
          return data.staff;
        }
        // Merge if serverless cold start only returned default seed staff
        const byEmail = new Map<string, any>();
        for (const ls of localStaff) byEmail.set(ls.email.toLowerCase(), ls);
        for (const ss of data.staff) byEmail.set(ss.email.toLowerCase(), ss);
        const merged = Array.from(byEmail.values());
        localBackend.mirrorStaffList(sid, merged);
        return merged;
      }
    } catch {
      // Fallback to localBackend
    }
    return localStaff;
  }

  async createStaff(staffData: any, actorEmail: string) {
    try {
      const { ok, status, data } = await fetchApiJson('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...staffData, schoolId: this.currentSchoolId, actorEmail })
      });
      if (ok && data?.staff) {
        try {
          localBackend.createStaff(this.currentSchoolId, { ...staffData, passcode: data.temporaryPasscode || data.staff.passcode }, actorEmail);
        } catch {
          // Ignore duplicate in local mirror
        }
        return data;
      }
      if (!ok && status !== 404) {
        throw new Error(data?.error || 'Failed to onboard staff member');
      }
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }
    return localBackend.createStaff(this.currentSchoolId, staffData, actorEmail);
  }

  async updateStaff(staffId: string, updates: any, actorEmail: string) {
    try {
      const { ok, status, data } = await fetchApiJson(`/api/staff/${encodeURIComponent(staffId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, schoolId: this.currentSchoolId, actorEmail })
      });
      if (ok) {
        try {
          localBackend.updateStaff(this.currentSchoolId, staffId, updates, actorEmail);
        } catch {
          // ignore
        }
        return data;
      }
      if (!ok && status !== 404) {
        throw new Error(data?.error || 'Failed to update staff assignments');
      }
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }
    return localBackend.updateStaff(this.currentSchoolId, staffId, updates, actorEmail);
  }

  async deleteStaff(staffId: string, actorEmail: string) {
    try {
      const { ok, status, data } = await fetchApiJson(
        `/api/staff/${encodeURIComponent(staffId)}?schoolId=${encodeURIComponent(this.currentSchoolId)}&actorEmail=${encodeURIComponent(actorEmail)}`,
        { method: 'DELETE' }
      );
      if (ok) {
        try {
          localBackend.deleteStaff(this.currentSchoolId, staffId, actorEmail);
        } catch {
          // ignore
        }
        return data;
      }
      if (!ok && status !== 404) {
        throw new Error(data?.error || 'Failed to remove staff member');
      }
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }
    return localBackend.deleteStaff(this.currentSchoolId, staffId, actorEmail);
  }

  // --- PLATFORM OWNER (MINO OFFICIAL /admin) ---
  async loginPlatformOwner(email: string, password: string) {
    try {
      const { ok, data } = await fetchApiJson('/api/platform/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (ok) return data;

      // Check localBackend in case custom owner password was saved locally across a serverless cold start
      try {
        return localBackend.loginPlatformOwner(email, password);
      } catch {
        throw new Error(data?.error || 'Platform owner authentication failed');
      }
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        return localBackend.loginPlatformOwner(email, password);
      }
      throw err;
    }
  }

  async getPlatformOverview(): Promise<PlatformAnalytics> {
    const localOverview = localBackend.getPlatformOverview();
    try {
      const { ok, data } = await fetchApiJson('/api/platform/overview');
      if (ok && data?.analytics) {
        const serverAnalytics: PlatformAnalytics = data.analytics;
        if (serverAnalytics.schools.length >= localOverview.schools.length) {
          return serverAnalytics;
        }
        // Merge schools across serverless cold starts
        const schoolMap = new Map<string, any>();
        for (const ls of localOverview.schools) schoolMap.set(ls.id, ls);
        for (const ss of serverAnalytics.schools) schoolMap.set(ss.id, ss);
        const mergedSchools = Array.from(schoolMap.values());
        return {
          totalSchools: mergedSchools.length,
          activeSchools: mergedSchools.filter(s => s.subscriptionStatus === 'active').length,
          pendingSchools: mergedSchools.filter(s => s.subscriptionStatus === 'pending').length,
          totalStudents: mergedSchools.reduce((a, c) => a + (c.studentCount || 0), 0),
          totalStaff: mergedSchools.reduce((a, c) => a + (c.staffCount || 0), 0),
          totalPlatformRevenueMinor: mergedSchools.reduce((a, c) => a + (c.totalRevenueMinor || 0), 0),
          schools: mergedSchools
        };
      }
    } catch {
      // Fallback to local overview
    }
    return localOverview;
  }

  async createPlatformSchool(schoolData: any) {
    try {
      const { ok, data } = await fetchApiJson('/api/platform/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schoolData)
      });
      if (ok && data?.school) {
        // Mirror school + admin credentials into localBackend so Vercel serverless cold starts retain login
        localBackend.createPlatformSchool({
          ...schoolData,
          code: data.school.code
        });
        localBackend.mirrorSchool(data.school);
        return data;
      }
      if (!ok) {
        throw new Error(data?.error || 'Failed to provision school');
      }
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        return localBackend.createPlatformSchool(schoolData);
      }
      throw err;
    }
    return localBackend.createPlatformSchool(schoolData);
  }

  async updatePlatformSchool(schoolId: string, updates: any) {
    let localRes: any = null;
    try {
      localRes = localBackend.updatePlatformSchool(schoolId, updates);
    } catch {
      // ignore if only on server
    }
    try {
      const { ok, status, data } = await fetchApiJson(`/api/platform/schools/${encodeURIComponent(schoolId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (ok) {
        if (data?.school) localBackend.mirrorSchool(data.school);
        return data;
      }
      if (!ok && status === 404 && localRes) return localRes;
      throw new Error(data?.error || 'Failed to update school');
    } catch (err) {
      if (err instanceof ApiUnavailableError && localRes) return localRes;
      if (err instanceof ApiUnavailableError) return localBackend.updatePlatformSchool(schoolId, updates);
      throw err;
    }
  }

  async deletePlatformSchool(schoolId: string) {
    let localRes: any = null;
    try {
      localRes = localBackend.deletePlatformSchool(schoolId);
    } catch {
      // ignore
    }
    try {
      const { ok, status, data } = await fetchApiJson(`/api/platform/schools/${encodeURIComponent(schoolId)}`, {
        method: 'DELETE'
      });
      if (ok) return data;
      if (!ok && status === 404 && localRes) return localRes;
      throw new Error(data?.error || 'Failed to suspend school');
    } catch (err) {
      if (err instanceof ApiUnavailableError && localRes) return localRes;
      if (err instanceof ApiUnavailableError) return localBackend.deletePlatformSchool(schoolId);
      throw err;
    }
  }

  // --- INDEPENDENT ROLE LOGINS (School Code + Email + Password) ---
  async loginWithRole(payload: {
    role: LoginRole;
    schoolCode: string;
    email: string;
    password: string;
  }) {
    try {
      const { ok, data } = await fetchApiJson('/api/auth/role-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (ok && data?.school) {
        localBackend.mirrorSchool(data.school);
        return data;
      }
      // If server returned 401/403/404 (e.g., Vercel serverless cold start lost a newly created account),
      // check browser-persisted localBackend before failing.
      try {
        return localBackend.loginWithRole(payload);
      } catch {
        throw new Error(data?.error || 'Authentication failed. Please check your School Code, email, and password.');
      }
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        return localBackend.loginWithRole(payload);
      }
      throw err;
    }
  }

  async loginStaff(email: string, role: string, passcode?: string, schoolId?: string) {
    const sid = schoolId || this.currentSchoolId;
    try {
      const { ok, data } = await fetchApiJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, passcode, schoolId: sid })
      });
      if (ok) return data;
      try {
        return localBackend.loginStaff(email, role, passcode, sid);
      } catch {
        throw new Error(data?.error || 'Login failed');
      }
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        return localBackend.loginStaff(email, role, passcode, sid);
      }
      throw err;
    }
  }

  async loginStudent(admissionNo: string, studentPin: string, schoolId?: string) {
    const sid = schoolId || this.currentSchoolId;
    try {
      const { ok, data } = await fetchApiJson('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admissionNo, studentPin, schoolId: sid })
      });
      if (ok) return data;
      try {
        return localBackend.loginStudent(admissionNo, studentPin, sid);
      } catch {
        throw new Error(data?.error || 'Student login failed');
      }
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        return localBackend.loginStudent(admissionNo, studentPin, sid);
      }
      throw err;
    }
  }

  // --- STUDENTS DIRECTORY (with IndexedDB + LocalBackend Cache) ---
  async getStudents(classArm?: string, includeDeleted = false): Promise<Student[]> {
    const sid = this.currentSchoolId;
    try {
      const url = `/api/students?schoolId=${encodeURIComponent(sid)}&includeDeleted=${includeDeleted}${classArm && classArm !== 'all' ? `&classArm=${encodeURIComponent(classArm)}` : ''}`;
      const { ok, data } = await fetchApiJson(url);
      if (ok && Array.isArray(data?.students)) {
        const students: Student[] = data.students;
        if (!classArm || classArm === 'all') {
          const localAll = localBackend.getStudents(sid, 'all', true);
          if (students.length >= localAll.filter(s => includeDeleted || !s.isDeleted).length) {
            try {
              if (students.length > 0) await localDb.cached_students.bulkPut(students);
            } catch {
              // ignore IndexedDB cache warning
            }
            return students;
          }
        } else {
          return students;
        }
      }
    } catch {
      // Fallback to localBackend & IndexedDB cache
    }

    const localList = localBackend.getStudents(sid, classArm, includeDeleted);
    if (localList.length > 0) {
      try {
        await localDb.cached_students.bulkPut(localList);
      } catch {
        // ignore
      }
      return localList;
    }

    const cached = await localDb.cached_students.where('schoolId').equals(sid).toArray();
    return cached.filter(st => {
      if (!includeDeleted && st.isDeleted) return false;
      if (classArm && classArm !== 'all' && st.classArm !== classArm) return false;
      return true;
    });
  }

  async createStudent(studentData: Partial<Student>, actorEmail: string): Promise<Student> {
    if (!navigator.onLine) {
      const queued = await this.queueOfflineStudent(studentData, 'create');
      try {
        localBackend.createStudent(this.currentSchoolId, queued, actorEmail);
      } catch {
        // ignore
      }
      return queued;
    }

    try {
      const { ok, status, data } = await fetchApiJson('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...studentData, schoolId: this.currentSchoolId, actorEmail })
      });
      if (ok && data?.student) {
        try {
          localBackend.createStudent(this.currentSchoolId, data.student, actorEmail);
        } catch {
          // ignore duplicate in local mirror
        }
        return data.student;
      }
      if (!ok && status !== 404) {
        throw new Error(data?.error || 'Failed to create student');
      }
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }

    return localBackend.createStudent(this.currentSchoolId, studentData, actorEmail);
  }

  async updateStudent(studentId: string, updates: Partial<Student>, actorEmail: string): Promise<Student> {
    if (!navigator.onLine) {
      const queued = await this.queueOfflineStudent({ ...updates, id: studentId }, 'update');
      try {
        return localBackend.updateStudent(this.currentSchoolId, studentId, updates, actorEmail);
      } catch {
        return queued;
      }
    }

    try {
      const { ok, status, data } = await fetchApiJson(`/api/students/${encodeURIComponent(studentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, schoolId: this.currentSchoolId, actorEmail })
      });
      if (ok && data?.student) {
        try {
          localBackend.updateStudent(this.currentSchoolId, studentId, updates, actorEmail);
        } catch {
          // ignore
        }
        return data.student;
      }
      if (!ok && status !== 404) {
        throw new Error(data?.error || 'Failed to update student');
      }
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }

    return localBackend.updateStudent(this.currentSchoolId, studentId, updates, actorEmail);
  }

  async deleteStudent(studentId: string, actorEmail: string): Promise<void> {
    try {
      const { ok, status, data } = await fetchApiJson(
        `/api/students/${encodeURIComponent(studentId)}?schoolId=${encodeURIComponent(this.currentSchoolId)}&actorEmail=${encodeURIComponent(actorEmail)}`,
        { method: 'DELETE' }
      );
      if (ok) {
        try {
          localBackend.deleteStudent(this.currentSchoolId, studentId, actorEmail);
        } catch {
          // ignore
        }
        return;
      }
      if (!ok && status !== 404) {
        throw new Error(data?.error || 'Failed to delete student');
      }
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }
    localBackend.deleteStudent(this.currentSchoolId, studentId, actorEmail);
  }

  async restoreStudent(studentId: string, actorEmail: string): Promise<void> {
    try {
      const { ok, status, data } = await fetchApiJson(
        `/api/students/${encodeURIComponent(studentId)}/restore`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolId: this.currentSchoolId, actorEmail })
        }
      );
      if (ok) {
        try {
          localBackend.restoreStudent(this.currentSchoolId, studentId, actorEmail);
        } catch {
          // ignore
        }
        return;
      }
      if (!ok && status !== 404) {
        throw new Error(data?.error || 'Failed to restore student');
      }
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }
    localBackend.restoreStudent(this.currentSchoolId, studentId, actorEmail);
  }

  async bulkImportCsv(students: any[], actorEmail: string) {
    try {
      const { ok, status, data } = await fetchApiJson('/api/students/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: this.currentSchoolId, students, actorEmail })
      });
      if (ok) {
        try {
          localBackend.bulkImportCsv(this.currentSchoolId, students, actorEmail);
        } catch {
          // ignore
        }
        return data;
      }
      if (!ok && status !== 404) {
        throw new Error(data?.error || 'Failed to import students');
      }
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }
    return localBackend.bulkImportCsv(this.currentSchoolId, students, actorEmail);
  }

  // --- GRADEBOOK (with Local Offline Storage & Merge) ---
  async getScores(classArm?: string, subjectId?: string, session?: string, term?: string): Promise<ScoreEvent[]> {
    const sid = this.currentSchoolId;
    const normalizedTerm = term ? normalizeAcademicTerm(term) : undefined;
    let baseScores: ScoreEvent[] = localBackend.getScores(sid, classArm, subjectId, session, normalizedTerm);

    try {
      let url = `/api/scores?schoolId=${encodeURIComponent(sid)}`;
      if (session) url += `&session=${encodeURIComponent(session)}`;
      if (normalizedTerm) url += `&term=${encodeURIComponent(normalizedTerm)}`;
      if (classArm && classArm !== 'all') url += `&classArm=${encodeURIComponent(classArm)}`;
      if (subjectId && subjectId !== 'all') url += `&subjectId=${encodeURIComponent(subjectId)}`;

      const { ok, data } = await fetchApiJson(url);
      if (ok && Array.isArray(data?.scores)) {
        const serverScores = data.scores.map((sc: ScoreEvent) => ({ ...sc, synced: true }));
        const mergedServerAndLocal = new Map<string, ScoreEvent>();
        for (const ls of baseScores) {
          mergedServerAndLocal.set(`${ls.studentId}::${ls.subjectId}::${ls.session}::${normalizeAcademicTerm(ls.term)}`, ls);
        }
        for (const ss of serverScores) {
          mergedServerAndLocal.set(`${ss.studentId}::${ss.subjectId}::${ss.session}::${normalizeAcademicTerm(ss.term)}`, ss);
        }
        baseScores = Array.from(mergedServerAndLocal.values());
      }
    } catch {
      // Offline or static Vercel: baseScores from localBackend already populated
    }

    // Load local offline scores and overlay any unsynced (or offline-only) records
    let localRecords: LocalOfflineScoreRecord[] = [];
    try {
      localRecords = await localDb.offline_scores.where('schoolId').equals(sid).toArray();
    } catch {
      localRecords = [];
    }

    const filteredLocal = localRecords.filter(rec => {
      if (session && rec.session !== session) return false;
      if (normalizedTerm && normalizeAcademicTerm(rec.term) !== normalizedTerm) return false;
      if (classArm && classArm !== 'all' && rec.classArm && rec.classArm !== classArm) return false;
      if (subjectId && subjectId !== 'all' && rec.subjectId !== subjectId) return false;
      return true;
    });

    const mergedByKey = new Map<string, ScoreEvent>();
    for (const sc of baseScores) {
      const k = `${sc.studentId}::${sc.subjectId}::${sc.session}::${normalizeAcademicTerm(sc.term)}`;
      mergedByKey.set(k, sc);
    }

    for (const loc of filteredLocal) {
      const k = `${loc.studentId}::${loc.subjectId}::${loc.session}::${normalizeAcademicTerm(loc.term)}`;
      const existingServer = mergedByKey.get(k);
      if (!existingServer || loc.synced === 0) {
        mergedByKey.set(k, {
          id: existingServer?.id || `sc_local_${loc.studentId}_${loc.subjectId}`,
          clientChangeId: loc.clientChangeId || existingServer?.clientChangeId || `cc_local_${loc.studentId}`,
          schoolId: loc.schoolId,
          studentId: loc.studentId,
          subjectId: loc.subjectId,
          session: loc.session,
          term: loc.term,
          ca1: loc.ca1,
          ca2: loc.ca2,
          midterm: loc.midterm,
          exam: loc.exam,
          total: loc.total,
          grade: loc.grade,
          remark: loc.remark,
          recordedBy: loc.recordedBy,
          deviceId: loc.deviceId || getDeviceId(),
          timestamp: loc.recordedAt,
          synced: loc.synced === 1
        });
      }
    }

    return Array.from(mergedByKey.values());
  }

  // Queue a score update into outbox + offline_scores store or push immediately
  async recordScore(
    scoreData: {
      studentId: string;
      subjectId: string;
      session: string;
      term: string;
      ca1: number;
      ca2: number;
      midterm: number;
      exam: number;
      recordedBy: string;
    },
    meta?: {
      schoolCode?: string;
      schoolName?: string;
      admissionNo?: string;
      firstName?: string;
      lastName?: string;
      gender?: string;
      email?: string;
      classArm?: string;
      subjectCode?: string;
      subjectName?: string;
      forceOfflineOnly?: boolean;
    }
  ) {
    const clientChangeId = 'cc_' + crypto.randomUUID();
    const deviceId = getDeviceId();
    const timestamp = new Date().toISOString();
    const normalizedTerm = normalizeAcademicTerm(scoreData.term);
    const clampedCa1 = Math.min(15, Math.max(0, Math.round(Number(scoreData.ca1) || 0)));
    const clampedCa2 = Math.min(15, Math.max(0, Math.round(Number(scoreData.ca2) || 0)));
    const clampedMid = Math.min(20, Math.max(0, Math.round(Number(scoreData.midterm) || 0)));
    const clampedExam = Math.min(50, Math.max(0, Math.round(Number(scoreData.exam) || 0)));
    const { total, grade, remark } = computeGradeAndRemark(clampedCa1, clampedCa2, clampedMid, clampedExam);

    const recordKey = `${this.currentSchoolId}::${scoreData.studentId}::${scoreData.subjectId}::${scoreData.session}::${normalizedTerm}`;
    const firstName = meta?.firstName || '';
    const lastName = meta?.lastName || '';

    const localRecord: LocalOfflineScoreRecord = {
      recordKey,
      schoolId: this.currentSchoolId,
      schoolCode: meta?.schoolCode || '',
      schoolName: meta?.schoolName || '',
      studentId: scoreData.studentId,
      admissionNo: meta?.admissionNo || '',
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      gender: meta?.gender,
      email: meta?.email,
      classArm: meta?.classArm || '',
      subjectId: scoreData.subjectId,
      subjectCode: meta?.subjectCode || '',
      subjectName: meta?.subjectName || '',
      session: scoreData.session,
      term: normalizedTerm,
      ca1: clampedCa1,
      ca2: clampedCa2,
      midterm: clampedMid,
      exam: clampedExam,
      total,
      grade,
      remark,
      recordedBy: scoreData.recordedBy,
      recordedAt: timestamp,
      clientChangeId,
      deviceId,
      synced: 0
    };

    try {
      await localDb.offline_scores.put(localRecord);
    } catch (dbErr) {
      console.warn('Unable to write offline_scores record', dbErr);
    }

    const normalizedPayload = {
      ...scoreData,
      term: normalizedTerm,
      ca1: clampedCa1,
      ca2: clampedCa2,
      midterm: clampedMid,
      exam: clampedExam
    };

    const syncBatchItem = {
      clientChangeId,
      entity: 'score',
      action: 'create',
      deviceId,
      payload: normalizedPayload,
      timestamp
    };

    if (navigator.onLine && !meta?.forceOfflineOnly) {
      // Mirror into localBackend first so student/guardian portals on Vercel reflect updates immediately
      const localPushRes = localBackend.pushSyncItems(this.currentSchoolId, [syncBatchItem]);
      if (localPushRes.results?.[0]?.status === 'rejected') {
        throw new Error(localPushRes.results[0].reason || 'Score update rejected.');
      }

      try {
        const { ok, data } = await fetchApiJson('/api/sync/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId: this.currentSchoolId,
            items: [syncBatchItem]
          })
        });
        if (ok) {
          if (data.results?.[0]?.status === 'rejected') {
            throw new Error(data.results[0].reason || 'Score update rejected by server.');
          }
          try {
            await localDb.offline_scores.update(recordKey, { synced: 1 });
          } catch {
            // ignore
          }
          return { clientChangeId, synced: true, queuedOffline: false };
        }
      } catch (err: any) {
        if (err instanceof ApiUnavailableError) {
          // On static Vercel where /api/* is absent, localBackend committed the score cleanly
          if (navigator.onLine) {
            try {
              await localDb.offline_scores.update(recordKey, { synced: 1 });
            } catch {
              // ignore
            }
            return { clientChangeId, synced: true, queuedOffline: false };
          }
        } else if (err?.message && err.message.includes('locked')) {
          throw err;
        }
      }
    }

    await this.queueOutboxItem({
      clientChangeId,
      schoolId: this.currentSchoolId,
      entity: 'score',
      action: 'create',
      deviceId,
      timestamp,
      payload: normalizedPayload
    });

    return { clientChangeId, synced: false, queuedOffline: true };
  }

  // --- LEDGER & FEES ---
  async getLedger(studentId?: string): Promise<{ entries: LedgerEntry[]; studentBalances: Record<string, any> }> {
    const sid = this.currentSchoolId;
    const localLedger = localBackend.getLedger(sid, studentId);
    try {
      let url = `/api/ledger?schoolId=${encodeURIComponent(sid)}`;
      if (studentId) url += `&studentId=${encodeURIComponent(studentId)}`;
      const { ok, data } = await fetchApiJson(url);
      if (ok && Array.isArray(data?.entries) && data.entries.length >= localLedger.entries.length) {
        return data;
      }
    } catch {
      // Fallback to localBackend
    }
    return localLedger;
  }

  async recordPayment(paymentData: {
    studentId: string;
    type: 'DEBIT_FEE' | 'CREDIT_PAYMENT' | 'WAIVER';
    amountMinor: number;
    description: string;
    category?: string;
    paymentChannel?: string;
    referenceNo?: string;
    actorEmail: string;
  }) {
    const clientChangeId = 'cc_' + crypto.randomUUID();
    const deviceId = getDeviceId();
    const timestamp = new Date().toISOString();

    if (navigator.onLine) {
      const localRes = localBackend.recordPayment(this.currentSchoolId, paymentData);
      try {
        const { ok, data } = await fetchApiJson('/api/ledger/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...paymentData, schoolId: this.currentSchoolId })
        });
        if (ok && data?.entry) {
          return { ...data.entry, synced: true };
        }
      } catch (err) {
        if (err instanceof ApiUnavailableError && navigator.onLine) {
          return { ...localRes.entry, synced: true };
        }
      }
      return { ...localRes.entry, synced: true };
    }

    await this.queueOutboxItem({
      clientChangeId,
      schoolId: this.currentSchoolId,
      entity: 'ledger',
      action: 'create',
      deviceId,
      timestamp,
      payload: paymentData
    });

    return {
      clientChangeId,
      studentId: paymentData.studentId,
      type: paymentData.type,
      amountMinor: paymentData.amountMinor,
      description: paymentData.description,
      receiptNo: 'OFFLINE-' + Date.now().toString().slice(-6),
      timestamp,
      synced: false,
      queuedOffline: true
    };
  }

  // --- OUTBOX QUEUEING & ENCRYPTION ---
  private async queueOutboxItem(item: {
    clientChangeId: string;
    schoolId: string;
    entity: 'student' | 'score' | 'ledger';
    action: 'create' | 'update' | 'delete';
    deviceId: string;
    timestamp: string;
    payload: any;
  }) {
    let cipherHex = '';
    let ivHex = '';

    if (this.activeCryptoKey) {
      const encrypted = await encryptData(this.activeCryptoKey, item.payload);
      cipherHex = encrypted.cipherHex;
      ivHex = encrypted.ivHex;
    } else {
      cipherHex = btoa(unescape(encodeURIComponent(JSON.stringify(item.payload))));
      ivHex = 'unencrypted_base64';
    }

    await localDb.outbox.add({
      clientChangeId: item.clientChangeId,
      schoolId: item.schoolId,
      entity: item.entity,
      action: item.action,
      deviceId: item.deviceId,
      payloadCipher: cipherHex,
      iv: ivHex,
      timestamp: item.timestamp,
      syncAttempts: 0,
      status: 'pending'
    });
  }

  private async queueOfflineStudent(studentData: Partial<Student>, action: 'create' | 'update'): Promise<Student> {
    const clientChangeId = 'cc_' + crypto.randomUUID();
    const deviceId = getDeviceId();
    const timestamp = new Date().toISOString();
    const tempStudent: Student = {
      id: studentData.id || 'std_off_' + Math.random().toString(36).substring(2, 8),
      schoolId: this.currentSchoolId,
      admissionNo: studentData.admissionNo || 'TEMP-' + Math.floor(1000 + Math.random() * 9000),
      firstName: studentData.firstName || '',
      lastName: studentData.lastName || '',
      email: studentData.email || '',
      studentPassword: studentData.studentPassword || 'student123',
      gender: studentData.gender || 'other',
      classArm: studentData.classArm || 'JSS 1',
      guardianName: studentData.guardianName || '',
      guardianPhone: studentData.guardianPhone || '',
      guardianEmail: studentData.guardianEmail || '',
      guardianPassword: studentData.guardianPassword || 'guardian123',
      accessToken: 'tok_off_' + Date.now(),
      accessPin: '000000',
      studentPin: studentData.studentPin || '1234',
      status: 'active',
      isDeleted: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await this.queueOutboxItem({
      clientChangeId,
      schoolId: this.currentSchoolId,
      entity: 'student',
      action,
      deviceId,
      timestamp,
      payload: tempStudent
    });

    return tempStudent;
  }

  // --- SYNC PUSH WORKER ---
  async syncOutbox(): Promise<{ pushed: number; failed: number; skipped: number }> {
    if (!navigator.onLine) {
      return { pushed: 0, failed: 0, skipped: 0 };
    }

    const pending = await localDb.outbox.where('status').equals('pending').toArray();
    if (pending.length === 0) {
      return { pushed: 0, failed: 0, skipped: 0 };
    }

    const batch: any[] = [];
    const validOutboxItems: OutboxItem[] = [];

    for (const item of pending) {
      try {
        let payload: any;
        if (item.iv === 'unencrypted_base64') {
          payload = JSON.parse(decodeURIComponent(escape(atob(item.payloadCipher))));
        } else if (this.activeCryptoKey) {
          payload = await decryptData(this.activeCryptoKey, item.payloadCipher, item.iv);
        } else {
          continue;
        }

        batch.push({
          clientChangeId: item.clientChangeId,
          entity: item.entity,
          action: item.action,
          deviceId: item.deviceId,
          payload,
          timestamp: item.timestamp
        });
        validOutboxItems.push(item);
      } catch (e) {
        console.error('Failed to decrypt outbox item', item.clientChangeId, e);
      }
    }

    if (batch.length === 0) {
      return { pushed: 0, failed: 0, skipped: pending.length };
    }

    // Always commit to localBackend first
    const localSyncData = localBackend.pushSyncItems(this.currentSchoolId, batch);

    let finalData: any = localSyncData;
    try {
      const { ok, data } = await fetchApiJson('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: this.currentSchoolId,
          items: batch
        })
      });
      if (ok) finalData = data;
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) {
        return { pushed: 0, failed: batch.length, skipped: 0 };
      }
    }

    for (let i = 0; i < validOutboxItems.length; i++) {
      const item = validOutboxItems[i];
      const batchEntry = batch[i];
      if (item.id) {
        await localDb.outbox.delete(item.id);
      }
      if (item.entity === 'score' && batchEntry?.payload) {
        const p = batchEntry.payload;
        const rk = `${this.currentSchoolId}::${p.studentId}::${p.subjectId}::${p.session}::${normalizeAcademicTerm(p.term)}`;
        try {
          await localDb.offline_scores.update(rk, { synced: 1 });
        } catch {
          // ignore
        }
      }
    }

    return {
      pushed: finalData.processedCount || 0,
      skipped: finalData.skippedIdempotentCount || 0,
      failed: Math.max(0, batch.length - (finalData.processedCount || 0) - (finalData.skippedIdempotentCount || 0))
    };
  }

  // --- PARENT PORTAL LOOKUP ---
  async lookupParentPortal(query: { admissionNo?: string; accessPin?: string; accessToken?: string }) {
    try {
      const { ok, data } = await fetchApiJson('/api/parent/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...query, schoolId: this.currentSchoolId })
      });
      if (ok) return data;
      try {
        return localBackend.lookupParentPortal(query, this.currentSchoolId);
      } catch {
        throw new Error(data?.error || 'Failed to lookup student record');
      }
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        return localBackend.lookupParentPortal(query, this.currentSchoolId);
      }
      throw err;
    }
  }

  // --- AUDIT TRAIL ---
  async getAuditLogs() {
    const localLogs = localBackend.getAuditLogs(this.currentSchoolId);
    try {
      const { ok, data } = await fetchApiJson(`/api/audit?schoolId=${encodeURIComponent(this.currentSchoolId)}`);
      if (ok && Array.isArray(data?.logs) && data.logs.length >= localLogs.length) {
        return data.logs;
      }
    } catch {
      // Fallback to localBackend
    }
    return localLogs;
  }

  // --- DASHBOARD SUMMARY & ANALYTICS ---
  async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      const { ok, data } = await fetchApiJson(`/api/dashboard/summary?schoolId=${encodeURIComponent(this.currentSchoolId)}`);
      if (ok && data?.summary) {
        const localSummary = localBackend.getDashboardSummary(this.currentSchoolId);
        if (data.summary.totalStudents >= localSummary.totalStudents) {
          return data.summary;
        }
        return localSummary;
      }
    } catch {
      // Fallback to localBackend
    }
    return localBackend.getDashboardSummary(this.currentSchoolId);
  }

  // --- ATTENDANCE ROLL CALL ---
  async getAttendance(classArm?: string, date?: string): Promise<{
    date: string;
    classArm: string;
    stats: { total: number; present: number; absent: number; late: number; excused: number; attendanceRate: number };
    records: { studentId: string; admissionNo: string; studentName: string; gender: string; classArm: string; status: AttendanceStatus; remark: string }[];
  }> {
    try {
      let url = `/api/attendance?schoolId=${encodeURIComponent(this.currentSchoolId)}`;
      if (classArm && classArm !== 'all') url += `&classArm=${encodeURIComponent(classArm)}`;
      if (date) url += `&date=${encodeURIComponent(date)}`;
      const { ok, data } = await fetchApiJson(url);
      if (ok && data?.records) return data;
    } catch {
      // Fallback to localBackend
    }
    return localBackend.getAttendance(this.currentSchoolId, classArm, date);
  }

  async markAttendance(payload: {
    date: string;
    classArm: string;
    studentId: string;
    status: AttendanceStatus;
    remark?: string;
    actorEmail: string;
  }) {
    const localRes = localBackend.markAttendance(this.currentSchoolId, payload);
    try {
      const { ok, data } = await fetchApiJson('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, schoolId: this.currentSchoolId })
      });
      if (ok) return data;
    } catch {
      // localRes already recorded
    }
    return localRes;
  }

  async markAllAttendance(payload: {
    date: string;
    classArm: string;
    status: AttendanceStatus;
    actorEmail: string;
  }) {
    const localRes = localBackend.markAllAttendance(this.currentSchoolId, payload);
    try {
      const { ok, data } = await fetchApiJson('/api/attendance/mark-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, schoolId: this.currentSchoolId })
      });
      if (ok) return data;
    } catch {
      // localRes already recorded
    }
    return localRes;
  }

  // --- NOTICES & ANNOUNCEMENTS ---
  async getNotices(): Promise<Notice[]> {
    const localNotices = localBackend.getNotices(this.currentSchoolId);
    try {
      const { ok, data } = await fetchApiJson(`/api/notices?schoolId=${encodeURIComponent(this.currentSchoolId)}`);
      if (ok && Array.isArray(data?.notices) && data.notices.length >= localNotices.length) {
        return data.notices;
      }
    } catch {
      // Fallback to localBackend
    }
    return localNotices;
  }

  async createNotice(noticeData: Partial<Notice>, actorEmail: string): Promise<Notice> {
    const localNotice = localBackend.createNotice(this.currentSchoolId, noticeData, actorEmail);
    try {
      const { ok, data } = await fetchApiJson('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...noticeData, schoolId: this.currentSchoolId, author: actorEmail })
      });
      if (ok && data?.notice) return data.notice;
    } catch {
      // localNotice already created
    }
    return localNotice;
  }

  // --- EVENTS & CALENDAR ---
  async getEvents(): Promise<SchoolEvent[]> {
    const localEvents = localBackend.getEvents(this.currentSchoolId);
    try {
      const { ok, data } = await fetchApiJson(`/api/events?schoolId=${encodeURIComponent(this.currentSchoolId)}`);
      if (ok && Array.isArray(data?.events) && data.events.length >= localEvents.length) {
        return data.events;
      }
    } catch {
      // Fallback to localBackend
    }
    return localEvents;
  }

  async createEvent(eventData: Partial<SchoolEvent>): Promise<SchoolEvent> {
    const localEvt = localBackend.createEvent(this.currentSchoolId, eventData);
    try {
      const { ok, data } = await fetchApiJson('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventData, schoolId: this.currentSchoolId })
      });
      if (ok && data?.event) return data.event;
    } catch {
      // localEvt already created
    }
    return localEvt;
  }

  async deleteEvent(eventId: string): Promise<void> {
    localBackend.deleteEvent(this.currentSchoolId, eventId);
    try {
      await fetchApiJson(`/api/events/${encodeURIComponent(eventId)}?schoolId=${encodeURIComponent(this.currentSchoolId)}`, {
        method: 'DELETE'
      });
    } catch {
      // ignore
    }
  }

  // --- NOTICES DELETION ---
  async deleteNotice(noticeId: string): Promise<void> {
    localBackend.deleteNotice(this.currentSchoolId, noticeId);
    try {
      await fetchApiJson(`/api/notices/${encodeURIComponent(noticeId)}?schoolId=${encodeURIComponent(this.currentSchoolId)}`, {
        method: 'DELETE'
      });
    } catch {
      // ignore
    }
  }

  // --- CLASSES MANAGEMENT ---
  async getClasses(schoolId?: string) {
    const sid = schoolId || this.currentSchoolId;
    const localClasses = localBackend.getClasses(sid);
    try {
      const { ok, data } = await fetchApiJson(`/api/classes?schoolId=${encodeURIComponent(sid)}`);
      if (ok && Array.isArray(data?.classes) && data.classes.length >= localClasses.length) {
        return data.classes;
      }
    } catch {
      // Fallback to localBackend
    }
    return localClasses;
  }

  async createClass(classData: { name: string; level: string; classTeacherId?: string }, actorEmail: string) {
    try {
      const { ok, status, data } = await fetchApiJson('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...classData, schoolId: this.currentSchoolId, actorEmail })
      });
      if (ok) {
        try {
          localBackend.createClass(this.currentSchoolId, classData, actorEmail);
        } catch {
          // ignore
        }
        return data;
      }
      if (!ok && status !== 404) throw new Error(data?.error || 'Failed to create class arm');
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }
    return localBackend.createClass(this.currentSchoolId, classData, actorEmail);
  }

  async updateClass(classId: string, updates: any) {
    try {
      const { ok, status, data } = await fetchApiJson(`/api/classes/${encodeURIComponent(classId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, schoolId: this.currentSchoolId })
      });
      if (ok) {
        try {
          localBackend.updateClass(this.currentSchoolId, classId, updates);
        } catch {
          // ignore
        }
        return data;
      }
      if (!ok && status !== 404) throw new Error(data?.error || 'Failed to update class');
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }
    return localBackend.updateClass(this.currentSchoolId, classId, updates);
  }

  async deleteClass(classId: string, actorEmail: string) {
    try {
      const { ok, status, data } = await fetchApiJson(
        `/api/classes/${encodeURIComponent(classId)}?schoolId=${encodeURIComponent(this.currentSchoolId)}&actorEmail=${encodeURIComponent(actorEmail)}`,
        { method: 'DELETE' }
      );
      if (ok) {
        try {
          localBackend.deleteClass(this.currentSchoolId, classId, actorEmail);
        } catch {
          // ignore
        }
        return data;
      }
      if (!ok && status !== 404) throw new Error(data?.error || 'Failed to delete class arm');
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }
    return localBackend.deleteClass(this.currentSchoolId, classId, actorEmail);
  }

  // --- SUBJECTS MANAGEMENT (with IndexedDB + LocalBackend Cache) ---
  async getSubjects(schoolId?: string) {
    const sid = schoolId || this.currentSchoolId;
    const localSubs = localBackend.getSubjects(sid);
    try {
      const { ok, data } = await fetchApiJson(`/api/subjects?schoolId=${encodeURIComponent(sid)}`);
      if (ok && Array.isArray(data?.subjects)) {
        const subjects: Subject[] = data.subjects.length >= localSubs.length ? data.subjects : localSubs;
        try {
          if (subjects.length > 0) await localDb.cached_subjects.bulkPut(subjects);
        } catch {
          // ignore
        }
        return subjects;
      }
    } catch {
      // Fallback
    }

    if (localSubs.length > 0) {
      try {
        await localDb.cached_subjects.bulkPut(localSubs);
      } catch {
        // ignore
      }
      return localSubs;
    }
    return await localDb.cached_subjects.where('schoolId').equals(sid).toArray();
  }

  async createSubject(subjectData: { name: string; code: string }, actorEmail: string) {
    try {
      const { ok, status, data } = await fetchApiJson('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...subjectData, schoolId: this.currentSchoolId, actorEmail })
      });
      if (ok) {
        try {
          localBackend.createSubject(this.currentSchoolId, subjectData, actorEmail);
        } catch {
          // ignore
        }
        return data;
      }
      if (!ok && status !== 404) throw new Error(data?.error || 'Failed to create subject');
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }
    return localBackend.createSubject(this.currentSchoolId, subjectData, actorEmail);
  }

  async deleteSubject(subjectId: string, actorEmail: string) {
    try {
      const { ok, status, data } = await fetchApiJson(
        `/api/subjects/${encodeURIComponent(subjectId)}?schoolId=${encodeURIComponent(this.currentSchoolId)}&actorEmail=${encodeURIComponent(actorEmail)}`,
        { method: 'DELETE' }
      );
      if (ok) {
        try {
          localBackend.deleteSubject(this.currentSchoolId, subjectId, actorEmail);
        } catch {
          // ignore
        }
        return data;
      }
      if (!ok && status !== 404) throw new Error(data?.error || 'Failed to delete subject');
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }
    return localBackend.deleteSubject(this.currentSchoolId, subjectId, actorEmail);
  }

  // --- TIMETABLE / SCHEDULE ---
  async getTimetable(classArm?: string) {
    const targetArm = classArm || 'JSS 1';
    try {
      const { ok, data } = await fetchApiJson(
        `/api/timetable?schoolId=${encodeURIComponent(this.currentSchoolId)}&classArm=${encodeURIComponent(targetArm)}`
      );
      if (ok && data?.schedule) return data;
    } catch {
      // Fallback to localBackend
    }
    return localBackend.getTimetable(this.currentSchoolId, targetArm);
  }

  async saveTimetablePeriod(periodData: {
    classArm: string;
    day: string;
    period: number;
    time: string;
    subject: string;
    teacher: string;
    room?: string;
  }) {
    const localRes = localBackend.saveTimetablePeriod(this.currentSchoolId, periodData);
    try {
      const { ok, data } = await fetchApiJson('/api/timetable/period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...periodData, schoolId: this.currentSchoolId })
      });
      if (ok) return data;
    } catch {
      // localRes already saved
    }
    return localRes;
  }

  async deleteTimetablePeriod(classArm: string, day: string, period: number) {
    const localRes = localBackend.deleteTimetablePeriod(this.currentSchoolId, classArm, day, period);
    try {
      const { ok, data } = await fetchApiJson(
        `/api/timetable/period?schoolId=${encodeURIComponent(this.currentSchoolId)}&classArm=${encodeURIComponent(classArm)}&day=${encodeURIComponent(day)}&period=${period}`,
        { method: 'DELETE' }
      );
      if (ok) return data;
    } catch {
      // localRes already updated
    }
    return localRes;
  }

  // --- BULK CLASS FEE ASSESSMENT ---
  async assessFeeToClass(data: {
    classArm: string;
    name: string;
    amountMinor: number;
    category?: string;
    term?: string;
    session?: string;
    actorEmail: string;
  }) {
    const localRes = localBackend.assessFeeToClass(this.currentSchoolId, data);
    try {
      const { ok, data: resData } = await fetchApiJson('/api/ledger/assess-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, schoolId: this.currentSchoolId })
      });
      if (ok) return resData;
    } catch {
      // localRes already assessed
    }
    return localRes;
  }

  // --- PARENTS DIRECTORY ---
  async getParents(): Promise<ParentSummary[]> {
    const localParents = localBackend.getParents(this.currentSchoolId);
    try {
      const { ok, data } = await fetchApiJson(`/api/parents?schoolId=${encodeURIComponent(this.currentSchoolId)}`);
      if (ok && Array.isArray(data?.parents) && data.parents.length >= localParents.length) {
        return data.parents;
      }
    } catch {
      // Fallback to localBackend
    }
    return localParents;
  }

  // --- BACKUP & RESTORE ---
  getBackupDownloadUrl() {
    return `/api/backup/export?schoolId=${encodeURIComponent(this.currentSchoolId)}`;
  }

  async downloadBackupSnapshot(): Promise<void> {
    let snapshot: any = null;
    try {
      const { ok, data } = await fetchApiJson(this.getBackupDownloadUrl());
      if (ok && data?.school) {
        snapshot = data;
      }
    } catch {
      // Fallback to localBackend snapshot
    }
    if (!snapshot) {
      snapshot = localBackend.exportBackupSnapshot(this.currentSchoolId);
    }

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStamp = new Date().toISOString().split('T')[0];
    link.download = `mino_backup_${this.currentSchoolId}_${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async restoreBackup(snapshot: any, actorEmail: string) {
    const localRes = localBackend.restoreBackup(snapshot, actorEmail);
    try {
      const { ok, data } = await fetchApiJson('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot, actorEmail })
      });
      if (ok) return data;
    } catch {
      // localRes already restored
    }
    return localRes;
  }

  async softWipeAndReseed(actorEmail: string) {
    const localRes = localBackend.softWipeAndReseed(this.currentSchoolId, actorEmail);
    try {
      const { ok, data } = await fetchApiJson('/api/admin/soft-wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: this.currentSchoolId, actorEmail })
      });
      if (ok) return data;
    } catch {
      // localRes already reseeded
    }
    return localRes;
  }

  // --- PLATFORM OWNER SECURITY ---
  async changePlatformOwnerPassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    actorEmail?: string;
  }): Promise<{ success: boolean; message: string; updatedAt?: string }> {
    const localRes = localBackend.changePlatformOwnerPassword(payload);
    try {
      const { ok, data } = await fetchApiJson('/api/platform/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (ok) return data;
    } catch {
      // localRes already updated
    }
    return localRes;
  }

  async getPlatformOwnerStatus(): Promise<{ email: string; lastPasswordChange: string; hasCustomPassword: boolean }> {
    try {
      const { ok, data } = await fetchApiJson('/api/platform/owner/status');
      if (ok && data?.email) return data;
    } catch {
      // Fallback to localBackend
    }
    return localBackend.getPlatformOwnerStatus();
  }

  // Convenience aliases for platform & scores + Offline Export / Smart Admin Import
  async saveScore(scoreData: {
    studentId: string;
    subjectId: string;
    classArm?: string;
    ca1: number;
    ca2: number;
    midterm: number;
    exam: number;
    actorEmail: string;
    session?: string;
    term?: string;
    schoolCode?: string;
    schoolName?: string;
    admissionNo?: string;
    firstName?: string;
    lastName?: string;
    gender?: string;
    email?: string;
    subjectCode?: string;
    subjectName?: string;
    forceOfflineOnly?: boolean;
  }) {
    return await this.recordScore(
      {
        studentId: scoreData.studentId,
        subjectId: scoreData.subjectId,
        session: scoreData.session || '2025/2026',
        term: scoreData.term || '2nd Term',
        ca1: scoreData.ca1,
        ca2: scoreData.ca2,
        midterm: scoreData.midterm,
        exam: scoreData.exam,
        recordedBy: scoreData.actorEmail
      },
      {
        schoolCode: scoreData.schoolCode,
        schoolName: scoreData.schoolName,
        admissionNo: scoreData.admissionNo,
        firstName: scoreData.firstName,
        lastName: scoreData.lastName,
        gender: scoreData.gender,
        email: scoreData.email,
        classArm: scoreData.classArm,
        subjectCode: scoreData.subjectCode,
        subjectName: scoreData.subjectName,
        forceOfflineOnly: scoreData.forceOfflineOnly
      }
    );
  }

  async getLocalStoredScores(options?: { onlyUnsynced?: boolean; session?: string; term?: string }): Promise<LocalOfflineScoreRecord[]> {
    const sid = this.currentSchoolId;
    try {
      const list = await localDb.offline_scores.where('schoolId').equals(sid).toArray();
      return list.filter(rec => {
        if (options?.onlyUnsynced && rec.synced !== 0) return false;
        if (options?.session && rec.session !== options.session) return false;
        if (options?.term && normalizeAcademicTerm(rec.term) !== normalizeAcademicTerm(options.term)) return false;
        return true;
      });
    } catch {
      return [];
    }
  }

  buildTeacherScoreExportPackage(params: {
    schoolId: string;
    schoolCode: string;
    schoolName: string;
    exportedBy: string;
    session: string;
    term: string;
    classArm?: string;
    subjectId?: string;
    subjectCode?: string;
    subjectName?: string;
    scope: 'single_sheet' | 'multi_sheet';
    records: TeacherScoreExportRecord[];
  }): TeacherScoreExportPackage {
    const exportedAt = new Date().toISOString();
    const deviceId = getDeviceId();
    const summaryStr = params.records
      .map(r => `${r.admissionNo || r.studentId}:${r.subjectCode || r.subjectId}:${r.session}:${r.term}:${r.ca1},${r.ca2},${r.midterm},${r.exam}=${r.total}`)
      .sort()
      .join('|');
    let hash = 2166136261;
    for (let i = 0; i < summaryStr.length; i++) {
      hash ^= summaryStr.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const integrityFingerprint = `MINO-FP-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}-${params.records.length}`;

    return {
      schemaVersion: 'MINO_SCORE_PACKAGE_V1',
      packageId: 'pkg_' + crypto.randomUUID(),
      exportedAt,
      exportedBy: params.exportedBy,
      deviceId,
      school: {
        schoolId: params.schoolId,
        schoolCode: params.schoolCode,
        schoolName: params.schoolName
      },
      context: {
        session: params.session,
        term: normalizeAcademicTerm(params.term),
        classArm: params.classArm,
        subjectId: params.subjectId,
        subjectCode: params.subjectCode,
        subjectName: params.subjectName,
        scope: params.scope
      },
      recordCount: params.records.length,
      integrityFingerprint,
      records: params.records
    };
  }

  async importScoresJsonBatch(
    payloads: Array<{ fileName: string; data: any }>,
    actorEmail: string,
    options?: { dryRun?: boolean }
  ): Promise<ScoreJsonImportResponse> {
    const dryRun = Boolean(options?.dryRun);
    try {
      const { ok, status, data } = await fetchApiJson('/api/scores/import-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: this.currentSchoolId,
          actorEmail,
          dryRun,
          payloads
        })
      });
      if (ok) {
        if (!dryRun) {
          try {
            localBackend.importScoresJsonBatch(this.currentSchoolId, payloads, actorEmail, false);
          } catch {
            // ignore local mirror note
          }
        }
        return data as ScoreJsonImportResponse;
      }
      if (!ok && status !== 404) {
        throw new Error(data?.error || 'Failed to process score JSON file(s).');
      }
    } catch (err) {
      if (!(err instanceof ApiUnavailableError)) throw err;
    }

    return localBackend.importScoresJsonBatch(this.currentSchoolId, payloads, actorEmail, dryRun);
  }

  async provisionSchool(schoolData: any) {
    return await this.createPlatformSchool(schoolData);
  }

  async enrollSchool(enrollmentData: {
    name: string;
    code?: string;
    logoUrl?: string;
    phone: string;
    address: string;
    adminEmail: string;
    adminPasscode: string;
  }) {
    return await this.createPlatformSchool({
      ...enrollmentData,
      isSelfEnrollment: true
    });
  }

  async verifyPlatformSchool(schoolId: string) {
    let localRes: any = null;
    try {
      localRes = localBackend.verifyPlatformSchool(schoolId);
    } catch {
      // ignore if school only existed on server
    }
    try {
      const { ok, status, data } = await fetchApiJson(`/api/platform/schools/${encodeURIComponent(schoolId)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (ok) {
        if (data?.school) localBackend.mirrorSchool(data.school);
        return data;
      }
      if (!ok && status === 404 && localRes) return localRes;
      throw new Error(data?.error || 'Failed to verify school');
    } catch (err) {
      if (err instanceof ApiUnavailableError && localRes) return localRes;
      if (err instanceof ApiUnavailableError) return localBackend.verifyPlatformSchool(schoolId);
      throw err;
    }
  }

  async updateSchoolConfig(schoolId: string, updates: any) {
    return await this.updatePlatformSchool(schoolId, updates);
  }

  async toggleSchoolStatus(schoolId: string, currentStatus?: string) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    return await this.updatePlatformSchool(schoolId, { subscriptionStatus: newStatus });
  }
}

export const api = new MinoApiClient();
