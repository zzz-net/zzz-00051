import { Router, type Request, type Response } from "express";
import * as service from "../services.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

router.post("/recover/:id", async (req: Request, res: Response) => {
  try {
    const { mode } = req.body;
    if (!mode || (mode !== "continue" && mode !== "restart")) {
      return res.status(400).json({
        success: false,
        error: "必须指定恢复模式: continue 或 restart",
      });
    }

    const runId = req.params.id;
    const result = await service.recoverDrill(runId, mode);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
        conflicts: result.conflicts,
      });
    }

    res.json({
      success: true,
      data: {
        run: result.run,
        action: result.action,
        conflicts: result.conflicts,
      },
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

router.get("/status/:id", (req: Request, res: Response) => {
  try {
    const result = service.getDrillRecoveryStatus(req.params.id);
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.message,
      });
    }
    res.json({
      success: true,
      data: result.status,
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

router.post("/snapshot/:id", (req: Request, res: Response) => {
  try {
    const result = service.saveManualSnapshot(req.params.id);
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.message,
      });
    }
    res.json({
      success: true,
      data: result.snapshot,
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

router.get("/snapshots/:id", (req: Request, res: Response) => {
  try {
    const result = service.getDrillSnapshots(req.params.id);
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.message,
      });
    }
    res.json({
      success: true,
      data: result.snapshots,
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

router.post("/pause/:id", (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const result = service.pauseDrill(req.params.id, reason);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }
    res.json({
      success: true,
      data: result.run,
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

router.post("/compare", (req: Request, res: Response) => {
  try {
    const { firstRunId, secondRunId } = req.body;
    if (!firstRunId || !secondRunId) {
      return res.status(400).json({
        success: false,
        error: "必须提供 firstRunId 和 secondRunId",
      });
    }

    const result = service.compareDrillRuns(firstRunId, secondRunId);
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.message,
      });
    }

    res.json({
      success: true,
      data: result.comparison,
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

router.get("/comparisons", (req: Request, res: Response) => {
  try {
    const firstRunId = req.query.firstRunId as string | undefined;
    const secondRunId = req.query.secondRunId as string | undefined;

    const result = service.getDrillComparisons(firstRunId, secondRunId);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }

    res.json({
      success: true,
      data: result.comparisons,
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

router.get("/comparisons/:id", (req: Request, res: Response) => {
  try {
    const result = service.getDrillComparisons(req.params.id);
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.message,
      });
    }
    res.json({
      success: true,
      data: result.comparisons,
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

router.post("/export/load", (req: Request, res: Response) => {
  try {
    const { packagePath } = req.body;
    if (!packagePath) {
      return res.status(400).json({
        success: false,
        error: "必须提供 packagePath",
      });
    }

    const result = service.loadExportPackage(packagePath);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
        data: result.index,
      });
    }

    res.json({
      success: true,
      data: {
        ...result.index,
        existingRunId: result.existingRunId,
      },
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

router.post("/export/restore/:id", (req: Request, res: Response) => {
  try {
    const { packagePath } = req.body;
    if (!packagePath) {
      return res.status(400).json({
        success: false,
        error: "必须提供 packagePath",
      });
    }

    const result = service.restoreFromExportPackage(req.params.id, packagePath);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
        data: result.run,
      });
    }

    res.json({
      success: true,
      data: result.run,
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

router.get("/packages", (req: Request, res: Response) => {
  try {
    const resultsDir = path.join(__dirname, "..", "..", "test-results");
    if (!fs.existsSync(resultsDir)) {
      return res.json({ success: true, data: [] });
    }

    const packages = [];
    const entries = fs.readdirSync(resultsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith("acceptance_")) {
        const packagePath = path.join(resultsDir, entry.name);
        const manifestPath = path.join(packagePath, "manifest.json");
        const indexPath = path.join(packagePath, "export-index.json");

        if (fs.existsSync(manifestPath) && fs.existsSync(indexPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
            const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
            packages.push({
              runId: manifest.runId,
              runName: manifest.runName,
              packagePath,
              createdAt: manifest.createdAt,
              totalFiles: index.totalFiles,
              totalSize: index.totalSize,
            });
          } catch (e) {
            // skip invalid packages
          }
        }
      }
    }

    packages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      data: packages,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

export default router;
