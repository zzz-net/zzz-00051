const BASE_URL = "http://localhost:3002/api";
const UID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const B = (name) => `dm-${UID}-${name}`;
const STORE_A = `store-${UID}-A`;
const STORE_B = `store-${UID}-B`;

function offsetDate(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const FUTURE_BASE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const D1 = offsetDate(FUTURE_BASE, 0);
const D2 = offsetDate(FUTURE_BASE, 1);
const D3 = offsetDate(FUTURE_BASE, 2);
const D4 = offsetDate(FUTURE_BASE, 3);
const D5 = offsetDate(FUTURE_BASE, 4);
const D6 = offsetDate(FUTURE_BASE, 5);

function assert(cond, msg) {
  if (!cond) {
    console.log("   ❌ 断言失败:", msg);
    process.exitCode = 1;
    return false;
  }
  console.log("   ✅", msg);
  return true;
}

async function testDataManagement() {
  console.log("=== 数据管理增强版综合测试（可重复执行，批次ID动态隔离）===\n");

  // ============================================================
  // 测试 1: 成功导入 - 检查批次元信息(成功/失败数、文件类型、覆盖日期、原始内容)
  // ============================================================
  console.log("1. 成功导入 - 批次元信息完整:");
  const SUCCESS_BATCH = B("success-import");
  const readingsCSV =
    "storeId,date,reading\n" +
    `${STORE_A},${D1},1000\n` +
    `${STORE_A},${D2},1100\n` +
    `${STORE_A},${D3},1210\n`;
  try {
    const res = await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: readingsCSV,
        fileType: "csv",
        fileName: "test_readings.csv",
        batchId: SUCCESS_BATCH,
      }),
    });
    const data = await res.json();
    assert(data.success, "接口返回成功");
    assert(data.data.recordCount === 3, `记录总数=3 (实际=${data.data.recordCount})`);
    assert(data.data.successCount === 3, `成功条数=3 (实际=${data.data.successCount})`);
    assert(data.data.failureCount === 0, `失败条数=0 (实际=${data.data.failureCount})`);

    const detailRes = await fetch(`${BASE_URL}/import/batches/${SUCCESS_BATCH}`);
    const detail = await detailRes.json();
    assert(detail.success, "批次详情可获取");
    const b = detail.data;
    assert(b.type === "readings", `批次类型=readings (实际=${b.type})`);
    assert(b.fileType === "csv", `文件类型=csv (实际=${b.fileType})`);
    assert(b.fileName === "test_readings.csv", `文件名正确 (实际=${b.fileName})`);
    assert(b.successCount === 3, `批次成功数=3 (实际=${b.successCount})`);
    assert(b.failureCount === 0, `批次失败数=0 (实际=${b.failureCount})`);
    assert(b.status === "success", `状态=success (实际=${b.status})`);
    assert(b.coverageStartDate === D1, `覆盖起始日期=${D1} (实际=${b.coverageStartDate})`);
    assert(b.coverageEndDate === D3, `覆盖结束日期=${D3} (实际=${b.coverageEndDate})`);
    assert(!!b.originalContent, "原始内容已存档");
    assert(b.records.length === 3, `明细记录数=3 (实际=${b.records.length})`);
    assert(b.records.every((r) => r.success), "所有明细状态为成功");
    assert(b.parentBatchId === null, "无父批次（首次导入）");
    assert(b.childBatches.length === 0, "无子批次（尚未重试）");
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  // ============================================================
  // 测试 2: 失败导入 - 检查失败明细及每条具体错误原因
  // ============================================================
  console.log("\n2. 失败导入 - 每条记录带具体错误原因:");
  const FAIL_BATCH = B("fail-import");
  const badCSV =
    "storeId,date,reading\n" +
    `,${D4},1000\n` +
    `${STORE_B},bad-date,abc\n` +
    `${STORE_B},${D5},-5\n`;
  try {
    const res = await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: badCSV,
        fileType: "csv",
        fileName: "bad.csv",
        batchId: FAIL_BATCH,
      }),
    });
    const data = await res.json();
    assert(!data.success, "接口返回失败");
    assert(!!data.errors, "返回错误数组");

    const detailRes = await fetch(`${BASE_URL}/import/batches/${FAIL_BATCH}`);
    const detail = await detailRes.json();
    const b = detail.data;
    assert(b.status === "failed", `批次状态=failed (实际=${b.status})`);
    assert(b.failureCount === 3, `失败条数=3 (实际=${b.failureCount})`);
    assert(b.records.length === 3, `明细记录数=3 (实际=${b.records.length})`);
    assert(b.records.every((r) => !r.success), "所有明细状态为失败");
    const errMsgs = b.records.map((r) => r.errorMessage).filter(Boolean);
    assert(errMsgs.length === 3, "每条失败记录都有具体错误原因");
    const hasStoreIdErr = errMsgs.some((m) => m.includes("storeId"));
    const hasDateErr = errMsgs.some((m) => m.includes("date") || m.includes("YYYY"));
    const hasReadingErr = errMsgs.some((m) => m.includes("reading") || m.includes("负数"));
    assert(hasStoreIdErr, "错误包含缺失 storeId 提示");
    assert(hasDateErr, "错误包含日期格式提示");
    assert(hasReadingErr, "错误包含读数非法提示");
    console.log("     错误样例:", errMsgs[0]?.slice(0, 60) + "...");
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  // ============================================================
  // 测试 3: 同批次号重复导入冲突提示
  // ============================================================
  console.log("\n3. 同批次号重复导入 - 明确提示冲突:");
  try {
    const res = await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: readingsCSV,
        fileType: "csv",
        batchId: SUCCESS_BATCH,
      }),
    });
    const data = await res.json();
    assert(!data.success, "重复批次ID被拒绝");
    const dupHint = data.errors?.some((e) => e.includes("已存在") || e.includes("重复"));
    assert(dupHint, `错误提示包含'已存在/重复'字样 (实际errors=${JSON.stringify(data.errors)})`);
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  // ============================================================
  // 测试 4: 重复数据冲突提示（不同批次但 storeId+date 相同）
  // ============================================================
  console.log("\n4. 重复数据(同门店+日期) - 提示避免覆盖历史:");
  const DUP_DATA_BATCH = B("dup-data");
  const dupCSV =
    "storeId,date,reading\n" +
    `${STORE_A},${D2},9999\n` +
    `${STORE_A},${D4},1350\n`;
  try {
    const res = await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: dupCSV,
        fileType: "csv",
        batchId: DUP_DATA_BATCH,
      }),
    });
    const data = await res.json();
    assert(data.success, "重复数据时接口仍成功（忽略冲突行）");
    assert(!!data.data.conflicts && data.data.conflicts.length > 0, "返回冲突列表");
    assert(
      data.data.conflicts[0].includes(STORE_A.slice(0, 6)) || data.data.conflicts[0].includes("已存在"),
      `冲突消息包含门店标识或已存在字样 (实际=${data.data.conflicts[0]?.slice(0, 60)})`
    );
    assert(data.data.successCount === 1, `仅新数据成功=1条 (实际=${data.data.successCount})`);
    assert(data.data.failureCount === 1, `冲突被标记失败=1条 (实际=${data.data.failureCount})`);

    const detailRes = await fetch(`${BASE_URL}/import/batches/${DUP_DATA_BATCH}`);
    const detail = await detailRes.json();
    const dupRecs = detail.data.records.filter((r) => r.isDuplicate);
    assert(dupRecs.length === 1, `明细中有1条被标记isDuplicate (实际=${dupRecs.length})`);
    assert(dupRecs[0].errorMessage?.includes("忽略"), "冲突记录提示'忽略'不覆盖历史");
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  // ============================================================
  // 测试 5: 重试导入 - 生成新批次并与父批次关联
  // ============================================================
  console.log("\n5. 重试失败批次 - 生成新批次并关联父批次:");
  try {
    const correctedCSV =
      "storeId,date,reading\n" +
      `${STORE_B},${D4},800\n` +
      `${STORE_B},${D5},900\n` +
      `${STORE_B},${D6},1010\n`;
    const RETRY_BATCH = B("retry-import");
    const res = await fetch(`${BASE_URL}/import/batches/${FAIL_BATCH}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correctedContent: correctedCSV,
        newBatchId: RETRY_BATCH,
      }),
    });
    const data = await res.json();
    assert(data.success, "重试导入成功");
    assert(data.data.batchId === RETRY_BATCH, `新批次ID正确 (实际=${data.data.batchId?.slice(0, 12)})`);
    assert(data.data.successCount === 3, `重试成功3条 (实际=${data.data.successCount})`);

    const retryDetail = await (await fetch(`${BASE_URL}/import/batches/${RETRY_BATCH}`)).json();
    assert(retryDetail.data.parentBatchId === FAIL_BATCH, `新批次 parentBatchId 指向父批次 (实际=${retryDetail.data.parentBatchId?.slice(0, 12)})`);
    assert(retryDetail.data.parentBatch.id === FAIL_BATCH, "详情含父批次对象");

    const failDetail = await (await fetch(`${BASE_URL}/import/batches/${FAIL_BATCH}`)).json();
    const hasChild = failDetail.data.childBatches.some((c) => c.id === RETRY_BATCH);
    assert(hasChild, "父批次的 childBatches 包含重试新批次");
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  // ============================================================
  // 测试 6: 列表按类型/状态/时间筛选
  // ============================================================
  console.log("\n6. 批次列表筛选（类型/状态/时间）:");
  try {
    const allRes = await fetch(`${BASE_URL}/import/batches`);
    const all = await allRes.json();
    assert(all.data.length >= 4, `至少4条批次记录 (实际=${all.data.length})`);

    const readingsRes = await fetch(`${BASE_URL}/import/batches?type=readings`);
    const readings = await readingsRes.json();
    assert(readings.data.every((b) => b.type === "readings"), "type=readings 筛选结果全是 readings");

    const failedRes = await fetch(`${BASE_URL}/import/batches?status=failed`);
    const failed = await failedRes.json();
    assert(failed.data.every((b) => b.status === "failed"), "status=failed 筛选结果全是失败");

    const today = new Date().toISOString().slice(0, 10);
    const filteredRes = await fetch(`${BASE_URL}/import/batches?startDate=${today}&endDate=${today}`);
    const filtered = await filteredRes.json();
    assert(
      filtered.data.every((b) => b.createdAt.slice(0, 10) === today),
      "按时间筛选只返回当日批次"
    );
    console.log(`     筛选结果数量: all=${all.data.length}, readings=${readings.data.length}, failed=${failed.data.length}, today=${filtered.data.length}`);
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  // ============================================================
  // 测试 7: 导出 CSV 和 JSON，包含成功记录、失败原因、关联批次
  // ============================================================
  console.log("\n7. 批次详情导出（CSV/JSON）含完整信息:");
  try {
    const csvRes = await fetch(`${BASE_URL}/import/batches/${DUP_DATA_BATCH}/export?format=csv`);
    const csv = await csvRes.text();
    assert(csv.length > 0, "CSV 导出有内容");
    assert(csv.includes("success"), "CSV 包含 success 列");
    assert(csv.includes("errorMessage"), "CSV 包含 errorMessage 列");
    assert(csv.includes("parentBatchId"), "CSV 包含 parentBatchId 列");
    assert(csv.includes("childBatchIds"), "CSV 包含 childBatchIds 列");
    assert(csv.includes(STORE_A), "CSV 包含原始数据的 storeId");
    assert(csvRes.headers.get("content-type")?.includes("csv"), "Content-Type 为 csv");

    const jsonRes = await fetch(`${BASE_URL}/import/batches/${DUP_DATA_BATCH}/export?format=json`);
    const json = await jsonRes.json();
    assert(!!json.batch, "JSON 有 batch 元信息");
    assert(Array.isArray(json.records), "JSON 有 records 数组");
    assert(json.batch.id === DUP_DATA_BATCH, "JSON 批次ID 正确");
    assert(json.batch.successCount !== undefined, "JSON 含 successCount");
    assert(json.batch.failureCount !== undefined, "JSON 含 failureCount");
    assert("parentBatchId" in json.batch, "JSON 含 parentBatchId 字段");
    assert("childBatches" in json.batch, "JSON 含 childBatches 字段");
    assert(jsonRes.headers.get("content-type")?.includes("json"), "Content-Type 为 json");
    console.log(`     CSV=${csv.split("\n").length}行, JSON.records=${json.records.length}条`);
  } catch (e) {
    console.log("   ❌ 接口异常:", e.message);
    process.exitCode = 1;
  }

  console.log("\n=== 数据管理增强版综合测试完成（可重复执行，结论应一致）===");
}

testDataManagement().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
