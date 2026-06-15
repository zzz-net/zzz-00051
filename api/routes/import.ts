import { Router, type Request, type Response } from "express";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import * as service from "../services.js";
import * as repo from "../repositories.js";
import type { ReviewPayload, ThresholdConfig, BatchFilter } from "../../shared/types.js";

const router = Router();

router.post("/readings", (req: Request, res: Response) => {
  try {
    const { fileContent, fileName, fileType, batchId } = req.body;
    if (!fileContent) {
      return res.status(400).json({ success: false, error: "文件内容不能为空" });
    }
    let data: any[];
    if (fileType === "csv") {
      const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: "CSV 解析错误",
          details: parsed.errors,
        });
      }
      data = parsed.data.slice();
    } else {
      data = typeof fileContent === "string" ? JSON.parse(fileContent) : fileContent;
    }
    const finalBatchId = batchId || uuidv4();
    service
      .importReadings(data, finalBatchId, true, { fileType, fileName })
      .then((result) => {
        if (!result.success) {
          return res.status(400).json(result);
        }
        res.json({ success: true, data: result });
      })
      .catch((err) => {
        res.status(500).json({ success: false, error: (err as Error).message });
      });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/hours", (req: Request, res: Response) => {
  try {
    const { fileContent, fileName, fileType, batchId } = req.body;
    if (!fileContent) {
      return res.status(400).json({ success: false, error: "文件内容不能为空" });
    }
    let data: any[];
    if (fileType === "csv") {
      const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: "CSV 解析错误",
          details: parsed.errors,
        });
      }
      data = parsed.data.slice();
    } else {
      data = typeof fileContent === "string" ? JSON.parse(fileContent) : fileContent;
    }
    const finalBatchId = batchId || uuidv4();
    service
      .importHours(data, finalBatchId, true, { fileType, fileName })
      .then((result) => {
        if (!result.success) {
          return res.status(400).json(result);
        }
        res.json({ success: true, data: result });
      })
      .catch((err) => {
        res.status(500).json({ success: false, error: (err as Error).message });
      });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/maintenance", (req: Request, res: Response) => {
  try {
    const { fileContent, fileName, fileType, batchId } = req.body;
    if (!fileContent) {
      return res.status(400).json({ success: false, error: "文件内容不能为空" });
    }
    let data: any[];
    if (fileType === "csv") {
      const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: "CSV 解析错误",
          details: parsed.errors,
        });
      }
      data = parsed.data;
    } else {
      data = typeof fileContent === "string" ? JSON.parse(fileContent) : fileContent;
    }
    const finalBatchId = batchId || uuidv4();
    service
      .importMaintenance(data, finalBatchId, true, { fileType, fileName })
      .then((result) => {
        if (!result.success) {
          return res.status(400).json(result);
        }
        res.json({ success: true, data: result });
      })
      .catch((err) => {
        res.status(500).json({ success: false, error: (err as Error).message });
      });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/batches", (req: Request, res: Response) => {
  try {
    const filter: BatchFilter = {};
    if (req.query.type) filter.type = req.query.type as any;
    if (req.query.status) filter.status = req.query.status as any;
    if (req.query.startDate) filter.startDate = req.query.startDate as string;
    if (req.query.endDate) filter.endDate = req.query.endDate as string;
    const batches = repo.getImportBatches(filter);
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/batches/:id", (req: Request, res: Response) => {
  try {
    const detail = repo.getImportBatchDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ success: false, error: "批次不存在" });
    }
    res.json({ success: true, data: detail });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/batches/:id/retry", (req: Request, res: Response) => {
  try {
    const { correctedContent, newBatchId } = req.body;
    const finalNewBatchId = newBatchId || uuidv4();
    if (!correctedContent) {
      return res.status(400).json({ success: false, error: "修正后的内容不能为空" });
    }
    service
      .retryImport(req.params.id, correctedContent, finalNewBatchId)
      .then((result) => {
        if (!result.success) {
          return res.status(400).json(result);
        }
        res.json({ success: true, data: result });
      })
      .catch((err) => {
        res.status(500).json({ success: false, error: (err as Error).message });
      });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/batches/:id/export", (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || "json";
    const batch = repo.getImportBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, error: "批次不存在" });
    }
    const data = service.getBatchExportData(req.params.id, format as "csv" | "json");
    const safeName = (batch.fileName || `batch-${batch.id.slice(0, 8)}`).replace(/[^\w.\-]/g, "_");
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.csv"`);
      res.send("\ufeff" + data);
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.json"`);
      res.send(data);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
