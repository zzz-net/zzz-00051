import * as repo from "./repositories.js";
import { db } from "./repositories.js";
import { v4 as uuidv4 } from "uuid";
import type {
  MeterReading,
  BusinessHours,
  MaintenanceRecord,
  ThresholdConfig,
  AnomalyStatus,
  ReviewPayload,
  Anomaly,
} from "../shared/types.js";

const STANDARD_HOURS = 12;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateReadings(data: any[], batchId: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (repo.hasBatch(batchId)) {
    errors.push(`批次ID ${batchId} 已存在，请勿重复导入`);
    return { valid: false, errors, warnings };
  }
  if (!data || data.length === 0) {
    errors.push("导入数据为空");
    return { valid: false, errors, warnings };
  }
  data.forEach((row, idx) => {
    const line = idx + 2;
    if (!row.storeId) errors.push(`第${line}行: 缺少必填字段 storeId`);
    if (!row.date) errors.push(`第${line}行: 缺少必填字段 date`);
    if (row.reading === undefined || row.reading === null) errors.push(`第${line}行: 缺少必填字段 reading`);
    if (row.reading !== undefined && row.reading !== null && isNaN(Number(row.reading))) {
      errors.push(`第${line}行: reading 必须是数字`);
    }
    if (row.date && !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      errors.push(`第${line}行: date 格式必须为 YYYY-MM-DD`);
    }
  });
  const dateStorePairs = new Map<string, string>();
  data.forEach((row, idx) => {
    if (row.storeId && row.date) {
      const key = `${row.storeId}-${row.date}`;
      if (dateStorePairs.has(key)) {
        warnings.push(`第${idx + 2}行: ${row.storeId} 在 ${row.date} 已存在，将被忽略`);
      }
      dateStorePairs.set(key, key);
    }
  });
  return { valid: errors.length === 0, errors, warnings };
}

export function validateHours(data: any[], batchId: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (repo.hasBatch(batchId)) {
    errors.push(`批次ID ${batchId} 已存在，请勿重复导入`);
    return { valid: false, errors, warnings };
  }
  if (!data || data.length === 0) {
    errors.push("导入数据为空");
    return { valid: false, errors, warnings };
  }
  data.forEach((row, idx) => {
    const line = idx + 2;
    if (!row.storeId) errors.push(`第${line}行: 缺少必填字段 storeId`);
    if (!row.date) errors.push(`第${line}行: 缺少必填字段 date`);
    if (row.openHour === undefined || row.openHour === null) errors.push(`第${line}行: 缺少必填字段 openHour`);
    if (row.closeHour === undefined || row.closeHour === null) errors.push(`第${line}行: 缺少必填字段 closeHour`);
    if (row.openHour !== undefined && isNaN(Number(row.openHour))) errors.push(`第${line}行: openHour 必须是数字`);
    if (row.closeHour !== undefined && isNaN(Number(row.closeHour))) errors.push(`第${line}行: closeHour 必须是数字`);
    if (row.openHour !== undefined && row.closeHour !== undefined && Number(row.closeHour) <= Number(row.openHour)) {
      errors.push(`第${line}行: closeHour 必须大于 openHour`);
    }
    if (row.date && !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      errors.push(`第${line}行: date 格式必须为 YYYY-MM-DD`);
    }
  });
  return { valid: errors.length === 0, errors, warnings };
}

export function validateMaintenance(data: any[], batchId: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (repo.hasBatch(batchId)) {
    errors.push(`批次ID ${batchId} 已存在，请勿重复导入`);
    return { valid: false, errors, warnings };
  }
  if (!data || data.length === 0) {
    errors.push("导入数据为空");
    return { valid: false, errors, warnings };
  }
  data.forEach((row, idx) => {
    const line = idx + 2;
    if (!row.storeId) errors.push(`第${line}行: 缺少必填字段 storeId`);
    if (!row.date) errors.push(`第${line}行: 缺少必填字段 date`);
    if (!row.type) errors.push(`第${line}行: 缺少必填字段 type`);
    if (!row.description) errors.push(`第${line}行: 缺少必填字段 description`);
    if (row.date && !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      errors.push(`第${line}行: date 格式必须为 YYYY-MM-DD`);
    }
  });
  return { valid: errors.length === 0, errors, warnings };
}

export function validateThreshold(config: Partial<ThresholdConfig>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (config.dailyLimit !== undefined) {
    if (config.dailyLimit <= 0) errors.push("日能耗上限必须大于0");
    if (isNaN(Number(config.dailyLimit))) errors.push("日能耗上限必须是数字");
  }
  if (config.fluctuationRate !== undefined) {
    if (config.fluctuationRate < 0) errors.push("波动阈值不能为负数");
    if (isNaN(Number(config.fluctuationRate))) errors.push("波动阈值必须是数字");
    if (config.fluctuationRate > 200) warnings.push("波动阈值设置过高，可能会漏报异常");
  }
  if (config.hoursCorrectionFactor !== undefined) {
    if (config.hoursCorrectionFactor <= 0) errors.push("营业时长修正系数必须大于0");
    if (isNaN(Number(config.hoursCorrectionFactor))) errors.push("营业时长修正系数必须是数字");
    if (config.hoursCorrectionFactor > 3) warnings.push("修正系数设置过高，可能影响检测准确性");
  }
  return { valid: errors.length === 0, errors, warnings };
}

export async function importReadings(
  data: Omit<MeterReading, "id" | "batchId">[],
  batchId: string,
  autoUpsertStores = true
) {
  const validation = validateReadings(data, batchId);
  if (!validation.valid) {
    const isDuplicate = validation.errors.some(e => e.includes("已存在，请勿重复导入"));
    if (!isDuplicate) {
      repo.createImportBatch("readings", data.length, "failed", JSON.stringify(validation.errors), batchId);
    }
    return { success: false, errors: validation.errors, warnings: validation.warnings };
  }
  if (autoUpsertStores) {
    const storeIds = [...new Set(data.map(r => r.storeId))];
    for (const storeId of storeIds) {
      if (!repo.getStoreById(storeId)) {
        repo.upsertStore({ name: storeId, area: 100, category: "默认" }, storeId);
      }
    }
  }
  const insertMany = db.prepare(
    "INSERT OR IGNORE INTO meter_readings (id, store_id, date, reading, batch_id) VALUES (?, ?, ?, ?, ?)"
  );
  const tx = db.transaction((rows: Omit<MeterReading, "id" | "batchId">[]) => {
    for (const row of rows) {
      insertMany.run(uuidv4(), row.storeId, row.date, row.reading, batchId);
    }
  });
  tx(data);
  repo.createImportBatch(
    "readings",
    data.length,
    validation.warnings.length > 0 ? "partial" : "success",
    validation.warnings.length > 0 ? JSON.stringify(validation.warnings) : null,
    batchId
  );
  const anomalyCount = recalculateAnomaliesForStores([...new Set(data.map(r => r.storeId))]);
  return {
    success: true,
    batchId,
    recordCount: data.length,
    warnings: validation.warnings,
    anomalyCount,
  };
}

export async function importHours(
  data: Omit<BusinessHours, "id" | "batchId">[],
  batchId: string
) {
  const validation = validateHours(data, batchId);
  if (!validation.valid) {
    const isDuplicate = validation.errors.some(e => e.includes("已存在，请勿重复导入"));
    if (!isDuplicate) {
      repo.createImportBatch("hours", data.length, "failed", JSON.stringify(validation.errors), batchId);
    }
    return { success: false, errors: validation.errors, warnings: validation.warnings };
  }
  const insertMany = db.prepare(
    "INSERT OR IGNORE INTO business_hours (id, store_id, date, open_hour, close_hour, batch_id) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const tx = db.transaction((rows: Omit<BusinessHours, "id" | "batchId">[]) => {
    for (const row of rows) {
      insertMany.run(uuidv4(), row.storeId, row.date, row.openHour, row.closeHour, batchId);
    }
  });
  tx(data);
  repo.createImportBatch(
    "hours",
    data.length,
    validation.warnings.length > 0 ? "partial" : "success",
    validation.warnings.length > 0 ? JSON.stringify(validation.warnings) : null,
    batchId
  );
  const anomalyCount = recalculateAnomaliesForStores([...new Set(data.map(r => r.storeId))]);
  return {
    success: true,
    batchId,
    recordCount: data.length,
    warnings: validation.warnings,
    anomalyCount,
  };
}

export async function importMaintenance(
  data: Omit<MaintenanceRecord, "id" | "batchId">[],
  batchId: string
) {
  const validation = validateMaintenance(data, batchId);
  if (!validation.valid) {
    const isDuplicate = validation.errors.some(e => e.includes("已存在，请勿重复导入"));
    if (!isDuplicate) {
      repo.createImportBatch("maintenance", data.length, "failed", JSON.stringify(validation.errors), batchId);
    }
    return { success: false, errors: validation.errors, warnings: validation.warnings };
  }
  const insertMany = db.prepare(
    "INSERT OR IGNORE INTO maintenance_records (id, store_id, date, type, description, batch_id) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const tx = db.transaction((rows: Omit<MaintenanceRecord, "id" | "batchId">[]) => {
    for (const row of rows) {
      insertMany.run(uuidv4(), row.storeId, row.date, row.type, row.description, batchId);
    }
  });
  tx(data);
  repo.createImportBatch(
    "maintenance",
    data.length,
    validation.warnings.length > 0 ? "partial" : "success",
    validation.warnings.length > 0 ? JSON.stringify(validation.warnings) : null,
    batchId
  );
  const anomalyCount = recalculateAnomaliesForStores([...new Set(data.map(r => r.storeId))]);
  return {
    success: true,
    batchId,
    recordCount: data.length,
    warnings: validation.warnings,
    anomalyCount,
  };
}

export function recalculateAnomaliesForStores(storeIds: string[]): number {
  let anomalyCount = 0;
  for (const storeId of storeIds) {
    anomalyCount += recalculateAnomaliesForStore(storeId);
  }
  return anomalyCount;
}

export function recalculateAnomaliesForStore(storeId: string): number {
  const readings = repo.getMeterReadings(storeId);
  const hoursMap = new Map(repo.getBusinessHours(storeId).map(h => [h.date, h]));
  const threshold = repo.getThresholdForStore(storeId);
  let anomalyCount = 0;
  for (let i = 1; i < readings.length; i++) {
    const curr = readings[i];
    const prev = readings[i - 1];
    const dailyConsumption = curr.reading - prev.reading;
    const hours = hoursMap.get(curr.date);
    const actualHours = hours ? (hours.closeHour - hours.openHour) : STANDARD_HOURS;
    const expectedConsumption = threshold.dailyLimit * (actualHours / STANDARD_HOURS) * threshold.hoursCorrectionFactor;
    const deviationRate = expectedConsumption > 0
      ? ((dailyConsumption - expectedConsumption) / expectedConsumption) * 100
      : dailyConsumption > 0 ? 999 : 0;
    const maintenance = repo.hasMaintenanceOnDate(storeId, curr.date);
    const isBackward = dailyConsumption < 0;
    const isOverThreshold = deviationRate > threshold.fluctuationRate;
    if (isBackward || isOverThreshold) {
      let attribution: string | null = null;
      if (isBackward) attribution = "读数倒退";
      else if (maintenance) attribution = "维修干扰";
      repo.upsertAnomaly({
        storeId,
        date: curr.date,
        dailyConsumption,
        expectedConsumption,
        deviationRate,
        status: "pending",
        attribution,
      });
      anomalyCount++;
    }
  }
  return anomalyCount;
}

export function recalculateAllAnomalies(): number {
  const stores = repo.getStores();
  let anomalyCount = 0;
  for (const store of stores) {
    anomalyCount += recalculateAnomaliesForStore(store.id);
  }
  return anomalyCount;
}

export function reviewAnomaly(id: string, payload: ReviewPayload): Anomaly {
  return repo.updateAnomalyReview(
    id,
    payload.status,
    payload.attribution || null,
    payload.note,
    payload.evidenceSource,
    payload.reviewer
  );
}

export function getAnomaliesForExport(filters?: any) {
  const anomalies = repo.getAnomalies(filters);
  const stores = new Map(repo.getStores().map(s => [s.id, s]));
  return anomalies.map(a => ({
    id: a.id,
    storeName: stores.get(a.storeId)?.name || a.storeId,
    storeId: a.storeId,
    date: a.date,
    dailyConsumption: a.dailyConsumption,
    expectedConsumption: a.expectedConsumption,
    deviationRate: a.deviationRate,
    status: a.status,
    attribution: a.attribution,
    note: a.note,
    evidenceSource: a.evidenceSource,
    reviewer: a.reviewer,
    reviewedAt: a.reviewedAt,
    createdAt: a.createdAt,
  }));
}

export function toCSV(rows: any[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = headers.join(",");
  const bodyLines = rows.map(row => headers.map(h => escape(row[h])).join(","));
  return [headerLine, ...bodyLines].join("\n");
}
