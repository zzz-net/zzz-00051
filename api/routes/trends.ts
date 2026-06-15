import { Router, type Request, type Response } from "express";
import * as repo from "../repositories.js";

const router = Router();

router.get("/stats", (_req: Request, res: Response) => {
  try {
    const stats = repo.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/:storeId", (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const trend = repo.getTrendData(storeId);
    res.json({ success: true, data: trend });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/", (_req: Request, res: Response) => {
  try {
    const stores = repo.getStores();
    const allTrends = stores.map(s => {
      try {
        return repo.getTrendData(s.id);
      } catch {
        return null;
      }
    }).filter(Boolean);
    res.json({ success: true, data: allTrends });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
