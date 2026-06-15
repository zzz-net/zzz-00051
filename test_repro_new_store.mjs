// ============================================================
// 最小复现测试：两个问题
//  A) 新门店直接导入营业时长 → 接口是否会重置/崩溃
//  B) 固定批次号重复执行 → 缺字段场景是否被误判成重复导入
// ============================================================
const BASE_URL = "http://localhost:3002/api";
const UID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const B = (name) => `rp-${UID}-${name}`;
const log = (t, c = "") => console.log(`   ${t}  ${c}`);
const pass = (s) => console.log(`   ✅ PASS - ${s}`);
const fail = (s) => console.log(`   ❌ FAIL - ${s}`);

async function json(method, path, body) {
  try {
    const r = await fetch(BASE_URL + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  } catch (e) {
    // 连接重置/未处理异常 → fetch 会抛
    return { ok: false, status: 0, data: { error: `连接异常: ${e.message}` }, fetchError: true };
  }
}

async function main() {
  console.log("\n=== 门店能耗复盘 - 问题最小复现 ===\n");

  // 生成一个数据库中绝对不存在的全新门店ID
  const NEW_STORE_ID = "new-store-" + UID;

  // ============================================================
  // [问题A] 新门店首批导入营业时长 → 接口是否会重置/崩溃？
  // ============================================================
  console.log("【问题A】新门店(不存在)直接导入营业时长");
  const hoursPayload = {
    fileType: "json",
    batchId: B("hours-new-store"),
    fileContent: JSON.stringify([
      { storeId: NEW_STORE_ID, date: "2026-06-01", openHour: 9, closeHour: 21 },
      { storeId: NEW_STORE_ID, date: "2026-06-02", openHour: 9, closeHour: 22 },
    ]),
  };
  const a1 = await json("POST", "/import/hours", hoursPayload);
  if (a1.fetchError) {
    fail(`接口崩溃/连接重置: ${a1.data.error}`);
    console.log("\n>>> 问题A复现成功：新门店导入营业时长触发连接重置\n");
  } else if (!a1.ok) {
    log(`HTTP ${a1.status}`, JSON.stringify(a1.data));
    // 外键错误或任何业务错误都应该被优雅处理
    if (a1.data?.success === false) {
      pass(`接口正常响应(失败态)，错误原因: ${a1.data.errors?.[0] || a1.data.error}`);
    } else {
      pass(`接口正常响应，未崩溃`);
    }
  } else {
    pass(`接口正常成功响应，返回 anomalyCount=${a1.data?.data?.anomalyCount}`);
  }

  // 对照：同样不存在的新门店先导入电表读数（有 autoUpsertStores，不会有问题）
  console.log("\n【对照A】新门店导入电表读数（应该肯定能过）");
  const readingsPayload = {
    fileType: "json",
    batchId: B("readings-new-store"),
    fileContent: JSON.stringify([
      { storeId: NEW_STORE_ID + "-r", date: "2026-06-01", reading: 100 },
      { storeId: NEW_STORE_ID + "-r", date: "2026-06-02", reading: 115 },
    ]),
  };
  const a2 = await json("POST", "/import/readings", readingsPayload);
  if (a2.fetchError) fail("导入读数也崩溃: " + a2.data.error);
  else pass(`状态:HTTP ${a2.status}, success=${a2.data?.success ?? a2.data?.data?.success}`);

  // ============================================================
  // [问题B] 固定批次号重复执行 → 缺字段误判成重复导入？
  // ============================================================
  console.log("\n【问题B】固定批次号重复导入：缺字段场景两次的错误原因是否一致？");
  const FIXED_BAD_BATCH = "bad-batch-fixed-missing-fields";
  const badPayload = (bid) => ({
    fileType: "json",
    batchId: bid,
    fileContent: JSON.stringify([
      { storeId: "STORE-FIX", date: "2026-06-01" /* 缺 reading */ },
    ]),
  });

  // 第一次导入：预期错误是"缺字段 reading"
  const b1 = await json("POST", "/import/readings", badPayload(FIXED_BAD_BATCH));
  const err1 = b1.data?.errors?.[0] || b1.data?.error || "";
  const isMissingField1 = err1.includes("缺少必填字段 reading");
  const isDup1 = err1.includes("已存在");

  // 第二次导入：用**同一 batchId**（模拟测试脚本重复跑）
  const b2 = await json("POST", "/import/readings", badPayload(FIXED_BAD_BATCH));
  const err2 = b2.data?.errors?.[0] || b2.data?.error || "";
  const isMissingField2 = err2.includes("缺少必填字段 reading");
  const isDup2 = err2.includes("已存在");

  console.log(`   第1次错误原因: [${err1.slice(0, 80)}]`);
  console.log(`   第2次错误原因: [${err2.slice(0, 80)}]`);

  if (isMissingField1 && isMissingField2) {
    pass("两次都命中缺字段（说明 batchId 是动态隔离的，没有串）");
  } else if (isMissingField1 && isDup2) {
    fail("第1次缺字段、第2次重复导入！固定batchId导致串判！测试如果第2次断言缺字段就会误报PASS或FAIL完全看运气");
    console.log("\n>>> 问题B复现成功：固定批次号二次运行错误原因漂移\n");
  } else {
    log(`其他情况: miss1=${isMissingField1} dup1=${isDup1} | miss2=${isMissingField2} dup2=${isDup2}`);
  }

  // 对照：动态 batchId 两次都应该是缺字段
  console.log("\n【对照B】动态批次号两次导入：错误原因应保持一致（都是缺字段）");
  const b3 = await json("POST", "/import/readings", badPayload(B("dynamic-missing-1")));
  const b4 = await json("POST", "/import/readings", badPayload(B("dynamic-missing-2")));
  const m3 = (b3.data?.errors?.[0] || "").includes("缺少必填字段 reading");
  const m4 = (b4.data?.errors?.[0] || "").includes("缺少必填字段 reading");
  if (m3 && m4) pass("动态 batchId 稳定命中缺字段，可重复验证");
  else fail(`动态也不一致: m3=${m3} m4=${m4}`);

  console.log("\n=== 复现测试完成（修完后应全部 PASS）===");
}
main().catch((e) => console.error("脚本本身异常:", e));
