import { Router, type Request, type Response } from "express";
import * as repo from "../repositories.js";
import * as service from "../services.js";

const router = Router();

router.get("/snapshot", (_req: Request, res: Response) => {
  try {
    const snapshot = repo.getSystemStateSnapshot();
    res.json({ success: true, data: snapshot });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/cleanup", (req: Request, res: Response) => {
  try {
    const { prefix, all } = req.body;
    let result;
    if (all === true) {
      result = repo.cleanupAll();
    } else if (prefix && typeof prefix === "string" && prefix.trim().length > 0) {
      result = repo.cleanupByPrefix(prefix.trim());
    } else {
      return res.status(400).json({
        success: false,
        error: "需要指定 prefix（清理特定前缀数据）或 all=true（清理全部数据）",
      });
    }
    const totalDeleted =
      result.deletedStores +
      result.deletedReadings +
      result.deletedHours +
      result.deletedMaintenance +
      result.deletedBatches +
      result.deletedBatchRecords +
      result.deletedAnomalies +
      result.deletedReviewLogs;

    console.log(`[验证清理] 前缀=${prefix || "全部"}，共删除 ${totalDeleted} 条记录`);
    res.json({
      success: true,
      data: {
        ...result,
        totalDeleted,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/import-sample", async (req: Request, res: Response) => {
  try {
    const { prefix = "repro", seed } = req.body;
    const runId = seed || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const storePrefix = `${prefix}-${runId}`;
    const stores = [
      { id: `${storePrefix}-A`, name: `${storePrefix}-A 门店`, area: 150, category: "旗舰" },
      { id: `${storePrefix}-B`, name: `${storePrefix}-B 门店`, area: 120, category: "标准" },
    ];

    for (const s of stores) {
      repo.upsertStore({ name: s.name, area: s.area, category: s.category }, s.id);
    }

    const baseReadings: Record<string, number> = {};
    stores.forEach((s, i) => {
      baseReadings[s.id] = 1000 + i * 200;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const readingRows: any[] = [];
    const hoursRows: any[] = [];
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const d = new Date(today);
      d.setDate(d.getDate() - dayOffset);
      const dateStr = d.toISOString().slice(0, 10);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      for (let i = 0; i < stores.length; i++) {
        const store = stores[i];
        let increment = 100 + Math.random() * 20 - 10;

        if (i === 1 && dayOffset === 4) {
          increment = 280;
        } else if (i === 1 && dayOffset === 3) {
          increment = baseReadings[store.id] - 5;
        }

        baseReadings[store.id] += increment;
        readingRows.push({
          storeId: store.id,
          date: dateStr,
          reading: Math.round(baseReadings[store.id] * 100) / 100,
        });

        hoursRows.push({
          storeId: store.id,
          date: dateStr,
          openHour: 8,
          closeHour: isWeekend ? 22 : 20,
        });
      }
    }

    const maintenanceRows: any[] = [];
    const md = new Date(today);
    md.setDate(md.getDate() - 5);
    maintenanceRows.push({
      storeId: stores[1].id,
      date: md.toISOString().slice(0, 10),
      type: "设备维修",
      description: "中央空调主机维修",
    });

    const readingsBatchId = `${storePrefix}-readings`;
    const hoursBatchId = `${storePrefix}-hours`;
    const maintBatchId = `${storePrefix}-maint`;

    const readingsResult = await service.importReadings(readingRows, readingsBatchId, false, {
      fileType: "json",
      fileName: `${storePrefix}_readings.json`,
    });
    const hoursResult = await service.importHours(hoursRows, hoursBatchId, false, {
      fileType: "json",
      fileName: `${storePrefix}_hours.json`,
    });
    const maintResult = await service.importMaintenance(maintenanceRows, maintBatchId, false, {
      fileType: "json",
      fileName: `${storePrefix}_maint.json`,
    });

    const anomalyCount = service.recalculateAllAnomalies();

    res.json({
      success: true,
      data: {
        runId,
        storePrefix,
        stores,
        readingRows: readingRows.length,
        hoursRows: hoursRows.length,
        maintenanceRows: maintenanceRows.length,
        readingsResult,
        hoursResult,
        maintResult,
        anomalyCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/snapshot-compare", (req: Request, res: Response) => {
  try {
    const { before, after, label } = req.body;
    if (!before || !after) {
      return res.status(400).json({
        success: false,
        error: "需要提供 before 和 after 两个快照",
      });
    }

    const diffs: string[] = [];
    const check = (field: string, a: any, b: any) => {
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        diffs.push(`${field}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
      }
    };

    check("storeCount", before.storeCount, after.storeCount);
    check("totalMeterReadings", before.totalMeterReadings, after.totalMeterReadings);
    check("totalBusinessHours", before.totalBusinessHours, after.totalBusinessHours);
    check("totalMaintenanceRecords", before.totalMaintenanceRecords, after.totalMaintenanceRecords);
    check("totalImportBatches", before.totalImportBatches, after.totalImportBatches);
    check("anomalyCounts", before.anomalyCounts, after.anomalyCounts);

    const beforeReviewedIds = new Set(
      before.anomalies.filter((a: any) => a.status !== "pending").map((a: any) => a.id)
    );
    const afterReviewedIds = new Set(
      after.anomalies.filter((a: any) => a.status !== "pending").map((a: any) => a.id)
    );

    const lostReviewed = [...beforeReviewedIds].filter((id) => !afterReviewedIds.has(id));
    const changedReviews: string[] = [];

    for (const a of before.anomalies) {
      if (a.status === "pending") continue;
      const match = after.anomalies.find((b: any) => b.id === a.id);
      if (!match) continue;
      if (
        match.status !== a.status ||
        match.note !== a.note ||
        match.reviewer !== a.reviewer ||
        match.attribution !== a.attribution
      ) {
        changedReviews.push(
          `${a.id}: status=${a.status}→${match.status}, reviewer=${a.reviewer}→${match.reviewer}`
        );
      }
    }

    res.json({
      success: true,
      data: {
        label: label || "未命名对比",
        timestamp: new Date().toISOString(),
        identical: diffs.length === 0 && lostReviewed.length === 0 && changedReviews.length === 0,
        fieldDiffs: diffs,
        lostReviewedAnomalies: lostReviewed,
        changedReviews,
        summary: {
          before,
          after,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
