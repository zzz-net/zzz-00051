const BASE_URL = "http://localhost:3002/api";
const UID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const B = (name) => `fp-${UID}-${name}`;

async function testFailurePaths() {
  console.log("=== 测试失败路径（批次ID动态隔离，可重复执行）===\n");

  // 测试1: 必填字段缺失（独立动态 batchId，与其他/前后运行完全隔离）
  console.log("1. 测试必填字段缺失:");
  try {
    const res = await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: "date,reading\n2026-06-01,1000",
        fileType: "csv",
        batchId: B("missing-field"),
      }),
    });
    const data = await res.json();
    const caughtMissing = data.success === false && data.errors?.some((e) => e.includes("storeId"));
    const notMistakenForDup = !data.errors?.some((e) => e.includes("已存在，请勿重复导入"));
    console.log("   状态:", res.status);
    console.log("   错误原因:", data.errors?.[0] || data.error);
    console.log("   ✅ 正确识别缺字段:", caughtMissing);
    console.log("   ✅ 未被误判成重复导入:", notMistakenForDup);
    if (!caughtMissing || !notMistakenForDup) process.exitCode = 1;
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  // 测试2: 重复导入同一批次（同一次执行内共享同一个动态ID，才能构成"重复"语义）
  console.log("\n2. 测试重复导入同一批次:");
  const DUP_BATCH = B("duplicate-batch"); // 关键：两次用同一个
  try {
    const first = await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: "storeId,date,reading\n47f9f7c0-cded-474e-85de-a283afbeade6,2026-06-20,5000",
        fileType: "csv",
        batchId: DUP_BATCH,
      }),
    });
    const firstData = await first.json();
    console.log("   首次导入:", firstData.success ? "✅ 成功" : "❌ 失败 - " + firstData.errors?.[0]);

    const second = await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: "storeId,date,reading\n47f9f7c0-cded-474e-85de-a283afbeade6,2026-06-20,5000",
        fileType: "csv",
        batchId: DUP_BATCH,
      }),
    });
    const secondData = await second.json();
    const caughtDup = secondData.success === false && secondData.errors?.some((e) => e.includes("重复") || e.includes("已存在"));
    console.log("   二次导入错误:", secondData.errors?.[0] || "(成功，说明重复未拦截)");
    console.log("   ✅ 正确识别重复批次:", caughtDup);
    if (!caughtDup) process.exitCode = 1;
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  // 测试3: 阈值配置非法 (负数)
  console.log("\n3. 测试阈值配置非法 (负数):");
  try {
    const res = await fetch(`${BASE_URL}/thresholds/global`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyLimit: -100, fluctuationRate: 20 }),
    });
    const data = await res.json();
    const caughtBad = data.success === false && data.errors?.some((e) => e.includes("日能耗上限"));
    console.log("   状态:", res.status, "| 错误:", data.errors?.[0] || data.error);
    console.log("   ✅ 正确识别非法阈值:", caughtBad);
    if (!caughtBad) process.exitCode = 1;
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  // 测试4: 读数倒退 (当日读数 < 前日读数)
  console.log("\n4. 测试读数倒退检测:");
  try {
    await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent:
          "storeId,date,reading\n791feccb-a925-4748-85fb-a7d6c5987ddb,2026-06-21,6000\n791feccb-a925-4748-85fb-a7d6c5987ddb,2026-06-22,5000",
        fileType: "csv",
        batchId: B("backward-reading"),
      }),
    });

    const recalc = await fetch(`${BASE_URL}/anomalies/recalculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const recalcData = await recalc.json();
    console.log("   重新计算状态:", recalc.status, "| anomalyCount:", recalcData.data?.anomalyCount);

    const anomaliesRes = await fetch(`${BASE_URL}/anomalies`);
    const anomalies = await anomaliesRes.json();
    const backwardAnomaly = anomalies.data?.find(
      (a) =>
        a.storeId === "791feccb-a925-4748-85fb-a7d6c5987ddb" &&
        a.date === "2026-06-22" &&
        a.dailyConsumption < 0,
    );
    console.log("   ✅ 正确检测读数倒退:", !!backwardAnomaly);
    if (!backwardAnomaly) process.exitCode = 1;
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  // 测试5: 数据持久化验证 - 检查已关闭异常的复核信息
  console.log("\n5. 测试数据持久化 (已复核误报记录应保留):");
  try {
    const res = await fetch(`${BASE_URL}/anomalies?status=false_positive`);
    const data = await res.json();
    const reviewed = data.data?.find((a) => a.status === "false_positive");
    console.log("   已复核误报存在:", !!reviewed);
    if (reviewed) {
      const intact = reviewed.note && reviewed.evidenceSource && reviewed.reviewer;
      console.log(
        "   复核信息:",
        JSON.stringify({
          note: reviewed.note ? "保留" : "丢失",
          evidenceSource: reviewed.evidenceSource ? "保留" : "丢失",
          reviewer: reviewed.reviewer ? "保留" : "丢失",
        }),
      );
      console.log("   ✅ 复核信息完整保留:", intact);
    }
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  // 测试6: 导出内容包含证据链字段
  console.log("\n6. 测试导出功能 (CSV含完整证据链):");
  try {
    const res = await fetch(`${BASE_URL}/anomalies/export?format=csv`);
    const csv = await res.text();
    const headerLine = csv.split("\n")[0] || "";
    const cols = [
      "readingPrev",
      "readingCurr",
      "openHour",
      "closeHour",
      "hasMaintenance",
      "thresholdDailyLimit",
      "thresholdFluctuationRate",
      "note",
      "evidenceSource",
      "reviewer",
    ];
    const present = cols.map((c) => headerLine.includes(c));
    console.log("   字段覆盖情况:", Object.fromEntries(cols.map((c, i) => [c, present[i]])));
    console.log("   ✅ 完整证据链字段都在:", present.every(Boolean));
    if (!present.every(Boolean)) process.exitCode = 1;
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  console.log("\n=== 所有失败路径测试完成（可重复执行，结论应一致）===");
}

testFailurePaths().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
