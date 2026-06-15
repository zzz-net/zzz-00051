import * as repo from "./repositories.js";
import { db } from "./repositories.js";
import { v4 as uuidv4 } from "uuid";
import Papa from "papaparse";
import type {
  MeterReading,
  BusinessHours,
  MaintenanceRecord,
  ThresholdConfig,
  AnomalyStatus,
  ReviewPayload,
  Anomaly,
  ImportBatchType,
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
    // —— 必填字段：原始值空、null、undefined 全部拦截
    if (row.storeId === undefined || row.storeId === null || String(row.storeId).trim() === "") {
      errors.push(`第${line}行: 缺少必填字段 storeId`);
    }
    if (row.date === undefined || row.date === null || String(row.date).trim() === "") {
      errors.push(`第${line}行: 缺少必填字段 date`);
    }
    const readingRaw = row.reading;
    if (readingRaw === undefined || readingRaw === null || (typeof readingRaw === "string" && readingRaw.trim() === "")) {
      errors.push(`第${line}行: 缺少必填字段 reading（空值禁止入库）`);
    } else {
      const n = Number(readingRaw);
      if (isNaN(n)) {
        errors.push(`第${line}行: reading 必须是有效数字`);
      } else if (n < 0) {
        errors.push(`第${line}行: reading 不能为负数（电表读数为累计值）`);
      }
    }
    if (row.date && !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date).trim())) {
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
  const isEmpty = (v: any) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  data.forEach((row, idx) => {
    const line = idx + 2;
    if (isEmpty(row.storeId)) errors.push(`第${line}行: 缺少必填字段 storeId`);
    if (isEmpty(row.date)) errors.push(`第${line}行: 缺少必填字段 date`);
    if (isEmpty(row.openHour)) {
      errors.push(`第${line}行: 缺少必填字段 openHour`);
    } else if (isNaN(Number(row.openHour))) {
      errors.push(`第${line}行: openHour 必须是有效数字`);
    }
    if (isEmpty(row.closeHour)) {
      errors.push(`第${line}行: 缺少必填字段 closeHour`);
    } else if (isNaN(Number(row.closeHour))) {
      errors.push(`第${line}行: closeHour 必须是有效数字`);
    }
    if (!isEmpty(row.openHour) && !isEmpty(row.closeHour) && !isNaN(Number(row.openHour)) && !isNaN(Number(row.closeHour))) {
      if (Number(row.closeHour) <= Number(row.openHour)) {
        errors.push(`第${line}行: closeHour 必须大于 openHour`);
      }
    }
    if (!isEmpty(row.date) && !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date).trim())) {
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
  const isEmpty = (v: any) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  data.forEach((row, idx) => {
    const line = idx + 2;
    if (isEmpty(row.storeId)) errors.push(`第${line}行: 缺少必填字段 storeId`);
    if (isEmpty(row.date)) errors.push(`第${line}行: 缺少必填字段 date`);
    if (isEmpty(row.type)) errors.push(`第${line}行: 缺少必填字段 type`);
    if (isEmpty(row.description)) errors.push(`第${line}行: 缺少必填字段 description`);
    if (!isEmpty(row.date) && !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date).trim())) {
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

function getCoverageDates(data: any[]): { start: string | null; end: string | null } {
  if (!data || data.length === 0) return { start: null, end: null };
  const dates = data
    .map((r) => r.date)
    .filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(String(d)))
    .sort();
  if (dates.length === 0) return { start: null, end: null };
  return { start: dates[0], end: dates[dates.length - 1] };
}

interface ConflictInfo {
  rowIndex: number;
  storeId: string;
  date: string;
  existingBatchId?: string | null;
  message: string;
}

function detectReadingsConflicts(data: any[]): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  data.forEach((row, idx) => {
    if (!row.storeId || !row.date) return;
    const existing = db
      .prepare("SELECT batch_id FROM meter_readings WHERE store_id = ? AND date = ? LIMIT 1")
      .get(row.storeId, row.date) as any;
    if (existing) {
      conflicts.push({
        rowIndex: idx,
        storeId: row.storeId,
        date: row.date,
        existingBatchId: existing.batch_id,
        message: `门店 ${row.storeId} 在 ${row.date} 已有读数记录（来自批次 ${existing.batch_id?.slice(0, 8)}），将被忽略避免覆盖历史数据`,
      });
    }
  });
  return conflicts;
}

function detectHoursConflicts(data: any[]): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  data.forEach((row, idx) => {
    if (!row.storeId || !row.date) return;
    const existing = db
      .prepare("SELECT batch_id FROM business_hours WHERE store_id = ? AND date = ? LIMIT 1")
      .get(row.storeId, row.date) as any;
    if (existing) {
      conflicts.push({
        rowIndex: idx,
        storeId: row.storeId,
        date: row.date,
        existingBatchId: existing.batch_id,
        message: `门店 ${row.storeId} 在 ${row.date} 已有营业时长（来自批次 ${existing.batch_id?.slice(0, 8)}），将被忽略避免覆盖历史数据`,
      });
    }
  });
  return conflicts;
}

function detectMaintenanceConflicts(data: any[]): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  data.forEach((row, idx) => {
    if (!row.storeId || !row.date || !row.type || !row.description) return;
    const existing = db
      .prepare("SELECT batch_id FROM maintenance_records WHERE store_id = ? AND date = ? AND type = ? AND description = ? LIMIT 1")
      .get(row.storeId, row.date, row.type, row.description) as any;
    if (existing) {
      conflicts.push({
        rowIndex: idx,
        storeId: row.storeId,
        date: row.date,
        existingBatchId: existing.batch_id,
        message: `门店 ${row.storeId} 在 ${row.date} 已有相同维修记录（来自批次 ${existing.batch_id?.slice(0, 8)}），将被忽略避免覆盖历史数据`,
      });
    }
  });
  return conflicts;
}

function serializeOriginalContent(data: any[], fileType: string): string {
  if (fileType === "csv") {
    return toCSV(data);
  }
  return JSON.stringify(data, null, 2);
}

export async function importReadings(
  data: Omit<MeterReading, "id" | "batchId">[],
  batchId: string,
  autoUpsertStores = true,
  options?: {
    fileType?: string;
    fileName?: string;
    parentBatchId?: string;
  }
) {
  const validation = validateReadings(data, batchId);
  const coverage = getCoverageDates(data);
  const originalContent = serializeOriginalContent(data, options?.fileType || "json");

  if (!validation.valid) {
    const isDuplicateBatch = validation.errors.some((e) => e.includes("已存在，请勿重复导入"));
    if (!isDuplicateBatch) {
      repo.createImportBatch("readings", data.length, "failed", {
        errors: JSON.stringify(validation.errors),
        batchId,
        fileType: options?.fileType,
        fileName: options?.fileName,
        successCount: 0,
        failureCount: data.length,
        originalContent,
        parentBatchId: options?.parentBatchId,
        coverageStartDate: coverage.start,
        coverageEndDate: coverage.end,
      });
      data.forEach((row, idx) => {
        const rowErrors = validation.errors.filter((e) => e.includes(`第${idx + 2}行`));
        const errMsg = rowErrors.length > 0 ? rowErrors.join("; ") : "整体校验失败";
        repo.insertBatchRecord(batchId, idx, row, false, errMsg);
      });
    }
    return { success: false, errors: validation.errors, warnings: validation.warnings };
  }

  const conflicts = detectReadingsConflicts(data);
  const conflictIndexes = new Set(conflicts.map((c) => c.rowIndex));
  const conflictMessages = conflicts.map((c) => c.message);
  const allWarnings = [...validation.warnings, ...conflictMessages];

  repo.createImportBatch("readings", data.length, "failed", {
    batchId,
    fileType: options?.fileType,
    fileName: options?.fileName,
    originalContent,
    parentBatchId: options?.parentBatchId,
    coverageStartDate: coverage.start,
    coverageEndDate: coverage.end,
  });

  if (autoUpsertStores) {
    const storeIds = [...new Set(data.map((r) => r.storeId))];
    for (const storeId of storeIds) {
      if (!repo.getStoreById(storeId)) {
        repo.upsertStore({ name: storeId, area: 100, category: "默认" }, storeId);
      }
    }
  }

  const insertMany = db.prepare(
    "INSERT OR IGNORE INTO meter_readings (id, store_id, date, reading, batch_id) VALUES (?, ?, ?, ?, ?)"
  );

  let successCount = 0;
  let failureCount = 0;
  const tx = db.transaction((rows: Omit<MeterReading, "id" | "batchId">[]) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const isConflict = conflictIndexes.has(i);
      if (isConflict) {
        failureCount++;
        repo.insertBatchRecord(batchId, i, row, false, conflicts.find((c) => c.rowIndex === i)?.message, true);
        continue;
      }
      const info = insertMany.run(uuidv4(), row.storeId, row.date, row.reading, batchId);
      const inserted = (info as any).changes > 0;
      if (inserted) {
        successCount++;
        repo.insertBatchRecord(batchId, i, row, true);
      } else {
        failureCount++;
        repo.insertBatchRecord(batchId, i, row, false, "数据库写入失败或记录已存在", true);
      }
    }
  });
  tx(data);

  const totalProcessed = successCount + failureCount;
  const batchStatus: "success" | "partial" | "failed" =
    successCount === data.length
      ? "success"
      : successCount > 0
      ? "partial"
      : "failed";

  repo.updateImportBatchStatus(batchId, batchStatus, {
    errors: allWarnings.length > 0 ? JSON.stringify(allWarnings) : null,
    successCount,
    failureCount,
  });

  const anomalyCount = recalculateAnomaliesForStores([...new Set(data.map((r) => r.storeId))]);
  return {
    success: true,
    batchId,
    recordCount: data.length,
    successCount,
    failureCount,
    warnings: allWarnings,
    conflicts: conflictMessages,
    anomalyCount,
  };
}

export async function importHours(
  data: Omit<BusinessHours, "id" | "batchId">[],
  batchId: string,
  autoUpsertStores = true,
  options?: {
    fileType?: string;
    fileName?: string;
    parentBatchId?: string;
  }
) {
  const validation = validateHours(data, batchId);
  const coverage = getCoverageDates(data);
  const originalContent = serializeOriginalContent(data, options?.fileType || "json");

  if (!validation.valid) {
    const isDuplicateBatch = validation.errors.some((e) => e.includes("已存在，请勿重复导入"));
    if (!isDuplicateBatch) {
      repo.createImportBatch("hours", data.length, "failed", {
        errors: JSON.stringify(validation.errors),
        batchId,
        fileType: options?.fileType,
        fileName: options?.fileName,
        successCount: 0,
        failureCount: data.length,
        originalContent,
        parentBatchId: options?.parentBatchId,
        coverageStartDate: coverage.start,
        coverageEndDate: coverage.end,
      });
      data.forEach((row, idx) => {
        const rowErrors = validation.errors.filter((e) => e.includes(`第${idx + 2}行`));
        const errMsg = rowErrors.length > 0 ? rowErrors.join("; ") : "整体校验失败";
        repo.insertBatchRecord(batchId, idx, row, false, errMsg);
      });
    }
    return { success: false, errors: validation.errors, warnings: validation.warnings };
  }

  const conflicts = detectHoursConflicts(data);
  const conflictIndexes = new Set(conflicts.map((c) => c.rowIndex));
  const conflictMessages = conflicts.map((c) => c.message);
  const allWarnings = [...validation.warnings, ...conflictMessages];

  repo.createImportBatch("hours", data.length, "failed", {
    batchId,
    fileType: options?.fileType,
    fileName: options?.fileName,
    originalContent,
    parentBatchId: options?.parentBatchId,
    coverageStartDate: coverage.start,
    coverageEndDate: coverage.end,
  });

  if (autoUpsertStores) {
    const storeIds = [...new Set(data.map((r) => r.storeId))];
    for (const storeId of storeIds) {
      if (!repo.getStoreById(storeId)) {
        repo.upsertStore({ name: storeId, area: 100, category: "默认" }, storeId);
      }
    }
  }

  const insertMany = db.prepare(
    "INSERT OR IGNORE INTO business_hours (id, store_id, date, open_hour, close_hour, batch_id) VALUES (?, ?, ?, ?, ?, ?)"
  );

  let successCount = 0;
  let failureCount = 0;
  const tx = db.transaction((rows: Omit<BusinessHours, "id" | "batchId">[]) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const isConflict = conflictIndexes.has(i);
      if (isConflict) {
        failureCount++;
        repo.insertBatchRecord(batchId, i, row, false, conflicts.find((c) => c.rowIndex === i)?.message, true);
        continue;
      }
      const info = insertMany.run(uuidv4(), row.storeId, row.date, row.openHour, row.closeHour, batchId);
      const inserted = (info as any).changes > 0;
      if (inserted) {
        successCount++;
        repo.insertBatchRecord(batchId, i, row, true);
      } else {
        failureCount++;
        repo.insertBatchRecord(batchId, i, row, false, "数据库写入失败或记录已存在", true);
      }
    }
  });
  tx(data);

  const batchStatus: "success" | "partial" | "failed" =
    successCount === data.length
      ? "success"
      : successCount > 0
      ? "partial"
      : "failed";

  repo.updateImportBatchStatus(batchId, batchStatus, {
    errors: allWarnings.length > 0 ? JSON.stringify(allWarnings) : null,
    successCount,
    failureCount,
  });

  const anomalyCount = recalculateAnomaliesForStores([...new Set(data.map((r) => r.storeId))]);
  return {
    success: true,
    batchId,
    recordCount: data.length,
    successCount,
    failureCount,
    warnings: allWarnings,
    conflicts: conflictMessages,
    anomalyCount,
  };
}

export async function importMaintenance(
  data: Omit<MaintenanceRecord, "id" | "batchId">[],
  batchId: string,
  autoUpsertStores = true,
  options?: {
    fileType?: string;
    fileName?: string;
    parentBatchId?: string;
  }
) {
  const validation = validateMaintenance(data, batchId);
  const coverage = getCoverageDates(data);
  const originalContent = serializeOriginalContent(data, options?.fileType || "json");

  if (!validation.valid) {
    const isDuplicateBatch = validation.errors.some((e) => e.includes("已存在，请勿重复导入"));
    if (!isDuplicateBatch) {
      repo.createImportBatch("maintenance", data.length, "failed", {
        errors: JSON.stringify(validation.errors),
        batchId,
        fileType: options?.fileType,
        fileName: options?.fileName,
        successCount: 0,
        failureCount: data.length,
        originalContent,
        parentBatchId: options?.parentBatchId,
        coverageStartDate: coverage.start,
        coverageEndDate: coverage.end,
      });
      data.forEach((row, idx) => {
        const rowErrors = validation.errors.filter((e) => e.includes(`第${idx + 2}行`));
        const errMsg = rowErrors.length > 0 ? rowErrors.join("; ") : "整体校验失败";
        repo.insertBatchRecord(batchId, idx, row, false, errMsg);
      });
    }
    return { success: false, errors: validation.errors, warnings: validation.warnings };
  }

  const conflicts = detectMaintenanceConflicts(data);
  const conflictIndexes = new Set(conflicts.map((c) => c.rowIndex));
  const conflictMessages = conflicts.map((c) => c.message);
  const allWarnings = [...validation.warnings, ...conflictMessages];

  repo.createImportBatch("maintenance", data.length, "failed", {
    batchId,
    fileType: options?.fileType,
    fileName: options?.fileName,
    originalContent,
    parentBatchId: options?.parentBatchId,
    coverageStartDate: coverage.start,
    coverageEndDate: coverage.end,
  });

  if (autoUpsertStores) {
    const storeIds = [...new Set(data.map((r) => r.storeId))];
    for (const storeId of storeIds) {
      if (!repo.getStoreById(storeId)) {
        repo.upsertStore({ name: storeId, area: 100, category: "默认" }, storeId);
      }
    }
  }

  const insertMany = db.prepare(
    "INSERT OR IGNORE INTO maintenance_records (id, store_id, date, type, description, batch_id) VALUES (?, ?, ?, ?, ?, ?)"
  );

  let successCount = 0;
  let failureCount = 0;
  const tx = db.transaction((rows: Omit<MaintenanceRecord, "id" | "batchId">[]) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const isConflict = conflictIndexes.has(i);
      if (isConflict) {
        failureCount++;
        repo.insertBatchRecord(batchId, i, row, false, conflicts.find((c) => c.rowIndex === i)?.message, true);
        continue;
      }
      const info = insertMany.run(uuidv4(), row.storeId, row.date, row.type, row.description, batchId);
      const inserted = (info as any).changes > 0;
      if (inserted) {
        successCount++;
        repo.insertBatchRecord(batchId, i, row, true);
      } else {
        failureCount++;
        repo.insertBatchRecord(batchId, i, row, false, "数据库写入失败或记录已存在", true);
      }
    }
  });
  tx(data);

  const batchStatus: "success" | "partial" | "failed" =
    successCount === data.length
      ? "success"
      : successCount > 0
      ? "partial"
      : "failed";

  repo.updateImportBatchStatus(batchId, batchStatus, {
    errors: allWarnings.length > 0 ? JSON.stringify(allWarnings) : null,
    successCount,
    failureCount,
  });

  const anomalyCount = recalculateAnomaliesForStores([...new Set(data.map((r) => r.storeId))]);
  return {
    success: true,
    batchId,
    recordCount: data.length,
    successCount,
    failureCount,
    warnings: allWarnings,
    conflicts: conflictMessages,
    anomalyCount,
  };
}

export async function retryImport(
  parentBatchId: string,
  correctedContent: string,
  newBatchId: string
): Promise<any> {
  const parentBatch = repo.getImportBatchById(parentBatchId);
  if (!parentBatch) {
    return { success: false, errors: [`父批次 ${parentBatchId} 不存在`] };
  }

  let data: any[];
  const fileType = parentBatch.fileType || "json";
  if (fileType === "csv") {
    const parsed = Papa.parse(correctedContent, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) {
      return { success: false, errors: parsed.errors.map((e: any) => e.message) };
    }
    data = parsed.data;
  } else {
    try {
      data = typeof correctedContent === "string" ? JSON.parse(correctedContent) : correctedContent;
    } catch {
      return { success: false, errors: ["JSON 格式解析失败"] };
    }
  }

  const baseOptions = {
    fileType,
    fileName: parentBatch.fileName || undefined,
    parentBatchId,
  };

  if (parentBatch.type === "readings") {
    return importReadings(data as any, newBatchId, true, baseOptions);
  } else if (parentBatch.type === "hours") {
    return importHours(data as any, newBatchId, true, baseOptions);
  } else {
    return importMaintenance(data as any, newBatchId, true, baseOptions);
  }
}

export function getBatchExportData(batchId: string, format: "csv" | "json"): string {
  const detail = repo.getImportBatchDetail(batchId);
  if (!detail) {
    return "";
  }

  const rows = detail.records.map((rec) => ({
    batchId: detail.id,
    rowIndex: rec.rowIndex + 2,
    success: rec.success ? "是" : "否",
    isDuplicate: rec.isDuplicate ? "是" : "否",
    errorMessage: rec.errorMessage || "",
    ...(typeof rec.recordData === "object" ? rec.recordData : { recordData: String(rec.recordData) }),
    parentBatchId: detail.parentBatchId || "",
    childBatchIds: detail.childBatches.map((b) => b.id).join("; "),
    batchType: detail.type,
    batchStatus: detail.status,
    batchCreatedAt: detail.createdAt,
  }));

  const exportedAt = new Date().toISOString();
  const batchMeta = {
    id: detail.id,
    type: detail.type,
    fileType: detail.fileType,
    fileName: detail.fileName,
    recordCount: detail.recordCount,
    successCount: detail.successCount,
    failureCount: detail.failureCount,
    status: detail.status,
    errors: detail.errors ? JSON.parse(detail.errors) : null,
    coverageStartDate: detail.coverageStartDate,
    coverageEndDate: detail.coverageEndDate,
    parentBatchId: detail.parentBatchId,
    parentBatch: detail.parentBatch
      ? { id: detail.parentBatch.id, status: detail.parentBatch.status, createdAt: detail.parentBatch.createdAt }
      : null,
    childBatches: detail.childBatches.map((b) => ({
      id: b.id,
      status: b.status,
      successCount: b.successCount,
      failureCount: b.failureCount,
      createdAt: b.createdAt,
    })),
    createdAt: detail.createdAt,
  };

  const exportMeta = {
    exportedAt,
    batchId,
    recordCount: rows.length,
    successCount: detail.successCount,
    failureCount: detail.failureCount,
    duplicateCount: rows.filter((r) => r.isDuplicate === "是").length,
  };

  if (format === "csv") {
    const metaHeaderRows = [
      [`# 导出时间: ${exportedAt}`],
      [`# 批次ID: ${detail.id}`],
      [`# 批次类型: ${detail.type}`],
      [`# 批次状态: ${detail.status}`],
      [`# 记录总数: ${detail.recordCount}`],
      [`# 成功数: ${detail.successCount}`],
      [`# 失败数: ${detail.failureCount}`],
      [`# 覆盖日期: ${detail.coverageStartDate || "-"} ~ ${detail.coverageEndDate || "-"}`],
      [],
    ];
    const metaCSV = metaHeaderRows.map((r) => r.join(",")).join("\n");
    const dataCSV = toCSV(rows);
    return metaCSV + "\n" + dataCSV;
  }
  return JSON.stringify(
    {
      exportMeta,
      batch: batchMeta,
      records: rows,
    },
    null,
    2
  );
}

export function recalculateAnomaliesForStores(storeIds: string[]): number {
  let anomalyCount = 0;
  for (const storeId of storeIds) {
    anomalyCount += recalculateAnomaliesForStore(storeId);
  }
  return anomalyCount;
}

export function recalculateAnomaliesForStore(storeId: string): number {
  // 阈值/源数据变更，先清理待复核异常再按新条件重判；已复核状态保留不动
  repo.deletePendingAnomaliesForStore(storeId);
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
  repo.deleteAllPendingAnomalies();
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

export interface ExportMeta {
  exportMeta: {
    exportedAt: string;
    recordCount: number;
    filters: any;
    summary: {
      byStatus: Record<string, number>;
      byStore: Record<string, number>;
    };
  };
}

export function getAnomaliesForExport(filters?: any) {
  const anomalies = repo.getAnomalies(filters);
  const stores = new Map(repo.getStores().map(s => [s.id, s]));

  const storeIds = [...new Set(anomalies.map(a => a.storeId))];
  type ReadingByDate = Map<string, number>;
  type HoursByDate = Map<string, { openHour: number; closeHour: number }>;
  type MaintByDate = Map<string, { type: string; description: string } | null>;
  type ThresholdForStore = { dailyLimit: number; fluctuationRate: number; hoursCorrectionFactor: number };

  const readingsByStore = new Map<string, ReadingByDate>();
  const hoursByStore = new Map<string, HoursByDate>();
  const maintByStore = new Map<string, MaintByDate>();
  const thresholdByStore = new Map<string, ThresholdForStore>();

  for (const sid of storeIds) {
    const rds = repo.getMeterReadings(sid);
    readingsByStore.set(sid, new Map(rds.map(r => [r.date, r.reading])));
    const hrs = repo.getBusinessHours(sid);
    hoursByStore.set(sid, new Map(hrs.map(h => [h.date, { openHour: h.openHour, closeHour: h.closeHour }])));
    const maintMap: MaintByDate = new Map();
    const allMaint = (repo as any).getMaintenanceRecords?.(sid) || [];
    for (const m of allMaint) maintMap.set(m.date, { type: m.type, description: m.description });
    maintByStore.set(sid, maintMap);
    thresholdByStore.set(sid, repo.getThresholdForStore(sid));
  }

  function getPrevReading(sid: string, date: string): number | null {
    const m = readingsByStore.get(sid);
    if (!m) return null;
    const dates = [...m.keys()].sort();
    const idx = dates.indexOf(date);
    if (idx <= 0) return null;
    return m.get(dates[idx - 1]) ?? null;
  }

  const records = anomalies.map(a => {
    const sid = a.storeId;
    const store = stores.get(sid);
    const readings = readingsByStore.get(sid);
    const hours = hoursByStore.get(sid);
    const maint = maintByStore.get(sid);
    const th = thresholdByStore.get(sid)!;

    const readingCurr: number | null = readings?.get(a.date) ?? null;
    const readingPrev: number | null = readingCurr !== null ? getPrevReading(sid, a.date) : null;
    const hoursRec = hours?.get(a.date);
    const openHour = hoursRec ? hoursRec.openHour : null;
    const closeHour = hoursRec ? hoursRec.closeHour : null;
    const businessHours = (openHour !== null && closeHour !== null) ? +(closeHour - openHour).toFixed(2) : STANDARD_HOURS;
    const maintRec = maint?.get(a.date) ?? repo.hasMaintenanceOnDate(sid, a.date);
    const hasMaintenance = !!maintRec;
    const maintenanceType = maintRec?.type ?? null;
    const maintenanceDesc = maintRec?.description ?? null;

    return {
      id: a.id,
      storeName: store?.name || sid,
      storeId: sid,
      date: a.date,
      readingPrev,
      readingCurr,
      dailyConsumption: a.dailyConsumption,
      openHour,
      closeHour,
      businessHours,
      hasMaintenance,
      maintenanceType,
      maintenanceDesc,
      thresholdDailyLimit: th.dailyLimit,
      thresholdFluctuationRate: th.fluctuationRate,
      hoursCorrectionFactor: th.hoursCorrectionFactor,
      expectedConsumption: a.expectedConsumption,
      deviationRate: a.deviationRate,
      status: a.status,
      attribution: a.attribution,
      note: a.note,
      evidenceSource: a.evidenceSource,
      reviewer: a.reviewer,
      reviewedAt: a.reviewedAt,
      createdAt: a.createdAt,
    };
  });

  const byStatus: Record<string, number> = {};
  const byStore: Record<string, number> = {};
  for (const a of anomalies) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    const sname = stores.get(a.storeId)?.name || a.storeId;
    byStore[sname] = (byStore[sname] || 0) + 1;
  }

  return {
    exportMeta: {
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      filters: filters || {},
      summary: {
        byStatus,
        byStore,
      },
    },
    records,
  };
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
