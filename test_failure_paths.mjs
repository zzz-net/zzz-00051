const BASE_URL = "http://localhost:3002/api";

async function testFailurePaths() {
  console.log("=== 测试失败路径 ===\n");

  // 测试1: 必填字段缺失
  console.log("1. 测试必填字段缺失:");
  try {
    const res = await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: "date,reading\n2026-06-01,1000",
        fileType: "csv",
        batchId: "test-missing-field-v2"
      })
    });
    const data = await res.json();
    console.log("   状态:", res.status);
    console.log("   结果:", JSON.stringify(data, null, 2));
    console.log("   ✅ 正确识别缺失字段:", data.success === false && data.errors?.some(e => e.includes("storeId")));
  } catch (e) {
    console.log("   ❌ 错误:", e.message);
  }

  // 先成功导入一次，为了测试重复导入
  console.log("\n2. 准备测试重复导入 (先成功导入一次):");
  try {
    const res = await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: "storeId,date,reading\n47f9f7c0-cded-474e-85de-a283afbeade6,2026-06-20,5000",
        fileType: "csv",
        batchId: "test-duplicate-batch-v2"
      })
    });
    const data = await res.json();
    console.log("   首次导入状态:", res.status);
    console.log("   首次导入结果:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("   ❌ 错误:", e.message);
  }

  // 测试2: 重复导入同一批次
  console.log("\n3. 测试重复导入同一批次:");
  try {
    const res = await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: "storeId,date,reading\n47f9f7c0-cded-474e-85de-a283afbeade6,2026-06-20,5000",
        fileType: "csv",
        batchId: "test-duplicate-batch-v2"
      })
    });
    const data = await res.json();
    console.log("   状态:", res.status);
    console.log("   结果:", JSON.stringify(data, null, 2));
    console.log("   ✅ 正确识别重复批次:", data.success === false && data.errors?.some(e => e.includes("重复")));
  } catch (e) {
    console.log("   ❌ 错误:", e.message);
  }

  // 测试3: 阈值配置非法 (负数)
  console.log("\n4. 测试阈值配置非法 (负数):");
  try {
    const res = await fetch(`${BASE_URL}/thresholds/global`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailyLimit: -100,
        fluctuationRate: 20
      })
    });
    const data = await res.json();
    console.log("   状态:", res.status);
    console.log("   结果:", JSON.stringify(data, null, 2));
    console.log("   ✅ 正确识别非法阈值:", data.success === false && data.errors?.some(e => e.includes("日能耗上限")));
  } catch (e) {
    console.log("   ❌ 错误:", e.message);
  }

  // 测试4: 读数倒退 (当日读数 < 前日读数)
  console.log("\n5. 测试读数倒退检测:");
  try {
    // 先导入两天正常数据
    await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: "storeId,date,reading\n791feccb-a925-4748-85fb-a7d6c5987ddb,2026-06-21,6000\n791feccb-a925-4748-85fb-a7d6c5987ddb,2026-06-22,5000",
        fileType: "csv",
        batchId: "test-backward-reading-v2"
      })
    });

    // 触发重新计算
    const res = await fetch(`${BASE_URL}/anomalies/recalculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    console.log("   重新计算状态:", res.status);
    console.log("   结果:", JSON.stringify(data, null, 2));

    // 获取异常列表检查是否有读数倒退
    const anomaliesRes = await fetch(`${BASE_URL}/anomalies`);
    const anomalies = await anomaliesRes.json();
    const backwardAnomaly = anomalies.data?.find(
      a => a.storeId === "791feccb-a925-4748-85fb-a7d6c5987ddb" && a.date === "2026-06-22" && a.dailyConsumption < 0
    );
    console.log("   ✅ 正确检测读数倒退:", !!backwardAnomaly);
    if (backwardAnomaly) {
      console.log("   读数倒退异常:", JSON.stringify({
        date: backwardAnomaly.date,
        dailyConsumption: backwardAnomaly.dailyConsumption,
        deviationRate: backwardAnomaly.deviationRate + "%"
      }, null, 2));
    }
  } catch (e) {
    console.log("   ❌ 错误:", e.message);
  }

  // 测试5: 数据持久化验证 - 检查已关闭异常的复核信息是否保留
  console.log("\n6. 测试数据持久化 (检查已复核异常):");
  try {
    const res = await fetch(`${BASE_URL}/anomalies?status=false_positive`);
    const data = await res.json();
    const reviewed = data.data?.find(a => a.status === "false_positive");
    console.log("   已复核异常存在:", !!reviewed);
    if (reviewed) {
      console.log("   复核信息保留情况:", JSON.stringify({
        status: reviewed.status,
        attribution: reviewed.attribution,
        note: reviewed.note ? "已保留" : "丢失",
        evidenceSource: reviewed.evidenceSource ? "已保留" : "丢失",
        reviewer: reviewed.reviewer ? "已保留" : "丢失"
      }, null, 2));
      console.log("   ✅ 复核信息完整保留:", !!reviewed.note && !!reviewed.evidenceSource && !!reviewed.reviewer);
    }
  } catch (e) {
    console.log("   ❌ 错误:", e.message);
  }

  // 测试6: 测试导出功能
  console.log("\n7. 测试导出功能 (CSV):");
  try {
    const res = await fetch(`${BASE_URL}/anomalies/export?format=csv`);
    const csv = await res.text();
    console.log("   CSV导出状态:", res.status);
    console.log("   CSV包含复核字段:", csv.includes("note") && csv.includes("evidenceSource") && csv.includes("reviewer"));
    console.log("   CSV前300字符:", csv.substring(0, 300) + "...");
  } catch (e) {
    console.log("   ❌ 错误:", e.message);
  }

  console.log("\n=== 所有失败路径测试完成 ===");
}

testFailurePaths().catch(console.error);
