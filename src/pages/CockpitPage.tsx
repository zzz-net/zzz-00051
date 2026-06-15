import { useState, useEffect } from "react";
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Shield,
  FileWarning,
  Filter,
  ClipboardCheck,
  Download,
  GitCompareArrows,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Activity,
  ListChecks,
  FileText,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "@/components/Toast";
import Card from "@/components/Card";
import type { CockpitRun, CockpitStepResult, CockpitSummary } from "../../shared/types";

const STEP_ICONS: Record<string, React.ReactNode> = {
  isolation: <Shield size={16} />,
  import_readings: <FileText size={16} />,
  import_hours: <Clock size={16} />,
  import_maintenance: <Activity size={16} />,
  conflict_detect: <FileWarning size={16} />,
  anomaly_filter: <Filter size={16} />,
  anomaly_review: <ClipboardCheck size={16} />,
  snapshot_before_restart: <ListChecks size={16} />,
  snapshot_after_restart: <ListChecks size={16} />,
  filter_review_preserved: <Filter size={16} />,
  export_json: <Download size={16} />,
  export_csv: <Download size={16} />,
  export_comparison: <GitCompareArrows size={16} />,
  duplicate_stability: <RotateCcw size={16} />,
};

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "passed":
      return <CheckCircle2 size={18} className="text-emerald-400" />;
    case "failed":
      return <XCircle size={18} className="text-red-400" />;
    case "running":
      return <Loader2 size={18} className="text-indigo-400 animate-spin" />;
    default:
      return <Clock size={18} className="text-slate-600" />;
  }
}

function SummaryCard({ label, ok, icon }: { label: string; ok: boolean; icon: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
      ok ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"
    }`}>
      <div className={ok ? "text-emerald-400" : "text-red-400"}>
        {ok ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
      </div>
      <div className="flex items-center gap-2">
        <span className={ok ? "text-emerald-400" : "text-slate-400"}>{icon}</span>
        <span className={`text-sm font-medium ${ok ? "text-emerald-300" : "text-red-300"}`}>{label}</span>
      </div>
    </div>
  );
}

function StepTimeline({ steps }: { steps: CockpitStepResult[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      {steps.map((step, idx) => (
        <div key={step.step}>
          <div
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-colors ${
              step.status === "passed"
                ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                : step.status === "failed"
                ? "bg-red-500/5 hover:bg-red-500/10"
                : step.status === "running"
                ? "bg-indigo-500/10"
                : "bg-slate-800/30 hover:bg-slate-800/50"
            }`}
            onClick={() => setExpanded(expanded === step.step ? null : step.step)}
          >
            <span className="text-slate-600 text-xs font-mono w-5">{idx + 1}</span>
            <StepStatusIcon status={step.status} />
            <span className="text-slate-400">{STEP_ICONS[step.step] || <Activity size={16} />}</span>
            <span className={`text-sm flex-1 ${
              step.status === "passed" ? "text-emerald-300" :
              step.status === "failed" ? "text-red-300" :
              step.status === "running" ? "text-indigo-300" :
              "text-slate-400"
            }`}>{step.label}</span>
            {step.detail && <span className="text-xs text-slate-500 truncate max-w-[200px]">{step.detail}</span>}
            {expanded === step.step ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
          </div>
          {expanded === step.step && (step.detail || step.error) && (
            <div className="ml-12 mr-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 text-xs">
              {step.detail && <p className="text-slate-400 mb-1">Detail: {step.detail}</p>}
              {step.error && <p className="text-red-400">Error: {step.error}</p>}
              {step.startedAt && <p className="text-slate-600 mt-1">Start: {step.startedAt}</p>}
              {step.finishedAt && <p className="text-slate-600">End: {step.finishedAt}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CockpitDashboard({ summary }: { summary: CockpitSummary | null }) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["数据隔离", "冲突处理", "筛选复核保留", "导出一致"].map(label => (
          <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-slate-800/30 border-slate-700">
            <Clock size={20} className="text-slate-600" />
            <span className="text-sm text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <SummaryCard label="数据隔离" ok={summary.isolationVerified} icon={<Shield size={16} />} />
      <SummaryCard label="冲突处理" ok={summary.importConflictFree} icon={<FileWarning size={16} />} />
      <SummaryCard label="筛选复核保留" ok={summary.filterReviewPreserved} icon={<Filter size={16} />} />
      <SummaryCard label="导出一致" ok={summary.exportConsistent} icon={<GitCompareArrows size={16} />} />
    </div>
  );
}

function RunHistory({ runs, onSelect }: { runs: CockpitRun[]; onSelect: (id: string) => void }) {
  if (runs.length === 0) {
    return <p className="text-slate-500 text-sm py-4 text-center">暂无运行记录，点击上方按钮开始验收流水线</p>;
  }
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {runs.map(run => {
        const passed = run.steps.filter(s => s.status === "passed").length;
        const failed = run.steps.filter(s => s.status === "failed").length;
        const total = run.steps.length;
        return (
          <div
            key={run.id}
            onClick={() => onSelect(run.id)}
            className="flex items-center gap-4 px-4 py-3 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-slate-600 cursor-pointer transition-colors"
          >
            <div className={
              run.status === "completed" ? "text-emerald-400" :
              run.status === "failed" ? "text-red-400" :
              run.status === "running" ? "text-indigo-400" : "text-slate-500"
            }>
              {run.status === "completed" ? <CheckCircle2 size={20} /> :
               run.status === "failed" ? <XCircle size={20} /> :
               <Loader2 size={20} className="animate-spin" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-200 font-medium truncate">{run.prefix}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  run.status === "completed" ? "bg-emerald-500/15 text-emerald-400" :
                  run.status === "failed" ? "bg-red-500/15 text-red-400" :
                  "bg-indigo-500/15 text-indigo-400"
                }`}>
                  {run.status === "completed" ? "全部通过" : run.status === "failed" ? "存在失败" : "运行中"}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {new Date(run.createdAt).toLocaleString()} · {passed}/{total} 步骤通过{failed > 0 ? ` · ${failed} 失败` : ""}
              </div>
            </div>
            <div className="flex gap-1">
              {[run.isolationCleaned, run.importConflictHandled, run.filterPreserved && run.reviewPreserved, run.exportComplete && run.exportComparisonMatch].map((ok, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogPanel({ logs }: { logs: string[] }) {
  if (logs.length === 0) return null;
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 max-h-64 overflow-y-auto">
      <h4 className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
        <FileText size={12} /> 关键日志
      </h4>
      <div className="space-y-0.5 font-mono text-xs">
        {logs.map((log, i) => (
          <div key={i} className={`${
            log.includes("失败") || log.includes("异常") || log.includes("不一致") ? "text-red-400" :
            log.includes("通过") || log.includes("一致") || log.includes("完成") ? "text-emerald-400" :
            "text-slate-400"
          }`}>{log}</div>
        ))}
      </div>
    </div>
  );
}

export default function CockpitPage() {
  const {
    cockpitSummary,
    cockpitCurrentRun,
    cockpitRuns,
    cockpitRunning,
    fetchCockpitSummary,
    startCockpitRun,
    fetchCockpitRuns,
    fetchCockpitRunDetail,
  } = useStore();

  const [prefix, setPrefix] = useState("");

  useEffect(() => {
    fetchCockpitSummary();
    fetchCockpitRuns();
  }, [fetchCockpitSummary, fetchCockpitRuns]);

  const handleRun = async () => {
    try {
      const result = await startCockpitRun(prefix || undefined);
      const allPassed = result.steps.every(s => s.status === "passed");
      if (allPassed) {
        toast("success", "验收流水线完成", "全部步骤通过");
      } else {
        const failedSteps = result.steps.filter(s => s.status === "failed").map(s => s.label);
        toast("error", "验收流水线存在失败", failedSteps.join(", "));
      }
    } catch (e: any) {
      toast("error", "验收流水线启动失败", e.message);
    }
  };

  const handleSelectRun = async (runId: string) => {
    await fetchCockpitRunDetail(runId);
  };

  const currentRun = cockpitCurrentRun;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">验收驾驶舱</h1>
          <p className="text-slate-500 mt-1">导入 → 筛选 → 复核 → 重启保留 → 导出核对 · 完整链路可反复执行</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="自定义前缀（可选）"
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 w-52"
          />
          <button
            onClick={handleRun}
            disabled={cockpitRunning}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cockpitRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                运行中...
              </>
            ) : (
              <>
                <Play size={16} />
                执行验收流水线
              </>
            )}
          </button>
        </div>
      </div>

      <Card title="状态总览" subtitle="当前样例验收核心指标">
        <CockpitDashboard summary={cockpitSummary} />
        {cockpitSummary && (
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
            <span>累计运行: {cockpitSummary.totalRuns} 次</span>
            {cockpitSummary.lastRunAt && (
              <span>上次运行: {new Date(cockpitSummary.lastRunAt).toLocaleString()}</span>
            )}
            {cockpitSummary.lastRunStatus && (
              <span className={cockpitSummary.lastRunStatus === "completed" ? "text-emerald-400" : "text-red-400"}>
                上次结果: {cockpitSummary.lastRunStatus === "completed" ? "全部通过" : "存在失败"}
              </span>
            )}
          </div>
        )}
      </Card>

      {currentRun && (
        <Card
          title="当前运行详情"
          subtitle={`前缀: ${currentRun.prefix} · ${currentRun.steps.filter(s => s.status === "passed").length}/${currentRun.steps.length} 步骤通过`}
          action={
            <span className={`text-xs px-2.5 py-1 rounded-full ${
              currentRun.status === "completed" ? "bg-emerald-500/15 text-emerald-400" :
              currentRun.status === "failed" ? "bg-red-500/15 text-red-400" :
              "bg-indigo-500/15 text-indigo-400"
            }`}>
              {currentRun.status === "completed" ? "全部通过" :
               currentRun.status === "failed" ? "存在失败" :
               "运行中"}
            </span>
          }
        >
          <StepTimeline steps={currentRun.steps} />
          <LogPanel logs={currentRun.logs} />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              <Shield size={12} className={currentRun.isolationCleaned ? "text-emerald-400" : "text-red-400"} />
              <span className="text-slate-400">数据隔离</span>
              <span className={currentRun.isolationCleaned ? "text-emerald-400" : "text-red-400"}>
                {currentRun.isolationCleaned ? "已验证" : "未通过"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <FileWarning size={12} className={currentRun.importConflictHandled ? "text-emerald-400" : "text-red-400"} />
              <span className="text-slate-400">冲突处理</span>
              <span className={currentRun.importConflictHandled ? "text-emerald-400" : "text-red-400"}>
                {currentRun.importConflictHandled ? "已处理" : "未通过"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Filter size={12} className={currentRun.filterPreserved && currentRun.reviewPreserved ? "text-emerald-400" : "text-red-400"} />
              <span className="text-slate-400">筛选/复核保留</span>
              <span className={currentRun.filterPreserved && currentRun.reviewPreserved ? "text-emerald-400" : "text-red-400"}>
                {currentRun.filterPreserved && currentRun.reviewPreserved ? "已保留" : "未通过"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Download size={12} className={currentRun.exportComplete ? "text-emerald-400" : "text-red-400"} />
              <span className="text-slate-400">导出完整</span>
              <span className={currentRun.exportComplete ? "text-emerald-400" : "text-red-400"}>
                {currentRun.exportComplete ? "完整" : "未通过"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <GitCompareArrows size={12} className={currentRun.exportComparisonMatch ? "text-emerald-400" : "text-red-400"} />
              <span className="text-slate-400">导出比对</span>
              <span className={currentRun.exportComparisonMatch ? "text-emerald-400" : "text-red-400"}>
                {currentRun.exportComparisonMatch ? "一致" : "不一致"}
              </span>
            </div>
          </div>
        </Card>
      )}

      <Card title="运行历史" subtitle="验收流水线执行记录" action={
        <button
          onClick={() => fetchCockpitRuns()}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
        >
          <RotateCcw size={12} /> 刷新
        </button>
      }>
        <RunHistory runs={cockpitRuns} onSelect={handleSelectRun} />
      </Card>
    </div>
  );
}
