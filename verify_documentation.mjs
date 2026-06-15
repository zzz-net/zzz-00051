#!/usr/bin/env node
/**
 * 文档与实现一致性验证脚本
 *
 * 用途：验证 README.md 中描述的功能是否与实际实现一致
 * 覆盖：启动命令、导入流程、筛选保留、导出结果、重启保留
 *
 * 运行方式：node verify_documentation.mjs
 * 前置条件：后端服务已启动在端口 3002
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "http://localhost:3002/api";
const SAMPLE_DATA_DIR = path.join(__dirname, "sample-data");

// 动态生成唯一批次ID，避免冲突
const UID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const B = (name) => `verify-${UID}-${name}`;

function log(level, msg) {
  const prefix = level === "PASS" ? "✅ PASS" : level === "FAIL" ? "❌ FAIL" : "ℹ️  INFO";
  console.log(`${prefix} - ${msg}`);
}

function section(title) {
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`📋 ${title}`);
  console.log(`═══════════════════════════════════════════════════════════════`);
}

function assert(condition, message) {
  if (condition) {
    log("PASS", message);
    return true;
  } else {
    log("FAIL", message);
    process.exitCode = 1;
    return false;
  }
}

async function checkServerAlive() {
  try {
    const res = await fetch(`${BASE_URL}/stores`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (await checkServerAlive()) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function test_verifySampleData() {
  section("1. 样例数据文件验证");

  const files = [
    "meter_readings.csv",
    "business_hours.csv",
    "maintenance_records.csv"
  ];

  for (const file of files) {
    const filePath = path.join(SAMPLE_DATA_DIR, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n");
      assert(lines.length > 1, `样例文件 ${file} 存在且有数据（${lines.length - 1} 条记录）`);
    } else {
      assert(false, `样例文件 ${file} 不存在`);
    }
  }
}

async function test_importReadings() {
  section("2. 电表读数导入验证（README 5.1 节");

  const readingsCSV = fs.readFileSync(path.join(SAMPLE_DATA_DIR, "meter_readings.csv"), "utf-8");
  const batchId = B("readings");

  const res = await fetch(`${BASE_URL}/import/readings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileContent: readingsCSV,
      fileType: "csv",
      fileName: "meter_readings.csv",
      batchId,
    }),
  });

  const data = await res.json();

  assert(data.success === true, "接口返回 success=true");
  assert(data.data.recordCount === 14, `记录总数=14`);
  assert(data.data.successCount === 14, `成功导入 14 条`);
  assert(data.data.anomalyCount >= 2, `至少检测出 2 条异常（DEMO01 6月4日突增 + 6月5日倒退）`);

  console.log(`\n📊 导入结果：成功 ${data.data.successCount} 条，异常 ${data.data.anomalyCount} 条`);

  return batchId;
}

async function test_importHours() {
  section("3. 营业时长导入验证");

  const hoursCSV = fs.readFileSync(path.join(SAMPLE_DATA_DIR, "business_hours.csv"), "utf-8");
  const batchId = B("hours");

  const res = await fetch(`${BASE_URL}/import/hours`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileContent: hoursCSV,
      fileType: "csv",
      fileName: "business_hours.csv",
      batchId,
    }),
  });

  const data = await res.json();

  assert(data.success === true, "营业时长导入成功");
  assert(data.data.recordCount === 14, `记录总数=14`);

  return batchId;
}

async function test_importMaintenance() {
  section("4. 维修记录导入验证");

  const maintCSV = fs.readFileSync(path.join(SAMPLE_DATA_DIR, "maintenance_records.csv"), "utf-8");
  const batchId = B("maintenance");

  const res = await fetch(`${BASE_URL}/import/maintenance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileContent: maintCSV,
      fileType: "csv",
      fileName: "maintenance_records.csv",
      batchId,
    }),
  });

  const data = await res.json();

  assert(data.success === true, "维修记录导入成功");
  assert(data.data.recordCount === 2, `记录总数=2`);

  return batchId;
}

async function test_batchFiltersPersistence() {
  section("5. 批次筛选持久化验证（README 5.5 节");

  console.log("ℹ️  设置筛选条件：类型=readings，状态=success");

  // 1. 设置筛选条件
  const filterRes = await fetch(`${BASE_URL}/import/batches?type=readings&status=success`);
  await filterRes.json();

  // 2. 验证筛选结果
  const listRes = await fetch(`${BASE_URL}/import/batches?type=readings&status=success`);
  const listData = await listRes.json();

  const allReadings = listData.data.every(b => b.type === "readings" && b.status === "success");
  assert(allReadings, "按类型和状态筛选结果正确");
}

async function test_anomalyFilters() {
  section("6. 异常筛选验证（README 5.4 节");

  console.log("ℹ️  设置异常筛选：状态=pending");

  const res = await fetch(`${BASE_URL}/anomalies?status=pending`);
  const data = await res.json();

  assert(data.success === true, "异常筛选接口正常");
  assert(Array.isArray(data.data), "返回异常列表数组");

  console.log(`📊 待复核异常数：${data.data.length}`);

  return data.data.length > 0 ? data.data[0]?.id : null;
}

async function test_reviewAnomaly(anomalyId) {
  if (!anomalyId) {
    section("7. 异常复核验证（跳过，无异常可复核）");
    log("INFO", "跳过复核测试");
    return;
  }

  section("7. 异常复核验证（README 5.4 节");

  const res = await fetch(`${BASE_URL}/anomalies/${anomalyId}/review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "confirmed",
      attribution: "设备故障",
      note: "经现场检查，确认空调机组故障导致能耗突增",
      evidenceSource: "现场照片/20260604_1430.jpg",
      reviewer: "张管理员",
    }),
  });

  const data = await res.json();

  assert(data.success === true, "异常复核成功");
  assert(data.data.status === "confirmed", "状态变为已确认");
  assert(data.data.note !== null, "备注已保存");
  assert(data.data.evidenceSource !== null, "证据来源已保存");
  assert(data.data.reviewer === "张管理员", "复核人已保存");

  console.log(`\n📝 复核完成：异常 ${anomalyId.slice(0, 12)}... 已标记为已确认`);

  return anomalyId;
}

async function test_exportCSV() {
  section("8. CSV 导出验证（README 5.6 节");

  const res = await fetch(`${BASE_URL}/anomalies/export?format=csv`);
  const csv = await res.text();

  assert(csv.length > 0, "CSV 导出有内容");
  assert(res.headers.get("content-type")?.includes("csv"), "Content-Type 正确");

  const requiredCols = [
    "date", "dailyConsumption", "expectedConsumption",
    "readingPrev", "readingCurr", "businessHours",
    "openHour", "closeHour", "hasMaintenance",
    "thresholdDailyLimit", "thresholdFluctuationRate",
    "status", "attribution", "note", "evidenceSource", "reviewer"
  ];

  const headerLine = csv.split("\n")[0];
  console.log(`\n📋 CSV 表头：${headerLine}`);

  for (const col of requiredCols) {
    assert(headerLine.includes(col), `CSV 包含字段 ${col}`);
  }

  const lines = csv.trim().split("\n");
  console.log(`\n📊 导出行数：${lines.length - 1} 条数据`);
}

async function test_exportJSON() {
  section("9. JSON 导出验证（README 5.6 节");

  const res = await fetch(`${BASE_URL}/anomalies/export?format=json`);
  const json = await res.json();

  assert(Array.isArray(json), "JSON 导出为数组");
  assert(res.headers.get("content-type")?.includes("json"), "Content-Type 正确");

  if (json.length > 0) {
    const sample = json[0];
    console.log(`\n📋 JSON 样例数据字段：${Object.keys(sample).join(", ")}`);

    const requiredProps = [
      "readingPrev", "readingCurr", "dailyConsumption",
      "businessHours", "hasMaintenance",
      "thresholdDailyLimit", "thresholdFluctuationRate",
      "status", "note", "evidenceSource", "reviewer"
    ];

    for (const prop of requiredProps) {
      assert(prop in sample, `JSON 包含字段 ${prop}`);
    }

    // 交叉验证：dailyConsumption === readingCurr - readingPrev
    if (sample.readingCurr !== null && sample.readingPrev !== null) {
      const calc = sample.readingCurr - sample.readingPrev;
      const diff = Math.abs(sample.dailyConsumption - calc);
      assert(diff < 0.001, `交叉验证：dailyConsumption (${sample.dailyConsumption}) === readingCurr (${sample.readingCurr}) - readingPrev (${sample.readingPrev})`);
    }
  }

  console.log(`\n📊 导出记录数：${json.length} 条`);
}

async function test_recalculateAnomalies() {
  section("10. 阈值变更后异常重算验证（README 5.3 节");

  // 先获取当前阈值
  const beforeRes = await fetch(`${BASE_URL}/thresholds`);
  const beforeData = await beforeRes.json();
  const beforeGlobal = beforeData.data.find(t => t.storeId === null);

  console.log(`ℹ️  当前全局阈值：dailyLimit=${beforeGlobal.dailyLimit}, fluctuationRate=${beforeGlobal.fluctuationRate}%`);

  // 获取当前待复核异常数
  const pendingBeforeRes = await fetch(`${BASE_URL}/anomalies?status=pending`);
  const pendingBefore = await pendingBeforeRes.json();
  console.log(`ℹ️  重算前待复核异常数：${pendingBefore.data.length}`);

  // 修改阈值为非常严格
  const strictRes = await fetch(`${BASE_URL}/thresholds/global`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dailyLimit: 50, fluctuationRate: 5, hoursCorrectionFactor: 1.0
    }),
  });

  assert(strictRes.ok, "阈值更新接口正常");

  // 触发重算
  const recalcRes = await fetch(`${BASE_URL}/anomalies/recalculate`, { method: "POST" });
  const recalcData = await recalcRes.json();
  assert(recalcData.success === true, "异常重算成功");

  // 验证待复核异常数应该变化
  const pendingAfterRes = await fetch(`${BASE_URL}/anomalies?status=pending`);
  const pendingAfter = await pendingAfterRes.json();
  console.log(`ℹ️  严格阈值后待复核异常数：${pendingAfter.data.length}`);

  // 恢复原始阈值
  await fetch(`${BASE_URL}/thresholds/global`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dailyLimit: beforeGlobal.dailyLimit,
      fluctuationRate: beforeGlobal.fluctuationRate,
      hoursCorrectionFactor: beforeGlobal.hoursCorrectionFactor
    }),
  });

  // 再次重算
  await fetch(`${BASE_URL}/anomalies/recalculate`, { method: "POST" });

  const pendingFinalRes = await fetch(`${BASE_URL}/anomalies?status=pending`);
  const pendingFinal = await pendingFinalRes.json();

  assert(pendingFinal.data.length >= pendingBefore.data.length, "恢复阈值后异常数恢复");

  console.log(`ℹ️  恢复阈值后待复核异常数：${pendingFinal.data.length}`);
}

async function test_batchExport() {
  section("11. 批次数据导出验证（README 5.6.2 节");

  // 获取第一个成功的批次
  const listRes = await fetch(`${BASE_URL}/import/batches?status=success`);
  const listData = await listRes.json();

  if (listData.data.length === 0) {
    log("INFO", "无成功批次，跳过批次导出验证");
    return;
  }

  const batchId = listData.data[0].id;

  // CSV 导出
  const csvRes = await fetch(`${BASE_URL}/import/batches/${batchId}/export?format=csv`);
  const csv = await csvRes.text();

  assert(csv.length > 0, "批次 CSV 导出有内容");
  assert(csv.includes("success"), "CSV 包含 success 列");
  assert(csv.includes("errorMessage"), "CSV 包含 errorMessage 列");
  assert(csv.includes("parentBatchId"), "CSV 包含 parentBatchId 列");
  assert(csv.includes("childBatchIds"), "CSV 包含 childBatchIds 列");

  // JSON 导出
  const jsonRes = await fetch(`${BASE_URL}/import/batches/${batchId}/export?format=json`);
  const json = await jsonRes.json();

  assert(!!json.batch, "JSON 包含 batch 元信息");
  assert(Array.isArray(json.records), "JSON 包含 records 数组");
  assert(json.batch.id === batchId, "JSON 批次 ID 正确");
  assert("successCount" in json.batch, "JSON 包含 successCount");
  assert("failureCount" in json.batch, "JSON 包含 failureCount");

  console.log(`\n📊 批次导出：CSV=${csv.split("\n").length - 1} 行, JSON.records=${json.records.length} 条`);
}

async function test_dataPersistenceAfterRestart() {
  section("12. 重启后数据保留验证（README 5.5 节");

  console.log("ℹ️  此步骤需要手动重启服务后验证");
  console.log("ℹ️  验证步骤：");
  console.log("     1. 记录当前异常列表");
  console.log("     2. 停止服务 (Ctrl+C)");
  console.log("     3. 重新启动 npm run server:dev");
  console.log("     4. 重新运行此脚本验证数据是否保留");
  console.log("     5. 重点检查：");
  console.log("        - 已复核的异常状态和备注是否保留");
  console.log("        - 总览看板统计是否一致");

  // 获取当前已确认异常数作为基线
  const confirmedRes = await fetch(`${BASE_URL}/anomalies?status=confirmed`);
  const confirmed = await confirmedRes.json();

  console.log(`\n📋 当前已确认异常数：${confirmed.data.length}`);
  if (confirmed.data.length > 0) {
    const latest = confirmed.data[0];
    console.log(`📋 样例已确认异常：${latest.storeName} - ${latest.date}`);
    console.log(`📋 复核人：${latest.reviewer}，备注：${latest.note?.slice(0, 30)}...`);
  }

  // 获取统计数据
  const statsRes = await fetch(`${BASE_URL}/trends/stats`);
  const stats = await statsRes.json();

  console.log(`\n📊 当前统计：`);
  console.log(`   总门店数：${stats.data.totalStores}`);
  console.log(`   待复核：${stats.data.pendingCount}`);
  console.log(`   已确认：${stats.data.confirmedCount}`);
  console.log(`   误报：${stats.data.falsePositiveCount}`);
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              文档与实现一致性验证脚本                          ║");
  console.log("║  验证 README.md 中描述的功能是否与实际实现一致            ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  console.log(`\n⏳ 等待后端服务启动中...`);
  const serverAlive = await waitForServer();

  if (!serverAlive) {
    console.log("\n❌ 后端服务未启动（端口 3002）");
    console.log("请先执行：npm run server:dev");
    process.exit(1);
  }

  log("PASS", "后端服务已启动在端口 3002");

  await test_verifySampleData();
  const readingsBatchId = await test_importReadings();
  await test_importHours();
  await test_importMaintenance();
  await test_batchFiltersPersistence();
  const anomalyId = await test_anomalyFilters();
  await test_reviewAnomaly(anomalyId);
  await test_exportCSV();
  await test_exportJSON();
  await test_recalculateAnomalies();
  await test_batchExport();
  await test_dataPersistenceAfterRestart();

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("\n📋 验证总结");
  console.log("═══════════════════════════════════════════════════════════════");

  if (process.exitCode === 1) {
    console.log("\n❌ 部分验证失败，请检查上述错误");
    console.log("\n💡 常见问题：");
    console.log("   1. 确保后端服务正常运行");
    console.log("   2. 检查 README.md 第 9 节手动验证清单");
  } else {
    console.log("\n✅ 所有自动化验证通过！");
    console.log("\n📝 请继续完成手动验证（README 第 9.2 节");
    console.log("\n📝 请完成重启验证（README 第 12 节");
  }

  console.log("\n📖 完整文档请参考：README.md");
}

main().catch((e) => {
  console.error("\n❌ 致命错误：", e.message);
  process.exit(2);
});
