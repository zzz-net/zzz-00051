import { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileSpreadsheet,
  Settings,
  Database,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Download,
  Plus,
  Clock,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Filter,
  X,
  RotateCcw,
  FileJson,
  FileText,
  History,
  Link2,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "@/components/Toast";
import Card from "@/components/Card";
import { StatusBadge } from "@/components/Badge";
import Modal from "@/components/Modal";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import type { ImportBatch, ImportBatchType, ImportBatchStatus } from "../../shared/types";

const IMPORT_TYPES = [
  { key: "readings", label: "电表读数", icon: Database, fields: ["storeId", "date", "reading"] },
  { key: "hours", label: "营业时长", icon: Clock, fields: ["storeId", "date", "openHour", "closeHour"] },
  { key: "maintenance", label: "维修记录", icon: Settings, fields: ["storeId", "date", "type", "description"] },
];

const TYPE_LABEL: Record<ImportBatchType, string> = {
  readings: "电表读数",
  hours: "营业时长",
  maintenance: "维修记录",
};

const TYPE_OPTIONS: { value: ImportBatchType | ""; label: string }[] = [
  { value: "", label: "全部类型" },
  { value: "readings", label: "电表读数" },
  { value: "hours", label: "营业时长" },
  { value: "maintenance", label: "维修记录" },
];

const STATUS_OPTIONS: { value: ImportBatchStatus | ""; label: string }[] = [
  { value: "", label: "全部状态" },
  { value: "success", label: "成功" },
  { value: "partial", label: "部分成功" },
  { value: "failed", label: "失败" },
];

function SampleDataSection() {
  const handleDownloadSample = (type: string) => {
    let csv: string;
    let filename: string;
    const today = new Date("2026-06-15");
    const storeIds = ["S001", "S002", "S003"];

    if (type === "readings") {
      const rows: any[] = [];
      let readings: Record<string, number> = { S001: 1000, S002: 800, S003: 500 };
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        for (const s of storeIds) {
          readings[s] += s === "S002" && i === 5 ? 250 : 100 + Math.random() * 30;
          rows.push({ storeId: s, date: dateStr, reading: readings[s].toFixed(2) });
        }
      }
      csv = Papa.unparse(rows);
      filename = "meter_readings_sample.csv";
    } else if (type === "hours") {
      const rows: any[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        for (const s of storeIds) {
          rows.push({ storeId: s, date: dateStr, openHour: 8, closeHour: isWeekend ? 22 : 20 });
        }
      }
      csv = Papa.unparse(rows);
      filename = "business_hours_sample.csv";
    } else {
      const d1 = new Date(today);
      d1.setDate(d1.getDate() - 7);
      const d2 = new Date(today);
      d2.setDate(d2.getDate() - 6);
      csv = Papa.unparse([
        { storeId: "S003", date: d1.toISOString().slice(0, 10), type: "设备维修", description: "中央空调主机维修" },
        { storeId: "S003", date: d2.toISOString().slice(0, 10), type: "设备调试", description: "空调系统校准" },
      ]);
      filename = "maintenance_sample.csv";
    }
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
      <div className="flex items-start gap-3">
        <Info className="text-indigo-400 shrink-0 mt-0.5" size={18} />
        <div className="flex-1">
          <p className="text-indigo-300 text-sm font-medium">样例数据模板</p>
          <p className="text-indigo-400/70 text-xs mt-1">下载样例CSV模板，查看正确的字段格式</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {IMPORT_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => handleDownloadSample(t.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-500/20 text-indigo-300 rounded-md hover:bg-indigo-500/30 transition-colors"
              >
                <Download size={14} />
                {t.label}模板
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportSection() {
  const [activeType, setActiveType] = useState("readings");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [fileInfo, setFileInfo] = useState<{ name: string; type: string; content: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [batchId, setBatchId] = useState(uuidv4());
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importData, loading } = useStore();

  const currentType = IMPORT_TYPES.find((t) => t.key === activeType)!;
  const Icon = currentType.icon;

  const parseFile = (file: File) => {
    setFileInfo(null);
    setPreviewErrors([]);
    setPreviewWarnings([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const isCSV = file.name.endsWith(".csv");
      let data: any[];
      if (isCSV) {
        const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
        if (parsed.errors.length > 0) {
          setPreviewErrors(parsed.errors.map((e: any) => e.message));
          setFileInfo({ name: file.name, type: "csv", content });
          return;
        }
        data = parsed.data;
      } else {
        try {
          data = JSON.parse(content);
        } catch {
          setPreviewErrors(["JSON 格式解析失败"]);
          setFileInfo({ name: file.name, type: "json", content });
          return;
        }
      }

      const errors: string[] = [];
      const warnings: string[] = [];
      data.forEach((row, idx) => {
        const line = idx + 2;
        currentType.fields.forEach((field) => {
          if (row[field] === undefined || row[field] === null || row[field] === "") {
            errors.push(`第${line}行: 缺少字段 ${field}`);
          }
        });
      });

      setPreviewErrors(errors);
      setPreviewWarnings(warnings);
      setPreviewData(data.slice(0, 5));
      setFileInfo({ name: file.name, type: isCSV ? "csv" : "json", content });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleImport = async () => {
    if (!fileInfo) {
      toast("error", "请先选择文件", "请上传 CSV 或 JSON 文件后再导入");
      return;
    }
    if (previewErrors.length > 0) {
      toast("error", "请先修复数据错误", previewErrors.join("\n"));
      return;
    }
    try {
      const result = await importData(activeType, fileInfo.content, fileInfo.type, batchId, fileInfo.name);
      const details: string[] = [`共 ${result.recordCount || 0} 条记录`];
      if (result.successCount !== undefined) details.push(`成功 ${result.successCount} 条`);
      if (result.failureCount !== undefined) details.push(`失败 ${result.failureCount} 条`);
      if (result.anomalyCount) details.push(`生成 ${result.anomalyCount} 条异常`);
      if (result.conflicts && result.conflicts.length > 0) {
        toast("warning", "导入完成（存在冲突）", `${details.join("，")}\n${result.conflicts.slice(0, 3).join("\n")}`);
      } else {
        toast("success", "导入成功", details.join("，"));
      }
      setPreviewData([]);
      setFileInfo(null);
      setBatchId(uuidv4());
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("已存在") || msg.includes("重复")) {
        toast("error", "批次冲突", msg + "\n请更换批次ID或使用重试功能生成新批次");
      } else {
        toast("error", "导入失败", msg);
      }
    }
  };

  return (
    <Card
      title="批次数据导入"
      subtitle="支持 CSV 和 JSON 格式，按批次管理导入历史"
      action={
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">批次ID:</span>
          <code className="font-mono text-xs bg-slate-800 px-2 py-1 rounded">{batchId.slice(0, 8)}...</code>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {IMPORT_TYPES.map((type) => {
            const TypeIcon = type.icon;
            const isActive = activeType === type.key;
            return (
              <button
                key={type.key}
                onClick={() => {
                  setActiveType(type.key);
                  setPreviewData([]);
                  setFileInfo(null);
                  setPreviewErrors([]);
                  setPreviewWarnings([]);
                  setBatchId(uuidv4());
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white border-indigo-500"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600"
                }`}
              >
                <TypeIcon size={16} />
                {type.label}
              </button>
            );
          })}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-indigo-500 bg-indigo-500/10"
              : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload
            size={32}
            className={`mx-auto mb-3 ${isDragging ? "text-indigo-400" : "text-slate-500"}`}
          />
          {fileInfo ? (
            <div>
              <p className="text-slate-300 font-medium">{fileInfo.name}</p>
              <p className="text-sm text-slate-500 mt-1">点击重新选择文件</p>
            </div>
          ) : (
            <div>
              <p className="text-slate-300">拖拽文件到此处或点击上传</p>
              <p className="text-sm text-slate-500 mt-1">必填字段：{currentType.fields.join(", ")}</p>
            </div>
          )}
        </div>

        {previewErrors.length > 0 && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-red-400 font-medium text-sm">数据校验不通过</p>
                <ul className="text-red-400/80 text-xs mt-2 space-y-1">
                  {previewErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {previewErrors.length > 5 && <li>... 还有 {previewErrors.length - 5} 条错误</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        {previewWarnings.length > 0 && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-amber-400 font-medium text-sm">警告信息</p>
                <ul className="text-amber-400/80 text-xs mt-2 space-y-1">
                  {previewWarnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {previewData.length > 0 && previewErrors.length === 0 && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="text-emerald-400" size={18} />
              <p className="text-emerald-400 font-medium text-sm">数据预览（共 {previewData.length} 条）</p>
              <div className="flex-1 text-right">
                <button
                  onClick={handleImport}
                  disabled={loading || !fileInfo}
                  className="px-4 py-1.5 text-xs bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  确认导入
                </button>
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    {currentType.fields.map((f) => (
                      <th key={f} className="py-2 px-2 text-left font-mono">
                        {f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {previewData.map((row, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      {currentType.fields.map((f) => (
                        <td key={f} className="py-1.5 px-2 font-mono">
                          {row[f]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <SampleDataSection />
      </div>
    </Card>
  );
}

function RetryModal({
  open,
  onClose,
  batch,
}: {
  open: boolean;
  onClose: () => void;
  batch: ImportBatch | null;
}) {
  const { retryImport, loading } = useStore();
  const [content, setContent] = useState("");
  const [newBatchId, setNewBatchId] = useState(uuidv4());
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (open && batch) {
      setContent(batch.originalContent || "");
      setNewBatchId(uuidv4());
      setErrors([]);
    }
  }, [open, batch]);

  if (!batch) return null;

  const handleRetry = async () => {
    if (!content.trim()) {
      toast("error", "内容不能为空", "请修正内容后重试");
      return;
    }
    try {
      const result = await retryImport(batch.id, content, newBatchId);
      toast(
        "success",
        "重试导入成功",
        `新批次 ${newBatchId.slice(0, 8)}...\n成功 ${result.successCount || 0} 条，失败 ${result.failureCount || 0} 条`
      );
      onClose();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("已存在") || msg.includes("重复")) {
        setErrors([msg, "提示：重试导入会自动生成新批次ID，避免与父批次冲突。如遇数据重复，请修正内容。"]);
      } else {
        setErrors([msg]);
      }
      toast("error", "重试失败", msg);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`重试导入 - ${TYPE_LABEL[batch.type]}`} size="xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Link2 size={14} />
            <span>父批次：</span>
            <code className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded">{batch.id.slice(0, 12)}...</code>
            <StatusBadge status={batch.status} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">新批次ID:</span>
            <code className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded">{newBatchId.slice(0, 12)}...</code>
            <button
              onClick={() => setNewBatchId(uuidv4())}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              title="重新生成批次ID"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <ul className="text-red-400 text-xs space-y-1">
              {errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-400 mb-1.5">修正后的内容（{batch.fileType === "csv" ? "CSV" : "JSON"} 格式）</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-64 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
            spellCheck={false}
          />
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleRetry}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={16} />
            {loading ? "导入中..." : "确认重试（生成新批次）"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BatchHistory() {
  const {
    importBatches,
    fetchImportBatches,
    batchFilters,
    setBatchFilters,
    clearBatchFilters,
    recentBatchIds,
    fetchBatchDetail,
    exportBatch,
    loading,
  } = useStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [retryBatch, setRetryBatch] = useState<ImportBatch | null>(null);
  const [retryOpen, setRetryOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  const hasFilters = Object.keys(batchFilters).length > 0;

  const toggleExpand = async (batch: ImportBatch) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(batch.id)) {
      newSet.delete(batch.id);
    } else {
      newSet.add(batch.id);
      setDetailLoading(batch.id);
      await fetchBatchDetail(batch.id);
      setDetailLoading(null);
    }
    setExpandedIds(newSet);
  };

  const handleExport = (batchId: string, format: "csv" | "json") => {
    exportBatch(batchId, format);
    toast("success", "导出成功", `批次数据已导出为 ${format.toUpperCase()}`);
  };

  const handleRetry = (batch: ImportBatch) => {
    setRetryBatch(batch);
    setRetryOpen(true);
  };

  const parsedErrors = (errors: string | null): string[] => {
    if (!errors) return [];
    try {
      const parsed = JSON.parse(errors);
      return Array.isArray(parsed) ? parsed : [errors];
    } catch {
      return [errors];
    }
  };

  const renderBatchExpanded = (batchId: string) => {
    const detail = useStore.getState().selectedBatchDetail;
    if (detailLoading === batchId) {
      return (
        <div className="mt-3 p-3 text-xs text-slate-500 text-center">加载详情中...</div>
      );
    }
    if (!detail || detail.id !== batchId) {
      return null;
    }
    return (
      <div className="mt-3 pt-3 border-t border-slate-700 space-y-3 text-xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <span className="text-slate-500">文件类型:</span>
            <span className="ml-2 text-slate-300 font-mono">{detail.fileType || "-"}</span>
          </div>
          <div>
            <span className="text-slate-500">文件名:</span>
            <span className="ml-2 text-slate-300 font-mono">{detail.fileName || "-"}</span>
          </div>
          <div>
            <span className="text-slate-500">覆盖日期:</span>
            <span className="ml-2 text-slate-300 font-mono">
              {detail.coverageStartDate && detail.coverageEndDate
                ? `${detail.coverageStartDate} ~ ${detail.coverageEndDate}`
                : "-"}
            </span>
          </div>
          <div>
            <span className="text-slate-500">成功/失败:</span>
            <span className="ml-2">
              <span className="text-emerald-400">{detail.successCount}成功</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-red-400">{detail.failureCount}失败</span>
            </span>
          </div>
        </div>

        {detail.parentBatch && (
          <div className="flex items-center gap-2 text-xs">
            <Link2 size={12} className="text-indigo-400" />
            <span className="text-slate-500">父批次:</span>
            <code className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">
              {detail.parentBatch.id.slice(0, 12)}...
            </code>
            <StatusBadge status={detail.parentBatch.status} />
          </div>
        )}

        {detail.childBatches.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-xs mb-1">
              <History size={12} className="text-indigo-400" />
              <span className="text-slate-500">重试/子批次 ({detail.childBatches.length}):</span>
            </div>
            <div className="flex flex-wrap gap-2 ml-5">
              {detail.childBatches.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-1 rounded">
                  <code className="font-mono text-slate-300">{c.id.slice(0, 10)}...</code>
                  <StatusBadge status={c.status} />
                  <span className="text-slate-500">成{c.successCount}/败{c.failureCount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {parsedErrors(detail.errors).length > 0 && (
          <div>
            <p className="text-slate-500 mb-1">错误/警告:</p>
            <div className="max-h-32 overflow-y-auto bg-slate-800/50 rounded p-2 space-y-1">
              {parsedErrors(detail.errors).slice(0, 20).map((e, i) => (
                <div key={i} className="text-amber-400/90">• {e}</div>
              ))}
              {parsedErrors(detail.errors).length > 20 && (
                <div className="text-slate-500">...还有 {parsedErrors(detail.errors).length - 20} 条</div>
              )}
            </div>
          </div>
        )}

        {detail.records.length > 0 && (
          <div>
            <p className="text-slate-500 mb-1">明细记录 ({detail.records.length}):</p>
            <div className="max-h-48 overflow-auto bg-slate-800/50 rounded">
              <table className="w-full text-xs">
                <thead className="bg-slate-900 sticky top-0">
                  <tr className="text-slate-400">
                    <th className="py-1.5 px-2 text-left w-14">行号</th>
                    <th className="py-1.5 px-2 text-left w-14">状态</th>
                    <th className="py-1.5 px-2 text-left">内容</th>
                    <th className="py-1.5 px-2 text-left w-48">错误原因</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.records.slice(0, 50).map((r) => (
                    <tr key={r.id} className="border-t border-slate-900">
                      <td className="py-1 px-2 font-mono text-slate-400">{r.rowIndex + 2}</td>
                      <td className="py-1 px-2">
                        {r.success ? (
                          <CheckCircle2 size={12} className="text-emerald-400" />
                        ) : r.isDuplicate ? (
                          <AlertTriangle size={12} className="text-amber-400" />
                        ) : (
                          <AlertCircle size={12} className="text-red-400" />
                        )}
                      </td>
                      <td className="py-1 px-2 font-mono text-slate-300">
                        {typeof r.recordData === "object"
                          ? Object.entries(r.recordData)
                              .map(([k, v]) => `${k}:${v}`)
                              .join(" ")
                          : String(r.recordData)}
                      </td>
                      <td className="py-1 px-2 text-red-400/80">{r.errorMessage || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const recentBatches = recentBatchIds
    .map((id) => importBatches.find((b) => b.id === id))
    .filter((b): b is ImportBatch => !!b);

  return (
    <Card
      title="导入批次历史"
      subtitle="所有导入批次记录，支持展开查看明细"
      action={
        <button
          onClick={fetchImportBatches}
          className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          刷新
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <Filter size={14} className="text-slate-500" />
          <select
            value={batchFilters.type || ""}
            onChange={(e) => setBatchFilters({ type: (e.target.value as ImportBatchType) || undefined })}
            className="px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={batchFilters.status || ""}
            onChange={(e) => setBatchFilters({ status: (e.target.value as ImportBatchStatus) || undefined })}
            className="px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={batchFilters.startDate || ""}
            onChange={(e) => setBatchFilters({ startDate: e.target.value || undefined })}
            className="px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-indigo-500"
          />
          <span className="text-xs text-slate-500">至</span>
          <input
            type="date"
            value={batchFilters.endDate || ""}
            onChange={(e) => setBatchFilters({ endDate: e.target.value || undefined })}
            className="px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-indigo-500"
          />
          {hasFilters && (
            <button
              onClick={clearBatchFilters}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 rounded"
            >
              <X size={12} /> 清除筛选
            </button>
          )}
          <span className="ml-auto text-xs text-slate-500">共 {importBatches.length} 条</span>
        </div>

        {recentBatches.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
              <History size={14} />
              <span>最近查看</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentBatches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => toggleExpand(b)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded hover:bg-indigo-500/20 transition-colors"
                >
                  <code className="font-mono">{b.id.slice(0, 10)}...</code>
                  <StatusBadge status={b.status} />
                </button>
              ))}
            </div>
          </div>
        )}

        {importBatches.length > 0 ? (
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {importBatches.map((batch) => {
              const expanded = expandedIds.has(batch.id);
              const isRetryable = batch.status === "failed" || batch.status === "partial";
              return (
                <div
                  key={batch.id}
                  className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleExpand(batch)}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
                    >
                      {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={18} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-200">{TYPE_LABEL[batch.type]}</p>
                        {batch.parentBatchId && (
                          <Link2 size={12} className="text-indigo-400" />
                        )}
                        <code className="text-xs text-slate-500 font-mono truncate">{batch.id}</code>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-slate-500">
                        <span>共 {batch.recordCount} 条</span>
                        {(batch.successCount > 0 || batch.failureCount > 0) && (
                          <span>
                            <span className="text-emerald-400/80">成{batch.successCount}</span>
                            <span className="mx-0.5">/</span>
                            <span className="text-red-400/80">败{batch.failureCount}</span>
                          </span>
                        )}
                        {batch.coverageStartDate && (
                          <span className="font-mono">
                            {batch.coverageStartDate}~{batch.coverageEndDate}
                          </span>
                        )}
                        <span>{new Date(batch.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={batch.status} />
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleExport(batch.id, "csv")}
                          className="p-1.5 text-slate-400 hover:text-white bg-slate-700 rounded hover:bg-slate-600 transition-colors"
                          title="导出 CSV"
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          onClick={() => handleExport(batch.id, "json")}
                          className="p-1.5 text-slate-400 hover:text-white bg-slate-700 rounded hover:bg-slate-600 transition-colors"
                          title="导出 JSON"
                        >
                          <FileJson size={14} />
                        </button>
                        {isRetryable && (
                          <button
                            onClick={() => handleRetry(batch)}
                            className="p-1.5 text-amber-400 hover:text-amber-300 bg-amber-500/15 rounded hover:bg-amber-500/25 transition-colors"
                            title="修正后重试导入"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {expanded && renderBatchExpanded(batch.id)}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">暂无导入记录</div>
        )}
      </div>
      <RetryModal open={retryOpen} onClose={() => setRetryOpen(false)} batch={retryBatch} />
    </Card>
  );
}

function ThresholdConfigSection() {
  const { thresholds, stores, saveThreshold, fetchThresholds, fetchStores, loading } = useStore();
  const [globalConfig, setGlobalConfig] = useState({
    dailyLimit: 150,
    fluctuationRate: 30,
    hoursCorrectionFactor: 1.0,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    fetchThresholds();
    fetchStores();
  }, [fetchThresholds, fetchStores]);

  useEffect(() => {
    const global = thresholds.find((t) => t.storeId === null);
    if (global) {
      setGlobalConfig({
        dailyLimit: global.dailyLimit,
        fluctuationRate: global.fluctuationRate,
        hoursCorrectionFactor: global.hoursCorrectionFactor,
      });
    }
  }, [thresholds]);

  const validateGlobal = () => {
    const errs: string[] = [];
    const warns: string[] = [];
    if (globalConfig.dailyLimit <= 0) errs.push("日能耗上限必须大于0");
    if (globalConfig.fluctuationRate < 0) errs.push("波动阈值不能为负数");
    if (globalConfig.hoursCorrectionFactor <= 0) errs.push("修正系数必须大于0");
    if (globalConfig.fluctuationRate > 200) warns.push("波动阈值过高，可能漏报");
    setErrors(errs);
    setWarnings(warns);
    return errs.length === 0;
  };

  const handleSaveGlobal = async () => {
    if (!validateGlobal()) return;
    try {
      await saveThreshold(null, globalConfig);
      toast("success", "阈值配置已保存", "已重新计算所有门店异常");
    } catch (err) {
      toast("error", "保存失败", (err as Error).message);
    }
  };

  const storeConfigs = thresholds.filter((t) => t.storeId !== null);

  return (
    <Card
      title="阈值配置"
      subtitle="全局阈值与门店独立阈值配置"
      action={
        <button
          onClick={() => {
            fetchThresholds();
            fetchStores();
          }}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          刷新
        </button>
      }
    >
      <div className="space-y-6">
        <div className="p-5 bg-slate-800/50 rounded-xl border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-display font-semibold text-white">全局默认阈值</h4>
              <p className="text-sm text-slate-500">所有未单独配置的门店使用此阈值</p>
            </div>
            <button
              onClick={handleSaveGlobal}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              保存配置
            </button>
          </div>

          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                <ul className="text-red-400 text-xs space-y-0.5">
                  {errors.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                <ul className="text-amber-400 text-xs space-y-0.5">
                  {warnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">日能耗上限 (kWh)</label>
              <input
                type="number"
                value={globalConfig.dailyLimit}
                onChange={(e) => setGlobalConfig({ ...globalConfig, dailyLimit: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                step="1"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">波动阈值 (%)</label>
              <input
                type="number"
                value={globalConfig.fluctuationRate}
                onChange={(e) => setGlobalConfig({ ...globalConfig, fluctuationRate: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                step="1"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">营业时长修正系数</label>
              <input
                type="number"
                value={globalConfig.hoursCorrectionFactor}
                onChange={(e) => setGlobalConfig({ ...globalConfig, hoursCorrectionFactor: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                step="0.1"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-display font-semibold text-white">门店独立阈值</h4>
            <button className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300">
              <Plus size={16} />
              新增门店配置
            </button>
          </div>

          {storeConfigs.length > 0 ? (
            <div className="space-y-3">
              {storeConfigs.map((config) => {
                const store = stores.find((s) => s.id === config.storeId);
                return (
                  <div key={config.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium text-white">{store?.name || config.storeId}</p>
                      <button className="text-sm text-indigo-400 hover:text-indigo-300">编辑</button>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">日能耗上限</p>
                        <p className="font-mono text-sm text-slate-200">{config.dailyLimit} kWh</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">波动阈值</p>
                        <p className="font-mono text-sm text-slate-200">{config.fluctuationRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">修正系数</p>
                        <p className="font-mono text-sm text-slate-200">{config.hoursCorrectionFactor}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">暂无门店独立阈值配置</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function DataManagement() {
  useEffect(() => {
    useStore.getState().fetchImportBatches();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">数据管理</h1>
        <p className="text-slate-500 mt-1">批次数据导入与阈值配置管理</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ImportSection />
        <BatchHistory />
      </div>

      <ThresholdConfigSection />
    </div>
  );
}
