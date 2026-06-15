import { Router, type Request, type Response } from "express";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import * as service from "../services.js";
import * as repo from "../repositories.js";
import type { ReviewPayload, ThresholdConfig } from "../../shared/types.js";

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
    service.importReadings(data, finalBatchId).then(result => {
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json({ success: true, data: result });
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
    service.importHours(data, finalBatchId).then(result => {
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json({ success: true, data: result });
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
    service.importMaintenance(data, finalBatchId).then(result => {
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json({ success: true, data: result });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/batches", (_req: Request, res: Response) => {
  try {
    const batches = repo.getImportBatches();
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
