import db from "./db.js";
export { db };
import { v4 as uuidv4 } from "uuid";
import type {
  Store,
  MeterReading,
  BusinessHours,
  MaintenanceRecord,
  ThresholdConfig,
  Anomaly,
  AnomalyStatus,
  ReviewLog,
  ImportBatch,
  ImportBatchType,
  ImportBatchStatus,
  ImportBatchRecord,
  ImportBatchDetail,
  BatchFilter,
  DashboardStats,
  TrendData,
} from "../shared/types.js";

export function getStores(): Store[] {
  const rows = db.prepare("SELECT id, name, area, category FROM stores").all() as any[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    area: row.area,
    category: row.category,
  }));
}

export function getStoreById(id: string): Store | null {
  const row = db.prepare("SELECT id, name, area, category FROM stores WHERE id = ?").get(id) as any;
  if (!row) return null;
  return { id: row.id, name: row.name, area: row.area, category: row.category };
}

export function upsertStore(store: Omit<Store, "id">, id?: string): Store {
  const storeId = id || uuidv4();
  const existing = getStoreById(storeId);
  if (existing) {
    db.prepare("UPDATE stores SET name = ?, area = ?, category = ? WHERE id = ?").run(
      store.name, store.area, store.category, storeId
    );
  } else {
    db.prepare("INSERT INTO stores (id, name, area, category) VALUES (?, ?, ?, ?)").run(
      storeId, store.name, store.area, store.category
    );
  }
  return { ...store, id: storeId };
}

export function getMeterReadings(storeId?: string, startDate?: string, endDate?: string): MeterReading[] {
  let sql = "SELECT id, store_id, date, reading, batch_id FROM meter_readings WHERE 1=1";
  const params: any[] = [];
  if (storeId) { sql += " AND store_id = ?"; params.push(storeId); }
  if (startDate) { sql += " AND date >= ?"; params.push(startDate); }
  if (endDate) { sql += " AND date <= ?"; params.push(endDate); }
  sql += " ORDER BY date ASC";
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(row => ({
    id: row.id,
    storeId: row.store_id,
    date: row.date,
    reading: row.reading,
    batchId: row.batch_id,
  }));
}

export function getPreviousReading(storeId: string, date: string): number | null {
  const row = db.prepare(
    "SELECT reading FROM meter_readings WHERE store_id = ? AND date < ? ORDER BY date DESC LIMIT 1"
  ).get(storeId, date) as any;
  return row ? row.reading : null;
}

export function getBusinessHours(storeId?: string, startDate?: string, endDate?: string): BusinessHours[] {
  let sql = "SELECT id, store_id, date, open_hour, close_hour, batch_id FROM business_hours WHERE 1=1";
  const params: any[] = [];
  if (storeId) { sql += " AND store_id = ?"; params.push(storeId); }
  if (startDate) { sql += " AND date >= ?"; params.push(startDate); }
  if (endDate) { sql += " AND date <= ?"; params.push(endDate); }
  sql += " ORDER BY date ASC";
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(row => ({
    id: row.id,
    storeId: row.store_id,
    date: row.date,
    openHour: row.open_hour,
    closeHour: row.close_hour,
    batchId: row.batch_id,
  }));
}

export function getMaintenanceRecords(storeId?: string, startDate?: string, endDate?: string): MaintenanceRecord[] {
  let sql = "SELECT id, store_id, date, type, description, batch_id FROM maintenance_records WHERE 1=1";
  const params: any[] = [];
  if (storeId) { sql += " AND store_id = ?"; params.push(storeId); }
  if (startDate) { sql += " AND date >= ?"; params.push(startDate); }
  if (endDate) { sql += " AND date <= ?"; params.push(endDate); }
  sql += " ORDER BY date ASC";
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(row => ({
    id: row.id,
    storeId: row.store_id,
    date: row.date,
    type: row.type,
    description: row.description,
    batchId: row.batch_id,
  }));
}

export function hasMaintenanceOnDate(storeId: string, date: string): MaintenanceRecord | null {
  const row = db.prepare(
    "SELECT id, store_id, date, type, description, batch_id FROM maintenance_records WHERE store_id = ? AND date = ? LIMIT 1"
  ).get(storeId, date) as any;
  if (!row) return null;
  return {
    id: row.id,
    storeId: row.store_id,
    date: row.date,
    type: row.type,
    description: row.description,
    batchId: row.batch_id,
  };
}

export function getThresholdConfigs(): ThresholdConfig[] {
  const rows = db.prepare(
    "SELECT id, store_id, daily_limit, fluctuation_rate, hours_correction_factor FROM threshold_config"
  ).all() as any[];
  return rows.map(row => ({
    id: row.id,
    storeId: row.store_id,
    dailyLimit: row.daily_limit,
    fluctuationRate: row.fluctuation_rate,
    hoursCorrectionFactor: row.hours_correction_factor,
  }));
}

export function getThresholdForStore(storeId: string): ThresholdConfig {
  const storeConfig = db.prepare(
    "SELECT id, store_id, daily_limit, fluctuation_rate, hours_correction_factor FROM threshold_config WHERE store_id = ? LIMIT 1"
  ).get(storeId) as any;
  if (storeConfig) {
    return {
      id: storeConfig.id,
      storeId: storeConfig.store_id,
      dailyLimit: storeConfig.daily_limit,
      fluctuationRate: storeConfig.fluctuation_rate,
      hoursCorrectionFactor: storeConfig.hours_correction_factor,
    };
  }
  const globalConfig = db.prepare(
    "SELECT id, store_id, daily_limit, fluctuation_rate, hours_correction_factor FROM threshold_config WHERE store_id IS NULL LIMIT 1"
  ).get() as any;
  if (globalConfig) {
    return {
      id: globalConfig.id,
      storeId: globalConfig.store_id,
      dailyLimit: globalConfig.daily_limit,
      fluctuationRate: globalConfig.fluctuation_rate,
      hoursCorrectionFactor: globalConfig.hours_correction_factor,
    };
  }
  return {
    id: "",
    storeId: null,
    dailyLimit: 150,
    fluctuationRate: 30,
    hoursCorrectionFactor: 1.0,
  };
}

export function saveThresholdConfig(config: Omit<ThresholdConfig, "id">): ThresholdConfig {
  const existing = db.prepare(
    "SELECT id FROM threshold_config WHERE store_id IS ? OR store_id = ?"
  ).get(config.storeId, config.storeId) as any;
  const id = existing?.id || uuidv4();
  if (existing) {
    db.prepare(
      "UPDATE threshold_config SET daily_limit = ?, fluctuation_rate = ?, hours_correction_factor = ? WHERE id = ?"
    ).run(config.dailyLimit, config.fluctuationRate, config.hoursCorrectionFactor, id);
  } else {
    db.prepare(
      "INSERT INTO threshold_config (id, store_id, daily_limit, fluctuation_rate, hours_correction_factor) VALUES (?, ?, ?, ?, ?)"
    ).run(id, config.storeId, config.dailyLimit, config.fluctuationRate, config.hoursCorrectionFactor);
  }
  return { ...config, id };
}

export function getAnomalies(filters?: {
  status?: AnomalyStatus;
  storeId?: string;
  startDate?: string;
  endDate?: string;
}): Anomaly[] {
  let sql = `SELECT a.id, a.store_id, a.date, a.daily_consumption, a.expected_consumption,
             a.deviation_rate, a.status, a.attribution, a.note, a.evidence_source,
             a.reviewer, a.reviewed_at, a.created_at
             FROM anomalies a WHERE 1=1`;
  const params: any[] = [];
  if (filters?.status) { sql += " AND a.status = ?"; params.push(filters.status); }
  if (filters?.storeId) { sql += " AND a.store_id = ?"; params.push(filters.storeId); }
  if (filters?.startDate) { sql += " AND a.date >= ?"; params.push(filters.startDate); }
  if (filters?.endDate) { sql += " AND a.date <= ?"; params.push(filters.endDate); }
  sql += " ORDER BY a.date DESC, a.deviation_rate DESC";
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(row => ({
    id: row.id,
    storeId: row.store_id,
    date: row.date,
    dailyConsumption: row.daily_consumption,
    expectedConsumption: row.expected_consumption,
    deviationRate: row.deviation_rate,
    status: row.status as AnomalyStatus,
    attribution: row.attribution,
    note: row.note,
    evidenceSource: row.evidence_source,
    reviewer: row.reviewer,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  }));
}

export function getAnomalyById(id: string): Anomaly | null {
  const row = db.prepare(
    `SELECT id, store_id, date, daily_consumption, expected_consumption, deviation_rate,
     status, attribution, note, evidence_source, reviewer, reviewed_at, created_at
     FROM anomalies WHERE id = ?`
  ).get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    storeId: row.store_id,
    date: row.date,
    dailyConsumption: row.daily_consumption,
    expectedConsumption: row.expected_consumption,
    deviationRate: row.deviation_rate,
    status: row.status as AnomalyStatus,
    attribution: row.attribution,
    note: row.note,
    evidenceSource: row.evidence_source,
    reviewer: row.reviewer,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export function upsertAnomaly(anomaly: Partial<Omit<Anomaly, "id" | "createdAt">> & Pick<Anomaly, "storeId" | "date" | "dailyConsumption" | "expectedConsumption" | "deviationRate" | "status"> & { id?: string; createdAt?: string }): Anomaly {
  const existing = db.prepare(
    "SELECT id, status, note, evidence_source, reviewer, reviewed_at FROM anomalies WHERE store_id = ? AND date = ?"
  ).get(anomaly.storeId, anomaly.date) as any;
  const now = new Date().toISOString();
  const id = anomaly.id || existing?.id || uuidv4();
  const createdAt = anomaly.createdAt || existing?.created_at || now;
  if (existing && (existing.status === "confirmed" || existing.status === "false_positive" || existing.status === "closed")) {
    db.prepare(`UPDATE anomalies SET
      daily_consumption = ?, expected_consumption = ?, deviation_rate = ?, attribution = ?
      WHERE id = ?`
    ).run(anomaly.dailyConsumption, anomaly.expectedConsumption, anomaly.deviationRate, anomaly.attribution, id);
    return getAnomalyById(id)!;
  }
  if (existing) {
    db.prepare(`UPDATE anomalies SET
      daily_consumption = ?, expected_consumption = ?, deviation_rate = ?, status = ?, attribution = ?,
      note = ?, evidence_source = ?, reviewer = ?, reviewed_at = ?, created_at = ?
      WHERE id = ?`
    ).run(
      anomaly.dailyConsumption, anomaly.expectedConsumption, anomaly.deviationRate, anomaly.status,
      anomaly.attribution, anomaly.note, anomaly.evidenceSource, anomaly.reviewer, anomaly.reviewedAt,
      createdAt, id
    );
  } else {
    db.prepare(`INSERT INTO anomalies
      (id, store_id, date, daily_consumption, expected_consumption, deviation_rate, status,
       attribution, note, evidence_source, reviewer, reviewed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, anomaly.storeId, anomaly.date, anomaly.dailyConsumption, anomaly.expectedConsumption,
      anomaly.deviationRate, anomaly.status, anomaly.attribution, anomaly.note,
      anomaly.evidenceSource, anomaly.reviewer, anomaly.reviewedAt, createdAt
    );
  }
  return getAnomalyById(id)!;
}

export function updateAnomalyReview(
  id: string,
  status: AnomalyStatus,
  attribution: string | null,
  note: string,
  evidenceSource: string,
  reviewer: string
): Anomaly {
  const existing = getAnomalyById(id);
  if (!existing) throw new Error("Anomaly not found");
  const now = new Date().toISOString();
  db.prepare(`UPDATE anomalies SET
    status = ?, attribution = ?, note = ?, evidence_source = ?, reviewer = ?, reviewed_at = ?
    WHERE id = ?`
  ).run(status, attribution, note, evidenceSource, reviewer, now, id);
  db.prepare(`INSERT INTO review_logs
    (id, anomaly_id, from_status, to_status, note, evidence_source, reviewer, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), id, existing.status, status, note, evidenceSource, reviewer, now);
  return getAnomalyById(id)!;
}

export function deletePendingAnomaliesForStore(storeId: string): number {
  const res = db.prepare("DELETE FROM anomalies WHERE store_id = ? AND status = 'pending'").run(storeId);
  return res.changes;
}

export function deleteAllPendingAnomalies(): number {
  const res = db.prepare("DELETE FROM anomalies WHERE status = 'pending'").run();
  return res.changes;
}

export function getReviewLogs(anomalyId: string): ReviewLog[] {
  const rows = db.prepare(
    `SELECT id, anomaly_id, from_status, to_status, note, evidence_source, reviewer, created_at
     FROM review_logs WHERE anomaly_id = ? ORDER BY created_at DESC`
  ).all(anomalyId) as any[];
  return rows.map(row => ({
    id: row.id,
    anomalyId: row.anomaly_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note,
    evidenceSource: row.evidence_source,
    reviewer: row.reviewer,
    createdAt: row.created_at,
  }));
}

function rowToImportBatch(row: any): ImportBatch {
  return {
    id: row.id,
    type: row.type as ImportBatchType,
    fileType: row.file_type ?? null,
    fileName: row.file_name ?? null,
    recordCount: row.record_count,
    successCount: row.success_count ?? 0,
    failureCount: row.failure_count ?? 0,
    status: row.status as ImportBatchStatus,
    errors: row.errors,
    originalContent: row.original_content ?? null,
    parentBatchId: row.parent_batch_id ?? null,
    coverageStartDate: row.coverage_start_date ?? null,
    coverageEndDate: row.coverage_end_date ?? null,
    createdAt: row.created_at,
  };
}

export function getImportBatches(filter?: BatchFilter): ImportBatch[] {
  let sql = `SELECT id, type, file_type, file_name, record_count, success_count, failure_count,
             status, errors, original_content, parent_batch_id, coverage_start_date, coverage_end_date, created_at
             FROM import_batches WHERE 1=1`;
  const params: any[] = [];
  if (filter?.type) { sql += " AND type = ?"; params.push(filter.type); }
  if (filter?.status) { sql += " AND status = ?"; params.push(filter.status); }
  if (filter?.startDate) { sql += " AND date(created_at) >= ?"; params.push(filter.startDate); }
  if (filter?.endDate) { sql += " AND date(created_at) <= ?"; params.push(filter.endDate); }
  sql += " ORDER BY created_at DESC";
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(rowToImportBatch);
}

export function getImportBatchById(id: string): ImportBatch | null {
  const row = db.prepare(
    `SELECT id, type, file_type, file_name, record_count, success_count, failure_count,
     status, errors, original_content, parent_batch_id, coverage_start_date, coverage_end_date, created_at
     FROM import_batches WHERE id = ?`
  ).get(id) as any;
  if (!row) return null;
  return rowToImportBatch(row);
}

export function hasBatch(batchId: string): boolean {
  const row = db.prepare("SELECT 1 FROM import_batches WHERE id = ?").get(batchId) as any;
  return !!row;
}

export function getBatchRecords(batchId: string): ImportBatchRecord[] {
  const rows = db.prepare(
    `SELECT id, batch_id, row_index, record_data, success, error_message, is_duplicate, created_at
     FROM import_batch_records WHERE batch_id = ? ORDER BY row_index ASC`
  ).all(batchId) as any[];
  return rows.map(row => ({
    id: row.id,
    batchId: row.batch_id,
    rowIndex: row.row_index,
    recordData: JSON.parse(row.record_data),
    success: row.success === 1,
    errorMessage: row.error_message,
    isDuplicate: row.is_duplicate === 1,
    createdAt: row.created_at,
  }));
}

export function insertBatchRecord(
  batchId: string,
  rowIndex: number,
  recordData: any,
  success: boolean,
  errorMessage?: string,
  isDuplicate = false
): ImportBatchRecord {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO import_batch_records (id, batch_id, row_index, record_data, success, error_message, is_duplicate, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, batchId, rowIndex, JSON.stringify(recordData), success ? 1 : 0, errorMessage || null, isDuplicate ? 1 : 0, now);
  return {
    id,
    batchId,
    rowIndex,
    recordData,
    success,
    errorMessage: errorMessage || null,
    isDuplicate,
    createdAt: now,
  };
}

export function getChildBatches(parentBatchId: string): ImportBatch[] {
  const rows = db.prepare(
    `SELECT id, type, file_type, file_name, record_count, success_count, failure_count,
     status, errors, original_content, parent_batch_id, coverage_start_date, coverage_end_date, created_at
     FROM import_batches WHERE parent_batch_id = ? ORDER BY created_at ASC`
  ).all(parentBatchId) as any[];
  return rows.map(rowToImportBatch);
}

export function getImportBatchDetail(id: string): ImportBatchDetail | null {
  const batch = getImportBatchById(id);
  if (!batch) return null;
  const records = getBatchRecords(id);
  const childBatches = getChildBatches(id);
  const parentBatch = batch.parentBatchId ? getImportBatchById(batch.parentBatchId) : null;
  return {
    ...batch,
    records,
    childBatches,
    parentBatch,
  };
}

export function insertMeterReading(reading: Omit<MeterReading, "id"> & { id?: string }): MeterReading {
  const id = reading.id || uuidv4();
  db.prepare(
    "INSERT OR IGNORE INTO meter_readings (id, store_id, date, reading, batch_id) VALUES (?, ?, ?, ?, ?)"
  ).run(id, reading.storeId, reading.date, reading.reading, reading.batchId);
  return { ...reading, id } as MeterReading;
}

export function insertBusinessHours(hours: Omit<BusinessHours, "id"> & { id?: string }): BusinessHours {
  const id = hours.id || uuidv4();
  db.prepare(
    "INSERT OR IGNORE INTO business_hours (id, store_id, date, open_hour, close_hour, batch_id) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, hours.storeId, hours.date, hours.openHour, hours.closeHour, hours.batchId);
  return { ...hours, id } as BusinessHours;
}

export function insertMaintenanceRecord(record: Omit<MaintenanceRecord, "id"> & { id?: string }): MaintenanceRecord {
  const id = record.id || uuidv4();
  db.prepare(
    "INSERT OR IGNORE INTO maintenance_records (id, store_id, date, type, description, batch_id) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, record.storeId, record.date, record.type, record.description, record.batchId);
  return { ...record, id } as MaintenanceRecord;
}

export function createImportBatch(
  type: ImportBatchType,
  recordCount: number,
  status: ImportBatchStatus,
  options?: {
    errors?: string;
    batchId?: string;
    fileType?: string;
    fileName?: string;
    successCount?: number;
    failureCount?: number;
    originalContent?: string;
    parentBatchId?: string;
    coverageStartDate?: string;
    coverageEndDate?: string;
  }
): ImportBatch {
  const id = options?.batchId || uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO import_batches (id, type, file_type, file_name, record_count, success_count, failure_count,
     status, errors, original_content, parent_batch_id, coverage_start_date, coverage_end_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    type,
    options?.fileType || null,
    options?.fileName || null,
    recordCount,
    options?.successCount ?? 0,
    options?.failureCount ?? 0,
    status,
    options?.errors || null,
    options?.originalContent || null,
    options?.parentBatchId || null,
    options?.coverageStartDate || null,
    options?.coverageEndDate || null,
    now
  );
  return getImportBatchById(id)!;
}

export function updateImportBatchStatus(
  batchId: string,
  status: ImportBatchStatus,
  options?: {
    errors?: string;
    successCount?: number;
    failureCount?: number;
  }
): void {
  const existing = getImportBatchById(batchId);
  if (!existing) return;
  db.prepare(
    `UPDATE import_batches SET status = ?, errors = ?, success_count = ?, failure_count = ? WHERE id = ?`
  ).run(
    status,
    options?.errors ?? existing.errors,
    options?.successCount ?? existing.successCount,
    options?.failureCount ?? existing.failureCount,
    batchId
  );
}

export function getDashboardStats(): DashboardStats {
  const totalStores = (db.prepare("SELECT COUNT(*) as cnt FROM stores").get() as any).cnt;
  const anomalyStores = (db.prepare("SELECT COUNT(DISTINCT store_id) as cnt FROM anomalies").get() as any).cnt;
  const pendingCount = (db.prepare("SELECT COUNT(*) as cnt FROM anomalies WHERE status = 'pending'").get() as any).cnt;
  const confirmedCount = (db.prepare("SELECT COUNT(*) as cnt FROM anomalies WHERE status = 'confirmed'").get() as any).cnt;
  const falsePositiveCount = (db.prepare("SELECT COUNT(*) as cnt FROM anomalies WHERE status = 'false_positive'").get() as any).cnt;
  const closedCount = (db.prepare("SELECT COUNT(*) as cnt FROM anomalies WHERE status = 'closed'").get() as any).cnt;

  const recentTrend = db.prepare(`
    SELECT date, COUNT(*) as count
    FROM anomalies
    WHERE date >= date('now', '-7 days')
    GROUP BY date
    ORDER BY date ASC
  `).all() as { date: string; count: number }[];

  const storeDistribution = db.prepare(`
    SELECT a.store_id, s.name as store_name, COUNT(*) as anomaly_count
    FROM anomalies a
    LEFT JOIN stores s ON a.store_id = s.id
    GROUP BY a.store_id
    ORDER BY anomaly_count DESC
  `).all() as { store_id: string; store_name: string; anomaly_count: number }[];

  return {
    totalStores,
    anomalyStores,
    pendingCount,
    confirmedCount,
    falsePositiveCount,
    closedCount,
    recentTrend: recentTrend.map(r => ({ date: r.date, count: r.count })),
    storeDistribution: storeDistribution.map(r => ({
      storeId: r.store_id,
      storeName: r.store_name || "未知门店",
      anomalyCount: r.anomaly_count,
    })),
  };
}

export function getTrendData(storeId: string): TrendData {
  const store = getStoreById(storeId);
  if (!store) throw new Error("Store not found");

  const readings = getMeterReadings(storeId);
  const hours = getBusinessHours(storeId);
  const maintenance = getMaintenanceRecords(storeId);
  const anomalies = getAnomalies({ storeId });

  const hoursMap = new Map(hours.map(h => [h.date, h]));
  const maintenanceMap = new Map(maintenance.map(m => [m.date, m]));
  const anomalyMap = new Map(anomalies.map(a => [a.date, a]));

  const dailyData: TrendData["dailyData"] = [];
  for (let i = 1; i < readings.length; i++) {
    const curr = readings[i];
    const prev = readings[i - 1];
    const consumption = curr.reading - prev.reading;
    const h = hoursMap.get(curr.date);
    const m = maintenanceMap.get(curr.date);
    const a = anomalyMap.get(curr.date);
    const threshold = getThresholdForStore(storeId);
    const stdHours = 12;
    const actualHours = h ? (h.closeHour - h.openHour) : stdHours;
    const expected = threshold.dailyLimit * (actualHours / stdHours) * threshold.hoursCorrectionFactor;

    dailyData.push({
      date: curr.date,
      consumption,
      expected,
      isAnomaly: !!a,
      anomalyStatus: a?.status || null,
      hasMaintenance: !!m,
      maintenanceDesc: m?.description || null,
      openHour: h?.openHour || 8,
      closeHour: h?.closeHour || 20,
    });
  }

  return {
    storeId,
    storeName: store.name,
    dailyData,
  };
}
