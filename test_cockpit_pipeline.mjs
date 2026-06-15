#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "http://localhost:3002/api";
const RUN_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const PREFIX = `cockpit-test-${RUN_ID}`;

const LOG_DIR = path.join(__dirname, "test-results");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, `cockpit_${RUN_ID}.log`);

let stepIndex = 0;
const results = [];

function now() { return new Date().toISOString(); }
function writeLog(level, msg) { fs.appendFileSync(LOG_FILE, `[${now()}] [${level}] ${msg}\n`, "utf-8"); }
function log(level, msg) {
  const prefix = level === "PASS" ? "✅ PASS" : level === "FAIL" ? "❌ FAIL" : level === "STEP" ? "📌 STEP" : "ℹ️  INFO";
  writeLog(level, msg);
  console.log(`${prefix} - ${msg}`);
}
function section(title) { console.log(`\n${"═".repeat(63)}\n📋 ${title}\n${"═".repeat(63)}`); writeLog("SECTION", title); }
function assert(condition, message) {
  stepIndex++;
  results.push({ index: stepIndex, condition: !!condition, message, timestamp: now() });
  if (condition) { log("PASS", message); return true; }
  else { log("FAIL", message); process.exitCode = 1; return false; }
}
function info(msg) { log("INFO", msg); }

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(`${BASE_URL}/health`); if (res.ok) return true; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function runPipeline(prefix) {
  const res = await fetch(`${BASE_URL}/cockpit/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix }),
  });
  return res.json();
}

async function getSummary() {
  const res = await fetch(`${BASE_URL}/cockpit/summary`);
  return res.json();
}

async function getRuns() {
  const res = await fetch(`${BASE_URL}/cockpit/runs`);
  return res.json();
}

async function getRunDetail(runId) {
  const res = await fetch(`${BASE_URL}/cockpit/runs/${runId}`);
  return res.json();
}

async function getCheckpoints(runId) {
  const res = await fetch(`${BASE_URL}/cockpit/runs/${runId}/checkpoints`);
  return res.json();
}

async function runAll() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║          验收驾驶舱 - 完整链路自动验证脚本                        ║");
  console.log("║  覆盖：导入→筛选→复核→重启保留→导出核对→连续两次结论一致         ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`\n▶ 运行ID: ${RUN_ID}`);
  console.log(`▶ 数据前缀: ${PREFIX}`);
  console.log(`▶ 日志文件: ${LOG_FILE}`);

  section("STEP 0: 环境健康检查");
  const serverAlive = await waitForServer();
  assert(serverAlive, "后端服务已启动在端口 3002");
  if (!serverAlive) { console.log("\n请先启动后端：npm run server:dev"); process.exit(1); }

  section("STEP 1: 第一次执行验收流水线");
  const run1Res = await runPipeline(PREFIX);
  assert(run1Res.success, "第一次流水线 API 返回 success");
  const run1 = run1Res.data;
  assert(run1.status === "completed", `第一次流水线状态=completed (实际=${run1.status})`);
  assert(run1.isolationCleaned === true, "第一次: 数据隔离已验证");
  assert(run1.importConflictHandled === true, "第一次: 导入冲突已处理");
  assert(run1.filterPreserved === true, "第一次: 筛选条件重启前后保留");
  assert(run1.reviewPreserved === true, "第一次: 复核状态重启前后保留");
  assert(run1.exportComplete === true, "第一次: 导出完整");
  assert(run1.exportComparisonMatch === true, "第一次: 导出比对一致");

  const steps1 = run1.steps;
  const passed1 = steps1.filter(s => s.status === "passed").length;
  const failed1 = steps1.filter(s => s.status === "failed").length;
  assert(failed1 === 0, `第一次: 0 步骤失败 (实际=${failed1})`);
  info(`第一次: ${passed1}/${steps1.length} 步骤通过`);

  for (const step of steps1) {
    assert(step.status === "passed", `第一次步骤: ${step.label} = passed`);
  }

  section("STEP 2: 第一次运行检查点验证");
  const checkpoints1Res = await getCheckpoints(run1.id);
  assert(checkpoints1Res.success, "检查点接口返回 success");
  const checkpoints1 = checkpoints1Res.data;
  assert(checkpoints1.length >= 2, `第一次: 至少2个检查点 (实际=${checkpoints1.length})`);
  const importCheckpoint = checkpoints1.find(c => c.step === "import_readings");
  assert(!!importCheckpoint, "第一次: 存在 import_readings 检查点");
  if (importCheckpoint) {
    const cpData = JSON.parse(importCheckpoint.stateJson);
    assert(!!cpData.batchId, "检查点含 batchId");
    assert(!!cpData.result, "检查点含 result");
    info(`检查点 batchId: ${cpData.batchId}`);
  }

  section("STEP 3: 驾驶舱汇总接口验证");
  const summaryRes = await getSummary();
  assert(summaryRes.success, "汇总接口返回 success");
  const summary = summaryRes.data;
  assert(summary.totalRuns >= 1, `累计运行次数>=1 (实际=${summary.totalRuns})`);
  assert(summary.lastRunStatus === "completed", `上次运行状态=completed (实际=${summary.lastRunStatus})`);
  assert(summary.isolationVerified === true, "汇总: 隔离已验证");
  assert(summary.importConflictFree === true, "汇总: 冲突处理完成");
  assert(summary.filterReviewPreserved === true, "汇总: 筛选复核保留");
  assert(summary.exportConsistent === true, "汇总: 导出一致");

  section("STEP 4: 第二次执行验收流水线（验证连续执行一致性）");
  const PREFIX2 = `cockpit-test2-${RUN_ID}`;
  const run2Res = await runPipeline(PREFIX2);
  assert(run2Res.success, "第二次流水线 API 返回 success");
  const run2 = run2Res.data;
  assert(run2.status === "completed", `第二次流水线状态=completed (实际=${run2.status})`);
  assert(run2.isolationCleaned === true, "第二次: 数据隔离已验证");
  assert(run2.importConflictHandled === true, "第二次: 导入冲突已处理");
  assert(run2.filterPreserved === true, "第二次: 筛选条件重启前后保留");
  assert(run2.reviewPreserved === true, "第二次: 复核状态重启前后保留");
  assert(run2.exportComplete === true, "第二次: 导出完整");
  assert(run2.exportComparisonMatch === true, "第二次: 导出比对一致");

  const steps2 = run2.steps;
  const passed2 = steps2.filter(s => s.status === "passed").length;
  const failed2 = steps2.filter(s => s.status === "failed").length;
  assert(failed2 === 0, `第二次: 0 步骤失败 (实际=${failed2})`);
  info(`第二次: ${passed2}/${steps2.length} 步骤通过`);

  section("STEP 5: 两次运行结论一致性验证");
  assert(run1.status === run2.status, `两次运行状态一致: ${run1.status}`);
  assert(passed1 === passed2, `两次通过步骤数一致: ${passed1} vs ${passed2}`);
  const key1 = [run1.isolationCleaned, run1.importConflictHandled, run1.filterPreserved, run1.reviewPreserved, run1.exportComplete, run1.exportComparisonMatch];
  const key2 = [run2.isolationCleaned, run2.importConflictHandled, run2.filterPreserved, run2.reviewPreserved, run2.exportComplete, run2.exportComparisonMatch];
  assert(JSON.stringify(key1) === JSON.stringify(key2), "两次运行关键指标全部一致");

  section("STEP 6: 运行历史接口验证");
  const runsRes = await getRuns();
  assert(runsRes.success, "运行历史接口返回 success");
  const runs = runsRes.data;
  assert(runs.length >= 2, `运行历史>=2条 (实际=${runs.length})`);

  const summary2Res = await getSummary();
  const summary2 = summary2Res.data;
  assert(summary2.totalRuns >= 2, `累计运行次数>=2 (实际=${summary2.totalRuns})`);
  assert(summary2.exportConsistent === true, "汇总更新后导出一致仍为 true");

  section("验证总结");
  const total = results.length;
  const passed = results.filter(r => r.condition).length;
  const failed = total - passed;
  console.log(`\n📊 统计: 共 ${total} 项断言，✅ 通过 ${passed} 项，❌ 失败 ${failed} 项`);
  console.log(`📁 日志文件: ${LOG_FILE}`);
  console.log(`\n🧪 覆盖场景:`);
  console.log("   ✔ 第一次验收流水线完整执行");
  console.log("   ✔ 数据隔离验证");
  console.log("   ✔ 导入冲突检测与处理");
  console.log("   ✔ 筛选与复核状态重启保留");
  console.log("   ✔ JSON/CSV 导出完整性");
  console.log("   ✔ 导出结果比对一致");
  console.log("   ✔ 检查点数据保存与读取");
  console.log("   ✔ 驾驶舱汇总接口");
  console.log("   ✔ 第二次验收流水线完整执行");
  console.log("   ✔ 两次运行关键指标一致性");
  console.log("   ✔ 运行历史接口");

  writeLog("SUMMARY", `Total=${total}, Passed=${passed}, Failed=${failed}`);
  if (failed > 0) {
    console.log(`\n❌ 失败项:`);
    results.filter(r => !r.condition).forEach(r => { console.log(`   #${r.index}. ${r.message}`); });
  } else {
    console.log(`\n🎉 所有验证项全部通过！验收驾驶舱完整链路连续两次结论一致。`);
  }
}

runAll().catch(e => {
  console.error("\n❌ 致命错误：", e.message);
  console.error(e.stack);
  writeLog("FATAL", `${e.message}\n${e.stack}`);
  process.exit(2);
});
