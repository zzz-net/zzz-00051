import { Router, type Request, type Response } from "express";
import * as service from "../services.js";
import * as repo from "../repositories.js";
import type { ReviewPayload, AnomalyStatus } from "../../shared/types.js";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  try {
    const { status, storeId, startDate, endDate } = req.query;
    const filters: any = {};
    if (status) filters.status = status as AnomalyStatus;
    if (storeId) filters.storeId = storeId as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    const anomalies = repo.getAnomalies(filters);
    const stores = new Map(repo.getStores().map(s => [s.id, s]));
    const withStoreName = anomalies.map(a => ({
      ...a,
      storeName: stores.get(a.storeId)?.name || a.storeId,
    }));
    res.json({ success: true, data: withStoreName });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put("/:id/review", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payload = req.body as ReviewPayload;
    if (!payload.status) {
      return res.status(400).json({ success: false, error: "状态不能为空" });
    }
    if (!payload.note) {
      return res.status(400).json({ success: false, error: "备注不能为空" });
    }
    if (!payload.evidenceSource) {
      return res.status(400).json({ success: false, error: "证据来源不能为空" });
    }
    if (!payload.reviewer) {
      return res.status(400).json({ success: false, error: "复核人不能为空" });
    }
    if (!["confirmed", "false_positive", "closed", "pending"].includes(payload.status)) {
      return res.status(400).json({ success: false, error: "无效的状态值" });
    }
    const result = service.reviewAnomaly(id, payload);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/:id/logs", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const logs = repo.getReviewLogs(id);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/recalculate", (_req: Request, res: Response) => {
  try {
    const anomalyCount = service.recalculateAllAnomalies();
    res.json({ success: true, data: { anomalyCount } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/export", (req: Request, res: Response) => {
  try {
    const { format = "csv", status, storeId, startDate, endDate } = req.query;
    const filters: any = {};
    if (status) filters.status = status as AnomalyStatus;
    if (storeId) filters.storeId = storeId as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    const exportResult = service.getAnomaliesForExport(filters);
    const { exportMeta, records } = exportResult;

    const filterParts: string[] = [];
    if (filters.status) filterParts.push(`status-${filters.status}`);
    if (filters.storeId) filterParts.push(`store-${filters.storeId.slice(0, 8)}`);
    if (filters.startDate) filterParts.push(`from-${filters.startDate}`);
    if (filters.endDate) filterParts.push(`to-${filters.endDate}`);
    const filterSuffix = filterParts.length > 0 ? `_${filterParts.join("_")}` : "";
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="anomalies_${dateStr}${filterSuffix}.json"`);
      res.send(JSON.stringify(exportResult, null, 2));
    } else {
      const metaHeaderRows = [
        [`# 导出时间: ${exportMeta.exportedAt}`],
        [`# 记录总数: ${exportMeta.recordCount}`],
        [`# 筛选条件: ${JSON.stringify(exportMeta.filters)}`],
        [`# 状态汇总: ${JSON.stringify(exportMeta.summary.byStatus)}`],
        [`# 门店汇总: ${JSON.stringify(exportMeta.summary.byStore)}`],
        [],
      ];
      const metaCSV = metaHeaderRows.map(r => r.join(",")).join("\n");
      const dataCSV = service.toCSV(records);
      const csv = metaCSV + "\n" + dataCSV;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="anomalies_${dateStr}${filterSuffix}.csv"`);
      res.send("\ufeff" + csv);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
