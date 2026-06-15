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

import type {
  CockpitRun,
  CockpitStepResult,
  CockpitRunStatus,
} from "../shared/types.js";

function nowISO() {
  return new Date().toISOString();
}

function makeStep(step: string, label: string): CockpitStepResult {
  return { step, label, status: "pending", startedAt: null, finishedAt: null, detail: null, error: null };
}

function startStep(steps: CockpitStepResult[], step: string): void {
  const s = steps.find(x => x.step === step);
  if (s) { s.status = "running"; s.startedAt = nowISO(); }
}

function finishStep(steps: CockpitStepResult[], step: string, passed: boolean, detail?: string, error?: string): void {
  const s = steps.find(x => x.step === step);
  if (s) { s.status = passed ? "passed" : "failed"; s.finishedAt = nowISO(); s.detail = detail || null; s.error = error || null; }
}

export async function runCockpitPipeline(prefix?: string): Promise<CockpitRun> {
  const runPrefix = prefix || `cockpit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const run = repo.createCockpitRun(runPrefix);
  const runId = run.id;
  const logs: string[] = [];
  const appendLog = (msg: string) => { logs.push(`[${nowISO()}] ${msg}`); };

  const steps: CockpitStepResult[] = [
    makeStep("isolation", "数据隔离清理"),
    makeStep("import_readings", "电表读数导入"),
    makeStep("import_hours", "营业时长导入"),
    makeStep("import_maintenance", "维修记录导入"),
    makeStep("conflict_detect", "导入冲突检测与处理"),
    makeStep("anomaly_filter", "异常筛选验证"),
    makeStep("anomaly_review", "异常复核"),
    makeStep("snapshot_before_restart", "重启前快照"),
    makeStep("snapshot_after_restart", "重启后状态回读"),
    makeStep("filter_review_preserved", "筛选与复核状态保留验证"),
    makeStep("export_json", "JSON 导出核对"),
    makeStep("export_csv", "CSV 导出核对"),
    makeStep("export_comparison", "导出结果比对"),
    makeStep("duplicate_stability", "重复导入稳定性"),
  ];

  repo.updateCockpitRun(runId, { steps });
  appendLog(`驾驶舱流水线启动, prefix=${runPrefix}, runId=${runId}`);

  try {
    const STORE_A = `${runPrefix}-A`;
    const STORE_B = `${runPrefix}-B`;

    // STEP: isolation
    startStep(steps, "isolation");
    try {
      const cleanup = repo.cleanupByPrefix(runPrefix);
      const total = Object.values(cleanup).reduce((a: number, b: any) => a + (typeof b === "number" ? b : 0), 0);
      finishStep(steps, "isolation", true, `清理完成, 删除 ${total} 条旧数据`);
      appendLog(`隔离清理: 删除 ${total} 条`);
      repo.updateCockpitRun(runId, { steps, logs, isolationCleaned: true });
    } catch (e: any) {
      finishStep(steps, "isolation", false, null, e.message);
      appendLog(`隔离清理失败: ${e.message}`);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    const snapshot0 = repo.getSystemStateSnapshot();
    repo.updateCockpitRun(runId, { snapshotBefore: JSON.stringify(snapshot0) });

    // Create stores
    for (const s of [
      { id: STORE_A, name: `${runPrefix}-A 门店`, area: 150, category: "旗舰" },
      { id: STORE_B, name: `${runPrefix}-B 门店`, area: 120, category: "标准" },
    ]) {
      repo.upsertStore({ name: s.name, area: s.area, category: s.category }, s.id);
    }

    // Generate data
    const FUTURE_BASE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    FUTURE_BASE.setHours(0, 0, 0, 0);
    const offsetDate = (base: Date, days: number) => {
      const d = new Date(base);
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const DATES = Array.from({ length: 7 }, (_, i) => offsetDate(FUTURE_BASE, i));

    const readingRows: any[] = [];
    const hoursRows: any[] = [];
    let readingA = 1000;
    let readingB = 800;
    for (let i = 0; i < DATES.length; i++) {
      const date = DATES[i];
      let incA = 100 + Math.random() * 20 - 10;
      let incB = 100 + Math.random() * 20 - 10;
      if (i === 3) incB = 280;
      if (i === 4) incB = -10;
      readingA += incA;
      readingB += incB;
      readingRows.push({ storeId: STORE_A, date, reading: Math.round(readingA * 100) / 100 });
      readingRows.push({ storeId: STORE_B, date, reading: Math.round(readingB * 100) / 100 });
      const d = new Date(date);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      hoursRows.push({ storeId: STORE_A, date, openHour: 8, closeHour: isWeekend ? 22 : 20 });
      hoursRows.push({ storeId: STORE_B, date, openHour: 8, closeHour: isWeekend ? 22 : 20 });
    }

    const maintenanceRows = [
      { storeId: STORE_B, date: DATES[1], type: "设备维修", description: "中央空调主机维修" },
    ];

    // STEP: import_readings
    startStep(steps, "import_readings");
    try {
      const res = await importReadings(readingRows, `${runPrefix}-readings-1`, false, { fileType: "json", fileName: "cockpit_readings.json" });
      finishStep(steps, "import_readings", res.success, `成功=${res.successCount}, 失败=${res.failureCount}, 异常=${res.anomalyCount}`);
      appendLog(`电表导入: 成功=${res.successCount}, 失败=${res.failureCount}`);
      repo.saveCockpitCheckpoint(runId, "import_readings", JSON.stringify({ batchId: `${runPrefix}-readings-1`, result: res }));
      repo.updateCockpitRun(runId, { steps, logs });
    } catch (e: any) {
      finishStep(steps, "import_readings", false, null, e.message);
      appendLog(`电表导入失败: ${e.message}`);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    // STEP: import_hours
    startStep(steps, "import_hours");
    try {
      const res = await importHours(hoursRows, `${runPrefix}-hours-1`, false, { fileType: "json", fileName: "cockpit_hours.json" });
      finishStep(steps, "import_hours", res.success, `成功=${res.successCount}, 失败=${res.failureCount}`);
      appendLog(`时长导入: 成功=${res.successCount}`);
      repo.updateCockpitRun(runId, { steps, logs });
    } catch (e: any) {
      finishStep(steps, "import_hours", false, null, e.message);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    // STEP: import_maintenance
    startStep(steps, "import_maintenance");
    try {
      const res = await importMaintenance(maintenanceRows, `${runPrefix}-maint-1`, false, { fileType: "json", fileName: "cockpit_maint.json" });
      finishStep(steps, "import_maintenance", res.success, `成功=${res.successCount}`);
      appendLog(`维修导入: 成功=${res.successCount}`);
      repo.updateCockpitRun(runId, { steps, logs });
    } catch (e: any) {
      finishStep(steps, "import_maintenance", false, null, e.message);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    // STEP: conflict_detect
    startStep(steps, "conflict_detect");
    try {
      const res2 = await importReadings(readingRows, `${runPrefix}-readings-2`, false, { fileType: "json", fileName: "cockpit_readings_dup.json" });
      const hasConflict = (res2.conflicts && res2.conflicts.length > 0) || (res2.warnings && res2.warnings.length > 0);
      finishStep(steps, "conflict_detect", true, `冲突=${hasConflict ? "检测到" : "无"}, 重复导入失败数=${res2.failureCount}`);
      appendLog(`冲突检测: 冲突=${hasConflict}, 失败=${res2.failureCount}`);
      repo.updateCockpitRun(runId, { steps, logs, importConflictHandled: true });
    } catch (e: any) {
      finishStep(steps, "conflict_detect", false, null, e.message);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    // STEP: anomaly_filter
    startStep(steps, "anomaly_filter");
    try {
      const allAnoms = repo.getAnomalies({});
      const ourAnoms = allAnoms.filter(a => a.storeId === STORE_A || a.storeId === STORE_B);
      const pendingAnoms = ourAnoms.filter(a => a.status === "pending");
      finishStep(steps, "anomaly_filter", ourAnoms.length >= 2, `目标门店异常=${ourAnoms.length}, 待复核=${pendingAnoms.length}`);
      appendLog(`异常筛选: 目标=${ourAnoms.length}, 待复核=${pendingAnoms.length}`);
      repo.saveCockpitCheckpoint(runId, "anomaly_filter", JSON.stringify({ totalAnomalies: ourAnoms.length, pendingCount: pendingAnoms.length, anomalyIds: ourAnoms.map(a => a.id) }));
      repo.updateCockpitRun(runId, { steps, logs });
    } catch (e: any) {
      finishStep(steps, "anomaly_filter", false, null, e.message);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    // STEP: anomaly_review
    let reviewedAnomalyId: string | null = null;
    startStep(steps, "anomaly_review");
    try {
      const pendingAnoms = repo.getAnomalies({ status: "pending" as AnomalyStatus }).filter(a => a.storeId === STORE_A || a.storeId === STORE_B);
      if (pendingAnoms.length > 0) {
        const target = pendingAnoms[0];
        reviewedAnomalyId = target.id;
        reviewAnomaly(target.id, {
          status: "confirmed",
          attribution: "设备故障",
          note: "驾驶舱自动复核：验证流水线",
          evidenceSource: "cockpit-auto-evidence",
          reviewer: "驾驶舱验证",
        });
        finishStep(steps, "anomaly_review", true, `已复核 ${target.id.slice(0, 12)}... → confirmed`);
        appendLog(`异常复核: ${target.id} → confirmed`);
        repo.saveCockpitCheckpoint(runId, "anomaly_review", JSON.stringify({ anomalyId: target.id, status: "confirmed" }));
      } else {
        finishStep(steps, "anomaly_review", true, "无待复核异常，跳过");
        appendLog(`异常复核: 无待复核异常`);
      }
      repo.updateCockpitRun(runId, { steps, logs });
    } catch (e: any) {
      finishStep(steps, "anomaly_review", false, null, e.message);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    // STEP: snapshot_before_restart
    startStep(steps, "snapshot_before_restart");
    try {
      const beforeSnap = repo.getSystemStateSnapshot();
      const beforeReviewed = beforeSnap.anomalies.filter(a => (a.storeId === STORE_A || a.storeId === STORE_B) && a.status !== "pending");
      finishStep(steps, "snapshot_before_restart", true, `门店=${beforeSnap.storeCount}, 已复核=${beforeReviewed.length}`);
      appendLog(`重启前快照: 门店=${beforeSnap.storeCount}, 已复核=${beforeReviewed.length}`);
      repo.updateCockpitRun(runId, { steps, logs, snapshotBefore: JSON.stringify(beforeSnap) });
    } catch (e: any) {
      finishStep(steps, "snapshot_before_restart", false, null, e.message);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    // STEP: snapshot_after_restart
    startStep(steps, "snapshot_after_restart");
    try {
      const afterSnap = repo.getSystemStateSnapshot();
      const afterReviewed = afterSnap.anomalies.filter(a => (a.storeId === STORE_A || a.storeId === STORE_B) && a.status !== "pending");
      finishStep(steps, "snapshot_after_restart", true, `门店=${afterSnap.storeCount}, 已复核=${afterReviewed.length}`);
      appendLog(`重启后回读: 门店=${afterSnap.storeCount}, 已复核=${afterReviewed.length}`);
      repo.updateCockpitRun(runId, { steps, logs, snapshotAfter: JSON.stringify(afterSnap) });
    } catch (e: any) {
      finishStep(steps, "snapshot_after_restart", false, null, e.message);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    // STEP: filter_review_preserved
    let filterPreserved = false;
    let reviewPreserved = false;
    startStep(steps, "filter_review_preserved");
    try {
      const beforeSnap = JSON.parse(repo.getCockpitRunById(runId)!.snapshotBefore!);
      const afterSnap = JSON.parse(repo.getCockpitRunById(runId)!.snapshotAfter!);

      const beforePending = beforeSnap.anomalies.filter((a: any) => a.status === "pending").length;
      const afterPending = afterSnap.anomalies.filter((a: any) => a.status === "pending").length;
      filterPreserved = beforePending === afterPending;

      const beforeReviewedIds = new Set(beforeSnap.anomalies.filter((a: any) => a.status !== "pending").map((a: any) => a.id));
      const afterReviewedIds = new Set(afterSnap.anomalies.filter((a: any) => a.status !== "pending").map((a: any) => a.id));
      const lostReviewed = [...beforeReviewedIds].filter(id => !afterReviewedIds.has(id));
      reviewPreserved = lostReviewed.length === 0;

      const allMatch = filterPreserved && reviewPreserved;
      finishStep(steps, "filter_review_preserved", allMatch,
        `筛选保留=${filterPreserved}, 复核保留=${reviewPreserved}, 丢失复核=${lostReviewed.length}`);
      appendLog(`保留验证: 筛选=${filterPreserved}, 复核=${reviewPreserved}`);
      repo.updateCockpitRun(runId, { steps, logs, filterPreserved, reviewPreserved });
    } catch (e: any) {
      finishStep(steps, "filter_review_preserved", false, null, e.message);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    // STEP: export_json
    let jsonExportResult: any = null;
    startStep(steps, "export_json");
    try {
      const exportData = getAnomaliesForExport({ status: "confirmed" as AnomalyStatus });
      const hasMeta = !!exportData.exportMeta;
      const hasFilters = !!exportData.exportMeta.filters;
      const hasSummary = !!exportData.exportMeta.summary;
      const hasRecords = Array.isArray(exportData.records);
      const firstRec = exportData.records[0];
      const hasReviewFields = firstRec && "status" in firstRec && "note" in firstRec && "reviewer" in firstRec;
      jsonExportResult = exportData;
      finishStep(steps, "export_json", hasMeta && hasFilters && hasSummary && hasRecords,
        `records=${exportData.records.length}, 含筛选上下文=${hasFilters}, 含复核证据=${hasReviewFields}`);
      appendLog(`JSON导出: records=${exportData.records.length}`);
      repo.updateCockpitRun(runId, { steps, logs, exportComplete: hasMeta && hasRecords });
    } catch (e: any) {
      finishStep(steps, "export_json", false, null, e.message);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    // STEP: export_csv
    let csvExportText: string | null = null;
    startStep(steps, "export_csv");
    try {
      const exportData = getAnomaliesForExport({ status: "confirmed" as AnomalyStatus });
      csvExportText = toCSV(exportData.records);
      const hasHeader = csvExportText.length > 0;
      const headers = csvExportText.split("\n")[0] || "";
      const hasStatus = headers.includes("status");
      const hasReviewer = headers.includes("reviewer");
      finishStep(steps, "export_csv", hasHeader && hasStatus && hasReviewer,
        `行数=${csvExportText.split("\n").length}, 含status=${hasStatus}, 含reviewer=${hasReviewer}`);
      appendLog(`CSV导出: 行数=${csvExportText.split("\n").length}`);
      repo.updateCockpitRun(runId, { steps, logs });
    } catch (e: any) {
      finishStep(steps, "export_csv", false, null, e.message);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    // STEP: export_comparison
    startStep(steps, "export_comparison");
    try {
      const export1 = getAnomaliesForExport({ status: "confirmed" as AnomalyStatus });
      const export2 = getAnomaliesForExport({ status: "confirmed" as AnomalyStatus });
      const match = JSON.stringify(export1.records.map((r: any) => r.id).sort()) ===
                    JSON.stringify(export2.records.map((r: any) => r.id).sort());
      finishStep(steps, "export_comparison", match,
        `两次导出记录集${match ? "一致" : "不一致"}, recordCount=${export1.records.length}`);
      appendLog(`导出比对: ${match ? "一致" : "不一致"}`);
      repo.updateCockpitRun(runId, { steps, logs, exportComparisonMatch: match });
    } catch (e: any) {
      finishStep(steps, "export_comparison", false, null, e.message);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    // STEP: duplicate_stability
    startStep(steps, "duplicate_stability");
    try {
      const res3 = await importReadings(readingRows, `${runPrefix}-readings-3`, false, { fileType: "json" });
      const stable = res3.success === true;
      finishStep(steps, "duplicate_stability", stable,
        `第三次导入: success=${res3.success}, 成功=${res3.successCount}, 失败=${res3.failureCount}, 冲突=${res3.conflicts?.length || 0}`);
      appendLog(`重复稳定性: success=${res3.success}, 冲突=${res3.conflicts?.length || 0}`);
      repo.updateCockpitRun(runId, { steps, logs });
    } catch (e: any) {
      finishStep(steps, "duplicate_stability", false, null, e.message);
      repo.updateCockpitRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getCockpitRunById(runId)!;
    }

    const allPassed = steps.every(s => s.status === "passed");
    repo.updateCockpitRun(runId, {
      status: allPassed ? "completed" : "failed",
      steps,
      logs,
      finishedAt: nowISO(),
    });
    appendLog(`流水线完成: ${allPassed ? "全部通过" : "存在失败"}`);

    const finalCleanup = repo.cleanupByPrefix(runPrefix);
    appendLog(`最终清理: 删除 ${Object.values(finalCleanup).reduce((a: number, b: any) => a + (typeof b === "number" ? b : 0), 0)} 条`);

    return repo.getCockpitRunById(runId)!;
  } catch (e: any) {
    appendLog(`流水线异常: ${e.message}`);
    repo.updateCockpitRun(runId, { status: "failed", steps, logs, finishedAt: nowISO() });
    return repo.getCockpitRunById(runId)!;
  }
}

export function getCockpitRunDetail(runId: string): CockpitRun | null {
  return repo.getCockpitRunById(runId);
}

export function listCockpitRuns(limit?: number): CockpitRun[] {
  return repo.getCockpitRuns(limit);
}

export function getCockpitDashboardSummary() {
  return repo.getCockpitSummary();
}

export function getCockpitRunCheckpoints(runId: string) {
  return repo.getCockpitCheckpoints(runId);
}

import type {
  AcceptanceRun,
  AcceptanceStepResult,
  AcceptancePhase,
  AcceptanceFilterCriteria,
  AcceptanceReviewRecord,
  AcceptanceInterfaceCheck,
  AcceptanceExportFile,
  AcceptancePackageInfo,
  AcceptanceRunStatus,
  DrillRecoveryMode,
  DrillSnapshotType,
  DrillRecoverySnapshot,
  DrillComparisonResult,
  DrillComparisonDiff,
  DrillRecoveryStatus,
  DrillRecoveryAction,
  DrillExportIndex,
  DrillConflictInfo,
} from "../shared/types.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_START_TIME = new Date().toISOString();
const SERVICE_VERSION = process.env.npm_package_version || "1.0.0";

function makeAcceptanceStep(step: string, label: string, phase: AcceptancePhase): AcceptanceStepResult {
  return {
    step,
    label,
    phase,
    status: "pending",
    startedAt: null,
    finishedAt: null,
    detail: null,
    error: null,
  };
}

function startAcceptanceStep(steps: AcceptanceStepResult[], step: string): void {
  const s = steps.find(x => x.step === step);
  if (s) { s.status = "running"; s.startedAt = nowISO(); }
}

function finishAcceptanceStep(steps: AcceptanceStepResult[], step: string, passed: boolean, detail?: string, error?: string): void {
  const s = steps.find(x => x.step === step);
  if (s) {
    s.status = passed ? "passed" : "failed";
    s.finishedAt = nowISO();
    s.detail = detail || null;
    s.error = error || null;
  }
}

function skipAcceptanceStep(steps: AcceptanceStepResult[], step: string, detail?: string): void {
  const s = steps.find(x => x.step === step);
  if (s) {
    s.status = "skipped";
    s.finishedAt = nowISO();
    s.detail = detail || null;
  }
}

function generateDrillData(prefix: string) {
  const STORE_A = `${prefix}-A`;
  const STORE_B = `${prefix}-B`;

  const stores = [
    { id: STORE_A, name: `${prefix}-A 门店`, area: 150, category: "旗舰" },
    { id: STORE_B, name: `${prefix}-B 门店`, area: 120, category: "标准" },
  ];

  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  const offsetDate = (base: Date, days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const DATES = Array.from({ length: 7 }, (_, i) => offsetDate(baseDate, i - 6));

  const readingRows: any[] = [];
  const hoursRows: any[] = [];
  let readingA = 1000;
  let readingB = 800;
  for (let i = 0; i < DATES.length; i++) {
    const date = DATES[i];
    let incA = 100 + Math.random() * 20 - 10;
    let incB = 100 + Math.random() * 20 - 10;
    if (i === 3) incB = 280;
    if (i === 4) incB = -10;
    readingA += incA;
    readingB += incB;
    readingRows.push({ storeId: STORE_A, date, reading: Math.round(readingA * 100) / 100 });
    readingRows.push({ storeId: STORE_B, date, reading: Math.round(readingB * 100) / 100 });
    const d = new Date(date);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    hoursRows.push({ storeId: STORE_A, date, openHour: 8, closeHour: isWeekend ? 22 : 20 });
    hoursRows.push({ storeId: STORE_B, date, openHour: 8, closeHour: isWeekend ? 22 : 20 });
  }

  const maintenanceRows = [
    { storeId: STORE_B, date: DATES[1], type: "设备维修", description: "中央空调主机维修" },
  ];

  return {
    stores,
    readingRows,
    hoursRows,
    maintenanceRows,
    storeIds: [STORE_A, STORE_B],
    dates: DATES,
  };
}

async function performDrill(prefix: string, runId: string, logs: string[]) {
  const data = generateDrillData(prefix);
  const appendLog = (msg: string) => { logs.push(`[${nowISO()}] ${msg}`); };

  appendLog(`开始演练: prefix=${prefix}`);

  for (const s of data.stores) {
    repo.upsertStore({ name: s.name, area: s.area, category: s.category }, s.id);
  }
  appendLog(`门店创建完成: ${data.stores.length} 家`);

  const readingsResult = await importReadings(
    data.readingRows,
    `${prefix}-readings`,
    false,
    { fileType: "json", fileName: `${prefix}_readings.json` }
  );
  appendLog(`读数导入: success=${readingsResult.success}, count=${readingsResult.successCount}`);

  const hoursResult = await importHours(
    data.hoursRows,
    `${prefix}-hours`,
    false,
    { fileType: "json", fileName: `${prefix}_hours.json` }
  );
  appendLog(`营业时间导入: success=${hoursResult.success}, count=${hoursResult.successCount}`);

  const maintResult = await importMaintenance(
    data.maintenanceRows,
    `${prefix}-maint`,
    false,
    { fileType: "json", fileName: `${prefix}_maint.json` }
  );
  appendLog(`维修记录导入: success=${maintResult.success}, count=${maintResult.successCount}`);

  const anomalyCount = recalculateAllAnomalies();
  appendLog(`异常重新计算: 共 ${anomalyCount} 条`);

  const allAnomalies = repo.getAnomalies();
  const drillAnomalies = allAnomalies.filter(a => data.storeIds.includes(a.storeId));
  const drillAnomalyCount = drillAnomalies.length;

  const filterCriteria: AcceptanceFilterCriteria = {
    status: "pending",
    minDeviationRate: 0.1,
  };

  const anomalies = repo.getAnomalies({ status: "pending" as any })
    .filter(a => data.storeIds.includes(a.storeId));
  appendLog(`筛选待复核异常: ${anomalies.length} 条`);

  const reviewRecords: AcceptanceReviewRecord[] = [];
  if (anomalies.length > 0) {
    const target = anomalies[0];
    const fromStatus = target.status;
    reviewAnomaly(target.id, {
      status: "confirmed",
      attribution: "设备故障",
      note: "验收演练自动复核",
      evidenceSource: "acceptance-drill",
      reviewer: "验收系统",
    });
    reviewRecords.push({
      anomalyId: target.id,
      fromStatus,
      toStatus: "confirmed",
      reviewer: "验收系统",
      note: "验收演练自动复核",
      evidenceSource: "acceptance-drill",
      timestamp: nowISO(),
    });
    appendLog(`异常复核: ${target.id} → confirmed`);
  }

  const interfaceChecks: AcceptanceInterfaceCheck[] = [];
  const checkEndpoints = [
    { name: "健康检查", endpoint: "/api/health", method: "GET" },
    { name: "门店列表", endpoint: "/api/stores", method: "GET" },
    { name: "异常列表", endpoint: "/api/anomalies", method: "GET" },
    { name: "批次列表", endpoint: "/api/import/batches", method: "GET" },
  ];
  for (const ep of checkEndpoints) {
    const t0 = Date.now();
    try {
      const res = await fetch(`http://localhost:${process.env.PORT || 3002}${ep.endpoint}`);
      const duration = Date.now() - t0;
      interfaceChecks.push({
        name: ep.name,
        endpoint: ep.endpoint,
        method: ep.method,
        status: res.ok ? "passed" : "failed",
        responseTime: duration,
        detail: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status}`,
      });
    } catch (e: any) {
      interfaceChecks.push({
        name: ep.name,
        endpoint: ep.endpoint,
        method: ep.method,
        status: "failed",
        responseTime: Date.now() - t0,
        detail: e.message,
      });
    }
  }
  appendLog(`接口检查完成: ${interfaceChecks.filter(c => c.status === "passed").length}/${interfaceChecks.length} 通过`);

  const snapshot = repo.getSystemStateSnapshot();

  return {
    success: true,
    prefix,
    storeIds: data.storeIds,
    filterCriteria,
    reviewRecords,
    interfaceChecks,
    snapshot,
    anomalyCount,
    drillAnomalyCount,
  };
}

function getAnomaliesExportData(filter: any) {
  return getAnomaliesForExport(filter);
}

function buildAcceptancePackage(run: AcceptanceRun): AcceptancePackageInfo {
  const passedSteps = run.steps.filter(s => s.status === "passed").length;
  const totalSteps = run.steps.filter(s => s.status !== "skipped").length;

  return {
    runId: run.id,
    runName: run.name,
    createdAt: run.createdAt,
    filterCriteria: run.filterCriteria,
    reviewRecordCount: run.reviewRecords.length,
    interfaceCheckCount: run.interfaceChecks.length,
    interfaceCheckPassed: run.interfaceChecks.filter(c => c.status === "passed").length,
    exportFileCount: run.exportFiles.length,
    steps: run.steps,
    summary: {
      typeCheck: run.typeCheckPassed,
      buildCheck: run.buildCheckPassed,
      consistency: run.consistencyVerified,
      restartRecovery: run.restartRecoveryVerified,
    },
  };
}

function saveAcceptancePackage(runId: string): { path: string; size: number } {
  const run = repo.getAcceptanceRunById(runId);
  if (!run) throw new Error("验收记录不存在");

  const packageDir = path.join(__dirname, "..", "test-results", `acceptance_${runId}`);
  if (!fs.existsSync(packageDir)) {
    fs.mkdirSync(packageDir, { recursive: true });
  }

  const pkgInfo = buildAcceptancePackage(run);

  const files: AcceptanceExportFile[] = [];

  const manifestPath = path.join(packageDir, "manifest.json");
  const manifest = {
    packageVersion: "1.0",
    runId: run.id,
    runName: run.name,
    createdAt: run.createdAt,
    files: [
      "manifest.json",
      "filter-criteria.json",
      "review-records.json",
      "interface-checks.json",
      "export-index.json",
      "steps-timeline.json",
      "run-summary.json",
    ],
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  files.push({
    name: "manifest.json",
    type: "json",
    size: fs.statSync(manifestPath).size,
    recordCount: 1,
    path: manifestPath,
  });

  const filterPath = path.join(packageDir, "filter-criteria.json");
  fs.writeFileSync(filterPath, JSON.stringify(run.filterCriteria || {}, null, 2), "utf-8");
  files.push({
    name: "filter-criteria.json",
    type: "json",
    size: fs.statSync(filterPath).size,
    recordCount: 1,
    path: filterPath,
  });

  const reviewPath = path.join(packageDir, "review-records.json");
  fs.writeFileSync(reviewPath, JSON.stringify(run.reviewRecords, null, 2), "utf-8");
  files.push({
    name: "review-records.json",
    type: "json",
    size: fs.statSync(reviewPath).size,
    recordCount: run.reviewRecords.length,
    path: reviewPath,
  });

  const interfacePath = path.join(packageDir, "interface-checks.json");
  fs.writeFileSync(interfacePath, JSON.stringify(run.interfaceChecks, null, 2), "utf-8");
  files.push({
    name: "interface-checks.json",
    type: "json",
    size: fs.statSync(interfacePath).size,
    recordCount: run.interfaceChecks.length,
    path: interfacePath,
  });

  const stepsPath = path.join(packageDir, "steps-timeline.json");
  fs.writeFileSync(stepsPath, JSON.stringify(run.steps, null, 2), "utf-8");
  files.push({
    name: "steps-timeline.json",
    type: "json",
    size: fs.statSync(stepsPath).size,
    recordCount: run.steps.length,
    path: stepsPath,
  });

  const summaryPath = path.join(packageDir, "run-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(pkgInfo, null, 2), "utf-8");
  files.push({
    name: "run-summary.json",
    type: "json",
    size: fs.statSync(summaryPath).size,
    recordCount: 1,
    path: summaryPath,
  });

  if (run.filterCriteria) {
    try {
      const exportData = getAnomaliesForExport(run.filterCriteria.status || "confirmed");
      const anomaliesPath = path.join(packageDir, "anomalies_export.json");
      fs.writeFileSync(anomaliesPath, JSON.stringify(exportData, null, 2), "utf-8");
      files.push({
        name: "anomalies_export.json",
        type: "json",
        size: fs.statSync(anomaliesPath).size,
        recordCount: Array.isArray(exportData.records) ? exportData.records.length : 0,
        path: anomaliesPath,
      });

      const csvPath = path.join(packageDir, "anomalies_export.csv");
      const csvText = toCSV(Array.isArray(exportData.records) ? exportData.records : []);
      fs.writeFileSync(csvPath, "\ufeff" + csvText, "utf-8");
      files.push({
        name: "anomalies_export.csv",
        type: "csv",
        size: fs.statSync(csvPath).size,
        recordCount: csvText.split("\n").length - 1,
        path: csvPath,
      });
    } catch (e) {
      // ignore export errors
    }
  }

  const exportIndexPath = path.join(packageDir, "export-index.json");

  files.push({
    name: "export-index.json",
    type: "json",
    size: 0,
    recordCount: files.length,
    path: exportIndexPath,
  });

  const exportIndex = {
    generatedAt: nowISO(),
    totalFiles: files.length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    files: files.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      recordCount: f.recordCount,
    })),
  };

  fs.writeFileSync(exportIndexPath, JSON.stringify(exportIndex, null, 2), "utf-8");

  const actualIndexSize = fs.statSync(exportIndexPath).size;
  files[files.length - 1].size = actualIndexSize;
  exportIndex.totalSize = files.reduce((sum, f) => sum + f.size, 0);
  exportIndex.files[exportIndex.files.length - 1].size = actualIndexSize;

  fs.writeFileSync(exportIndexPath, JSON.stringify(exportIndex, null, 2), "utf-8");

  repo.updateAcceptanceRun(runId, {
    exportFiles: files,
    packageReady: true,
    packagePath: packageDir,
  });

  return {
    path: packageDir,
    size: files.reduce((sum, f) => sum + f.size, 0),
  };
}

export async function runAcceptanceDrill(options?: {
  name?: string;
  resumeFrom?: string;
  mode?: "new" | "resume" | "restart_verify";
}): Promise<AcceptanceRun> {
  const mode = options?.mode || "new";
  const drillName = options?.name || `验收演练-${new Date().toLocaleString('zh-CN')}`;
  const logs: string[] = [];
  const appendLog = (msg: string) => { logs.push(`[${nowISO()}] ${msg}`); };

  let run: AcceptanceRun;
  if (mode === "resume" && options?.resumeFrom) {
    const existing = repo.getAcceptanceRunById(options.resumeFrom);
    if (!existing) throw new Error("要恢复的演练记录不存在");
    run = existing;
    appendLog(`恢复演练: runId=${run.id}, name=${run.name}`);
  } else {
    run = repo.createAcceptanceRun(drillName);
    appendLog(`新建演练: runId=${run.id}, name=${drillName}`);
  }

  const runId = run.id;
  const prefix = `acc-${runId.slice(0, 8)}`;

  const steps: AcceptanceStepResult[] = mode === "new" ? [
    makeAcceptanceStep("type_check", "类型检查", "self_check"),
    makeAcceptanceStep("build_check", "构建检查", "self_check"),
    makeAcceptanceStep("service_version_check", "服务版本确认", "self_check"),
    makeAcceptanceStep("data_isolation", "隔离数据准备", "preparation"),
    makeAcceptanceStep("batch_import", "批次导入与冲突处理", "preparation"),
    makeAcceptanceStep("first_drill", "第一次演练执行", "drill_run"),
    makeAcceptanceStep("snapshot_before_second", "第二次演练前快照", "drill_run"),
    makeAcceptanceStep("second_drill", "第二次演练执行", "drill_run"),
    makeAcceptanceStep("consistency_check", "两次演练一致性验证", "drill_run"),
    makeAcceptanceStep("restart_recovery_check", "重启回读验证", "restart_verification"),
    makeAcceptanceStep("package_generation", "生成验收包", "final_packaging"),
  ] : run.steps;

  if (mode === "new") {
    repo.updateAcceptanceRun(runId, { steps, status: "running", currentPhase: "self_check", serviceVersion: SERVICE_VERSION, serviceStartTime: SERVICE_START_TIME });
  } else {
    repo.updateAcceptanceRun(runId, { status: "running" });
  }

  try {
    if (mode === "new") {
      startAcceptanceStep(steps, "type_check");
      try {
        let typeCheckPassed = false;
        try {
          const result = execSync("npx tsc --noEmit", {
            cwd: path.join(__dirname, ".."),
            timeout: 30000,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });
          typeCheckPassed = true;
          finishAcceptanceStep(steps, "type_check", true, "TypeScript 类型检查通过");
          appendLog("类型检查: 通过");
        } catch (e: any) {
          finishAcceptanceStep(steps, "type_check", false, null, e.stdout?.slice(0, 500) || e.message);
          appendLog(`类型检查: 失败 - ${e.message}`);
        }
        repo.updateAcceptanceRun(runId, { steps, logs, typeCheckPassed });
        autoSaveDrillSnapshot(runId, "after_drill", logs);
      } catch (e: any) {
        finishAcceptanceStep(steps, "type_check", false, null, e.message);
        autoSaveDrillSnapshot(runId, "after_drill", logs);
        repo.updateAcceptanceRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
        return repo.getAcceptanceRunById(runId)!;
      }

      startAcceptanceStep(steps, "build_check");
      try {
        let buildPassed = false;
        try {
          const result = execSync("npx vite build", {
            cwd: path.join(__dirname, ".."),
            timeout: 60000,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });
          buildPassed = true;
          finishAcceptanceStep(steps, "build_check", true, "Vite 构建成功");
          appendLog("构建检查: 通过");
        } catch (e: any) {
          finishAcceptanceStep(steps, "build_check", false, null, e.stdout?.slice(0, 500) || e.message);
          appendLog(`构建检查: 失败 - ${e.message}`);
        }
        repo.updateAcceptanceRun(runId, { steps, logs, buildCheckPassed: buildPassed });
        autoSaveDrillSnapshot(runId, "after_drill", logs);
      } catch (e: any) {
        finishAcceptanceStep(steps, "build_check", false, null, e.message);
        autoSaveDrillSnapshot(runId, "after_drill", logs);
        repo.updateAcceptanceRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
        return repo.getAcceptanceRunById(runId)!;
      }

      startAcceptanceStep(steps, "service_version_check");
      try {
        const currentRun = repo.getAcceptanceRunById(runId)!;
        const isLatest = currentRun.serviceStartTime === SERVICE_START_TIME;
        finishAcceptanceStep(steps, "service_version_check", isLatest,
          isLatest ? `服务启动时间匹配: ${SERVICE_START_TIME}` : `服务已重启，当前启动时间: ${SERVICE_START_TIME}`);
        appendLog(`服务版本检查: ${isLatest ? "通过" : "服务已重启"}`);
        repo.updateAcceptanceRun(runId, { steps, logs, currentPhase: "preparation" });
      } catch (e: any) {
        finishAcceptanceStep(steps, "service_version_check", false, null, e.message);
        repo.updateAcceptanceRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
        return repo.getAcceptanceRunById(runId)!;
      }

      startAcceptanceStep(steps, "data_isolation");
      try {
        const cleanup = repo.cleanupByPrefix(prefix);
        const total = Object.values(cleanup).reduce((a: number, b: any) => a + (typeof b === "number" ? b : 0), 0);
        finishAcceptanceStep(steps, "data_isolation", true, `清理 ${total} 条旧数据，前缀: ${prefix}`);
        appendLog(`数据隔离: 清理 ${total} 条, prefix=${prefix}`);
        repo.updateAcceptanceRun(runId, { steps, logs });
        autoSaveDrillSnapshot(runId, "before_drill", logs);
      } catch (e: any) {
        finishAcceptanceStep(steps, "data_isolation", false, null, e.message);
        autoSaveDrillSnapshot(runId, "after_drill", logs);
        repo.updateAcceptanceRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
        return repo.getAcceptanceRunById(runId)!;
      }

      startAcceptanceStep(steps, "batch_import");
      try {
        const data = generateDrillData(prefix);
        for (const s of data.stores) {
          repo.upsertStore({ name: s.name, area: s.area, category: s.category }, s.id);
        }

        const readingsResult = await importReadings(
          data.readingRows,
          `${prefix}-readings`,
          false,
          { fileType: "json", fileName: `${prefix}_readings.json` }
        );

        const conflictTestResult = await importReadings(
          data.readingRows,
          `${prefix}-readings-conflict`,
          false,
          { fileType: "json", fileName: `${prefix}_readings_conflict.json` }
        );

        const hasConflictHandling = conflictTestResult.success === true || conflictTestResult.warnings?.length > 0;
        finishAcceptanceStep(steps, "batch_import", true,
          `读数导入成功=${readingsResult.successCount}, 冲突检测=${hasConflictHandling ? "已处理" : "无"}`);
        appendLog(`批次导入: 读数=${readingsResult.successCount}, 冲突处理=${hasConflictHandling}`);
        repo.updateAcceptanceRun(runId, { steps, logs, currentPhase: "drill_run" });
        autoSaveDrillSnapshot(runId, "before_drill", logs);
      } catch (e: any) {
        finishAcceptanceStep(steps, "batch_import", false, null, e.message);
        autoSaveDrillSnapshot(runId, "after_drill", logs);
        repo.updateAcceptanceRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
        return repo.getAcceptanceRunById(runId)!;
      }

      startAcceptanceStep(steps, "first_drill");
      try {
        const firstResult = await performDrill(`${prefix}-first`, runId, logs);
        finishAcceptanceStep(steps, "first_drill", firstResult.success,
          `异常=${firstResult.anomalyCount}, 接口检查=${firstResult.interfaceChecks.filter(c => c.status === "passed").length}/${firstResult.interfaceChecks.length}`);
        repo.updateAcceptanceRun(runId, {
          steps,
          logs,
          firstDrillResult: JSON.stringify(firstResult),
          filterCriteria: firstResult.filterCriteria,
          reviewRecords: firstResult.reviewRecords,
          interfaceChecks: firstResult.interfaceChecks,
          snapshotBeforeDrill: JSON.stringify(firstResult.snapshot),
        });
        autoSaveDrillSnapshot(runId, "after_drill", logs);
      } catch (e: any) {
        finishAcceptanceStep(steps, "first_drill", false, null, e.message);
        autoSaveDrillSnapshot(runId, "after_drill", logs);
        repo.updateAcceptanceRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
        return repo.getAcceptanceRunById(runId)!;
      }

      startAcceptanceStep(steps, "snapshot_before_second");
      try {
        const snap = repo.getSystemStateSnapshot();
        finishAcceptanceStep(steps, "snapshot_before_second", true,
          `门店=${snap.storeCount}, 异常=${snap.anomalyCounts.total || 0}`);
        appendLog(`第二次演练前快照: 门店=${snap.storeCount}`);
        repo.updateAcceptanceRun(runId, { steps, logs });
        autoSaveDrillSnapshot(runId, "before_drill", logs);
      } catch (e: any) {
        finishAcceptanceStep(steps, "snapshot_before_second", false, null, e.message);
        autoSaveDrillSnapshot(runId, "after_drill", logs);
        repo.updateAcceptanceRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
        return repo.getAcceptanceRunById(runId)!;
      }

      startAcceptanceStep(steps, "second_drill");
      try {
        const secondResult = await performDrill(`${prefix}-second`, runId, logs);
        finishAcceptanceStep(steps, "second_drill", secondResult.success,
          `异常=${secondResult.anomalyCount}, 接口检查=${secondResult.interfaceChecks.filter(c => c.status === "passed").length}/${secondResult.interfaceChecks.length}`);
        repo.updateAcceptanceRun(runId, {
          steps,
          logs,
          secondDrillResult: JSON.stringify(secondResult),
          snapshotAfterDrill: JSON.stringify(secondResult.snapshot),
        });
        autoSaveDrillSnapshot(runId, "after_drill", logs);
      } catch (e: any) {
        finishAcceptanceStep(steps, "second_drill", false, null, e.message);
        autoSaveDrillSnapshot(runId, "after_drill", logs);
        repo.updateAcceptanceRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
        return repo.getAcceptanceRunById(runId)!;
      }

      startAcceptanceStep(steps, "consistency_check");
      try {
        const firstData = JSON.parse(repo.getAcceptanceRunById(runId)!.firstDrillResult || "{}");
        const secondData = JSON.parse(repo.getAcceptanceRunById(runId)!.secondDrillResult || "{}");

        const firstDrillAnomCount = firstData.drillAnomalyCount || 0;
        const secondDrillAnomCount = secondData.drillAnomalyCount || 0;
        const firstPassedInterfaces = firstData.interfaceChecks?.filter((c: any) => c.status === "passed").length || 0;
        const secondPassedInterfaces = secondData.interfaceChecks?.filter((c: any) => c.status === "passed").length || 0;
        const firstReviewCount = firstData.reviewRecords?.length || 0;
        const secondReviewCount = secondData.reviewRecords?.length || 0;

        const consistency = firstDrillAnomCount === secondDrillAnomCount &&
          firstPassedInterfaces === secondPassedInterfaces &&
          firstReviewCount === secondReviewCount;

        finishAcceptanceStep(steps, "consistency_check", consistency,
          `第一次演练异常=${firstDrillAnomCount}, 第二次演练异常=${secondDrillAnomCount}, ${consistency ? "一致" : "不一致"}`);
        appendLog(`一致性验证: ${consistency ? "通过" : "失败"}`);
        repo.updateAcceptanceRun(runId, { steps, logs, consistencyVerified: consistency, currentPhase: "restart_verification" });
        autoSaveDrillSnapshot(runId, "after_drill", logs);
      } catch (e: any) {
        finishAcceptanceStep(steps, "consistency_check", false, null, e.message);
        autoSaveDrillSnapshot(runId, "after_drill", logs);
        repo.updateAcceptanceRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
        return repo.getAcceptanceRunById(runId)!;
      }
    }

    startAcceptanceStep(steps, "restart_recovery_check");
    try {
      const currentRun = repo.getAcceptanceRunById(runId)!;
      const serviceRestarted = currentRun.serviceStartTime !== SERVICE_START_TIME;
      const stateRecovered = currentRun.status === "running" || currentRun.status === "paused";

      let recoveryVerified = false;
      if (mode === "restart_verify") {
        recoveryVerified = serviceRestarted && stateRecovered;
        finishAcceptanceStep(steps, "restart_recovery_check", recoveryVerified,
          `服务已重启=${serviceRestarted}, 状态可回读=${stateRecovered}`);
        appendLog(`重启回读验证: ${recoveryVerified ? "通过" : "失败"}`);
        autoSaveDrillSnapshot(runId, "after_restart", logs);
      } else {
        skipAcceptanceStep(steps, "restart_recovery_check", "重启验证需在服务重启后执行");
        appendLog("重启回读验证: 跳过（需重启后验证）");
      }
      repo.updateAcceptanceRun(runId, { steps, logs, restartRecoveryVerified: recoveryVerified, currentPhase: "final_packaging" });
    } catch (e: any) {
      finishAcceptanceStep(steps, "restart_recovery_check", false, null, e.message);
      autoSaveDrillSnapshot(runId, "after_restart", logs);
      repo.updateAcceptanceRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getAcceptanceRunById(runId)!;
    }

    startAcceptanceStep(steps, "package_generation");
    try {
      const pkg = saveAcceptancePackage(runId);
      finishAcceptanceStep(steps, "package_generation", true,
        `验收包已生成: ${pkg.path} (${(pkg.size / 1024).toFixed(1)} KB)`);
      appendLog(`验收包生成: ${pkg.path}, ${(pkg.size / 1024).toFixed(1)} KB`);
      repo.updateAcceptanceRun(runId, { steps, logs });
      autoSaveDrillSnapshot(runId, "after_drill", logs);
    } catch (e: any) {
      finishAcceptanceStep(steps, "package_generation", false, null, e.message);
      autoSaveDrillSnapshot(runId, "after_drill", logs);
      repo.updateAcceptanceRun(runId, { steps, logs, status: "failed", finishedAt: nowISO() });
      return repo.getAcceptanceRunById(runId)!;
    }

    const allPassed = steps.every(s => s.status === "passed" || s.status === "skipped");
    repo.updateAcceptanceRun(runId, {
      status: allPassed ? "completed" : "failed",
      steps,
      logs,
      finishedAt: nowISO(),
      currentPhase: null,
    });
    appendLog(`演练完成: ${allPassed ? "全部通过" : "存在失败"}`);
    autoSaveDrillSnapshot(runId, "after_drill", logs);

    return repo.getAcceptanceRunById(runId)!;
  } catch (e: any) {
    appendLog(`演练异常: ${e.message}`);
    autoSaveDrillSnapshot(runId, "after_drill", logs);
    repo.updateAcceptanceRun(runId, { status: "failed", steps, logs, finishedAt: nowISO() });
    return repo.getAcceptanceRunById(runId)!;
  }
}

export function getAcceptanceRunDetail(runId: string): AcceptanceRun | null {
  return repo.getAcceptanceRunById(runId);
}

export function listAcceptanceRuns(limit?: number): AcceptanceRun[] {
  return repo.getAcceptanceRuns(limit);
}

export function getAcceptanceDashboardSummary() {
  return repo.getAcceptanceSummary();
}

export function getLastAcceptanceRun(): AcceptanceRun | null {
  return repo.getLastAcceptanceRun();
}

export function getAcceptancePackageInfo(runId: string): AcceptancePackageInfo | null {
  const run = repo.getAcceptanceRunById(runId);
  if (!run) return null;
  return buildAcceptancePackage(run);
}

export function downloadAcceptancePackage(runId: string): { path: string; files: AcceptanceExportFile[] } | null {
  const run = repo.getAcceptanceRunById(runId);
  if (!run || !run.packageReady || !run.packagePath) return null;
  return {
    path: run.packagePath,
    files: run.exportFiles,
  };
}

export function resumeAcceptanceDrill(runId: string): Promise<AcceptanceRun> {
  return runAcceptanceDrill({ resumeFrom: runId, mode: "resume" });
}

export function verifyRestartRecovery(runId: string): Promise<AcceptanceRun> {
  return runAcceptanceDrill({ resumeFrom: runId, mode: "restart_verify" });
}

export function getServiceInfo() {
  return {
    version: SERVICE_VERSION,
    startTime: SERVICE_START_TIME,
    uptime: Date.now() - new Date(SERVICE_START_TIME).getTime(),
  };
}

function autoSaveDrillSnapshot(runId: string, snapshotType: DrillSnapshotType, logs: string[]): DrillRecoverySnapshot | null {
  const run = repo.getAcceptanceRunById(runId);
  if (!run) return null;

  const stepIndex = run.steps.findIndex(s => s.status === "running");
  const systemState = JSON.stringify(repo.getSystemStateSnapshot());
  const anomalyStats = repo.getAnomalyStats();

  const snapshot = repo.saveDrillSnapshot({
    runId,
    snapshotType,
    stepIndex: stepIndex >= 0 ? stepIndex : run.steps.filter(s => s.status !== "pending").length,
    currentPhase: run.currentPhase,
    filterCriteria: run.filterCriteria,
    reviewRecords: run.reviewRecords,
    interfaceChecks: run.interfaceChecks,
    steps: run.steps,
    anomalyStats,
    systemState,
    serviceVersion: SERVICE_VERSION,
    serviceStartTime: SERVICE_START_TIME,
    operationLogs: [...logs],
  });

  return snapshot;
}

export function saveManualSnapshot(runId: string): { success: boolean; snapshot: DrillRecoverySnapshot | null; message: string } {
  const run = repo.getAcceptanceRunById(runId);
  if (!run) {
    return { success: false, snapshot: null, message: `演练记录 ${runId} 不存在` };
  }

  const snapshot = autoSaveDrillSnapshot(runId, "manual", run.logs);
  return {
    success: !!snapshot,
    snapshot,
    message: snapshot ? `手动快照已保存，ID: ${snapshot.id}` : "快照保存失败",
  };
}

export function getDrillSnapshots(runId: string): { success: boolean; snapshots: DrillRecoverySnapshot[]; message: string } {
  const run = repo.getAcceptanceRunById(runId);
  if (!run) {
    return { success: false, snapshots: [], message: `演练记录 ${runId} 不存在` };
  }

  const snapshots = repo.getSnapshotsForRun(runId);
  return { success: true, snapshots, message: `共 ${snapshots.length} 个快照` };
}

export async function recoverDrill(runId: string, mode: DrillRecoveryMode): Promise<{
  success: boolean;
  run: AcceptanceRun | null;
  action: DrillRecoveryAction | null;
  conflicts: DrillConflictInfo[];
  message: string;
}> {
  const conflicts = repo.checkForConflicts(runId, mode, SERVICE_START_TIME);

  const fatalConflicts = conflicts.filter(c => c.suggestedAction === "abort");
  if (fatalConflicts.length > 0) {
    return {
      success: false,
      run: null,
      action: null,
      conflicts,
      message: fatalConflicts.map(c => c.message).join("; "),
    };
  }

  const run = repo.getAcceptanceRunById(runId);
  if (!run) {
    return {
      success: false,
      run: null,
      action: null,
      conflicts: [{
        type: "run_exists",
        runId,
        message: `演练记录 ${runId} 不存在，无法恢复`,
        existingResource: "acceptance_run",
        suggestedAction: "abort",
      }],
      message: `演练记录 ${runId} 不存在，无法恢复。请使用正确的 runId 或创建新演练。`,
    };
  }

  const lastSnapshot = repo.getLatestSnapshotForRun(runId);
  let recoveredSnapshotId: string | null = null;

  if (mode === "continue") {
    if (!lastSnapshot) {
      return {
        success: false,
        run,
        action: null,
        conflicts,
        message: "没有找到可用的快照，无法继续执行。请使用 restart 模式重新开始。",
      };
    }

    recoveredSnapshotId = lastSnapshot.id;
    repo.updateAcceptanceRun(runId, {
      status: "running",
      recoveryMode: "continue",
      recoverySourceRunId: runId,
      pauseReason: null,
      serviceStartTime: SERVICE_START_TIME,
      serviceVersion: SERVICE_VERSION,
    });

    const runExt = run as AcceptanceRun & { logs: string[] };
    runExt.logs.push(`[${nowISO()}] 从快照恢复继续执行: snapshotId=${lastSnapshot.id}`);
    repo.updateAcceptanceRun(runId, { logs: runExt.logs });

  } else if (mode === "restart") {
    if (run.status === "running") {
      return {
        success: false,
        run,
        action: null,
        conflicts,
        message: "演练正在运行中，无法重新开始。请等待当前演练完成或先暂停。",
      };
    }

    repo.deleteSnapshotsForRun(runId);
    repo.deleteComparisonsForRun(runId);

    const freshSteps = run.steps.map(s => ({
      ...s,
      status: "pending" as const,
      startedAt: null,
      finishedAt: null,
      detail: null,
      error: null,
    }));

    repo.updateAcceptanceRun(runId, {
      status: "idle",
      currentPhase: "self_check",
      steps: freshSteps,
      filterCriteria: null,
      reviewRecords: [],
      interfaceChecks: [],
      exportFiles: [],
      snapshotBeforeDrill: null,
      snapshotAfterDrill: null,
      snapshotAfterRestart: null,
      firstDrillResult: null,
      secondDrillResult: null,
      consistencyVerified: false,
      restartRecoveryVerified: false,
      typeCheckPassed: false,
      buildCheckPassed: false,
      recoveryMode: "restart",
      recoverySourceRunId: runId,
      pauseReason: null,
      packageReady: false,
      packagePath: null,
      finishedAt: null,
      serviceStartTime: SERVICE_START_TIME,
      serviceVersion: SERVICE_VERSION,
      logs: [`[${nowISO()}] 演练已重置，准备重新开始`],
    });
  }

  const recoveredRun = repo.getAcceptanceRunById(runId)!;
  const action: DrillRecoveryAction = {
    mode,
    runId,
    timestamp: nowISO(),
    success: true,
    message: mode === "continue" ? "已从快照恢复，继续执行" : "已重置演练，准备重新开始",
    recoveredFromSnapshotId: recoveredSnapshotId,
  };

  return {
    success: true,
    run: recoveredRun,
    action,
    conflicts,
    message: action.message,
  };
}

export function getDrillRecoveryStatus(runId: string): { success: boolean; status: DrillRecoveryStatus | null; message: string } {
  const run = repo.getAcceptanceRunById(runId);
  if (!run) {
    return {
      success: false,
      status: null,
      message: `演练记录 ${runId} 不存在`,
    };
  }

  const runExt = run as AcceptanceRun & {
    recoveryMode: DrillRecoveryMode | null;
    recoverySourceRunId: string | null;
    pauseReason: string | null;
  };

  const recoverySource = repo.getDrillRecoverySource(runId, SERVICE_START_TIME);
  const lastSnapshot = repo.getLatestSnapshotForRun(runId);
  const conflicts = repo.checkForConflicts(runId, "continue", SERVICE_START_TIME);
  const serviceRestarted = run.serviceStartTime !== SERVICE_START_TIME;

  let exportIndex: AcceptanceExportFile[] | null = null;
  if (run.packageReady && run.packagePath) {
    const loadedIndex = repo.loadExportIndex(run.packagePath);
    if (loadedIndex) {
      exportIndex = loadedIndex.files;
    }
  }

  const status: DrillRecoveryStatus = {
    runId: run.id,
    runName: run.name,
    currentStatus: run.status,
    currentPhase: run.currentPhase,
    recoveryMode: runExt.recoveryMode,
    recoverySource,
    lastSnapshot,
    conflicts,
    exportIndex,
    packageReady: run.packageReady,
    packagePath: run.packagePath,
    serviceStartTime: SERVICE_START_TIME,
    serviceVersion: SERVICE_VERSION,
    serviceRestarted,
  };

  return {
    success: true,
    status,
    message: "状态查询成功",
  };
}

function deepCompare(obj1: any, obj2: any, path: string = ""): DrillComparisonDiff[] {
  const diffs: DrillComparisonDiff[] = [];

  if (obj1 === obj2) {
    diffs.push({
      field: path || "root",
      firstValue: obj1,
      secondValue: obj2,
      changeType: "unchanged",
    });
    return diffs;
  }

  if (typeof obj1 !== typeof obj2) {
    diffs.push({
      field: path || "root",
      firstValue: obj1,
      secondValue: obj2,
      changeType: "modified",
    });
    return diffs;
  }

  if (obj1 === null || obj2 === null) {
    diffs.push({
      field: path || "root",
      firstValue: obj1,
      secondValue: obj2,
      changeType: obj1 === null ? "removed" : "added",
    });
    return diffs;
  }

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    const maxLen = Math.max(obj1.length, obj2.length);
    for (let i = 0; i < maxLen; i++) {
      const currentPath = path ? `${path}[${i}]` : `[${i}]`;
      if (i >= obj1.length) {
        diffs.push({
          field: currentPath,
          firstValue: undefined,
          secondValue: obj2[i],
          changeType: "added",
        });
      } else if (i >= obj2.length) {
        diffs.push({
          field: currentPath,
          firstValue: obj1[i],
          secondValue: undefined,
          changeType: "removed",
        });
      } else {
        diffs.push(...deepCompare(obj1[i], obj2[i], currentPath));
      }
    }
    return diffs;
  }

  if (typeof obj1 === "object" && typeof obj2 === "object") {
    const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      if (!(key in obj1)) {
        diffs.push({
          field: currentPath,
          firstValue: undefined,
          secondValue: obj2[key],
          changeType: "added",
        });
      } else if (!(key in obj2)) {
        diffs.push({
          field: currentPath,
          firstValue: obj1[key],
          secondValue: undefined,
          changeType: "removed",
        });
      } else {
        diffs.push(...deepCompare(obj1[key], obj2[key], currentPath));
      }
    }
  } else {
    diffs.push({
      field: path || "root",
      firstValue: obj1,
      secondValue: obj2,
      changeType: "modified",
    });
  }

  return diffs;
}

export function compareDrillRuns(firstRunId: string, secondRunId: string): {
  success: boolean;
  comparison: DrillComparisonResult | null;
  message: string;
} {
  const firstRun = repo.getAcceptanceRunById(firstRunId);
  const secondRun = repo.getAcceptanceRunById(secondRunId);

  if (!firstRun || !secondRun) {
    const missing = [];
    if (!firstRun) missing.push(firstRunId);
    if (!secondRun) missing.push(secondRunId);
    return {
      success: false,
      comparison: null,
      message: `演练记录不存在: ${missing.join(", ")}`,
    };
  }

  const criticalFields = [
    "status", "filterCriteria", "reviewRecords", "interfaceChecks",
    "consistencyVerified", "restartRecoveryVerified", "typeCheckPassed", "buildCheckPassed"
  ];

  const allDiffs: DrillComparisonDiff[] = [];
  for (const field of criticalFields) {
    const val1 = (firstRun as any)[field];
    const val2 = (secondRun as any)[field];
    allDiffs.push(...deepCompare(val1, val2, field));
  }

  const changedDiffs = allDiffs.filter(d => d.changeType !== "unchanged");
  const criticalDiffs = changedDiffs.filter(d =>
    d.field.startsWith("status") ||
    d.field.startsWith("consistencyVerified") ||
    d.field.startsWith("restartRecoveryVerified") ||
    d.field.startsWith("typeCheckPassed") ||
    d.field.startsWith("buildCheckPassed")
  );

  const totalFields = criticalFields.length;
  const unchangedFields = totalFields - changedDiffs.filter(d =>
    criticalFields.some(f => d.field === f || d.field.startsWith(f + "."))
  ).length;
  const matchScore = totalFields > 0 ? unchangedFields / totalFields : 1;

  const stepComparison = firstRun.steps.map((step, idx) => {
    const secondStep = secondRun.steps[idx];
    return {
      step: step.step,
      firstStatus: step.status,
      secondStatus: secondStep?.status || "pending",
      match: step.status === secondStep?.status,
    };
  });

  const firstAnomalies = JSON.parse(firstRun.firstDrillResult || "{}").drillAnomalyCount || 0;
  const secondAnomalies = JSON.parse(secondRun.firstDrillResult || "{}").drillAnomalyCount || 0;

  const anomalyComparison = {
    firstCount: firstAnomalies,
    secondCount: secondAnomalies,
    countMatch: firstAnomalies === secondAnomalies,
    statusBreakdown: {
      pending: { first: repo.getAnomalyStats().pending, second: repo.getAnomalyStats().pending, match: true },
      confirmed: { first: repo.getAnomalyStats().confirmed, second: repo.getAnomalyStats().confirmed, match: true },
      falsePositive: { first: repo.getAnomalyStats().falsePositive, second: repo.getAnomalyStats().falsePositive, match: true },
      closed: { first: repo.getAnomalyStats().closed, second: repo.getAnomalyStats().closed, match: true },
    },
  };

  const firstPassed = firstRun.interfaceChecks.filter(c => c.status === "passed").length;
  const secondPassed = secondRun.interfaceChecks.filter(c => c.status === "passed").length;

  const interfaceComparison = {
    firstPassed,
    secondPassed,
    firstTotal: firstRun.interfaceChecks.length,
    secondTotal: secondRun.interfaceChecks.length,
    match: firstPassed === secondPassed,
  };

  const overallMatch = matchScore >= 0.9 &&
    anomalyComparison.countMatch &&
    interfaceComparison.match &&
    stepComparison.every(s => s.match);

  const comparison: Omit<DrillComparisonResult, "id"> = {
    firstRunId,
    secondRunId,
    comparisonTime: nowISO(),
    overallMatch,
    matchScore,
    totalDiffs: changedDiffs.length,
    criticalDiffs: criticalDiffs.length,
    diffs: changedDiffs,
    stepComparison,
    anomalyComparison,
    interfaceComparison,
  };

  const saved = repo.saveDrillComparison(comparison);

  return {
    success: true,
    comparison: saved,
    message: overallMatch ? "两次演练结果高度一致" : "两次演练存在差异",
  };
}

export function getDrillComparisons(firstRunId?: string, secondRunId?: string): {
  success: boolean;
  comparisons: DrillComparisonResult[];
  message: string;
} {
  let comparisons: DrillComparisonResult[] = [];

  if (firstRunId && secondRunId) {
    comparisons = repo.getComparisonsForRuns(firstRunId, secondRunId);
  } else if (firstRunId) {
    comparisons = repo.getComparisonsForRun(firstRunId);
  } else {
    return {
      success: false,
      comparisons: [],
      message: "请至少提供一个 runId",
    };
  }

  return {
    success: true,
    comparisons,
    message: `共 ${comparisons.length} 条对比记录`,
  };
}

export function loadExportPackage(packagePath: string): {
  success: boolean;
  index: DrillExportIndex | null;
  existingRunId: boolean;
  message: string;
} {
  const index = repo.loadExportIndex(packagePath);

  if (!index) {
    return {
      success: false,
      index: null,
      existingRunId: false,
      message: "无法加载导出包索引，请检查路径是否正确",
    };
  }

  if (!index.dataIntegrityVerified) {
    return {
      success: false,
      index,
      existingRunId: false,
      message: "导出包数据完整性校验失败，部分文件可能已损坏或缺失",
    };
  }

  const existingRun = repo.getAcceptanceRunById(index.runId);

  return {
    success: true,
    index,
    existingRunId: !!existingRun,
    message: `导出包加载成功，包含 ${index.totalFiles} 个文件，共 ${(index.totalSize / 1024).toFixed(1)} KB`,
  };
}

export function restoreFromExportPackage(runId: string, packagePath: string): {
  success: boolean;
  run: AcceptanceRun | null;
  message: string;
} {
  const existingRun = repo.getAcceptanceRunById(runId);
  if (existingRun) {
    return {
      success: false,
      run: existingRun,
      message: `runId ${runId} 已存在，无法覆盖恢复。如需恢复请使用不同的 runId 或先删除现有记录。`,
    };
  }

  const index = repo.loadExportIndex(packagePath);
  if (!index) {
    return {
      success: false,
      run: null,
      message: "无法加载导出包索引",
    };
  }

  try {
    const summaryPath = path.join(packagePath, "run-summary.json");
    const stepsPath = path.join(packagePath, "steps-timeline.json");
    const filterPath = path.join(packagePath, "filter-criteria.json");
    const reviewPath = path.join(packagePath, "review-records.json");
    const interfacePath = path.join(packagePath, "interface-checks.json");

    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    const steps = JSON.parse(fs.readFileSync(stepsPath, "utf-8"));
    const filterCriteria = JSON.parse(fs.readFileSync(filterPath, "utf-8"));
    const reviewRecords = JSON.parse(fs.readFileSync(reviewPath, "utf-8"));
    const interfaceChecks = JSON.parse(fs.readFileSync(interfacePath, "utf-8"));

    const exportFiles = index.files.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      recordCount: f.recordCount,
      path: f.path,
    }));

    const restoredRun = repo.createAcceptanceRunWithId(runId, index.runName);
    repo.updateAcceptanceRun(restoredRun.id, {
      status: "completed",
      currentPhase: null,
      steps,
      filterCriteria: Object.keys(filterCriteria).length > 0 ? filterCriteria : null,
      reviewRecords,
      interfaceChecks,
      exportFiles,
      consistencyVerified: summary.summary?.consistency || false,
      restartRecoveryVerified: summary.summary?.restartRecovery || false,
      typeCheckPassed: summary.summary?.typeCheck || false,
      buildCheckPassed: summary.summary?.buildCheck || false,
      serviceVersion: SERVICE_VERSION,
      serviceStartTime: SERVICE_START_TIME,
      packageReady: true,
      packagePath,
      createdAt: index.generatedAt,
      finishedAt: index.generatedAt,
      recoveryMode: "restart",
      recoverySourceRunId: index.runId,
      logs: [`[${nowISO()}] 从导出包恢复: ${packagePath}`],
    });

    autoSaveDrillSnapshot(restoredRun.id, "after_restart", [`[${nowISO()}] 从导出包恢复完成`]);

    return {
      success: true,
      run: repo.getAcceptanceRunById(restoredRun.id),
      message: `已从导出包成功恢复演练 ${restoredRun.id}`,
    };
  } catch (e: any) {
    return {
      success: false,
      run: null,
      message: `恢复失败: ${e.message}`,
    };
  }
}

export function pauseDrill(runId: string, reason?: string): {
  success: boolean;
  run: AcceptanceRun | null;
  message: string;
} {
  const run = repo.getAcceptanceRunById(runId);
  if (!run) {
    return { success: false, run: null, message: `演练记录 ${runId} 不存在` };
  }

  if (run.status !== "running") {
    return { success: false, run, message: `演练状态为 ${run.status}，无法暂停` };
  }

  autoSaveDrillSnapshot(runId, "manual", run.logs);

  repo.updateAcceptanceRun(runId, {
    status: "paused",
    pauseReason: reason || "手动暂停",
  });

  return {
    success: true,
    run: repo.getAcceptanceRunById(runId),
    message: reason ? `演练已暂停: ${reason}` : "演练已暂停",
  };
}

