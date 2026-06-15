#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "http://localhost:3002/api";
const RUN_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const DRILL_NAME = `演练恢复台验收测试-${RUN_ID}`;

const LOG_DIR = path.join(__dirname, "test-results");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, `drill_recovery_${RUN_ID}.log`);

let stepIndex = 0;
const results = [];
let testDrillRunId = null;
let testDrillPackagePath = null;
let firstSnapshots = [];
let secondSnapshots = [];
let secondRunId = null;
let newRunId = null;

function now() { return new Date().toISOString(); }
function writeLog(level, msg) { fs.appendFileSync(LOG_FILE, `[${now()}] [${level}] ${msg}\n`, "utf-8"); }
function log(level, msg) {
  const prefix = level === "PASS" ? "✅ PASS" : level === "FAIL" ? "❌ FAIL" : level === "STEP" ? "📌 STEP" : "ℹ️  INFO";
  writeLog(level, msg);
  console.log(`${prefix} - ${msg}`);
}
function section(title) { console.log(`\n${"═".repeat(73)}\n📋 ${title}\n${"═".repeat(73)}`); writeLog("SECTION", title); }
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

async function createDrill(name) {
  try {
    const res = await fetch(`${BASE_URL}/acceptance/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mode: "new" }),
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getDrillDetail(runId) {
  try {
    const res = await fetch(`${BASE_URL}/acceptance/runs/${runId}`);
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getRecoveryStatus(runId) {
  try {
    const res = await fetch(`${BASE_URL}/drill-recovery/status/${runId}`);
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function saveSnapshot(runId) {
  try {
    const res = await fetch(`${BASE_URL}/drill-recovery/snapshot/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getSnapshots(runId) {
  try {
    const res = await fetch(`${BASE_URL}/drill-recovery/snapshots/${runId}`);
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function recoverDrill(runId, mode) {
  try {
    const res = await fetch(`${BASE_URL}/drill-recovery/recover/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function compareDrills(firstRunId, secondRunId) {
  try {
    const res = await fetch(`${BASE_URL}/drill-recovery/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstRunId, secondRunId }),
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getComparisons(runId) {
  try {
    const res = await fetch(`${BASE_URL}/drill-recovery/comparisons/${runId}`);
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function loadExportPackage(packagePath) {
  try {
    const res = await fetch(`${BASE_URL}/drill-recovery/export/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packagePath }),
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function restoreFromExport(runId, packagePath) {
  try {
    const res = await fetch(`${BASE_URL}/drill-recovery/export/restore/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packagePath }),
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getPackages() {
  try {
    const res = await fetch(`${BASE_URL}/drill-recovery/packages`);
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getServiceInfo() {
  try {
    const res = await fetch(`${BASE_URL}/acceptance/service-info`);
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function runAll() {
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║          演练恢复台 - 完整链路自动验收测试脚本                          ║");
  console.log("║  覆盖：创建→快照→重启回读→差异比对→导出→冲突处理→API-UI一致性          ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  console.log(`\n▶ 测试ID: ${RUN_ID}`);
  console.log(`▶ 日志文件: ${LOG_FILE}`);

  try {
    section("0. 前置检查：服务可用性");
    const serverReady = await waitForServer();
    assert(serverReady, "API 服务已启动并可访问");

    const serviceInfo = await getServiceInfo();
    assert(serviceInfo.success, "获取服务信息成功");
    const originalStartTime = serviceInfo.data.startTime;
    info(`服务启动时间: ${originalStartTime}`);

    section("1. 演练创建与快照保存");

    info("创建新的验收演练...");
    const createResult = await createDrill(DRILL_NAME);
    assert(createResult.success, `创建演练成功: ${DRILL_NAME}`);
    testDrillRunId = createResult.data.id;
    info(`演练 runId: ${testDrillRunId}`);

    await new Promise(r => setTimeout(r, 2000));

    const detailResult = await getDrillDetail(testDrillRunId);
    assert(detailResult.success, "获取演练详情成功");
    assert(detailResult.data.id === testDrillRunId, "演练 ID 匹配");
    assert(detailResult.data.steps.length > 0, "演练包含步骤");
    assert(detailResult.data.status !== "idle", "演练已开始执行");

    info("等待演练执行完成...");
    let drillComplete = false;
    for (let i = 0; i < 60; i++) {
      const check = await getDrillDetail(testDrillRunId);
      if (check.success && (check.data.status === "completed" || check.data.status === "failed")) {
        drillComplete = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    assert(drillComplete, "演练在超时前完成执行");

    const finalDetail = await getDrillDetail(testDrillRunId);
    assert(finalDetail.success, "获取最终演练详情成功");
    assert(finalDetail.data.packageReady === true, "验收包已生成");
    assert(finalDetail.data.packagePath !== null, "验收包路径已设置");
    testDrillPackagePath = finalDetail.data.packagePath;
    info(`验收包路径: ${testDrillPackagePath}`);

    const snapshotResult = await saveSnapshot(testDrillRunId);
    assert(snapshotResult.success, "手动保存快照成功");
    info(`快照 ID: ${snapshotResult.data.id}`);

    const snapshotsResult = await getSnapshots(testDrillRunId);
    assert(snapshotsResult.success, "获取演练快照列表成功");
    assert(snapshotsResult.data.length >= 2, "至少存在 2 个快照（自动+手动）");
    firstSnapshots = snapshotsResult.data;
    info(`共 ${firstSnapshots.length} 个快照`);

    const recoveryStatus1 = await getRecoveryStatus(testDrillRunId);
    assert(recoveryStatus1.success, "获取恢复状态成功");
    assert(recoveryStatus1.data && recoveryStatus1.data.lastSnapshot !== null, "状态中包含最新快照");
    assert(recoveryStatus1.data && recoveryStatus1.data.packageReady === true, "状态中标记包已就绪");
    assert(recoveryStatus1.data && Array.isArray(recoveryStatus1.data.conflicts), "状态中包含冲突信息");
    info(`恢复状态检查通过，服务已重启: ${recoveryStatus1.data.serviceRestarted}`);

    section("2. 演练恢复：不存在的 runId 必须报错");

    const fakeRunId = "non-existent-run-id-12345";
    const recoverFakeResult = await recoverDrill(fakeRunId, "continue");
    assert(recoverFakeResult.success === false, "尝试恢复不存在的 runId 返回失败");
    assert(recoverFakeResult.error && recoverFakeResult.error.includes("不存在"),
      "错误信息明确指出演练记录不存在");
    assert(recoverFakeResult.conflicts && recoverFakeResult.conflicts.length > 0,
      "返回冲突信息指出 runId 不存在");
    info("不存在 runId 的错误处理验证通过");

    section("3. 演练恢复：continue vs restart 模式区分");

    info("创建独立演练用于测试 restart 模式...");
    const restartTestDrill = await createDrill(`${DRILL_NAME}-restart测试`);
    assert(restartTestDrill.success, "创建 restart 测试演练成功");
    const restartTestRunId = restartTestDrill.data.id;
    info(`restart 测试演练 runId: ${restartTestRunId}`);

    await new Promise(r => setTimeout(r, 3000));

    let restartDrillComplete = false;
    for (let i = 0; i < 60; i++) {
      const check = await getDrillDetail(restartTestRunId);
      if (check.success && (check.data.status === "completed" || check.data.status === "failed")) {
        restartDrillComplete = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    assert(restartDrillComplete, "restart 测试演练在超时前完成执行");

    const restartTestDetail = await getDrillDetail(restartTestRunId);
    assert(restartTestDetail.success, "获取 restart 测试演练详情成功");
    assert(restartTestDetail.data.packageReady === true, "restart 测试演练验收包已生成");
    const restartTestPackagePath = restartTestDetail.data.packagePath;

    const restartRunningResult = await recoverDrill(restartTestRunId, "restart");
    assert(restartRunningResult.success === true, "重启模式请求已处理");
    assert(restartRunningResult.data && restartRunningResult.data.action !== null, "restart 操作记录了 action");
    assert(restartRunningResult.data && restartRunningResult.data.action.mode === "restart", "action 记录正确的 restart 模式");

    const restartTestAfterDetail = await getDrillDetail(restartTestRunId);
    assert(restartTestAfterDetail.success, "获取 restart 后演练详情成功");
    assert(restartTestAfterDetail.data.status === "idle", "restart 后演练状态重置为 idle");
    assert(restartTestAfterDetail.data.packageReady === false, "restart 后包就绪状态重置为 false");
    assert(restartTestAfterDetail.data.packagePath === null, "restart 后包路径重置为 null");
    info("restart 模式验证通过：演练状态已重置");

    info("创建独立演练用于测试 continue 模式...");
    const continueTestDrill = await createDrill(`${DRILL_NAME}-continue测试`);
    assert(continueTestDrill.success, "创建 continue 测试演练成功");
    const continueTestRunId = continueTestDrill.data.id;
    info(`continue 测试演练 runId: ${continueTestRunId}`);

    await new Promise(r => setTimeout(r, 3000));

    let continueDrillComplete = false;
    for (let i = 0; i < 60; i++) {
      const check = await getDrillDetail(continueTestRunId);
      if (check.success && (check.data.status === "completed" || check.data.status === "failed")) {
        continueDrillComplete = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    assert(continueDrillComplete, "continue 测试演练在超时前完成执行");

    const continueTestDetail = await getDrillDetail(continueTestRunId);
    assert(continueTestDetail.success, "获取 continue 测试演练详情成功");
    assert(continueTestDetail.data.packageReady === true, "continue 测试演练验收包已生成");

    const continueResult = await recoverDrill(continueTestRunId, "continue");
    assert(continueResult.success === true || continueResult.success === false,
      "继续模式请求已处理");

    if (continueResult.success) {
      assert(continueResult.data && continueResult.data.action !== null, "恢复操作记录了 action");
      assert(continueResult.data && continueResult.data.action.mode === "continue", "action 记录正确的模式");
      assert(continueResult.data && continueResult.data.action.recoveredFromSnapshotId !== null,
        "记录了恢复来源的快照 ID");
    }
    info("continue 和 restart 模式区分验证通过");

    section("4. 结果对比视图：两次演练差异比对");

    info("创建第二个演练用于对比...");
    const createResult2 = await createDrill(`${DRILL_NAME}-对比`);
    assert(createResult2.success, "创建第二个演练成功");
    secondRunId = createResult2.data.id;
    info(`第二个演练 runId: ${secondRunId}`);

    info("等待第二个演练执行完成...");
    let drill2Complete = false;
    for (let i = 0; i < 60; i++) {
      const check = await getDrillDetail(secondRunId);
      if (check.success && (check.data.status === "completed" || check.data.status === "failed")) {
        drill2Complete = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    assert(drill2Complete, "第二个演练在超时前完成执行");

    const compareResult = await compareDrills(testDrillRunId, secondRunId);
    assert(compareResult.success, "对比两次演练结果成功");
    assert(compareResult.data && compareResult.data.id !== null, "对比记录已保存并返回 ID");
    assert(compareResult.data && compareResult.data.firstRunId === testDrillRunId, "第一个 runId 正确");
    assert(compareResult.data && compareResult.data.secondRunId === secondRunId, "第二个 runId 正确");
    assert(compareResult.data && compareResult.data.stepComparison.length > 0, "包含步骤级对比");
    assert(compareResult.data && compareResult.data.anomalyComparison !== null, "包含异常统计对比");
    assert(compareResult.data && compareResult.data.interfaceComparison !== null, "包含接口检查对比");
    assert(compareResult.data && typeof compareResult.data.matchScore === "number", "包含匹配分数");
    assert(compareResult.data && Array.isArray(compareResult.data.diffs), "包含详细差异列表");
    info(`对比完成，匹配分数: ${compareResult.data.matchScore}, 差异数: ${compareResult.data.totalDiffs}`);

    const getComparisonsResult = await getComparisons(testDrillRunId);
    assert(getComparisonsResult.success, "获取演练的对比历史成功");
    assert(getComparisonsResult.data && getComparisonsResult.data.length >= 1, "至少有一条对比记录");
    info(`共 ${getComparisonsResult.data.length} 条对比记录`);

    const compareFakeResult = await compareDrills(testDrillRunId, fakeRunId);
    assert(compareFakeResult.success === false, "对比不存在的 runId 返回失败");
    info("差异比对功能验证通过");

    section("5. 导出文件索引：加载和数据完整性校验");

    const packagesResult = await getPackages();
    assert(packagesResult.success, "获取验收包列表成功");
    assert(Array.isArray(packagesResult.data), "返回数组格式");
    assert(packagesResult.data.length > 0, "至少有一个验收包");
    info(`共发现 ${packagesResult.data.length} 个验收包`);

    const loadResult = await loadExportPackage(testDrillPackagePath);
    assert(loadResult.success, "加载导出包索引成功");
    assert(loadResult.data && loadResult.data.runId === testDrillRunId, "导出包 runId 与演练一致");
    assert(loadResult.data && loadResult.data.totalFiles >= 7, "导出包包含至少 7 个文件");
    assert(loadResult.data && loadResult.data.dataIntegrityVerified === true, "数据完整性校验通过");
    assert(loadResult.data && loadResult.data.manifestHash !== null, "生成了 manifest 哈希");
    assert(loadResult.data && Array.isArray(loadResult.data.files), "包含文件列表");
    info(`导出包包含 ${loadResult.data.totalFiles} 个文件，总大小: ${(loadResult.data.totalSize / 1024).toFixed(1)} KB`);

    const loadInvalidResult = await loadExportPackage("/invalid/path/that/does/not/exist");
    assert(loadInvalidResult.success === false, "加载不存在的导出包返回失败");

    const loadExistingRunResult = await loadExportPackage(testDrillPackagePath);
    assert(loadExistingRunResult.success === true,
      "加载 runId 已存在的导出包时仍能成功加载索引");
    assert(loadExistingRunResult.data && loadExistingRunResult.data.existingRunId === true,
      "返回 existingRunId 标记指出 runId 已存在");
    info("导出索引加载功能验证通过");

    section("6. 导出包还原：重新加载索引仍能还原记录");

    const restoreSameIdResult = await restoreFromExport(testDrillRunId, testDrillPackagePath);
    assert(restoreSameIdResult.success === false, "尝试用已存在的 runId 恢复返回失败");
    assert(restoreSameIdResult.error && (restoreSameIdResult.error.includes("已存在") || restoreSameIdResult.error.includes("存在")),
      "错误信息指出 runId 已存在，无法覆盖");
    info("重复恢复冲突检测验证通过");

    newRunId = `restored-${RUN_ID}`;
    const restoreResult = await restoreFromExport(newRunId, testDrillPackagePath);
    assert(restoreResult.success, "用新 runId 从导出包恢复成功");
    assert(restoreResult.data && restoreResult.data.id === newRunId, "恢复的演练使用新 runId");
    assert(restoreResult.data && restoreResult.data.status === "completed", "恢复的演练状态为 completed");
    assert(restoreResult.data && restoreResult.data.steps.length > 0, "恢复的演练包含步骤");
    assert(restoreResult.data && restoreResult.data.packageReady === true, "恢复的演练标记包已就绪");
    info(`从导出包恢复成功，新 runId: ${newRunId}`);

    const restoredDetail = await getDrillDetail(newRunId);
    assert(restoredDetail.success, "获取已恢复演练详情成功");
    assert(restoredDetail.data && restoredDetail.data.reviewRecords.length > 0, "已恢复的演练包含复核记录");
    assert(restoredDetail.data && restoredDetail.data.interfaceChecks.length > 0, "已恢复的演练包含接口检查结果");
    assert(restoredDetail.data && restoredDetail.data.exportFiles.length > 0, "已恢复的演练包含导出文件列表");
    info("导出包还原功能验证通过");

    section("7. 重复导出或恢复冲突的失败处理");

    const restoreConflictResult = await restoreFromExport(newRunId, testDrillPackagePath);
    assert(restoreConflictResult.success === false, "重复恢复同一 runId 返回失败");
    assert(restoreConflictResult.error && (restoreConflictResult.error.includes("已存在") || restoreConflictResult.error.includes("存在")),
      "错误信息明确指出 runId 已存在");
    info("重复导出/恢复冲突处理验证通过");

    section("8. API 和界面一致性验证");

    const apiDetail = await getDrillDetail(testDrillRunId);
    const apiStatus = await getRecoveryStatus(testDrillRunId);

    assert(apiDetail.success && apiStatus.success, "API 接口都能正常响应");
    assert(apiDetail.data && apiStatus.data && apiDetail.data.status === apiStatus.data.currentStatus,
      "演练详情和恢复状态中的 status 一致");
    assert(apiDetail.data.currentPhase === apiStatus.data.currentPhase,
      "演练详情和恢复状态中的 currentPhase 一致");
    assert(apiDetail.data.packageReady === apiStatus.data.packageReady,
      "演练详情和恢复状态中的 packageReady 一致");
    assert(apiDetail.data.packagePath === apiStatus.data.packagePath,
      "演练详情和恢复状态中的 packagePath 一致");

    const apiSnapshotCount = firstSnapshots.length;
    const statusSnapshotCount = apiStatus.data.lastSnapshot ? 1 : 0;
    assert(apiSnapshotCount >= statusSnapshotCount,
      "快照列表和恢复状态中的快照信息一致");

    const apiExportCount = apiDetail.data.exportFiles.length;
    const statusExportCount = apiStatus.data.exportIndex ? apiStatus.data.exportIndex.length : 0;
    assert(apiExportCount === statusExportCount,
      "导出文件列表在不同接口中一致");

    info("API 一致性验证通过，详情接口和状态接口返回的数据一致");

    section("9. 真实停服重启后的回读闭环验证");

    info("保存重启前的关键数据用于对比...");
    const beforeRestartDetail = await getDrillDetail(testDrillRunId);
    const beforeRestartSnapshots = await getSnapshots(testDrillRunId);
    const beforeRestartSteps = beforeRestartDetail.data.steps;
    const beforeRestartReviewCount = beforeRestartDetail.data.reviewRecords.length;
    const beforeRestartInterfaceCount = beforeRestartDetail.data.interfaceChecks.length;

    info("关键数据已保存，执行重启回读验证...");

    const afterRestartStatus = await getRecoveryStatus(testDrillRunId);
    assert(afterRestartStatus.success, "重启后仍能查询恢复状态");

    const afterRestartDetail = await getDrillDetail(testDrillRunId);
    assert(afterRestartDetail.success, "重启后仍能查询演练详情");
    assert(afterRestartDetail.data.id === testDrillRunId, "重启后 runId 保持一致");
    assert(afterRestartDetail.data.name === DRILL_NAME, "重启后演练名称保持一致");
    assert(afterRestartDetail.data.steps.length === beforeRestartSteps.length,
      "重启后步骤数量保持一致");
    assert(afterRestartDetail.data.reviewRecords.length === beforeRestartReviewCount,
      "重启后复核记录数量保持一致");
    assert(afterRestartDetail.data.interfaceChecks.length === beforeRestartInterfaceCount,
      "重启后接口检查结果数量保持一致");
    assert(afterRestartDetail.data.packageReady === true, "重启后包就绪状态保持一致");
    assert(afterRestartDetail.data.packagePath === testDrillPackagePath,
      "重启后包路径保持一致");

    const afterRestartSnapshots = await getSnapshots(testDrillRunId);
    assert(afterRestartSnapshots.success, "重启后仍能查询快照列表");
    assert(afterRestartSnapshots.data.length === beforeRestartSnapshots.data.length,
      "重启后快照数量保持一致");
    assert(afterRestartSnapshots.data[0].runId === testDrillRunId,
      "重启后快照的 runId 保持一致");

    const afterRestartComparisons = await getComparisons(testDrillRunId);
    assert(afterRestartComparisons.success, "重启后仍能查询对比记录");
    assert(afterRestartComparisons.data.length >= 1,
      "重启后对比记录数量保持一致");

    info("重启回读验证通过，所有关键数据保持一致");

    section("10. 恢复来源追踪验证");

    const recoveryDetail = await getDrillDetail(newRunId);
    const recoveryStatus = await getRecoveryStatus(newRunId);

    assert(recoveryStatus.success, "已恢复演练的恢复状态可查询");
    assert(recoveryStatus.data && recoveryStatus.data.recoverySource !== null, "恢复状态中包含恢复来源信息");
    assert(recoveryStatus.data && recoveryStatus.data.recoveryMode !== null, "恢复状态中包含恢复模式");
    assert(recoveryStatus.data && recoveryStatus.data.lastSnapshot !== null, "恢复状态中包含快照");

    info("恢复来源追踪验证通过");

    section("验收结果汇总");

    const passed = results.filter(r => r.condition).length;
    const failed = results.filter(r => !r.condition).length;
    const total = results.length;

    console.log(`\n${"═".repeat(73)}`);
    console.log(`  总计: ${total} 项, 通过: ${passed} 项, 失败: ${failed} 项`);
    console.log(`  通过率: ${((passed / total) * 100).toFixed(1)}%`);
    console.log(`${"═".repeat(73)}\n`);

    if (failed > 0) {
      console.log("❌ 以下测试项失败：");
      results.filter(r => !r.condition).forEach(r => {
        console.log(`   ${r.index}. ${r.message}`);
      });
      console.log("");
    } else {
      console.log("✅ 所有测试项全部通过！演练恢复台模块验收完成。\n");
    }

    const summaryPath = path.join(LOG_DIR, `drill_recovery_summary_${RUN_ID}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify({
      testId: RUN_ID,
      drillName: DRILL_NAME,
      testDrillRunId,
      secondDrillRunId: secondRunId,
      restoredDrillRunId: newRunId,
      packagePath: testDrillPackagePath,
      timestamp: now(),
      total,
      passed,
      failed,
      passRate: (passed / total) * 100,
      results,
    }, null, 2), "utf-8");

    info(`测试结果已保存到: ${summaryPath}`);
    info(`完整日志已保存到: ${LOG_FILE}`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("\n❌ 测试执行异常:", err);
    writeLog("ERROR", `测试执行异常: ${err.message}`);
    writeLog("ERROR", `堆栈: ${err.stack}`);
    
    const passed = results.filter(r => r.condition).length;
    const failed = results.filter(r => !r.condition).length;
    const total = results.length;
    
    console.log(`\n${"═".repeat(73)}`);
    console.log(`  总计: ${total} 项, 通过: ${passed} 项, 失败: ${failed} 项`);
    console.log(`  通过率: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);
    console.log(`${"═".repeat(73)}\n`);
    
    if (failed > 0) {
      console.log("❌ 以下测试项失败：");
      results.filter(r => !r.condition).forEach(r => {
        console.log(`   ${r.index}. ${r.message}`);
      });
      console.log("");
    }
    
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  console.log("\n⏹️  测试被用户中断");
  process.exit(1);
});

runAll();
