import { Router, type Request, type Response } from "express";
import * as repo from "../repositories.js";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  try {
    const stores = repo.getStores();
    res.json({ success: true, data: stores });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/", (req: Request, res: Response) => {
  try {
    const { id, name, area, category } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "门店名称不能为空" });
    if (area <= 0) return res.status(400).json({ success: false, error: "面积必须大于0" });
    const store = repo.upsertStore({ name, area: Number(area), category: category || "默认" }, id);
    res.json({ success: true, data: store });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
