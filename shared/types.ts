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

