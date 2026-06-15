import { Router, type Request, type Response } from "express";
import * as service from "../services.js";
import * as repo from "../repositories.js";
import type { ThresholdConfig } from "../../shared/types.js";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  try {
    const configs = repo.getThresholdConfigs();
    res.json({ success: true, data: configs });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put("/global", (req: Request, res: Response) => {
  try {
    const { dailyLimit, fluctuationRate, hoursCorrectionFactor } = req.body;
    const validation = service.validateThreshold({
      dailyLimit,
      fluctuationRate,
      hoursCorrectionFactor,
    });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }
    const config: Omit<ThresholdConfig, "id"> = {
      storeId: null,
      dailyLimit: Number(dailyLimit),
      fluctuationRate: Number(fluctuationRate),
      hoursCorrectionFactor: Number(hoursCorrectionFactor),
    };
    const saved = repo.saveThresholdConfig(config);
    const anomalyCount = service.recalculateAllAnomalies();
    res.json({
      success: true,
      data: saved,
      warnings: validation.warnings,
      anomalyCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put("/:storeId", (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { dailyLimit, fluctuationRate, hoursCorrectionFactor } = req.body;
    const validation = service.validateThreshold({
      dailyLimit,
      fluctuationRate,
      hoursCorrectionFactor,
    });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }
    if (!repo.getStoreById(storeId)) {
      return res.status(404).json({ success: false, error: "门店不存在" });
    }
    const config: Omit<ThresholdConfig, "id"> = {
      storeId,
      dailyLimit: Number(dailyLimit),
      fluctuationRate: Number(fluctuationRate),
      hoursCorrectionFactor: Number(hoursCorrectionFactor),
    };
    const saved = repo.saveThresholdConfig(config);
    const anomalyCount = service.recalculateAnomaliesForStores([storeId]);
    res.json({
      success: true,
      data: saved,
      warnings: validation.warnings,
      anomalyCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/:storeId", (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const config = repo.getThresholdForStore(storeId);
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
