import { Router, type Request, type Response } from "express";
import * as service from "../services.js";

const router = Router();

router.post("/run", async (req: Request, res: Response) => {
  try {
    const { prefix } = req.body;
    const result = await service.runCockpitPipeline(prefix);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/summary", (_req: Request, res: Response) => {
  try {
    const summary = service.getCockpitDashboardSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/runs", (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const runs = service.listCockpitRuns(limit);
    res.json({ success: true, data: runs });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/runs/:id", (req: Request, res: Response) => {
  try {
    const run = service.getCockpitRunDetail(req.params.id);
    if (!run) {
      return res.status(404).json({ success: false, error: "运行记录不存在" });
    }
    res.json({ success: true, data: run });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/runs/:id/checkpoints", (req: Request, res: Response) => {
  try {
    const checkpoints = service.getCockpitRunCheckpoints(req.params.id);
    res.json({ success: true, data: checkpoints });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
