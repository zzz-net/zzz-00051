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
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "@/components/Toast";
import Card from "@/components/Card";
import { StatusBadge } from "@/components/Badge";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";

const IMPORT_TYPES = [
  { key: "readings", label: "电表读数", icon: Database, fields: ["storeId", "date", "reading"] },
  { key: "hours", label: "营业时长", icon: Clock, fields: ["storeId", "date", "openHour", "closeHour"] },
  { key: "maintenance", label: "维修记录", icon: Settings, fields: ["storeId", "date", "type", "description"] },
];

const ATTRIBUTION_OPTIONS = ["读数异常", "设备故障", "维修干扰", "季节波动", "其他"];

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
          <p className="text-indigo-400/70 text-xs mt-1">
            下载样例CSV模板，查看正确的字段格式
          </p>
          <div className="flex gap-2 mt-3">
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
  const [fileInfo, setFileInfo] = useState<{ name: string; type: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [batchId, setBatchId] = useState(uuidv4());
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importData, loading } = useStore();

  const currentType = IMPORT_TYPES.find((t) => t.key === activeType)!;
  const Icon = currentType.icon;

  const parseFile = (file: File) => {
    setFileInfo({ name: file.name, type: file.type });
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
          return;
        }
        data = parsed.data;
      } else {
        try {
          data = JSON.parse(content);
        } catch {
          setPreviewErrors(["JSON 格式解析失败"]);
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
    if (previewErrors.length > 0) {
      toast("error", "请先修复数据错误", previewErrors.join("\n"));
      return;
    }
    if (!fileInfo) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        try {
          const fileType = fileInfo.name.endsWith(".csv") ? "csv" : "json";
          const result = await importData(activeType, content, fileType, batchId);
          toast("success",
            "导入成功",
            `共 ${result.recordCount} 条记录，生成 ${result.anomalyCount} 条异常`
          );
          setPreviewData([]);
          setFileInfo(null);
          setBatchId(uuidv4());
        } catch (err) {
          toast("error", "导入失败", (err as Error).message);
        }
      };
      reader.readAsText(fileInputRef.current?.files?.[0] || new Blob());
    }
  };

  return (
    <Card
      title="批次数据导入"
      subtitle="支持 CSV 和 JSON 格式，按批次管理导入历史"
      action={
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">批次ID:</span>
          <code className="font-mono text-xs bg-slate-800 px-2 py-1 rounded">
            {batchId.slice(0, 8)}...
          </code>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
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
              <p className="text-sm text-slate-500 mt-1">
                必填字段：{currentType.fields.join(", ")}
              </p>
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
                {previewErrors.length > 5 && (
                  <li>... 还有 {previewErrors.length - 5} 条错误</li>
                )}
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
            <p className="text-emerald-400 font-medium text-sm">
              数据预览（共 {previewData.length} 条）
            </p>
            <div className="flex-1 text-right">
              <button
                onClick={handleImport}
                disabled={loading}
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

function BatchHistory() {
  const { importBatches, fetchImportBatches } = useStore();

  return (
    <Card
      title="导入批次历史"
      subtitle="所有导入批次记录"
      action={
        <button
          onClick={fetchImportBatches}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          刷新
        </button>
      }
    >
      {importBatches.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {importBatches.map((batch) => (
            <div
              key={batch.id}
              className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet size={18} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {batch.type === "readings" ? "电表读数" : batch.type === "hours" ? "营业时长" : "维修记录"}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {batch.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-400">{batch.recordCount}条记录</span>
                <StatusBadge status={batch.status} />
                <span className="text-xs text-slate-500">
                  {new Date(batch.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500">
          暂无导入记录
        </div>
      )}
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
                  {errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                <ul className="text-amber-400 text-xs space-y-0.5">
                  {warnings.map((w, i) => <li key={i}>• {w}</li>)}
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
