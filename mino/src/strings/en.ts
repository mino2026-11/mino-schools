/**
 * MINO-SMS English String Resources
 * Professional, clear, anti-slop copy.
 */

export const STRINGS = {
  app: {
    name: 'MINO-SMS',
    fullName: 'MINO School Management System',
    tagline: 'Multi-Tenant School Administration & Offline Sync Engine',
    copyright: '© 2026 MINO Platform Services'
  },
  roles: {
    admin: 'Administrator',
    teacher: 'Class Teacher',
    bursar: 'Bursar / Finance',
    parent: 'Guardian / Parent'
  },
  nav: {
    dashboard: 'Overview',
    students: 'Pupils Directory',
    gradebook: 'Gradebook',
    ledger: 'Fees & Ledger',
    parentPortal: 'Parent Portal',
    auditLogs: 'Audit Trail',
    securityVault: 'Security & PIN Vault',
    settings: 'School Configuration'
  },
  common: {
    save: 'Save Changes',
    cancel: 'Cancel',
    delete: 'Delete',
    restore: 'Restore',
    edit: 'Edit',
    create: 'Create',
    exportCsv: 'Export CSV',
    importCsv: 'Import CSV',
    syncNow: 'Sync Outbox',
    search: 'Search records...',
    filter: 'Filter',
    loading: 'Loading...',
    all: 'All',
    status: 'Status',
    actions: 'Actions',
    close: 'Close',
    confirm: 'Confirm'
  },
  status: {
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
    graduated: 'Graduated',
    paid: 'Paid',
    partial: 'Partial',
    unpaid: 'Unpaid / Arrears',
    synced: 'Synced',
    pending: 'Pending Sync',
    offline: 'Offline'
  },
  vault: {
    title: 'Offline AES-GCM Vault',
    enterPin: 'Enter 6-digit Master PIN',
    setupPin: 'Set Up 6-digit Master PIN',
    pinHint: 'PIN is used via PBKDF2 to derive your client encryption key. The PIN is never transmitted or stored.',
    locked: 'Vault Locked',
    unlocked: 'Vault Unlocked',
    lockNow: 'Lock Vault',
    invalidPin: 'Incorrect PIN. Encryption verification failed.'
  },
  gradebook: {
    title: 'Academic Gradebook',
    selectSubject: 'Select Subject',
    selectClass: 'Select Class Arm',
    ca1: 'CA 1 (15)',
    ca2: 'CA 2 (15)',
    midterm: 'Mid-Term (20)',
    exam: 'Exam (50)',
    total: 'Total (100)',
    grade: 'Grade',
    remark: 'Remark',
    lockedTitle: 'Term Results Locked',
    lockedNotice: 'Published report cards for this term have been locked by the Administration.'
  },
  finance: {
    title: 'Pupil Accounts & Fee Ledger',
    recordPayment: 'Record Payment',
    feeStructure: 'Fee Structure',
    receiptNo: 'Receipt Number',
    amountDue: 'Amount Due',
    amountPaid: 'Amount Paid',
    balance: 'Current Balance',
    paymentMethod: 'Payment Channel',
    generateReceipt: 'Generate Receipt',
    verifiedReceipt: 'Cryptographically Verified Receipt'
  },
  parent: {
    title: 'Guardian Academic & Financial Portal',
    searchNotice: 'Enter student Admission Number and Guardian Access PIN to retrieve verified records.',
    admissionNo: 'Admission Number',
    accessPin: 'Guardian Access Token',
    lookupStudent: 'Retrieve Student Record'
  }
};
