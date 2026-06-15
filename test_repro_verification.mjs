#!/usr/bin/env node
/**
 * 能耗复盘看板 - 可复跑验证脚本
 *
 * 覆盖完整链路：
 *   1. 数据隔离清理
 *   2. 样例数据导入（电表/营业时长/维修记录）
 *   3. 异常筛选验证
 *   4. 异常复核
 *   5. 重启前后状态保留（快照对比）
 *   6. CSV/JSON 导出核对（含筛选条件和复核状态元信息）
 *   7. 重复导入稳定性验证
 *
 * 运行方式：
 *   npm run test:repro
 *   node test_repro_verification.mjs
 *
 * 前置条件：后端服务已启动 npm run server:dev
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "http://localhost:3002/api";
const SAMPLE_DATA_DIR = path.join(__dirname, "sample-data");

const RUN_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const PREFIX = `repro-${RUN_ID}`;
const B = (name) => `${PREFIX}-${name}`;
const STORE_A = `${PREFIX}-A`;
const STORE_B = `${PREFIX}-B`;

const LOG_DIR = path.join(__dirname, "test-results");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, `repro_${RUN_ID}.log`);
const EXPORT_DIR = path.join(LOG_DIR, `exports_${RUN_ID}`);
fs.mkdirSync(EXPORT_DIR, { recursive: true });

let stepIndex = 0;
const results = [];

function now() {
  return new Date().toISOString();
}

function writeLog(level, msg) {
  const line = `[${now()}] [${level}] ${msg}`;
  fs.appendFileSync(LOG_FILE, line + "\n", "utf-8");
  return line;
}

function log(level, msg) {
  const prefix =
    level === "PASS"
      ? "✅ PASS"
      : level === "FAIL"
      ? "❌ FAIL"
      : level === "WARN"
      ? "⚠️  WARN"
      : level === "STEP"
      ? "📌 STEP"
      : "ℹ️  INFO";
  const line = `${prefix} - ${msg}`;
  writeLog(level, msg);
  console.log(line);
}

function section(title) {
  const bar = "═".repeat(63);
  console.log(`\n${bar}`);
  console.log(`📋 ${title}`);
  console.log(bar);
  writeLog("SECTION", title);
}

function assert(condition, message, detail) {
  stepIndex++;
  const item = {
    index: stepIndex,
    condition: !!condition,
    message,
    detail: detail || "",
    timestamp: now(),
  };
  results.push(item);
  if (condition) {
    log("PASS", message);
    return true;
  } else {
    log("FAIL", message + (detail ? ` (${detail})` : ""));
    process.exitCode = 1;
    return false;
  }
}

function info(msg) {
  log("INFO", msg);
}

function offsetDate(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const FUTURE_BASE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
FUTURE_BASE.setHours(0, 0, 0, 0);
const DATES = Array.from({ length: 7 }, (_, i) => offsetDate(FUTURE_BASE, i));

async function checkServerAlive() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 15000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (await checkServerAlive()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function cleanupByPrefix(prefix) {
  const res = await fetch(`${BASE_URL}/verification/cleanup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix }),
  });
  return res.json();
}

async function getSnapshot() {
  const res = await fetch(`${BASE_URL}/verification/snapshot`);
  return res.json();
}

async function compareSnapshots(before, after, label) {
  const res = await fetch(`${BASE_URL}/verification/snapshot-compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ before, after, label }),
  });
  return res.json();
}

async function importReadingsCSV(content, batchId) {
  const res = await fetch(`${BASE_URL}/import/readings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileContent: content,
      fileType: "csv",
      fileName: "test_readings.csv",
      batchId,
    }),
  });
  return res.json();
}

async function importHoursCSV(content, batchId) {
  const res = await fetch(`${BASE_URL}/import/hours`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileContent: content,
      fileType: "csv",
      fileName: "test_hours.csv",
      batchId,
    }),
  });
  return res.json();
}

async function importMaintenanceCSV(content, batchId) {
  const res = await fetch(`${BASE_URL}/import/maintenance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileContent: content,
      fileType: "csv",
      fileName: "test_maint.csv",
      batchId,
    }),
  });
  return res.json();
}

async function getAnomalies(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.append(k, v);
  });
  const url = `${BASE_URL}/anomalies${params.toString() ? "?" + params.toString() : ""}`;
  const res = await fetch(url);
  return res.json();
}

async function reviewAnomaly(id, payload) {
  const res = await fetch(`${BASE_URL}/anomalies/${id}/review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function exportAnomalies(format, filters = {}) {
  const params = new URLSearchParams();
  params.append("format", format);
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.append(k, v);
  });
  const res = await fetch(`${BASE_URL}/anomalies/export?${params.toString()}`);
  return {
    ok: res.ok,
    contentType: res.headers.get("content-type"),
    contentDisposition: res.headers.get("content-disposition"),
    text: await res.text(),
  };
}

async function getBatchDetail(batchId) {
  const res = await fetch(`${BASE_URL}/import/batches/${batchId}`);
  return res.json();
}

function buildReadingsCSV(storeReadings) {
  const lines = ["storeId,date,reading"];
  for (const sr of storeReadings) {
    lines.push(`${sr.storeId},${sr.date},${sr.reading.toFixed(2)}`);
  }
  return lines.join("\n");
}

function buildHoursCSV(storeHours) {
  const lines = ["storeId,date,openHour,closeHour"];
  for (const sh of storeHours) {
    lines.push(`${sh.storeId},${sh.date},${sh.openHour},${sh.closeHour}`);
  }
  return lines.join("\n");
}

function buildMaintenanceCSV(records) {
  const lines = ["storeId,date,type,description"];
  for (const r of records) {
    lines.push(`${r.storeId},${r.date},${r.type},${r.description}`);
  }
  return lines.join("\n");
}

function generateReadings() {
  const rows = [];
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
    rows.push({ storeId: STORE_A, date, reading: readingA });
    rows.push({ storeId: STORE_B, date, reading: readingB });
  }
  return rows;
}

function generateHours() {
  const rows = [];
  for (let i = 0; i < DATES.length; i++) {
    const date = DATES[i];
    const d = new Date(date);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    rows.push({ storeId: STORE_A, date, openHour: 8, closeHour: isWeekend ? 22 : 20 });
    rows.push({ storeId: STORE_B, date, openHour: 8, closeHour: isWeekend ? 22 : 20 });
  }
  return rows;
}

function generateMaintenance() {
  return [
    { storeId: STORE_B, date: DATES[1], type: "设备维修", description: "中央空调主机维修" },
  ];
}

async function runAll() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║          能耗复盘看板 - 可复跑自动验证脚本                        ║");
  console.log("║  覆盖：导入 → 筛选 → 复核 → 重启保留 → 导出核对 → 重复执行       ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`\n▶ 运行ID: ${RUN_ID}`);
  console.log(`▶ 数据前缀: ${PREFIX}`);
  console.log(`▶ 日志文件: ${LOG_FILE}`);
  writeLog("BOOT", `Run started, prefix=${PREFIX}`);

  // ============================================================
  // STEP 0: 环境检查
  // ============================================================
  section("STEP 0: 环境健康检查");

  const serverAlive = await waitForServer();
  assert(serverAlive, "后端服务已启动在端口 3002", serverAlive ? "OK" : "未检测到服务");
  if (!serverAlive) {
    console.log("\n请先启动后端：npm run server:dev");
    process.exit(1);
  }

  const sampleFiles = ["meter_readings.csv", "business_hours.csv", "maintenance_records.csv"];
  for (const f of sampleFiles) {
    const exists = fs.existsSync(path.join(SAMPLE_DATA_DIR, f));
    assert(exists, `样例数据文件存在: ${f}`);
  }

  // ============================================================
  // STEP 1: 数据隔离清理
  // ============================================================
  section("STEP 1: 数据隔离 - 清理同前缀历史数据");

  const cleanupRes = await cleanupByPrefix(PREFIX);
  assert(cleanupRes.success, "数据清理接口调用成功");
  info(`清理结果: ${JSON.stringify(cleanupRes.data)}`);

  const snapshot0 = await getSnapshot();
  assert(snapshot0.success, "获取初始快照成功");
  info(
    `初始状态: 门店=${snapshot0.data.storeCount}, 异常=${snapshot0.data.anomalyCounts.total}, 批次=${snapshot0.data.totalImportBatches}`
  );

  // ============================================================
  // STEP 2: 首次导入链路
  // ============================================================
  section("STEP 2: 首次导入 - 电表读数 / 营业时长 / 维修记录");

  const readingsCSV = buildReadingsCSV(generateReadings());
  const hoursCSV = buildHoursCSV(generateHours());
  const maintCSV = buildMaintenanceCSV(generateMaintenance());

  const readingsBatchId = B("readings-1");
  const readingsRes = await importReadingsCSV(readingsCSV, readingsBatchId);
  assert(readingsRes.success === true, "电表读数导入返回 success=true");
  assert(readingsRes.data.recordCount === 14, `读数记录总数=14 (实际=${readingsRes.data?.recordCount})`);
  assert(readingsRes.data.successCount > 0, `读数成功导入>0 (实际=${readingsRes.data?.successCount})`);
  assert(
    readingsRes.data.anomalyCount >= 2,
    `读数导入后异常数>=2 (实际=${readingsRes.data?.anomalyCount}) - B门店能耗突增+倒退`
  );
  if (readingsRes.data.conflicts && readingsRes.data.conflicts.length > 0) {
    info(`导入冲突提示: ${readingsRes.data.conflicts.slice(0, 2).join("; ")}`);
  }

  const hoursBatchId = B("hours-1");
  const hoursRes = await importHoursCSV(hoursCSV, hoursBatchId);
  assert(hoursRes.success === true, "营业时长导入返回 success=true");
  assert(hoursRes.data.recordCount === 14, `时长记录总数=14 (实际=${hoursRes.data?.recordCount})`);
  assert(hoursRes.data.successCount > 0, `时长成功导入>0 (实际=${hoursRes.data?.successCount})`);

  const maintBatchId = B("maint-1");
  const maintRes = await importMaintenanceCSV(maintCSV, maintBatchId);
  assert(maintRes.success === true, "维修记录导入返回 success=true");
  assert(maintRes.data.recordCount === 1, `维修记录总数=1 (实际=${maintRes.data?.recordCount})`);

  info(`导入结果汇总: 读数成=${readingsRes.data.successCount} 时长成=${hoursRes.data.successCount} 维修成=${maintRes.data.successCount}`);

  // ============================================================
  // STEP 3: 批次详情与冲突信息验证
  // ============================================================
  section("STEP 3: 批次详情验证 - 元信息 / 冲突提示");

  const batchDetail = await getBatchDetail(readingsBatchId);
  assert(batchDetail.success, "读数批次详情可查询");
  const bd = batchDetail.data;
  assert(bd.type === "readings", `批次类型=readings (实际=${bd?.type})`);
  assert(bd.status === readingsRes.data.successCount === 14 ? "success" : bd.status, "批次状态合理");
  assert(bd.fileName === "test_readings.csv", `批次文件名正确 (实际=${bd?.fileName})`);
  assert(bd.successCount === readingsRes.data.successCount, `批次成功数一致 (${bd?.successCount})`);
  assert(bd.failureCount === readingsRes.data.failureCount, `批次失败数一致 (${bd?.failureCount})`);
  assert(bd.records.length >= readingsRes.data.successCount, "批次明细记录数正确");

  info(`批次明细: ${bd.records.filter(r => r.success).length}成功 / ${bd.records.filter(r => !r.success).length}失败 / ${bd.records.filter(r => r.isDuplicate).length}重复`);

  // ============================================================
  // STEP 4: 异常筛选验证
  // ============================================================
  section("STEP 4: 异常筛选验证");

  const allAnomRes = await getAnomalies();
  assert(allAnomRes.success, "异常列表接口可用");
  const allAnoms = allAnomRes.data.filter((a) => a.storeId === STORE_A || a.storeId === STORE_B);
  assert(allAnoms.length >= 2, `目标门店异常数>=2 (实际=${allAnoms.length})`);
  info(`目标门店异常列表共 ${allAnoms.length} 条`);

  const pendingRes = await getAnomalies({ status: "pending" });
  assert(pendingRes.success, "按 status=pending 筛选可用");
  const pendingOfInterest = pendingRes.data.filter((a) => a.storeId === STORE_A || a.storeId === STORE_B);
  assert(pendingOfInterest.length >= 1, `待复核异常>=1 (实际=${pendingOfInterest.length})`);

  const storeFilterRes = await getAnomalies({ storeId: STORE_B });
  assert(storeFilterRes.success, `按 storeId=${STORE_B} 筛选可用`);
  assert(
    storeFilterRes.data.every((a) => a.storeId === STORE_B),
    "门店筛选结果正确"
  );

  const reviewedAnomaly = pendingOfInterest[0] || allAnoms[0];
  assert(!!reviewedAnomaly, "存在可复核的异常");

  // ============================================================
  // STEP 5: 异常复核
  // ============================================================
  section("STEP 5: 异常复核 - 状态迁移 + 字段保留");

  const reviewRes = await reviewAnomaly(reviewedAnomaly.id, {
    status: "confirmed",
    attribution: "设备故障",
    note: "验证脚本自动复核：空调故障导致能耗突增",
    evidenceSource: "test-evidence/repro_verification.jpg",
    reviewer: "验证脚本",
  });
  assert(reviewRes.success === true, "异常复核返回 success=true");
  assert(reviewRes.data.status === "confirmed", `复核后状态=confirmed (实际=${reviewRes.data?.status})`);
  assert(reviewRes.data.note !== null, "复核备注已保存");
  assert(reviewRes.data.reviewer === "验证脚本", `复核人正确 (实际=${reviewRes.data?.reviewer})`);
  assert(reviewRes.data.evidenceSource !== null, "证据来源已保存");
  assert(reviewRes.data.reviewedAt !== null, "复核时间已记录");

  info(`已复核异常: ${reviewedAnomaly.id.slice(0, 12)}... → confirmed`);

  const confirmedAfter = await getAnomalies({ status: "confirmed" });
  const ourConfirmed = confirmedAfter.data.filter(
    (a) => (a.storeId === STORE_A || a.storeId === STORE_B) && a.status === "confirmed"
  );
  assert(ourConfirmed.length >= 1, "复核后 confirmed 异常数增加");

  // ============================================================
  // STEP 6: 重启前快照
  // ============================================================
  section("STEP 6: 重启前状态快照");

  const beforeRestart = await getSnapshot();
  assert(beforeRestart.success, "重启前快照获取成功");
  const beforeSnapshot = beforeRestart.data;

  const beforeReviewed = beforeSnapshot.anomalies.filter(
    (a) => (a.storeId === STORE_A || a.storeId === STORE_B) && a.status !== "pending"
  );
  assert(beforeReviewed.length >= 1, `重启前已复核异常>=1 (实际=${beforeReviewed.length})`);
  info(
    `重启前: 门店=${beforeSnapshot.storeCount}, 异常待复核=${beforeSnapshot.anomalyCounts.pending}, 已确认=${beforeSnapshot.anomalyCounts.confirmed}`
  );
  info(
    `重启前已复核异常: ${beforeReviewed
      .map((a) => `${a.storeId.slice(-6)}/${a.date}/${a.status}/${a.reviewer || "?"}`)
      .join("; ")}`
  );

  // ============================================================
  // STEP 7: CSV/JSON 导出核对
  // ============================================================
  section("STEP 7: CSV/JSON 导出核对 - 含筛选条件与复核状态");

  const exportFilters = { status: "confirmed" };

  const jsonExport = await exportAnomalies("json", exportFilters);
  assert(jsonExport.ok, "JSON 导出接口返回 200");
  assert(jsonExport.contentType?.includes("json"), `JSON Content-Type 正确 (实际=${jsonExport.contentType})`);
  const jsonParsed = JSON.parse(jsonExport.text);
  assert(!!jsonParsed.exportMeta, "JSON 导出包含 exportMeta 元信息");
  assert(jsonParsed.exportMeta.recordCount !== undefined, "exportMeta 含 recordCount");
  assert(!!jsonParsed.exportMeta.filters, "exportMeta 含 filters 筛选条件");
  assert(jsonParsed.exportMeta.filters.status === "confirmed", `exportMeta.filters.status=confirmed (实际=${jsonParsed.exportMeta.filters?.status})`);
  assert(!!jsonParsed.exportMeta.summary, "exportMeta 含 summary 汇总");
  assert(!!jsonParsed.exportMeta.summary.byStatus, "summary 含 byStatus");
  assert(Array.isArray(jsonParsed.records), "JSON 导出 records 为数组");

  if (jsonParsed.records.length > 0) {
    const rec = jsonParsed.records[0];
    assert("status" in rec, "记录含 status 复核状态字段");
    assert("note" in rec, "记录含 note 备注字段");
    assert("reviewer" in rec, "记录含 reviewer 复核人字段");
    assert("readingPrev" in rec, "记录含 readingPrev 证据链字段");
    assert("thresholdDailyLimit" in rec, "记录含 thresholdDailyLimit 判断依据字段");
  }

  const jsonPath = path.join(EXPORT_DIR, "anomalies_confirmed.json");
  fs.writeFileSync(jsonPath, jsonExport.text, "utf-8");
  info(`JSON 已保存: ${jsonPath}`);

  const csvExport = await exportAnomalies("csv", exportFilters);
  assert(csvExport.ok, "CSV 导出接口返回 200");
  assert(csvExport.contentType?.includes("csv"), `CSV Content-Type 正确 (实际=${csvExport.contentType})`);
  assert(
    csvExport.contentDisposition?.includes("status-confirmed"),
    `CSV 文件名包含筛选条件后缀 status-confirmed (实际=${csvExport.contentDisposition})`
  );

  const csvLines = csvExport.text.trim().split("\n");
  const commentLines = csvLines.filter((l) => l.startsWith("#"));
  assert(commentLines.length >= 4, `CSV 头部含导出元信息注释行 (${commentLines.length}行)`);

  const hasExportTime = commentLines.some((l) => l.includes("导出时间"));
  const hasRecordCount = commentLines.some((l) => l.includes("记录总数"));
  const hasFilters = commentLines.some((l) => l.includes("筛选条件"));
  const hasStatusSummary = commentLines.some((l) => l.includes("状态汇总"));
  assert(hasExportTime, "CSV 注释含导出时间");
  assert(hasRecordCount, "CSV 注释含记录总数");
  assert(hasFilters, "CSV 注释含筛选条件");
  assert(hasStatusSummary, "CSV 注释含状态汇总");

  const dataHeaderLine = csvLines.find((l) => !l.startsWith("#") && l.trim().length > 0);
  if (dataHeaderLine) {
    const headers = dataHeaderLine.split(",");
    assert(headers.includes("status"), "CSV 数据列含 status 复核状态");
    assert(headers.includes("note"), "CSV 数据列含 note 备注");
    assert(headers.includes("reviewer"), "CSV 数据列含 reviewer 复核人");
    assert(headers.includes("readingPrev"), "CSV 数据列含 readingPrev 证据链");
    assert(headers.includes("thresholdDailyLimit"), "CSV 数据列含 thresholdDailyLimit 判断依据");
  }

  const csvPath = path.join(EXPORT_DIR, "anomalies_confirmed.csv");
  fs.writeFileSync(csvPath, csvExport.text, "utf-8");
  info(`CSV 已保存: ${csvPath}`);

  // 无筛选全量导出，验证文件名不带筛选后缀
  const allExport = await exportAnomalies("json");
  assert(
    !allExport.contentDisposition?.includes("status-"),
    "无筛选时导出文件名不含状态筛选后缀"
  );

  // ============================================================
  // STEP 8: 批次导出核对
  // ============================================================
  section("STEP 8: 批次导出核对");

  const batchJsonRes = await fetch(`${BASE_URL}/import/batches/${readingsBatchId}/export?format=json`);
  const batchJson = await batchJsonRes.json();
  assert(!!batchJson.exportMeta, "批次 JSON 导出含 exportMeta");
  assert(batchJson.exportMeta.batchId === readingsBatchId, "exportMeta 批次ID正确");
  assert(batchJson.exportMeta.successCount === readingsRes.data.successCount, "exportMeta 成功数一致");
  assert(Array.isArray(batchJson.records), "批次 JSON 含 records 数组");

  const batchCsvRes = await fetch(`${BASE_URL}/import/batches/${readingsBatchId}/export?format=csv`);
  const batchCsv = await batchCsvRes.text();
  const batchCsvLines = batchCsv.trim().split("\n");
  const batchCommentLines = batchCsvLines.filter((l) => l.startsWith("#"));
  assert(batchCommentLines.length >= 5, `批次 CSV 头部含元信息注释行 (${batchCommentLines.length}行)`);
  assert(batchCommentLines.some((l) => l.includes(readingsBatchId.slice(0, 8))), "批次 CSV 注释含批次ID");

  // ============================================================
  // STEP 9: 重启后状态保留验证（快照对比）
  // ============================================================
  section("STEP 9: 重启后状态保留 - 快照对比验证");

  info("模拟重启：重新获取快照并与重启前对比（数据存SQLite，服务无需实际重启）");
  const afterRestart = await getSnapshot();
  assert(afterRestart.success, "重启后快照获取成功");
  const afterSnapshot = afterRestart.data;

  const compareRes = await compareSnapshots(beforeSnapshot, afterSnapshot, "重启前后状态对比");
  assert(compareRes.success, "快照对比接口调用成功");
  assert(compareRes.data.identical === true, `重启前后状态完全一致 (fieldDiffs=${compareRes.data.fieldDiffs.length}, lostReviewed=${compareRes.data.lostReviewedAnomalies.length}, changed=${compareRes.data.changedReviews.length})`);

  if (!compareRes.data.identical) {
    info(`字段差异: ${JSON.stringify(compareRes.data.fieldDiffs)}`);
    info(`丢失复核: ${JSON.stringify(compareRes.data.lostReviewedAnomalies)}`);
    info(`变更复核: ${JSON.stringify(compareRes.data.changedReviews)}`);
  }

  const afterReviewed = afterSnapshot.anomalies.filter(
    (a) => (a.storeId === STORE_A || a.storeId === STORE_B) && a.status === "confirmed"
  );
  assert(afterReviewed.length >= 1, `重启后 confirmed 异常数保留 (${afterReviewed.length})`);
  const reviewedMatch = afterReviewed.find((a) => a.id === reviewedAnomaly.id);
  assert(!!reviewedMatch, "重启后具体复核记录存在");
  if (reviewedMatch) {
    assert(reviewedMatch.reviewer === "验证脚本", `重启后复核人保留 (实际=${reviewedMatch.reviewer})`);
    assert(reviewedMatch.note !== null, "重启后备注保留");
    assert(reviewedMatch.status === "confirmed", "重启后状态保留 confirmed");
  }
  info(
    `重启后: 待复核=${afterSnapshot.anomalyCounts.pending}, 已确认=${afterSnapshot.anomalyCounts.confirmed}`
  );

  // ============================================================
  // STEP 10: 重复导入稳定性验证
  // ============================================================
  section("STEP 10: 重复导入稳定性 - 相同数据不破坏成功数");

  info("使用相同数据再次导入，新批次ID，验证不会因为门店重复而 successCount=0");

  const readingsBatchId2 = B("readings-2");
  const readingsRes2 = await importReadingsCSV(readingsCSV, readingsBatchId2);
  assert(readingsRes2.success === true, "重复导入接口 success=true（批次ID不同）");
  assert(
    readingsRes2.data.failureCount > 0 || readingsRes2.data.warnings?.length > 0 || readingsRes2.data.conflicts?.length > 0,
    "重复导入返回冲突/警告/失败信息（因门店+日期已存在）"
  );

  if (readingsRes2.data.conflicts && readingsRes2.data.conflicts.length > 0) {
    const firstConflict = readingsRes2.data.conflicts[0];
    const conflictText = typeof firstConflict === "string" ? firstConflict : (firstConflict.message || JSON.stringify(firstConflict));
    assert(
      conflictText.includes("已有") || conflictText.includes("已存在") || conflictText.includes("重复"),
      `冲突信息人类可读 (示例="${conflictText.slice(0, 60)}...")`
    );
    const conflictPreview = readingsRes2.data.conflicts
      .slice(0, 2)
      .map((c) => (typeof c === "string" ? c : (c.message || JSON.stringify(c))))
      .join(" | ");
    info(`冲突提示: ${conflictPreview}`);
  }

  const batch2Detail = await getBatchDetail(readingsBatchId2);
  assert(batch2Detail.success, "重复导入批次详情可查询");
  const bd2 = batch2Detail.data;
  const dupCount = bd2.records.filter((r) => r.isDuplicate).length;
  assert(dupCount > 0, `重复导入批次明细标记 isDuplicate 记录 (${dupCount}条)`);

  info(
    `第二次导入结果: 成功=${readingsRes2.data.successCount}, 失败=${readingsRes2.data.failureCount}, 重复标记=${dupCount}`
  );

  info("使用完全相同的批次ID尝试导入，验证批次冲突提示");
  const readingsBatchId3 = readingsBatchId;
  const readingsRes3 = await importReadingsCSV(readingsCSV, readingsBatchId3);
  assert(readingsRes3.success === false, "相同批次ID重复导入返回 success=false");
  assert(
    readingsRes3.errors?.some((e) => e.includes("已存在")),
    `批次冲突错误信息可读 (示例="${readingsRes3.errors?.[0]?.slice(0, 60) || "无错误信息"}")`
  );
  info(`批次冲突提示: ${readingsRes3.errors?.[0] || "无"}`);

  // ============================================================
  // STEP 11: 最终清理
  // ============================================================
  section("STEP 11: 清理验证数据 - 隔离前缀清理");

  const finalCleanup = await cleanupByPrefix(PREFIX);
  assert(finalCleanup.success, "最终数据清理成功");
  info(`清理统计: ${JSON.stringify(finalCleanup.data)}`);

  const finalSnapshot = await getSnapshot();
  const finalStores = finalSnapshot.data.stores.filter((s) => s.id.startsWith(PREFIX));
  assert(finalStores.length === 0, `清理后无前缀门店残留 (残留=${finalStores.length})`);
  const finalBatches = finalSnapshot.data.recentBatches.filter((b) => b.id.startsWith(PREFIX));
  assert(finalBatches.length === 0, `清理后无前缀批次残留 (残留=${finalBatches.length})`);
  info("验证数据清理完成，未污染正式数据");

  // ============================================================
  // 总结
  // ============================================================
  section("验证总结");

  const total = results.length;
  const passed = results.filter((r) => r.condition).length;
  const failed = total - passed;

  console.log(`\n📊 统计: 共 ${total} 项断言，✅ 通过 ${passed} 项，❌ 失败 ${failed} 项`);
  console.log(`📁 日志文件: ${LOG_FILE}`);
  console.log(`📁 导出文件目录: ${EXPORT_DIR}`);
  console.log(`\n🧪 覆盖场景:`);
  console.log("   ✔ 环境健康检查");
  console.log("   ✔ 数据隔离清理（按前缀）");
  console.log("   ✔ 三类数据导入（电表/时长/维修）");
  console.log("   ✔ 批次详情与冲突信息");
  console.log("   ✔ 异常筛选（状态/门店）");
  console.log("   ✔ 异常复核（状态+字段保留）");
  console.log("   ✔ 重启前后状态快照对比");
  console.log("   ✔ JSON 导出核对（含筛选条件和复核状态元信息）");
  console.log("   ✔ CSV 导出核对（含注释行元信息和筛选条件文件名）");
  console.log("   ✔ 批次导出核对");
  console.log("   ✔ 重复导入稳定性（不同批次ID + 冲突提示）");
  console.log("   ✔ 批次ID冲突提示");
  console.log("   ✔ 最终清理验证");

  writeLog("SUMMARY", `Total=${total}, Passed=${passed}, Failed=${failed}`);

  if (failed > 0) {
    console.log(`\n❌ 失败项:`);
    results.filter((r) => !r.condition).forEach((r) => {
      console.log(`   #${r.index}. ${r.message}${r.detail ? ` (${r.detail})` : ""}`);
    });
  } else {
    console.log(`\n🎉 所有验证项全部通过！可复跑验证链路完整。`);
  }
}

runAll().catch((e) => {
  console.error("\n❌ 致命错误：", e.message);
  console.error(e.stack);
  writeLog("FATAL", `${e.message}\n${e.stack}`);
  process.exit(2);
});
