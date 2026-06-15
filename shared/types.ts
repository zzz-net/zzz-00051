export interface Store {
  id: string;
  name: string;
  area: number;
  category: string;
}

export interface MeterReading {
  id: string;
  storeId: string;
  date: string;
  reading: number;
  batchId: string;
}

export interface BusinessHours {
  id: string;
  storeId: string;
  date: string;
  openHour: number;
  closeHour: number;
  batchId: string;
}

export interface MaintenanceRecord {
  id: string;
  storeId: string;
  date: string;
  type: string;
  description: string;
  batchId: string;
}

export interface ThresholdConfig {
  id: string;
  storeId: string | null;
  dailyLimit: number;
  fluctuationRate: number;
  hoursCorrectionFactor: number;
}

export type AnomalyStatus = "pending" | "confirmed" | "false_positive" | "closed";

export interface Anomaly {
  id: string;
  storeId: string;
  date: string;
  dailyConsumption: number;
  expectedConsumption: number;
  deviationRate: number;
  status: AnomalyStatus;
  attribution: string | null;
  note: string | null;
  evidenceSource: string | null;
  reviewer: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ReviewLog {
  id: string;
  anomalyId: string;
  fromStatus: string;
  toStatus: string;
  note: string;
  evidenceSource: string;
  reviewer: string;
  createdAt: string;
}

export type ImportBatchType = "readings" | "hours" | "maintenance";
export type ImportBatchStatus = "success" | "partial" | "failed";

export interface ImportBatchRecord {
  id: string;
  batchId: string;
  rowIndex: number;
  recordData: any;
  success: boolean;
  errorMessage: string | null;
  isDuplicate: boolean;
  createdAt: string;
}

export interface ImportBatch {
  id: string;
  type: ImportBatchType;
  fileType: string | null;
  fileName: string | null;
  recordCount: number;
  successCount: number;
  failureCount: number;
  status: ImportBatchStatus;
  errors: string | null;
  originalContent: string | null;
  parentBatchId: string | null;
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  createdAt: string;
}

export interface ImportBatchDetail extends ImportBatch {
  records: ImportBatchRecord[];
  childBatches: ImportBatch[];
  parentBatch: ImportBatch | null;
}

export interface BatchFilter {
  type?: ImportBatchType;
  status?: ImportBatchStatus;
  startDate?: string;
  endDate?: string;
}

export interface DashboardStats {
  totalStores: number;
  anomalyStores: number;
  pendingCount: number;
  confirmedCount: number;
  falsePositiveCount: number;
  closedCount: number;
  recentTrend: { date: string; count: number }[];
  storeDistribution: { storeId: string; storeName: string; anomalyCount: number }[];
}

export interface TrendData {
  storeId: string;
  storeName: string;
  dailyData: {
    date: string;
    consumption: number;
    expected: number;
    isAnomaly: boolean;
    anomalyStatus: AnomalyStatus | null;
    hasMaintenance: boolean;
    maintenanceDesc: string | null;
    openHour: number;
    closeHour: number;
  }[];
}

export interface ReviewPayload {
  status: AnomalyStatus;
  attribution?: string;
  note: string;
  evidenceSource: string;
  reviewer: string;
}

export type CockpitStepStatus = "pending" | "running" | "passed" | "failed" | "skipped";

export interface CockpitStepResult {
  step: string;
  label: string;
  status: CockpitStepStatus;
  startedAt: string | null;
  finishedAt: string | null;
  detail: string | null;
  error: string | null;
}

export type CockpitRunStatus = "idle" | "running" | "completed" | "failed";

export interface CockpitRun {
  id: string;
  prefix: string;
  status: CockpitRunStatus;
  steps: CockpitStepResult[];
  snapshotBefore: string | null;
  snapshotAfter: string | null;
  isolationCleaned: boolean;
  importConflictHandled: boolean;
  filterPreserved: boolean;
  reviewPreserved: boolean;
  exportComplete: boolean;
  exportComparisonMatch: boolean;
  logs: string[];
  createdAt: string;
  finishedAt: string | null;
}

export interface CockpitCheckpoint {
  id: string;
  runId: string;
  step: string;
  stateJson: string;
  createdAt: string;
}

export interface CockpitSummary {
  totalRuns: number;
  lastRunStatus: CockpitRunStatus | null;
  lastRunAt: string | null;
  isolationVerified: boolean;
  importConflictFree: boolean;
  filterReviewPreserved: boolean;
  exportConsistent: boolean;
  recentRuns: CockpitRun[];
}

export type AcceptancePhase =
  | "preparation"
  | "self_check"
  | "drill_run"
  | "restart_verification"
  | "final_packaging";

export type AcceptanceStepStatus = "pending" | "running" | "passed" | "failed" | "skipped";

export interface AcceptanceStepResult {
  step: string;
  label: string;
  phase: AcceptancePhase;
  status: AcceptanceStepStatus;
  startedAt: string | null;
  finishedAt: string | null;
  detail: string | null;
  error: string | null;
}

export type AcceptanceRunStatus = "idle" | "running" | "paused" | "completed" | "failed";

export interface AcceptanceFilterCriteria {
  status?: AnomalyStatus;
  storeId?: string;
  startDate?: string;
  endDate?: string;
  minDeviationRate?: number;
}

export interface AcceptanceReviewRecord {
  anomalyId: string;
  fromStatus: AnomalyStatus;
  toStatus: AnomalyStatus;
  reviewer: string;
  note: string;
  evidenceSource: string;
  timestamp: string;
}

export interface AcceptanceInterfaceCheck {
  name: string;
  endpoint: string;
  method: string;
  status: "passed" | "failed";
  responseTime: number;
  detail: string;
}

export interface AcceptanceExportFile {
  name: string;
  type: "csv" | "json";
  size: number;
  recordCount: number;
  path: string;
}

export interface AcceptanceRun {
  id: string;
  name: string;
  status: AcceptanceRunStatus;
  currentPhase: AcceptancePhase | null;
  steps: AcceptanceStepResult[];
  filterCriteria: AcceptanceFilterCriteria | null;
  reviewRecords: AcceptanceReviewRecord[];
  interfaceChecks: AcceptanceInterfaceCheck[];
  exportFiles: AcceptanceExportFile[];
  snapshotBeforeDrill: string | null;
  snapshotAfterDrill: string | null;
  snapshotAfterRestart: string | null;
  firstDrillResult: string | null;
  secondDrillResult: string | null;
  consistencyVerified: boolean;
  restartRecoveryVerified: boolean;
  typeCheckPassed: boolean;
  buildCheckPassed: boolean;
  serviceVersion: string | null;
  serviceStartTime: string | null;
  logs: string[];
  packageReady: boolean;
  packagePath: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface AcceptancePackageInfo {
  runId: string;
  runName: string;
  createdAt: string;
  filterCriteria: AcceptanceFilterCriteria | null;
  reviewRecordCount: number;
  interfaceCheckCount: number;
  interfaceCheckPassed: number;
  exportFileCount: number;
  steps: AcceptanceStepResult[];
  summary: {
    typeCheck: boolean;
    buildCheck: boolean;
    consistency: boolean;
    restartRecovery: boolean;
  };
}

export interface AcceptanceSummary {
  totalRuns: number;
  lastRunStatus: AcceptanceRunStatus | null;
  lastRunAt: string | null;
  lastRunId: string | null;
  totalPassed: number;
  totalFailed: number;
  typeCheckVerified: boolean;
  buildCheckVerified: boolean;
  consistencyVerified: boolean;
  restartRecoveryVerified: boolean;
  recentRuns: AcceptanceRun[];
}

export type DrillRecoveryMode = "continue" | "restart";

export type DrillSnapshotType = "before_drill" | "after_drill" | "after_restart" | "manual";

export interface DrillRecoverySnapshot {
  id: string;
  runId: string;
  snapshotType: DrillSnapshotType;
  stepIndex: number;
  currentPhase: AcceptancePhase | null;
  filterCriteria: AcceptanceFilterCriteria | null;
  reviewRecords: AcceptanceReviewRecord[];
  interfaceChecks: AcceptanceInterfaceCheck[];
  steps: AcceptanceStepResult[];
  anomalyStats: {
    pending: number;
    confirmed: number;
    falsePositive: number;
    closed: number;
    total: number;
  };
  systemState: string;
  serviceVersion: string;
  serviceStartTime: string;
  operationLogs: string[];
  createdAt: string;
}

export interface DrillComparisonDiff {
  field: string;
  firstValue: any;
  secondValue: any;
  changeType: "added" | "removed" | "modified" | "unchanged";
}

export interface DrillComparisonResult {
  id: string;
  firstRunId: string;
  secondRunId: string;
  comparisonTime: string;
  overallMatch: boolean;
  matchScore: number;
  totalDiffs: number;
  criticalDiffs: number;
  diffs: DrillComparisonDiff[];
  stepComparison: Array<{
    step: string;
    firstStatus: AcceptanceStepStatus;
    secondStatus: AcceptanceStepStatus;
    match: boolean;
  }>;
  anomalyComparison: {
    firstCount: number;
    secondCount: number;
    countMatch: boolean;
    statusBreakdown: {
      pending: { first: number; second: number; match: boolean };
      confirmed: { first: number; second: number; match: boolean };
      falsePositive: { first: number; second: number; match: boolean };
      closed: { first: number; second: number; match: boolean };
    };
  };
  interfaceComparison: {
    firstPassed: number;
    secondPassed: number;
    firstTotal: number;
    secondTotal: number;
    match: boolean;
  };
}

export interface DrillRecoverySource {
  runId: string;
  runName: string;
  originalStartTime: string;
  lastSnapshotTime: string;
  pauseReason: string | null;
  completedSteps: number;
  totalSteps: number;
  serviceRestarted: boolean;
  canContinue: boolean;
  canRestart: boolean;
}

export interface DrillConflictInfo {
  type: "run_exists" | "export_exists" | "snapshot_conflict" | "in_progress";
  runId: string;
  message: string;
  existingResource: string;
  suggestedAction: "overwrite" | "use_existing" | "abort";
}

export interface DrillRecoveryStatus {
  runId: string;
  runName: string;
  currentStatus: AcceptanceRunStatus;
  currentPhase: AcceptancePhase | null;
  recoveryMode: DrillRecoveryMode | null;
  recoverySource: DrillRecoverySource | null;
  lastSnapshot: DrillRecoverySnapshot | null;
  conflicts: DrillConflictInfo[];
  exportIndex: AcceptanceExportFile[] | null;
  packageReady: boolean;
  packagePath: string | null;
  serviceStartTime: string;
  serviceVersion: string;
  serviceRestarted: boolean;
}

export interface DrillRecoveryAction {
  mode: DrillRecoveryMode;
  runId: string;
  timestamp: string;
  success: boolean;
  message: string;
  recoveredFromSnapshotId: string | null;
}

export interface DrillExportIndex {
  runId: string;
  runName: string;
  generatedAt: string;
  restoredAt: string | null;
  totalFiles: number;
  totalSize: number;
  files: AcceptanceExportFile[];
  manifestHash: string;
  dataIntegrityVerified: boolean;
}

