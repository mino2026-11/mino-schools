/**
 * MINO-SMS Examination & Assessment Management Module
 * Complete implementation conforming to the Architecture Specification (Section 6):
 * 1. Continuous Assessment & Exam Marks Entry (Clearable score inputs + Offline local vault + Teacher JSON Export + Admin Smart Batch JSON Import)
 * 2. Examination Timetable & Schedule Management
 * 3. Candidate Digital Admit Cards Generator (with QR verification & printable hall passes)
 * 4. Consolidated Class Mark Sheet & Broadsheet Analytics
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Unlock,
  RefreshCw,
  Check,
  CloudOff,
  AlertTriangle,
  ArrowRight,
  Keyboard,
  Calendar,
  Award,
  FileSpreadsheet,
  Printer,
  Download,
  Upload,
  FileJson,
  HardDrive,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  User,
  BookOpen,
  X,
  Trash2,
  Delete
} from 'lucide-react';
import { api } from '../services/api';
import {
  ACADEMIC_TERMS,
  normalizeAcademicTerm,
  getSchoolLogoUrl,
  type AcademicTerm,
  type Student,
  type ScoreEvent,
  type Subject,
  type ClassArm,
  type SchoolTenant,
  type TeacherScoreExportRecord,
  type ScoreJsonImportResponse
} from '../types';

type ScoreFieldKey = 'ca1' | 'ca2' | 'midterm' | 'exam';
type DraftScoreRow = Record<ScoreFieldKey, string>;

interface GradebookProps {
  currentRole: string;
  userEmail: string;
  classes: ClassArm[];
  subjects: Subject[];
  tenant?: SchoolTenant | null;
  isReportsLocked: boolean;
  onToggleReportLock: (locked: boolean) => void;
  onSyncTriggered?: () => void;
  onScoresImported?: () => void;
  initialOpenImportModal?: boolean;
  onConsumeInitialImportModal?: () => void;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  session?: string;
  term?: string;
}

interface ExamScheduleItem {
  id: string;
  subjectCode: string;
  subjectName: string;
  paperTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  venue: string;
  invigilator: string;
}

interface StagedJsonFile {
  id: string;
  fileName: string;
  sizeBytes: number;
  parsedData: any | null;
  parseError?: string;
}

export const Gradebook: React.FC<GradebookProps> = ({
  currentRole,
  userEmail,
  classes,
  subjects,
  tenant,
  isReportsLocked,
  onToggleReportLock,
  onSyncTriggered,
  onScoresImported,
  initialOpenImportModal,
  onConsumeInitialImportModal,
  assignedClasses,
  assignedSubjects,
  session = '2025/2026',
  term = '2nd Term'
}) => {
  // Navigation tabs within Examination Management Module
  const [examTab, setExamTab] = useState<'scores' | 'schedule' | 'admit_cards' | 'broadsheet'>('scores');
  const [selectedTerm, setSelectedTerm] = useState<AcademicTerm>(normalizeAcademicTerm(term));
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    setSelectedTerm(normalizeAcademicTerm(term));
  }, [term]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // If teacher has assigned classes/subjects, restrict dropdown to them
  const filteredClasses =
    assignedClasses && assignedClasses.length > 0 && currentRole === 'teacher'
      ? classes.filter(c => assignedClasses.includes(c.name))
      : classes;

  const filteredSubjects =
    assignedSubjects && assignedSubjects.length > 0 && currentRole === 'teacher'
      ? subjects.filter(s => assignedSubjects.includes(s.id))
      : subjects;

  const [selectedClass, setSelectedClass] = useState(
    filteredClasses.find(c => c.name === 'JSS 1')?.name ||
      filteredClasses[0]?.name ||
      classes[0]?.name ||
      'JSS 1'
  );
  const [selectedSubject, setSelectedSubject] = useState(filteredSubjects[0]?.id || subjects[0]?.id || 'sub_math');
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreEvent>>({});
  const [loading, setLoading] = useState(true);
  const [savingSheet, setSavingSheet] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Local offline score stats & export menu state
  const [localStoredCount, setLocalStoredCount] = useState<number>(0);
  const [unsyncedOfflineCount, setUnsyncedOfflineCount] = useState<number>(0);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  // Admin Smart Batch JSON Import Modal state
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [stagedFiles, setStagedFiles] = useState<StagedJsonFile[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState<boolean>(false);
  const [verifyingImport, setVerifyingImport] = useState<boolean>(false);
  const [committingImport, setCommittingImport] = useState<boolean>(false);
  const [importPreview, setImportPreview] = useState<ScoreJsonImportResponse | null>(null);
  const [importCommittedResult, setImportCommittedResult] = useState<ScoreJsonImportResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFilter, setImportFilter] = useState<'all' | 'ready' | 'issues'>('all');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Admit Card selection
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<Student | null>(null);

  // Active cell for Desktop Keyboard Navigation
  const [activeCell, setActiveCell] = useState<{ rowIndex: number; colKey: ScoreFieldKey } | null>(null);
  const [mobileEntryStudentId, setMobileEntryStudentId] = useState<string | null>(null);
  const [mobileActiveField, setMobileActiveField] = useState<ScoreFieldKey>('ca1');

  // String-backed working copy of scores being edited so teachers can clear '0' to '' cleanly before typing
  const [editValues, setEditValues] = useState<Record<string, DraftScoreRow>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const COLS: ScoreFieldKey[] = ['ca1', 'ca2', 'midterm', 'exam'];
  const MAX_LIMITS: Record<ScoreFieldKey, number> = { ca1: 15, ca2: 15, midterm: 20, exam: 50 };

  const activeSubjectObj =
    subjects.find(s => s.id === selectedSubject) ||
    filteredSubjects.find(s => s.id === selectedSubject) || {
      id: selectedSubject,
      schoolId: tenant?.id || api.getSchoolId(),
      name: selectedSubject,
      code: selectedSubject.toUpperCase().slice(0, 4)
    };

  const canImportJson = currentRole === 'admin' || currentRole === 'head_teacher' || currentRole === 'super_admin';

  useEffect(() => {
    if (initialOpenImportModal && canImportJson) {
      setShowImportModal(true);
      if (onConsumeInitialImportModal) {
        onConsumeInitialImportModal();
      }
    }
  }, [initialOpenImportModal, canImportJson]);

  // Standard examination schedule for current class & term
  const examSchedules: ExamScheduleItem[] = [
    {
      id: 'sch_1',
      subjectCode: 'MTH',
      subjectName: 'Mathematics',
      paperTitle: 'Paper 1: Core Algebra & Geometry',
      date: '2026-03-23',
      startTime: '09:00 AM',
      endTime: '11:00 AM',
      durationMinutes: 120,
      venue: 'Main Examination Hall A',
      invigilator: 'Dr. Chukwuemeka Eze'
    },
    {
      id: 'sch_2',
      subjectCode: 'ENG',
      subjectName: 'English Language',
      paperTitle: 'Paper 2: Comprehension & Grammar',
      date: '2026-03-24',
      startTime: '09:00 AM',
      endTime: '11:00 AM',
      durationMinutes: 120,
      venue: 'Main Examination Hall A',
      invigilator: 'Mrs. Adebayo Funke'
    },
    {
      id: 'sch_3',
      subjectCode: 'SCI',
      subjectName: 'Basic Science & Technology',
      paperTitle: 'Theory & Applied Practical',
      date: '2026-03-25',
      startTime: '09:00 AM',
      endTime: '10:30 AM',
      durationMinutes: 90,
      venue: 'Science Laboratory Complex',
      invigilator: 'Mr. David Okafor'
    },
    {
      id: 'sch_4',
      subjectCode: 'SOC',
      subjectName: 'Social Studies',
      paperTitle: 'Citizenship & National Values',
      date: '2026-03-26',
      startTime: '09:00 AM',
      endTime: '10:30 AM',
      durationMinutes: 90,
      venue: 'Auditorium Hall B',
      invigilator: 'Mrs. Folake Bello'
    },
    {
      id: 'sch_5',
      subjectCode: 'BUS',
      subjectName: 'Business Studies',
      paperTitle: 'Office Practice & Book-keeping',
      date: '2026-03-27',
      startTime: '09:00 AM',
      endTime: '10:30 AM',
      durationMinutes: 90,
      venue: 'Auditorium Hall B',
      invigilator: 'Mr. Kenneth Ibrahim'
    }
  ];

  useEffect(() => {
    const activePool = filteredClasses.length > 0 ? filteredClasses : classes;
    if (activePool.length > 0 && !activePool.some(c => c.name === selectedClass)) {
      setSelectedClass(activePool.find(c => c.name === 'JSS 1')?.name || activePool[0].name);
    }
  }, [classes, assignedClasses, currentRole]);

  useEffect(() => {
    const subPool = filteredSubjects.length > 0 ? filteredSubjects : subjects;
    if (subPool.length > 0 && !subPool.some(s => s.id === selectedSubject)) {
      setSelectedSubject(subPool[0].id);
    }
  }, [subjects, assignedSubjects, currentRole]);

  useEffect(() => {
    loadGradebookData();
  }, [selectedClass, selectedSubject, session, selectedTerm]);

  async function refreshLocalScoreCounts() {
    const allLocal = await api.getLocalStoredScores();
    setLocalStoredCount(allLocal.length);
    setUnsyncedOfflineCount(allLocal.filter(r => r.synced === 0).length);
  }

  function parseDraftValue(raw: string | undefined, field: ScoreFieldKey): number {
    if (!raw || raw.trim() === '') return 0;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return 0;
    return Math.min(MAX_LIMITS[field], Math.max(0, parsed));
  }

  function getNumericRow(studentId: string): { ca1: number; ca2: number; midterm: number; exam: number } {
    const draft = editValues[studentId];
    return {
      ca1: parseDraftValue(draft?.ca1, 'ca1'),
      ca2: parseDraftValue(draft?.ca2, 'ca2'),
      midterm: parseDraftValue(draft?.midterm, 'midterm'),
      exam: parseDraftValue(draft?.exam, 'exam')
    };
  }

  async function loadGradebookData() {
    setLoading(true);
    try {
      const studentList = await api.getStudents(selectedClass, false);
      const scoreList = await api.getScores(selectedClass, selectedSubject, session, selectedTerm);

      setStudents(studentList);
      if (studentList.length > 0 && (!selectedStudentForCard || !studentList.some(s => s.id === selectedStudentForCard.id))) {
        setSelectedStudentForCard(studentList[0]);
      }

      const scoreMap: Record<string, ScoreEvent> = {};
      const initialEditMap: Record<string, DraftScoreRow> = {};

      scoreList.forEach(sc => {
        scoreMap[sc.studentId] = sc;
      });

      studentList.forEach(st => {
        const existing = scoreMap[st.id];
        initialEditMap[st.id] = {
          ca1: existing ? String(existing.ca1) : '0',
          ca2: existing ? String(existing.ca2) : '0',
          midterm: existing ? String(existing.midterm) : '0',
          exam: existing ? String(existing.exam) : '0'
        };
      });

      setScores(scoreMap);
      setEditValues(initialEditMap);
      await refreshLocalScoreCounts();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load gradebook records' });
    } finally {
      setLoading(false);
    }
  }

  /**
   * Allows teacher to completely clear '0' (leaving '' while editing) and type digits cleanly
   * without '0' sticking or prepending leading zeros.
   */
  function handleRawInputChange(studentId: string, field: ScoreFieldKey, rawInput: string) {
    if (isReportsLocked) return;

    // Allow empty string so Backspace / Delete clears '0' completely
    if (rawInput === '') {
      setEditValues(prev => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || { ca1: '0', ca2: '0', midterm: '0', exam: '0' }),
          [field]: ''
        }
      }));
      return;
    }

    // Keep only numeric digits
    const digitsOnly = rawInput.replace(/\D/g, '');
    if (digitsOnly === '') {
      setEditValues(prev => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || { ca1: '0', ca2: '0', midterm: '0', exam: '0' }),
          [field]: ''
        }
      }));
      return;
    }

    const max = MAX_LIMITS[field];
    const numeric = parseInt(digitsOnly, 10);
    const clamped = Math.min(max, Math.max(0, isNaN(numeric) ? 0 : numeric));

    setEditValues(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { ca1: '0', ca2: '0', midterm: '0', exam: '0' }),
        [field]: String(clamped)
      }
    }));
  }

  async function commitScoreRow(studentId: string, options?: { silent?: boolean; forceOfflineOnly?: boolean }) {
    if (isReportsLocked) return;
    const draft = editValues[studentId];
    if (!draft) return;

    const studentObj = students.find(s => s.id === studentId);
    const ca1 = parseDraftValue(draft.ca1, 'ca1');
    const ca2 = parseDraftValue(draft.ca2, 'ca2');
    const midterm = parseDraftValue(draft.midterm, 'midterm');
    const exam = parseDraftValue(draft.exam, 'exam');

    // Normalize any cleared '' fields to '0' on commit/blur
    setEditValues(prev => ({
      ...prev,
      [studentId]: {
        ca1: String(ca1),
        ca2: String(ca2),
        midterm: String(midterm),
        exam: String(exam)
      }
    }));

    try {
      const updated = await api.saveScore({
        studentId,
        subjectId: selectedSubject,
        classArm: studentObj?.classArm || selectedClass,
        ca1,
        ca2,
        midterm,
        exam,
        actorEmail: userEmail,
        session,
        term: selectedTerm,
        schoolCode: tenant?.code,
        schoolName: tenant?.name,
        admissionNo: studentObj?.admissionNo,
        firstName: studentObj?.firstName,
        lastName: studentObj?.lastName,
        gender: studentObj?.gender,
        email: studentObj?.email,
        subjectCode: activeSubjectObj.code,
        subjectName: activeSubjectObj.name,
        forceOfflineOnly: options?.forceOfflineOnly
      });

      const total = ca1 + ca2 + midterm + exam;
      const { grade, remark } = getGrade(total);
      const scoreEvent: ScoreEvent = {
        id: 'sc_' + studentId + '_' + selectedSubject + '_' + selectedTerm,
        clientChangeId: updated.clientChangeId,
        schoolId: api.getSchoolId(),
        studentId,
        subjectId: selectedSubject,
        session,
        term: selectedTerm,
        ca1,
        ca2,
        midterm,
        exam,
        total,
        grade: grade as ScoreEvent['grade'],
        remark,
        recordedBy: userEmail,
        deviceId: 'browser',
        timestamp: new Date().toISOString(),
        synced: Boolean(updated.synced)
      };

      setScores(prev => ({ ...prev, [studentId]: scoreEvent }));
      await refreshLocalScoreCounts();

      if (!options?.silent) {
        setFeedback({
          type: 'success',
          message: updated.synced
            ? 'Score saved locally and synced to official school ledger.'
            : 'Score saved offline on this device. You can download the JSON file anytime to send to Admin.'
        });
      }
      if (updated.synced && onSyncTriggered) onSyncTriggered();
    } catch (err: any) {
      if (!options?.silent) {
        setFeedback({ type: 'error', message: err.message || 'Failed to save score.' });
      }
    }
  }

  /**
   * Saves the entire active class/subject score sheet into local IndexedDB offline vault
   * (and syncs to server if online, or keeps safely queued offline when disconnected).
   */
  async function handleSaveEntireSheetOffline() {
    if (isReportsLocked || students.length === 0) return;
    setSavingSheet(true);
    try {
      for (const st of students) {
        await commitScoreRow(st.id, { silent: true });
      }
      await refreshLocalScoreCounts();
      setFeedback({
        type: 'success',
        message: isOnline
          ? `All ${students.length} pupil scores for ${selectedClass} (${activeSubjectObj.name}) saved offline & synced.`
          : `Offline Mode: All ${students.length} pupil scores for ${selectedClass} (${activeSubjectObj.name}) stored safely on this device.`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save class sheet.' });
    } finally {
      setSavingSheet(false);
    }
  }

  function triggerJsonFileDownload(filename: string, payloadObj: unknown) {
    const jsonString = JSON.stringify(payloadObj, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Exports current class + subject + term scores as a deterministic, self-verifying JSON file
   * that the teacher can send to the School Admin.
   */
  async function handleExportCurrentSheetJson() {
    setShowExportMenu(false);
    if (students.length === 0) {
      setFeedback({ type: 'error', message: `No pupils found in ${selectedClass} to export.` });
      return;
    }

    // Persist current edits locally first so offline store is 100% up-to-date
    if (!isReportsLocked) {
      for (const st of students) {
        await commitScoreRow(st.id, { silent: true });
      }
    }

    const schoolId = tenant?.id || api.getSchoolId();
    const schoolCode = tenant?.code || 'SCH-0000';
    const schoolName = tenant?.name || 'School Tenant';
    const nowIso = new Date().toISOString();

    const records: TeacherScoreExportRecord[] = students.map(st => {
      const nums = getNumericRow(st.id);
      const total = nums.ca1 + nums.ca2 + nums.midterm + nums.exam;
      const { grade, remark } = getGrade(total);
      return {
        recordKey: `${schoolId}::${st.id}::${selectedSubject}::${session}::${selectedTerm}`,
        schoolId,
        schoolCode,
        schoolName,
        studentId: st.id,
        admissionNo: st.admissionNo,
        firstName: st.firstName,
        lastName: st.lastName,
        fullName: `${st.firstName} ${st.lastName}`.trim(),
        gender: st.gender,
        email: st.email || '',
        classArm: st.classArm || selectedClass,
        subjectId: selectedSubject,
        subjectCode: activeSubjectObj.code,
        subjectName: activeSubjectObj.name,
        session,
        term: selectedTerm,
        ca1: nums.ca1,
        ca2: nums.ca2,
        midterm: nums.midterm,
        exam: nums.exam,
        total,
        grade: grade as TeacherScoreExportRecord['grade'],
        remark,
        recordedBy: userEmail,
        recordedAt: scores[st.id]?.timestamp || nowIso,
        clientChangeId: scores[st.id]?.clientChangeId
      };
    });

    const pkg = api.buildTeacherScoreExportPackage({
      schoolId,
      schoolCode,
      schoolName,
      exportedBy: userEmail,
      session,
      term: selectedTerm,
      classArm: selectedClass,
      subjectId: selectedSubject,
      subjectCode: activeSubjectObj.code,
      subjectName: activeSubjectObj.name,
      scope: 'single_sheet',
      records
    });

    const safeClass = selectedClass.replace(/[^a-zA-Z0-9]+/g, '_');
    const safeSub = (activeSubjectObj.code || activeSubjectObj.name).replace(/[^a-zA-Z0-9]+/g, '_');
    const safeTerm = selectedTerm.replace(/[^a-zA-Z0-9]+/g, '_');
    const filename = `mino-scores-${schoolCode}-${safeClass}-${safeSub}-${safeTerm}.json`;

    triggerJsonFileDownload(filename, pkg);
    setFeedback({
      type: 'success',
      message: `Downloaded ${records.length} pupil score records (${selectedClass} · ${activeSubjectObj.name}) as "${filename}". Send this JSON file to your School Admin.`
    });
  }

  /**
   * Exports ALL locally stored offline/recorded teacher scores across all classes & subjects on this device
   */
  async function handleExportAllStoredOfflineJson() {
    setShowExportMenu(false);
    // Commit active sheet first if unlocked
    if (!isReportsLocked && students.length > 0) {
      for (const st of students) {
        await commitScoreRow(st.id, { silent: true });
      }
    }

    const stored = await api.getLocalStoredScores();
    if (stored.length === 0) {
      setFeedback({ type: 'error', message: 'No locally stored scores found yet. Enter scores first or export the current sheet.' });
      return;
    }

    const schoolId = tenant?.id || api.getSchoolId();
    const schoolCode = tenant?.code || 'SCH-0000';
    const schoolName = tenant?.name || 'School Tenant';

    const cleanRecords: TeacherScoreExportRecord[] = stored.map(({ synced: _s, deviceId: _d, ...rest }) => ({
      ...rest,
      schoolCode: rest.schoolCode || schoolCode,
      schoolName: rest.schoolName || schoolName
    }));

    const pkg = api.buildTeacherScoreExportPackage({
      schoolId,
      schoolCode,
      schoolName,
      exportedBy: userEmail,
      session,
      term: selectedTerm,
      scope: 'multi_sheet',
      records: cleanRecords
    });

    const dateStamp = new Date().toISOString().split('T')[0];
    const filename = `mino-scores-${schoolCode}-all-stored-${cleanRecords.length}-records-${dateStamp}.json`;
    triggerJsonFileDownload(filename, pkg);
    setFeedback({
      type: 'success',
      message: `Downloaded all ${cleanRecords.length} locally stored score records across classes/subjects as "${filename}".`
    });
  }

  // --- ADMIN MULTI-FILE SMART JSON IMPORT HANDLERS ---
  async function runSmartDryRunPreview(filesToAnalyze: StagedJsonFile[]) {
    const validPayloads = filesToAnalyze
      .filter(f => f.parsedData !== null && !f.parseError)
      .map(f => ({ fileName: f.fileName, data: f.parsedData }));

    if (validPayloads.length === 0) {
      setImportPreview(null);
      return;
    }

    setVerifyingImport(true);
    setImportError(null);
    try {
      const preview = await api.importScoresJsonBatch(validPayloads, userEmail, { dryRun: true });
      setImportPreview(preview);
    } catch (err: any) {
      setImportError(err.message || 'Smart verification failed while analyzing JSON files.');
      setImportPreview(null);
    } finally {
      setVerifyingImport(false);
    }
  }

  async function handleFilesSelected(fileList: FileList | File[]) {
    const incomingFiles = Array.from(fileList);
    if (incomingFiles.length === 0) return;

    setImportCommittedResult(null);
    setImportError(null);

    const newlyParsed: StagedJsonFile[] = await Promise.all(
      incomingFiles.map(async file => {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          return {
            id: `${file.name}_${file.size}_${Math.random().toString(36).slice(2, 7)}`,
            fileName: file.name,
            sizeBytes: file.size,
            parsedData: parsed
          };
        } catch {
          return {
            id: `${file.name}_${file.size}_${Math.random().toString(36).slice(2, 7)}`,
            fileName: file.name,
            sizeBytes: file.size,
            parsedData: null,
            parseError: 'Invalid JSON syntax in file'
          };
        }
      })
    );

    const combined = [...stagedFiles, ...newlyParsed];
    setStagedFiles(combined);
    await runSmartDryRunPreview(combined);
  }

  async function handleRemoveStagedFile(fileId: string) {
    const remaining = stagedFiles.filter(f => f.id !== fileId);
    setStagedFiles(remaining);
    setImportCommittedResult(null);
    if (remaining.length === 0) {
      setImportPreview(null);
      setImportError(null);
    } else {
      await runSmartDryRunPreview(remaining);
    }
  }

  function handleResetImportModal() {
    setStagedFiles([]);
    setImportPreview(null);
    setImportCommittedResult(null);
    setImportError(null);
    setImportFilter('all');
  }

  async function handleCommitSmartImport() {
    const validPayloads = stagedFiles
      .filter(f => f.parsedData !== null && !f.parseError)
      .map(f => ({ fileName: f.fileName, data: f.parsedData }));

    if (validPayloads.length === 0) return;

    setCommittingImport(true);
    setImportError(null);
    try {
      const committed = await api.importScoresJsonBatch(validPayloads, userEmail, { dryRun: false });
      setImportCommittedResult(committed);
      setImportPreview(committed);
      await loadGradebookData();
      if (onScoresImported) onScoresImported();
      if (onSyncTriggered) onSyncTriggered();
      setFeedback({
        type: 'success',
        message: `Smart JSON Import Complete: Automatically matched and updated ${committed.appliedCount} pupil score records (${committed.createdCount} new, ${committed.updatedCount} updated) with zero mix-ups.`
      });
    } catch (err: any) {
      setImportError(err.message || 'Failed to apply verified student score records.');
    } finally {
      setCommittingImport(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, rowIndex: number, colKey: ScoreFieldKey, studentId: string) {
    const colIndex = COLS.indexOf(colKey);

    if (e.key === 'ArrowRight' || e.key === 'Tab') {
      e.preventDefault();
      commitScoreRow(studentId, { silent: true });
      if (colIndex < COLS.length - 1) {
        const nextCol = COLS[colIndex + 1];
        setActiveCell({ rowIndex, colKey: nextCol });
        inputRefs.current[`${rowIndex}_${nextCol}`]?.focus();
      } else if (rowIndex < students.length - 1) {
        setActiveCell({ rowIndex: rowIndex + 1, colKey: COLS[0] });
        inputRefs.current[`${rowIndex + 1}_${COLS[0]}`]?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      commitScoreRow(studentId, { silent: true });
      if (colIndex > 0) {
        const prevCol = COLS[colIndex - 1];
        setActiveCell({ rowIndex, colKey: prevCol });
        inputRefs.current[`${rowIndex}_${prevCol}`]?.focus();
      } else if (rowIndex > 0) {
        setActiveCell({ rowIndex: rowIndex - 1, colKey: COLS[COLS.length - 1] });
        inputRefs.current[`${rowIndex - 1}_${COLS[COLS.length - 1]}`]?.focus();
      }
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      commitScoreRow(studentId);
      if (rowIndex < students.length - 1) {
        setActiveCell({ rowIndex: rowIndex + 1, colKey });
        inputRefs.current[`${rowIndex + 1}_${colKey}`]?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      commitScoreRow(studentId, { silent: true });
      if (rowIndex > 0) {
        setActiveCell({ rowIndex: rowIndex - 1, colKey });
        inputRefs.current[`${rowIndex - 1}_${colKey}`]?.focus();
      }
    } else if (e.key === 'Escape') {
      setActiveCell(null);
      (e.target as HTMLInputElement).blur();
    }
  }

  function handleMobileKeypadDigit(digit: number) {
    if (!mobileEntryStudentId || isReportsLocked) return;
    const currentRaw = editValues[mobileEntryStudentId]?.[mobileActiveField] ?? '';
    const nextStr = currentRaw === '' || currentRaw === '0' ? String(digit) : `${currentRaw}${digit}`;
    handleRawInputChange(mobileEntryStudentId, mobileActiveField, nextStr);
  }

  function handleMobileKeypadBackspace() {
    if (!mobileEntryStudentId || isReportsLocked) return;
    const currentRaw = editValues[mobileEntryStudentId]?.[mobileActiveField] ?? '';
    const shortened = currentRaw.length <= 1 ? '' : currentRaw.slice(0, -1);
    handleRawInputChange(mobileEntryStudentId, mobileActiveField, shortened);
  }

  function handleMobileKeypadClear() {
    if (!mobileEntryStudentId || isReportsLocked) return;
    handleRawInputChange(mobileEntryStudentId, mobileActiveField, '');
  }

  function handleMobileKeypadNext() {
    if (!mobileEntryStudentId) return;
    commitScoreRow(mobileEntryStudentId);
    const colIndex = COLS.indexOf(mobileActiveField);
    const studentIndex = students.findIndex(s => s.id === mobileEntryStudentId);

    if (colIndex < COLS.length - 1) {
      setMobileActiveField(COLS[colIndex + 1]);
    } else if (studentIndex < students.length - 1) {
      setMobileEntryStudentId(students[studentIndex + 1].id);
      setMobileActiveField(COLS[0]);
    }
  }

  function getGrade(total: number): { grade: string; remark: string } {
    if (total >= 70) return { grade: 'A', remark: 'Distinction' };
    if (total >= 60) return { grade: 'B', remark: 'Very Good' };
    if (total >= 50) return { grade: 'C', remark: 'Credit' };
    if (total >= 45) return { grade: 'D', remark: 'Pass' };
    if (total >= 40) return { grade: 'E', remark: 'Marginal Pass' };
    return { grade: 'F', remark: 'Needs Support' };
  }

  // Broadsheet statistics
  const broadsheetRows = students
    .map(st => {
      const nums = getNumericRow(st.id);
      const total = nums.ca1 + nums.ca2 + nums.midterm + nums.exam;
      const { grade, remark } = getGrade(total);
      return {
        student: st,
        nums,
        total,
        grade,
        remark
      };
    })
    .sort((a, b) => b.total - a.total);

  const classAvgScore =
    broadsheetRows.length > 0
      ? Math.round(broadsheetRows.reduce((acc, r) => acc + r.total, 0) / broadsheetRows.length)
      : 0;

  const highestScore = broadsheetRows.length > 0 ? broadsheetRows[0].total : 0;
  const lowestScore = broadsheetRows.length > 0 ? broadsheetRows[broadsheetRows.length - 1].total : 0;
  const passCount = broadsheetRows.filter(r => r.total >= 50).length;
  const passRate = broadsheetRows.length > 0 ? Math.round((passCount / broadsheetRows.length) * 100) : 0;

  const filteredPreviewDetails = (importPreview?.details || []).filter(item => {
    if (importFilter === 'ready') return item.status === 'created' || item.status === 'updated';
    if (importFilter === 'issues') return item.status !== 'created' && item.status !== 'updated';
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Module Title Banner & Workflow Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              Examinations & Academic Assessments
            </h1>
            {!isOnline && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-[11px] font-semibold text-amber-900">
                <CloudOff className="w-3 h-3 text-amber-700" />
                Offline Score Vault Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {session} · {selectedTerm} — Offline-ready score entry, downloadable teacher JSON sheets, and smart student score matching.
          </p>
        </div>

        {/* Action Strip: Teacher Offline Save/JSON Export + Admin Batch JSON Upload + Term Lock */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          {/* Save Sheet Offline Button */}
          <button
            type="button"
            disabled={isReportsLocked || savingSheet || students.length === 0}
            onClick={handleSaveEntireSheetOffline}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors disabled:opacity-50"
            title="Save all scores on this sheet locally so they work offline and can be exported anytime"
          >
            <HardDrive className="w-3.5 h-3.5 text-slate-700" />
            <span>{savingSheet ? 'Saving...' : 'Save Scores Offline'}</span>
            {unsyncedOfflineCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 font-mono text-[10px] font-bold">
                {unsyncedOfflineCount}
              </span>
            )}
          </button>

          {/* Teacher / Staff Download JSON Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Download Scores JSON</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1.5 space-y-1">
                <button
                  type="button"
                  onClick={handleExportCurrentSheetJson}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-start gap-2.5"
                >
                  <FileJson className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Current Class Sheet ({selectedClass})
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Export {students.length} pupils · {activeSubjectObj.name} ({selectedTerm})
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportAllStoredOfflineJson}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-start gap-2.5 border-t border-slate-100"
                >
                  <HardDrive className="w-4 h-4 text-[#065F46] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      All Offline / Stored Scores ({localStoredCount})
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Bundle all classes & subjects saved on this device into one JSON file
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Admin Multi-File Smart JSON Upload Button */}
          {canImportJson && (
            <button
              type="button"
              onClick={() => {
                setShowExportMenu(false);
                setShowImportModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#065F46] hover:bg-[#064E3B] text-white shadow-2xs transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-300" />
              <span>Upload Teacher JSON</span>
            </button>
          )}

          {/* Term Lock Controls (Admin only) */}
          {currentRole === 'admin' && (
            <button
              type="button"
              onClick={() => onToggleReportLock(!isReportsLocked)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border shadow-2xs ${
                isReportsLocked
                  ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
              }`}
            >
              {isReportsLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Terminal Lock Active</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Lock Term Grades</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs matching Section 6 of Architecture Guide */}
      <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs no-print">
        <button
          onClick={() => setExamTab('scores')}
          className={`flex-1 py-2 font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${
            examTab === 'scores' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-[#B45309]" />
          <span>Grade Entry Matrix</span>
        </button>

        <button
          onClick={() => setExamTab('schedule')}
          className={`flex-1 py-2 font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${
            examTab === 'schedule' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-blue-700" />
          <span>Examination Timetable</span>
        </button>

        <button
          onClick={() => setExamTab('admit_cards')}
          className={`flex-1 py-2 font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${
            examTab === 'admit_cards' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-purple-700" />
          <span>Candidate Admit Cards</span>
        </button>

        <button
          onClick={() => setExamTab('broadsheet')}
          className={`flex-1 py-2 font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${
            examTab === 'broadsheet' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#065F46]" />
          <span>Broadsheet & Analytics</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border shadow-2xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="font-bold text-slate-400 hover:text-slate-700 ml-2">
            ✕
          </button>
        </div>
      )}

      {/* 1. GRADE ENTRY MATRIX TAB */}
      {examTab === 'scores' && (
        <div className="space-y-4">
          {/* Class, Subject & Term Selector Header */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Select Class
                </label>
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                >
                  {filteredClasses.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Select Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={e => setSelectedSubject(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                >
                  {filteredSubjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  School Term
                </label>
                <select
                  value={selectedTerm}
                  onChange={e => setSelectedTerm(e.target.value as AcademicTerm)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                >
                  {ACADEMIC_TERMS.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="hidden md:inline font-mono">
                Weighting: CA1 (15) + CA2 (15) + Midterm (20) + Exam (50) = 100
              </span>
              <button
                onClick={loadGradebookData}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                title="Reload scores"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scores Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Pupil Name</th>
                    <th className="py-3 px-4 text-center w-24">CA 1 (15)</th>
                    <th className="py-3 px-4 text-center w-24">CA 2 (15)</th>
                    <th className="py-3 px-4 text-center w-24">Mid (20)</th>
                    <th className="py-3 px-4 text-center w-24">Exam (50)</th>
                    <th className="py-3 px-4 text-center w-28 font-bold">Total (100)</th>
                    <th className="py-3 px-4 text-center w-20">Grade</th>
                    <th className="py-3 px-4">Evaluation Remark</th>
                    <th className="py-3 px-4 text-center w-28">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        Loading gradebook matrix...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No pupils enrolled in {selectedClass}.
                      </td>
                    </tr>
                  ) : (
                    students.map((student, rowIndex) => {
                      const draftRow = editValues[student.id] || { ca1: '0', ca2: '0', midterm: '0', exam: '0' };
                      const nums = getNumericRow(student.id);
                      const total = nums.ca1 + nums.ca2 + nums.midterm + nums.exam;
                      const { grade, remark } = getGrade(total);
                      const savedScore = scores[student.id];

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 text-center font-mono text-slate-400">
                            {rowIndex + 1}
                          </td>

                          <td className="py-3 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>
                                {student.firstName} {student.lastName}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">({student.admissionNo})</span>
                            </div>
                          </td>

                          {COLS.map(fieldKey => (
                            <td key={fieldKey} className="py-2 px-2 text-center">
                              <input
                                ref={el => {
                                  inputRefs.current[`${rowIndex}_${fieldKey}`] = el;
                                }}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="0"
                                disabled={isReportsLocked}
                                value={draftRow[fieldKey]}
                                onChange={e => handleRawInputChange(student.id, fieldKey, e.target.value)}
                                onKeyDown={e => handleKeyDown(e, rowIndex, fieldKey, student.id)}
                                onBlur={() => commitScoreRow(student.id)}
                                onFocus={e => {
                                  setActiveCell({ rowIndex, colKey: fieldKey });
                                  setMobileEntryStudentId(student.id);
                                  setMobileActiveField(fieldKey);
                                  e.currentTarget.select();
                                }}
                                className={`w-16 px-2 py-1 text-center text-xs font-semibold rounded-md border font-tabular placeholder:text-slate-300 ${
                                  activeCell?.rowIndex === rowIndex && activeCell?.colKey === fieldKey
                                    ? 'border-[#B45309] bg-amber-50 ring-1 ring-[#B45309]'
                                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                } disabled:bg-slate-100 disabled:text-slate-400`}
                              />
                            </td>
                          ))}

                          {/* Total */}
                          <td className="py-3 px-4 text-center font-bold text-slate-900 font-tabular text-sm">
                            {total}
                          </td>

                          {/* Grade Badge */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                grade === 'A'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : grade === 'B'
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : grade === 'C'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : grade === 'D' || grade === 'E'
                                  ? 'bg-orange-50 text-orange-800 border border-orange-200'
                                  : 'bg-red-50 text-red-800 border border-red-200'
                              }`}
                            >
                              {grade}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-xs text-slate-600">{remark}</td>

                          <td className="py-3 px-4 text-center">
                            {savedScore ? (
                              savedScore.synced ? (
                                <span className="text-[10px] font-semibold text-emerald-700 inline-flex items-center justify-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-600" /> Synced
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-flex items-center justify-center gap-1">
                                  <HardDrive className="w-3 h-3 text-amber-700" /> Saved Offline
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400">Unsaved</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  Backspace clears 0 cleanly. Scores save offline automatically on cell blur and can be downloaded as JSON anytime.
                </span>
              </span>
              <span className="font-tabular font-medium shrink-0">
                {students.length} pupils · {localStoredCount} local records stored
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. EXAMINATION TIMETABLE & SCHEDULE TAB */}
      {examTab === 'schedule' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-100 gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Terminal Examination Timetable ({selectedClass})
              </h3>
              <p className="text-xs text-slate-500">
                Official scheduled examination papers, venues, and chief invigilators
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Schedule</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-4">Date & Day</th>
                  <th className="py-3 px-4">Time & Duration</th>
                  <th className="py-3 px-4">Subject & Paper</th>
                  <th className="py-3 px-4">Examination Venue</th>
                  <th className="py-3 px-4">Chief Invigilator</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {examSchedules.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {new Date(item.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-tabular">
                      <div className="font-semibold text-slate-800">
                        {item.startTime} - {item.endTime}
                      </div>
                      <div className="text-[10px] text-slate-400">{item.durationMinutes} minutes</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {item.subjectName} ({item.subjectCode})
                      </div>
                      <div className="text-[11px] text-slate-500">{item.paperTitle}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{item.venue}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 font-medium">{item.invigilator}</td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                        Scheduled
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CANDIDATE DIGITAL ADMIT CARDS GENERATOR TAB */}
      {examTab === 'admit_cards' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Class Arm
                </label>
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-900"
                >
                  {filteredClasses.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Select Pupil
                </label>
                <select
                  value={selectedStudentForCard?.id || ''}
                  onChange={e => {
                    const st = students.find(s => s.id === e.target.value);
                    if (st) setSelectedStudentForCard(st);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-900"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.admissionNo})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-2xs transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Print Official Admit Card</span>
              </button>
            </div>
          </div>

          {/* Admit Card High-Fidelity Printable Document */}
          {selectedStudentForCard ? (
            <div className="max-w-2xl mx-auto bg-white border-2 border-slate-800 rounded-xl p-6 sm:p-8 shadow-md space-y-6 print:border-black print:shadow-none">
              <div className="border-b-2 border-slate-800 pb-4 text-center relative">
                <div className="flex justify-center mb-2">
                  <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shadow-2xs overflow-hidden">
                    <img
                      src={getSchoolLogoUrl(tenant)}
                      alt={`${tenant?.name || 'School'} Logo`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide">
                  {tenant?.name || 'Institutional Examination Council'}
                </h2>
                <p className="text-xs font-semibold text-slate-600">
                  Official Examination Admit Card & Candidate Hall Pass
                </p>
                <div className="inline-block mt-2 px-3 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-[11px] font-mono font-bold text-slate-800">
                  {session} Academic Session · {selectedTerm}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-300 rounded-lg text-xs">
                <div className="col-span-2 space-y-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Candidate Full Name
                    </span>
                    <span className="text-base font-bold text-slate-900">
                      {selectedStudentForCard.firstName} {selectedStudentForCard.lastName}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Admission Number
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {selectedStudentForCard.admissionNo}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Class & Stream
                      </span>
                      <span className="font-semibold text-slate-800">{selectedStudentForCard.classArm}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Assigned Seat No
                      </span>
                      <span className="font-mono font-bold text-[#B45309]">
                        {selectedClass.substring(0, 3)}-{selectedStudentForCard.admissionNo.slice(-3)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Clearance Status
                      </span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Fully Cleared
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center border-l border-slate-200 pl-4">
                  <div className="w-24 h-28 bg-slate-200 border-2 border-slate-400 rounded-md flex flex-col items-center justify-center text-slate-500 text-xs text-center p-2">
                    <User className="w-8 h-8 text-slate-400 mb-1" />
                    <span className="text-[9px] font-mono uppercase">Verified Candidate Photo</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Registered Examination Papers & Timetable
                </h4>
                <table className="w-full text-left text-xs border border-slate-300">
                  <thead className="bg-slate-100 border-b border-slate-300 text-[10px] uppercase font-bold text-slate-700">
                    <tr>
                      <th className="p-2">Subject</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Time</th>
                      <th className="p-2">Hall / Venue</th>
                      <th className="p-2 text-center">Invigilator Sign</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {examSchedules.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-semibold text-slate-800">{item.subjectName}</td>
                        <td className="p-2 font-tabular text-slate-600">{item.date}</td>
                        <td className="p-2 font-tabular text-slate-600">{item.startTime}</td>
                        <td className="p-2 text-slate-600">{item.venue}</td>
                        <td className="p-2 border-l border-slate-200 text-center text-slate-300 font-mono text-[10px]">
                          [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                <div className="space-y-1 text-slate-500 text-[11px] max-w-sm">
                  <span className="font-bold text-slate-700 block">Candidate Instructions:</span>
                  <p>1. Present this original physical admit card at the entrance of the examination hall.</p>
                  <p>2. Electronic communication devices and unauthorized paper materials are strictly prohibited.</p>
                </div>

                <div className="flex flex-col items-center p-2 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="font-mono text-center text-[10px] font-bold text-slate-800">
                    ||||| | |||| || |||||| | ||||
                  </div>
                  <span className="font-mono text-[9px] text-slate-400 mt-1">
                    CERT-AUTH-{selectedStudentForCard.admissionNo}-2026
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
              No pupil selected for admit card generation.
            </div>
          )}
        </div>
      )}

      {/* 4. CONSOLIDATED CLASS MARK SHEET & BROADSHEET TAB */}
      {examTab === 'broadsheet' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Class Average</span>
              <div className="text-2xl font-bold text-slate-900 font-tabular mt-1">{classAvgScore}%</div>
              <span className="text-[11px] text-slate-400">Mean composite score</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Highest Score</span>
              <div className="text-2xl font-bold text-[#065F46] font-tabular mt-1">{highestScore}%</div>
              <span className="text-[11px] text-slate-400">Class valedictorian</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Lowest Score</span>
              <div className="text-2xl font-bold text-slate-700 font-tabular mt-1">{lowestScore}%</div>
              <span className="text-[11px] text-slate-400">Intervention required</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pass Rate</span>
              <div className="text-2xl font-bold text-[#B45309] font-tabular mt-1">{passRate}%</div>
              <span className="text-[11px] text-slate-400">
                {passCount} of {broadsheetRows.length} passed
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Academic Performance Broadsheet ({selectedClass})
                </h3>
                <p className="text-xs text-slate-500">
                  Student rankings, cumulative scores, and official promotional decisions
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Broadsheet</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold">
                  <tr>
                    <th className="py-3 px-4 w-16 text-center">Rank</th>
                    <th className="py-3 px-4">Pupil Name</th>
                    <th className="py-3 px-4">Admission No</th>
                    <th className="py-3 px-4 text-center">CA Subtotal (50)</th>
                    <th className="py-3 px-4 text-center">Exam (50)</th>
                    <th className="py-3 px-4 text-center font-bold">Total (100)</th>
                    <th className="py-3 px-4 text-center">Grade</th>
                    <th className="py-3 px-4">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {broadsheetRows.map((row, index) => {
                    const caSubtotal = row.nums.ca1 + row.nums.ca2 + row.nums.midterm;
                    const examVal = row.nums.exam;
                    return (
                      <tr key={row.student.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-center font-bold font-tabular">
                          {index === 0 ? '🥇 1st' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : `${index + 1}th`}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {row.student.firstName} {row.student.lastName}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">{row.student.admissionNo}</td>
                        <td className="py-3.5 px-4 text-center font-tabular text-slate-700">{caSubtotal}</td>
                        <td className="py-3.5 px-4 text-center font-tabular text-slate-700">{examVal}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-900 font-tabular text-sm">
                          {row.total}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                              row.grade === 'A'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : row.grade === 'B'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : row.grade === 'C'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                            }`}
                          >
                            {row.grade}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                          {row.total >= 50 ? (
                            <span className="text-emerald-700">Recommended for Promotion</span>
                          ) : (
                            <span className="text-amber-700">Academic Intervention Required</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN MULTI-FILE SMART STUDENT SCORE JSON IMPORT MODAL */}
      {showImportModal && canImportJson && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#065F46] text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Smart Batch Teacher Score JSON Importer
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Upload any number of teacher JSON files at once — multi-factor identity matching updates exact pupil records without mix-ups.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Multi-File Dropzone */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDraggingFiles(true);
                }}
                onDragLeave={() => setIsDraggingFiles(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDraggingFiles(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  isDraggingFiles
                    ? 'border-[#065F46] bg-emerald-50/70'
                    : 'border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  multiple
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFilesSelected(e.target.files);
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
                <FileJson className="w-8 h-8 text-[#065F46] mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-900">
                  Click to select or drag & drop one or multiple Teacher Score JSON files
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supports unlimited `.json` files across classes, subjects, and terms ({tenant?.name || 'Active School'} · {tenant?.code || ''})
                </p>
              </div>

              {/* Staged Files List */}
              {stagedFiles.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Staged JSON Files ({stagedFiles.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleResetImportModal}
                      className="text-[11px] font-semibold text-red-700 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Clear All Files
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {stagedFiles.map(file => (
                      <div
                        key={file.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                          file.parseError
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <FileJson className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[200px]">{file.fileName}</span>
                        {file.parseError && <span className="text-[10px] font-bold">(Invalid JSON)</span>}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleRemoveStagedFile(file.id);
                          }}
                          className="text-slate-400 hover:text-red-600 ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {verifyingImport && (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
                  Running deterministic pupil, admission number, class, and subject verification...
                </div>
              )}

              {/* Smart Verification Summary & Detailed Match Table */}
              {importPreview && !verifyingImport && (
                <div className="space-y-3">
                  {importCommittedResult && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        Successfully applied {importCommittedResult.appliedCount} student score records ({importCommittedResult.createdCount} new, {importCommittedResult.updatedCount} updated) to official academic records.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="text-[10px] font-bold uppercase text-emerald-800">
                        Verified & Matched
                      </div>
                      <div className="text-xl font-bold text-emerald-950 font-tabular mt-0.5">
                        {importPreview.appliedCount}
                      </div>
                      <div className="text-[10px] text-emerald-700">
                        {importPreview.createdCount} new · {importPreview.updatedCount} updates
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-bold uppercase text-slate-500">
                        Total Records Scanned
                      </div>
                      <div className="text-xl font-bold text-slate-900 font-tabular mt-0.5">
                        {importPreview.totalReceived}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {importPreview.deduplicatedCount} older duplicates merged
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <div className="text-[10px] font-bold uppercase text-red-800">
                        Identity Conflicts Blocked
                      </div>
                      <div className="text-xl font-bold text-red-900 font-tabular mt-0.5">
                        {importPreview.conflictCount}
                      </div>
                      <div className="text-[10px] text-red-700">
                        Zero-mixup guard active
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="text-[10px] font-bold uppercase text-amber-800">
                        Unmatched / Invalid
                      </div>
                      <div className="text-xl font-bold text-amber-950 font-tabular mt-0.5">
                        {importPreview.unmatchedCount + importPreview.invalidCount}
                      </div>
                      <div className="text-[10px] text-amber-800">
                        Safely skipped
                      </div>
                    </div>
                  </div>

                  {/* Filter Tabs for Preview Table */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setImportFilter('all')}
                        className={`px-2.5 py-1 rounded-md font-semibold ${
                          importFilter === 'all'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All ({importPreview.details.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportFilter('ready')}
                        className={`px-2.5 py-1 rounded-md font-semibold ${
                          importFilter === 'ready'
                            ? 'bg-[#065F46] text-white'
                            : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Verified Matches ({importPreview.appliedCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportFilter('issues')}
                        className={`px-2.5 py-1 rounded-md font-semibold ${
                          importFilter === 'issues'
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Skipped / Warnings ({importPreview.details.length - importPreview.appliedCount})
                      </button>
                    </div>
                  </div>

                  {/* Verification Rows Table */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Pupil & Admission No</th>
                          <th className="py-2 px-3">Class · Subject · Term</th>
                          <th className="py-2 px-3 text-center">CA1/CA2/Mid/Exam</th>
                          <th className="py-2 px-3 text-center">Total</th>
                          <th className="py-2 px-3">Smart Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPreviewDetails.map(row => {
                          const isReady = row.status === 'created' || row.status === 'updated';
                          return (
                            <tr key={`${row.sourceFile}_${row.index}`} className="hover:bg-slate-50">
                              <td className="py-2 px-3">
                                <div className="font-bold text-slate-900">{row.studentName}</div>
                                <div className="font-mono text-[10px] text-slate-500">
                                  {row.admissionNo} · <span className="text-slate-400">{row.sourceFile}</span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                <div className="font-semibold">
                                  {row.classArm} · {row.subjectName}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {row.session} · {row.term}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-slate-700">
                                {row.ca1} / {row.ca2} / {row.midterm} / {row.exam}
                              </td>
                              <td className="py-2 px-3 text-center font-tabular font-bold text-slate-900">
                                {isReady ? (
                                  <div>
                                    <span>
                                      {row.total} ({row.grade})
                                    </span>
                                    {row.previousTotal !== null && row.previousTotal !== undefined && (
                                      <div className="text-[10px] font-normal text-slate-400">
                                        was {row.previousTotal}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {isReady ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px]">
                                      <Check className="w-2.5 h-2.5" />
                                      {row.status === 'created' ? 'New Record' : 'Update Match'}
                                    </span>
                                    <div className="text-[10px] text-slate-500 mt-0.5">{row.matchMethod}</div>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-800 font-bold text-[10px]">
                                      {row.status.replace(/_/g, ' ')}
                                    </span>
                                    {row.reason && (
                                      <div className="text-[10px] text-red-700 mt-0.5 leading-snug">{row.reason}</div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500">
                Only 100% deterministically verified pupil records are applied; ambiguous or mismatched rows are never mixed.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                >
                  {importCommittedResult ? 'Done' : 'Cancel'}
                </button>
                {!importCommittedResult && (
                  <button
                    type="button"
                    disabled={!importPreview || importPreview.appliedCount === 0 || committingImport || verifyingImport}
                    onClick={handleCommitSmartImport}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#065F46] hover:bg-[#064E3B] text-white shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    <span>
                      {committingImport
                        ? 'Updating Records...'
                        : `Apply ${importPreview?.appliedCount || 0} Verified Student Scores`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Thumb Keypad for Scores Entry */}
      {mobileEntryStudentId && examTab === 'scores' && (
        <div className="block sm:hidden fixed bottom-16 left-0 right-0 z-40 bg-white border-t-2 border-slate-900 p-3 shadow-2xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div className="text-xs font-bold text-slate-900 truncate">
              {students.find(s => s.id === mobileEntryStudentId)?.firstName}{' '}
              {students.find(s => s.id === mobileEntryStudentId)?.lastName}
            </div>
            <div className="flex gap-1">
              {COLS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setMobileActiveField(c)}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-[3px] uppercase ${
                    mobileActiveField === c ? 'bg-[#0F172A] text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {c} ({MAX_LIMITS[c]})
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(digit => (
              <button
                key={digit}
                type="button"
                onClick={() => handleMobileKeypadDigit(digit)}
                className="h-11 flex items-center justify-center rounded-[4px] bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-base border border-slate-300 active:bg-slate-300"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleMobileKeypadBackspace}
              className="h-11 flex items-center justify-center gap-1 rounded-[4px] bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs border border-amber-200"
            >
              <Delete className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleMobileKeypadClear}
              className="h-11 col-span-2 flex items-center justify-center rounded-[4px] bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs border border-red-200"
            >
              Clear Score
            </button>
            <button
              type="button"
              onClick={handleMobileKeypadNext}
              className="h-11 col-span-2 flex items-center justify-center rounded-[4px] bg-[#B45309] hover:bg-[#92400E] text-white font-bold text-xs"
            >
              Next <ArrowRight className="w-3.5 h-3.5 ml-1 inline" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
