import { useState, useEffect, useMemo } from "react";
import {
  Filter,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  X,
  Calendar,
  Store,
  Clock,
  RefreshCw,
  FileJson,
  FileSpreadsheet,
  TrendingUp,
  Wrench,
  AlertTriangle,
  User,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "@/components/Toast";
import Card from "@/components/Card";
import Modal from "@/components/Modal";
import { StatusBadge, AttributionBadge } from "@/components/Badge";
import Papa from "papaparse";
import type { Anomaly, AnomalyStatus } from "../../shared/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Area,
  Legend,
} from "recharts";

const STATUS_FILTERS: { value: AnomalyStatus | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待复核" },
  { value: "confirmed", label: "已确认" },
  { value: "false_positive", label: "误报" },
  { value: "closed", label: "已关闭" },
];

const ATTRIBUTION_OPTIONS = ["读数倒退", "设备故障", "维修干扰", "季节波动", "其他"];

function AnomalyFilterBar() {
  const { anomalyFilters, setAnomalyFilters, stores, fetchAnomalies } = useStore();
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Filter size={18} />
            筛选
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setAnomalyFilters({ status: f.value === "all" ? undefined : f.value });
                  fetchAnomalies();
                }}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  (anomalyFilters.status || "all") === f.value
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <select
              value={anomalyFilters.storeId || ""}
              onChange={(e) => {
                setAnomalyFilters({ storeId: e.target.value || undefined });
                fetchAnomalies();
              }}
              className="pl-9 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 appearance-none focus:outline-none focus:border-indigo-500"
            >
              <option value="">全部门店</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              useStore.getState().recalculateAnomalies();
              toast("success", "已重新计算异常");
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm"
          >
            <RefreshCw size={16} />
            重新计算
          </button>
          <ExportButton />
        </div>
      </div>

      {showFilters && (
        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">开始日期</label>
            <input
              type="date"
              value={anomalyFilters.startDate || ""}
              onChange={(e) => setAnomalyFilters({ startDate: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">结束日期</label>
            <input
              type="date"
              value={anomalyFilters.endDate || ""}
              onChange={(e) => setAnomalyFilters({ endDate: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ExportButton() {
  const [showMenu, setShowMenu] = useState(false);
  const { anomalyFilters } = useStore();

  const handleExport = async (format: "csv" | "json") => {
    setShowMenu(false);
    try {
      const params = new URLSearchParams();
      params.append("format", format);
      if (anomalyFilters.status) params.append("status", anomalyFilters.status);
      if (anomalyFilters.storeId) params.append("storeId", anomalyFilters.storeId);
      if (anomalyFilters.startDate) params.append("startDate", anomalyFilters.startDate);
      if (anomalyFilters.endDate) params.append("endDate", anomalyFilters.endDate);

      const res = await fetch(`/api/anomalies/export?${params.toString()}`);
      if (!res.ok) throw new Error("导出失败");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `anomalies_${dateStr}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast("success", "导出成功", `已导出为 ${format.toUpperCase()} 格式`);
    } catch (err) {
      toast("error", "导出失败", (err as Error).message);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors text-sm"
      >
        <Download size={16} />
        导出数据
        <ChevronDown size={14} />
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-2 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
            <button
              onClick={() => handleExport("csv")}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <FileSpreadsheet size={16} className="text-emerald-400" />
              导出为 CSV
            </button>
            <button
              onClick={() => handleExport("json")}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors border-t border-slate-700"
            >
              <FileJson size={16} className="text-blue-400" />
              导出为 JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AnomalyTable() {
  const { anomalies, loading, fetchAnomalies, fetchStores, fetchReviewLogs, reviewLogs } = useStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    anomaly: (Anomaly & { storeName: string }) | null;
  }>({ open: false, anomaly: null });

  useEffect(() => {
    fetchAnomalies();
    fetchStores();
  }, [fetchAnomalies, fetchStores]);

  if (loading && anomalies.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-800 rounded w-1/3 mx-auto" />
          <div className="h-4 bg-slate-800 rounded w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Card
        title="异常记录列表"
        subtitle={`共 ${anomalies.length} 条异常记录`}
      >
        {anomalies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                  <th className="pb-3 pr-4 w-10"></th>
                  <th className="pb-3 pr-4">门店</th>
                  <th className="pb-3 pr-4">日期</th>
                  <th className="pb-3 pr-4 text-right">实际能耗</th>
                  <th className="pb-3 pr-4 text-right">预期能耗</th>
                  <th className="pb-3 pr-4 text-right">偏差率</th>
                  <th className="pb-3 pr-4">归因</th>
                  <th className="pb-3 pr-4">状态</th>
                  <th className="pb-3 pr-4">复核人</th>
                  <th className="pb-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((anomaly) => {
                  const isExpanded = expandedId === anomaly.id;
                  return (
                    <>
                      <tr
                        key={anomaly.id}
                        className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer ${
                          isExpanded ? "bg-slate-800/30" : ""
                        }`}
                        onClick={() => {
                          setExpandedId(isExpanded ? null : anomaly.id);
                          if (!isExpanded) fetchReviewLogs(anomaly.id);
                        }}
                      >
                        <td className="py-3 pr-4">
                          {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <Store size={16} className="text-slate-500" />
                            <span className="text-slate-200 font-medium">{anomaly.storeName}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <Calendar size={14} />
                            {anomaly.date}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right font-mono text-sm">
                          <span className="text-red-400">{anomaly.dailyConsumption.toFixed(1)}</span>
                          <span className="text-slate-600 text-xs"> kWh</span>
                        </td>
                        <td className="py-3 pr-4 text-right font-mono text-sm text-slate-400">
                          {anomaly.expectedConsumption.toFixed(1)}
                          <span className="text-slate-600 text-xs"> kWh</span>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className={`font-mono text-sm font-semibold ${
                            anomaly.deviationRate > 50 ? "text-red-400" : anomaly.deviationRate > 30 ? "text-amber-400" : "text-orange-400"
                          }`}>
                            {anomaly.deviationRate > 0 ? "+" : ""}{anomaly.deviationRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <AttributionBadge attribution={anomaly.attribution} />
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={anomaly.status} />
                        </td>
                        <td className="py-3 pr-4 text-sm text-slate-400">
                          {anomaly.reviewer || "-"}
                        </td>
                        <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {anomaly.status === "pending" && (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setReviewModal({ open: true, anomaly })}
                                className="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md hover:bg-emerald-500/30 transition-colors"
                              >
                                复核
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-800/20">
                          <td colSpan={10} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <h5 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
                                  <AlertTriangle size={16} className="text-amber-400" />
                                  异常详情
                                </h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between py-1 border-b border-slate-700/50">
                                    <span className="text-slate-500">异常ID</span>
                                    <span className="font-mono text-slate-300">{anomaly.id.slice(0, 16)}...</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-700/50">
                                    <span className="text-slate-500">日能耗</span>
                                    <span className="text-slate-300">{anomaly.dailyConsumption.toFixed(2)} kWh</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-700/50">
                                    <span className="text-slate-500">预期能耗</span>
                                    <span className="text-slate-300">{anomaly.expectedConsumption.toFixed(2)} kWh</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-700/50">
                                    <span className="text-slate-500">偏差率</span>
                                    <span className={anomaly.deviationRate > 0 ? "text-red-400" : "text-emerald-400"}>
                                      {anomaly.deviationRate > 0 ? "+" : ""}{anomaly.deviationRate.toFixed(2)}%
                                    </span>
                                  </div>
                                  {anomaly.note && (
                                    <div className="py-2">
                                      <span className="text-slate-500 block mb-1">备注</span>
                                      <p className="text-slate-300 bg-slate-800 p-3 rounded-lg">{anomaly.note}</p>
                                    </div>
                                  )}
                                  {anomaly.evidenceSource && (
                                    <div className="py-2">
                                      <span className="text-slate-500 block mb-1">证据来源</span>
                                      <p className="text-slate-300 bg-slate-800 p-3 rounded-lg font-mono text-sm">
                                        {anomaly.evidenceSource}
                                      </p>
                                    </div>
                                  )}
                                  {anomaly.reviewedAt && (
                                    <div className="flex justify-between py-1 border-b border-slate-700/50">
                                      <span className="text-slate-500">复核时间</span>
                                      <span className="text-slate-300">
                                        {new Date(anomaly.reviewedAt).toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h5 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
                                  <Clock size={16} className="text-indigo-400" />
                                  复核历史
                                </h5>
                                {reviewLogs.length > 0 ? (
                                  <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {reviewLogs.map((log) => (
                                      <div key={log.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <StatusBadge status={log.toStatus} />
                                          </div>
                                          <span className="text-xs text-slate-500">
                                            {new Date(log.createdAt).toLocaleString()}
                                          </span>
                                        </div>
                                        <p className="text-sm text-slate-300 mb-1">{log.note}</p>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                          <User size={12} />
                                          {log.reviewer}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                          证据：{log.evidenceSource}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-slate-500 text-sm">暂无复核历史</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <AlertTriangle size={40} className="mx-auto mb-3 opacity-50" />
            <p>暂无异常记录</p>
          </div>
        )}
      </Card>

      <ReviewModal
        open={reviewModal.open}
        onClose={() => setReviewModal({ open: false, anomaly: null })}
        anomaly={reviewModal.anomaly}
      />
    </>
  );
}

function ReviewModal({
  open,
  onClose,
  anomaly,
}: {
  open: boolean;
  onClose: () => void;
  anomaly: (Anomaly & { storeName: string }) | null;
}) {
  const { reviewAnomaly, currentUser } = useStore();
  const [status, setStatus] = useState<AnomalyStatus>("confirmed");
  const [attribution, setAttribution] = useState("");
  const [note, setNote] = useState("");
  const [evidenceSource, setEvidenceSource] = useState("");

  useEffect(() => {
    if (anomaly) {
      setAttribution(anomaly.attribution || "");
    }
  }, [anomaly]);

  const handleSubmit = async () => {
    if (!anomaly) return;
    if (!note.trim()) {
      toast("error", "请填写复核备注");
      return;
    }
    if (!evidenceSource.trim()) {
      toast("error", "请填写证据来源");
      return;
    }
    try {
      await reviewAnomaly(anomaly.id, {
        status,
        attribution: attribution || undefined,
        note,
        evidenceSource,
        reviewer: currentUser,
      });
      toast("success", "复核完成", `已标记为${status === "confirmed" ? "已确认" : "误报"}`);
      onClose();
      setNote("");
      setEvidenceSource("");
    } catch (err) {
      toast("error", "复核失败", (err as Error).message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="异常复核" size="md">
      {anomaly && (
        <div className="space-y-5">
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">{anomaly.storeName}</p>
                <p className="text-sm text-slate-500">{anomaly.date}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-bold text-red-400">
                  {anomaly.deviationRate > 0 ? "+" : ""}{anomaly.deviationRate.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500">偏差率</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">复核结果</label>
            <div className="flex gap-2">
              <button
                onClick={() => setStatus("confirmed")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all ${
                  status === "confirmed"
                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                <CheckCircle2 size={18} />
                确认异常
              </button>
              <button
                onClick={() => setStatus("false_positive")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all ${
                  status === "false_positive"
                    ? "bg-slate-500/20 border-slate-500/50 text-slate-300"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                <XCircle size={18} />
                标记误报
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">归因标签</label>
            <div className="flex flex-wrap gap-2">
              {ATTRIBUTION_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setAttribution(attribution === opt ? "" : opt)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-all ${
                    attribution === opt
                      ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">复核备注 *</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="请详细描述异常原因或误报理由..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 resize-none focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">证据来源 *</label>
            <input
              type="text"
              value={evidenceSource}
              onChange={(e) => setEvidenceSource(e.target.value)}
              placeholder="如：现场照片/img_001.jpg、报修单/WO-2026-001"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <User size={14} />
              复核人：{currentUser}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function TrendComparison() {
  const { stores, selectedTrend, fetchTrendData, loading } = useStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");

  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
      fetchTrendData(stores[0].id);
    }
  }, [stores, selectedStoreId, fetchTrendData]);

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    fetchTrendData(storeId);
  };

  const chartData = useMemo(() => {
    if (!selectedTrend) return [];
    return selectedTrend.dailyData.map((d) => ({
      ...d,
      businessHours: d.closeHour - d.openHour,
    }));
  }, [selectedTrend]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-sm font-medium text-white">{data.date}</p>
          <p className="text-xs text-slate-400 mt-1">
            实际能耗：<span className="text-indigo-400 font-mono">{data.consumption.toFixed(1)} kWh</span>
          </p>
          <p className="text-xs text-slate-400">
            预期能耗：<span className="text-slate-300 font-mono">{data.expected.toFixed(1)} kWh</span>
          </p>
          <p className="text-xs text-slate-400">
            营业时长：<span className="text-emerald-400 font-mono">{data.businessHours.toFixed(1)} 小时</span>
          </p>
          {data.isAnomaly && (
            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
              <AlertTriangle size={12} />
              异常点 [{data.anomalyStatus}]
            </p>
          )}
          {data.hasMaintenance && (
            <p className="text-xs text-purple-400 mt-1 flex items-center gap-1">
              <Wrench size={12} />
              维修：{data.maintenanceDesc}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card
      title="趋势对比"
      subtitle="门店能耗趋势与异常标注"
      action={
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">选择门店：</span>
          <select
            value={selectedStoreId}
            onChange={(e) => handleStoreChange(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      }
    >
      {selectedTrend && chartData.length > 0 ? (
        <div className="space-y-4">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="consumption"
                  name="实际能耗 (kWh)"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#colorConsumption)"
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (payload.isAnomaly) {
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={payload.anomalyStatus === "false_positive" ? "#64748b" : "#ef4444"}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="expected"
                  name="预期能耗 (kWh)"
                  stroke="#64748b"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Bar
                  yAxisId="right"
                  dataKey="businessHours"
                  name="营业时长 (小时)"
                  fill="#10b981"
                  opacity={0.3}
                  radius={[4, 4, 0, 0]}
                />
                {chartData.map(
                  (d, i) =>
                    d.hasMaintenance && (
                      <ReferenceLine
                        key={i}
                        x={d.date}
                        yAxisId="left"
                        stroke="#a855f7"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{
                          value: "维修",
                          position: "top",
                          fill: "#a855f7",
                          fontSize: 10,
                        }}
                      />
                    )
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-xs text-slate-400">实际能耗</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5 bg-slate-500" style={{ borderStyle: "dashed" }} />
              <span className="text-xs text-slate-400">预期能耗</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs text-slate-400">待复核/已确认异常</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-500" />
              <span className="text-xs text-slate-400">误报</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5 bg-purple-500" style={{ borderStyle: "dashed" }} />
              <span className="text-xs text-slate-400">维修记录</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500/30" />
              <span className="text-xs text-slate-400">营业时长</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-80 flex items-center justify-center text-slate-500">
          {loading ? "加载中..." : "请选择门店查看趋势"}
        </div>
      )}
    </Card>
  );
}

export default function AnomalyReview() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">异常复盘</h1>
          <p className="text-slate-500 mt-1">异常记录列表、复核流程与趋势对比</p>
        </div>
      </div>

      <AnomalyFilterBar />

      <div className="grid grid-cols-1 gap-6">
        <AnomalyTable />
        <TrendComparison />
      </div>
    </div>
  );
}
