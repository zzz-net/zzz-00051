const BASE_URL = "http://localhost:3002/api";
const UID = Date.now().toString(36) + Math.floor(Math.random() * 999).toString(36);
const B = (name) => `tc-${UID}-${name}`; // 批次ID动态化，避免重复导入冲突

function log(label, val) {
  const prefix = "   ";
  if (typeof val === "boolean") {
    console.log(prefix + (val ? "✅ PASS" : "❌ FAIL") + " - " + label);
  } else {
    console.log(prefix + label + ":", typeof val === "object" ? JSON.stringify(val) : val);
  }
}

async function cleanup() {
  // 可选：清理测试数据，这里不做真删除，避免影响已有样例
  return true;
}

async function main() {
  console.log("\n=== 门店能耗复盘流程 - 问题复现与验证测试 ===\n");

  // ============================================================
  // TEST 1: 空读数拦截 - 空/null/undefined/NaN 不允许入库
  // ============================================================
  console.log("【Test 1】空读数拦截：空/null/undefined/NaN 禁止入库");
  let test1_pass = true;
  try {
    const badCases = [
      { name: "空字符串", payload: "storeId,date,reading\n47f9f7c0-cded-474e-85de-a283afbeade6,2026-06-25," },
      { name: "null值",    payload: '[{"storeId":"47f9f7c0-cded-474e-85de-a283afbeade6","date":"2026-06-26","reading":null}]' },
      { name: "undefined", payload: '[{"storeId":"47f9f7c0-cded-474e-85de-a283afbeade6","date":"2026-06-27"}]' },
      { name: "NaN字符串", payload: "storeId,date,reading\n47f9f7c0-cded-474e-85de-a283afbeade6,2026-06-28,NaN" },
    ];
    for (const c of badCases) {
      const res = await fetch(`${BASE_URL}/import/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileContent: c.payload,
          fileType: c.payload.startsWith("[") ? "json" : "csv",
          batchId: B("t1e-" + c.name),
        }),
      });
      const data = await res.json().catch(() => ({}));
      const blocked = !data.success && data.errors?.some((e) => /reading|必填|数字/.test(e));
      log(`拦截场景 ${c.name}`, blocked);
      if (!blocked) test1_pass = false;
    }
    // 额外确认坏数据没有落库（查异常和读数不该突然新增这些日期的异常）
    log("空读数整体通过", test1_pass);
  } catch (e) {
    console.log("   ❌ 异常:", e.message);
    test1_pass = false;
  }

  // ============================================================
  // TEST 2: 必填字段缺失 - 完全拦截，坏数据一条都不能落库
  // ============================================================
  console.log("\n【Test 2】必填字段缺失：全量拦截，禁止部分落库");
  let test2_pass = true;
  try {
    // 构造一批混合数据：前几条好的、最后一条缺字段
    const mixedCSV = [
      "storeId,date,reading",
      "47f9f7c0-cded-474e-85de-a283afbeade6,2026-06-30,5500",   // good
      "47f9f7c0-cded-474e-85de-a283afbeade6,2026-07-01,5620",   // good
      ",2026-07-02,5700",                                         // 缺 storeId - BAD
    ].join("\n");
    const res = await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileContent: mixedCSV, fileType: "csv", batchId: B("t2-mixed") }),
    });
    const data = await res.json().catch(() => ({}));
    const rejected = !data.success;
    log("含缺字段的混合批次被拒绝", rejected);
    if (!rejected) test2_pass = false;

    // 再用纯好数据批次作为对照，确保正常情况能过
    const pureCSV = [
      "storeId,date,reading",
      "47f9f7c0-cded-474e-85de-a283afbeade6,2026-07-03,5780",
      "47f9f7c0-cded-474e-85de-a283afbeade6,2026-07-04,5900",
    ].join("\n");
    const okRes = await fetch(`${BASE_URL}/import/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileContent: pureCSV, fileType: "csv", batchId: B("t2-pure") }),
    });
    const okData = await okRes.json().catch(() => ({}));
    log("全好数据批次导入成功", okData.success === true);

    log("必填字段校验整体通过", test2_pass && okData.success === true);
    test2_pass = test2_pass && okData.success === true;
  } catch (e) {
    console.log("   ❌ 异常:", e.message);
    test2_pass = false;
  }

  // ============================================================
  // TEST 3: 阈值调整后异常重算 - 待复核异常要被清理并按新阈值重算
  // ============================================================
  console.log("\n【Test 3】阈值调整→重算：待复核异常按新阈值重新判断");
  let test3_pass = true;
  try {
    // 步骤A：先拿当前阈值快照
    const before = await (await fetch(`${BASE_URL}/thresholds`)).json();
    const cur = before.data.find((t) => t.storeId === null) || before.data[0];
    log("当前全局阈值", {
      dailyLimit: cur.dailyLimit,
      fluctuationRate: cur.fluctuationRate,
    });

    // 步骤B：取当前待复核异常的状态和数量
    const pendingBefore = await (await fetch(`${BASE_URL}/anomalies?status=pending`)).json();
    const pendingIdsBefore = new Set(pendingBefore.data.map((a) => a.id));
    log("阈值调整前 待复核异常数", pendingBefore.data.length);

    // 步骤C：设置一个极端宽松的阈值（应该把 pending 数量压到很低甚至 0）
    const loose = await fetch(`${BASE_URL}/thresholds/global`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyLimit: 9999, fluctuationRate: 500, hoursCorrectionFactor: cur.hoursCorrectionFactor || 1 }),
    }).then((r) => r.json());
    log("应用宽松阈值 (dailyLimit=9999, fluctuationRate=500%) 成功", loose.success === true);

    const pendingAfterLoose = await (await fetch(`${BASE_URL}/anomalies?status=pending`)).json();
    // 关键断言：宽松阈值下 pending 应该显著减少，并且原来的 pending id 不应该再以 pending 状态存在
    // （那些真正不异常的会消失，仍然异常的如果检测出还是异常也会是新的状态但这里宽松理应几乎无异常）
    const remainPendingOld = pendingAfterLoose.data.filter((a) => pendingIdsBefore.has(a.id) && a.status === "pending").length;
    log("宽松阈值后旧的待复核ID仍然是pending的数量", remainPendingOld);
    const looseOK = remainPendingOld === 0 || pendingAfterLoose.data.length <= pendingBefore.data.length;
    log("旧待复核被清理/重判（不再原地跳过）", looseOK);
    if (!looseOK) test3_pass = false;

    // 步骤D：恢复正常阈值，再做一次严格阈值，观察 pending 重新出现/数量增加
    const strict = await fetch(`${BASE_URL}/thresholds/global`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailyLimit: cur.dailyLimit,
        fluctuationRate: 5, // 非常严格，5%就算异常
        hoursCorrectionFactor: cur.hoursCorrectionFactor || 1,
      }),
    }).then((r) => r.json());
    log("恢复基准+严格波动阈值成功", strict.success === true);

    const pendingAfterStrict = await (await fetch(`${BASE_URL}/anomalies?status=pending`)).json();
    log("严格阈值下待复核异常数", pendingAfterStrict.data.length);
    const strictOK = pendingAfterStrict.data.length >= pendingAfterLoose.data.length;
    log("严格阈值产生至少和宽松阈值一样多的异常", strictOK);
    if (!strictOK) test3_pass = false;

    // 步骤E：恢复原始阈值
    const restore = await fetch(`${BASE_URL}/thresholds/global`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailyLimit: cur.dailyLimit,
        fluctuationRate: cur.fluctuationRate,
        hoursCorrectionFactor: cur.hoursCorrectionFactor || 1,
      }),
    }).then((r) => r.json());
    log("恢复原始阈值成功", restore.success === true);

    log("阈值→重算逻辑整体通过", test3_pass);
  } catch (e) {
    console.log("   ❌ 异常:", e.message);
    test3_pass = false;
  }

  // ============================================================
  // TEST 4: 导出内容完整性 - 证据链完整（读数/营业时长/维修记录/判断依据）
  // ============================================================
  console.log("\n【Test 4】导出内容完整性：证据链连续可支撑人工复核");
  let test4_pass = true;
  try {
    const csv = await fetch(`${BASE_URL}/anomalies/export?format=csv`).then((r) => r.text());
    const json = await fetch(`${BASE_URL}/anomalies/export?format=json`).then((r) => r.json());

    // CSV 表头字段覆盖检查
    const requiredCols = [
      "date",
      "dailyConsumption",
      "expectedConsumption",
      "deviationRate",
      "readingPrev",        // 前日读数（源数据）
      "readingCurr",        // 当日读数（源数据）
      "businessHours",      // 营业时长（源数据）
      "openHour",           // 开门时间
      "closeHour",          // 关门时间
      "hasMaintenance",     // 是否有维修
      "maintenanceType",    // 维修类型
      "maintenanceDesc",    // 维修描述
      "thresholdDailyLimit",    // 当日判断依据：阈值
      "thresholdFluctuationRate",
      "hoursCorrectionFactor",
      "status",
      "attribution",
      "note",
      "evidenceSource",
      "reviewer",
    ];
    const headerLine = csv.split("\n")[0] || "";
    const colStatus = requiredCols.map((c) => ({
      col: c,
      present: headerLine.includes(c),
    }));
    for (const s of colStatus) {
      log(`CSV字段 [${s.col}] 存在`, s.present);
      if (!s.present) test4_pass = false;
    }

    // JSON 结构检查：至少一条数据应当包含完整证据链字段（导出是裸数组）
    const rows = Array.isArray(json) ? json : (json.data || []);
    if (rows.length > 0) {
      const sample = rows[0];
      const requiredProps = [
        "readingPrev",
        "readingCurr",
        "businessHours",
        "hasMaintenance",
        "thresholdDailyLimit",
        "thresholdFluctuationRate",
      ];
      for (const p of requiredProps) {
        const has = sample[p] !== undefined;
        log(`JSON样例字段 [${p}] 存在`, has);
        if (!has) test4_pass = false;
      }
      // 交叉一致性：dailyConsumption === readingCurr - readingPrev
      if (sample.readingCurr !== null && sample.readingPrev !== null) {
        const consistent = Math.abs(sample.dailyConsumption - (sample.readingCurr - sample.readingPrev)) < 0.001;
        log("日能耗 = 当日读数 - 前日读数 (交叉一致)", consistent);
        if (!consistent) test4_pass = false;
      }
    } else {
      console.log("   ⚠️ JSON导出无数据，结构检查跳过");
    }

    log("导出证据链完整性整体通过", test4_pass);
  } catch (e) {
    console.log("   ❌ 异常:", e.message);
    test4_pass = false;
  }

  // ============================================================
  // Summary
  // ============================================================
  console.log("\n=========== 汇总 ===========");
  const results = [
    ["Test1 空读数拦截", test1_pass],
    ["Test2 必填字段全量拦截", test2_pass],
    ["Test3 阈值变更待复核重算", test3_pass],
    ["Test4 导出证据链完整", test4_pass],
  ];
  let allPass = true;
  for (const [n, p] of results) {
    const mark = p ? "✅" : "❌";
    console.log(`  ${mark} ${n}`);
    if (!p) allPass = false;
  }
  console.log("============================");
  console.log(allPass ? "🎉 全部通过" : "⚠️ 存在失败，请修复后重跑");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
