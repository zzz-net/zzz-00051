import { Router, type Request, type Response } from "express";
import * as service from "../services.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

router.get("/summary", (_req: Request, res: Response) => {
  try {
    const summary = service.getAcceptanceDashboardSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/service-info", (_req: Request, res: Response) => {
  try {
    const info = service.getServiceInfo();
    res.json({ success: true, data: info });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/run", async (req: Request, res: Response) => {
  try {
    const { name, mode, resumeFrom } = req.body;
    const result = await service.runAcceptanceDrill({
      name,
      mode: mode as "new" | "resume" | "restart_verify" | undefined,
      resumeFrom,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/resume/:id", async (req: Request, res: Response) => {
  try {
    const result = await service.resumeAcceptanceDrill(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/restart-verify/:id", async (req: Request, res: Response) => {
  try {
    const result = await service.verifyRestartRecovery(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/runs", (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const runs = service.listAcceptanceRuns(limit);
    res.json({ success: true, data: runs });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/runs/:id", (req: Request, res: Response) => {
  try {
    const run = service.getAcceptanceRunDetail(req.params.id);
    if (!run) {
      return res.status(404).json({ success: false, error: "验收记录不存在" });
    }
    res.json({ success: true, data: run });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/last", (_req: Request, res: Response) => {
  try {
    const run = service.getLastAcceptanceRun();
    res.json({ success: true, data: run });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/runs/:id/package", (req: Request, res: Response) => {
  try {
    const pkg = service.getAcceptancePackageInfo(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, error: "验收包不存在" });
    }
    res.json({ success: true, data: pkg });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/runs/:id/download", (req: Request, res: Response) => {
  try {
    const pkg = service.downloadAcceptancePackage(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, error: "验收包不存在或未生成" });
    }

    const format = (req.query.format as string) || "json";
    if (format === "json") {
      const summaryFile = path.join(pkg.path, "run-summary.json");
      if (fs.existsSync(summaryFile)) {
        const content = fs.readFileSync(summaryFile, "utf-8");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="acceptance_summary_${req.params.id.slice(0, 8)}.json"`);
        return res.send(content);
      }
    }

    const manifestFile = path.join(pkg.path, "manifest.json");
    if (fs.existsSync(manifestFile)) {
      const content = fs.readFileSync(manifestFile, "utf-8");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="acceptance_manifest_${req.params.id.slice(0, 8)}.json"`);
      return res.send(content);
    }

    res.status(404).json({ success: false, error: "验收包文件不存在" });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/runs/:id/files", (req: Request, res: Response) => {
  try {
    const run = service.getAcceptanceRunDetail(req.params.id);
    if (!run) {
      return res.status(404).json({ success: false, error: "验收记录不存在" });
    }
    res.json({ success: true, data: run.exportFiles });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/runs/:id/file/:filename", (req: Request, res: Response) => {
  try {
    const run = service.getAcceptanceRunDetail(req.params.id);
    if (!run || !run.packagePath) {
      return res.status(404).json({ success: false, error: "验收包不存在" });
    }

    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(run.packagePath, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: "文件不存在" });
    }

    const stat = fs.statSync(filePath);
    if (filename.endsWith(".csv")) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(fs.readFileSync(filePath));
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
