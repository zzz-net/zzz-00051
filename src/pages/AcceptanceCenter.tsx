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
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Activity,
  FileText,
  RefreshCw,
  Power,
  Package,
  Zap,
  Server,
  GitBranch,
  CheckSquare,
  ArrowRight,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "@/components/Toast";
import Card from "@/components/Card";
import type {
  AcceptanceRun,
  AcceptanceStepResult,
  AcceptanceSummary,
  AcceptancePhase,
} from "../../shared/types";

const PHASE_LABELS: Record<AcceptancePhase, string> = {
  preparation: "样例准备",
  self_check: "链路自检",
  drill_run: "演练执行",
  restart_verification: "重启验证",
  final_packaging: "结果打包",
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  type_check: <CheckSquare size={16} />,
  build_check: <Zap size={16} />,
  service_version_check: <Server size={16} />,
  data_isolation: <Shield size={16} />,
  batch_import: <FileText size={16} />,
  first_drill: <Activity size={16} />,
  snapshot_before_second: <GitBranch size={16} />,
  second_drill: <Activity size={16} />,
  consistency_check: <GitBranch size={16} />,
  restart_recovery_check: <Power size={16} />,
  package_generation: <Package size={16} />,
};

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "passed":
      return <CheckCircle2 size={18} className="text-emerald-400" />;
    case "failed":
      return <XCircle size={18} className="text-red-400" />;
    case "running":
      return <Loader2 size={18} className="text-indigo-400 animate-spin" />;
    case "skipped":
      return <Clock size={18} className="text-slate-500" />;
    default:
      return <Clock size={18} className="text-slate-600" />;
  }
}

function SummaryCard({
  label,
  ok,
  icon,
  subtitle,
}: {
  label: string;
  ok: boolean;
  icon: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 px-4 py-3 rounded-lg border ${
        ok
          ? "bg-emerald-500/10 border-emerald-500/30"
          : "bg-red-500/10 border-red-500/30"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={ok ? "text-emerald-400" : "text-red-400"}>
          {ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
        </div>
        <span className="text-slate-400">{icon}</span>
        <span
          className={`text-sm font-medium ${
            ok ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {label}
        </span>
      </div>
      {subtitle && (
        <p className="text-xs text-slate-500 ml-7">{subtitle}</p>
      )}
    </div>
  );
}

function PhaseSection({
  phase,
  steps,
  expanded,
  onToggle,
}: {
  phase: AcceptancePhase;
  steps: AcceptanceStepResult[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const phaseSteps = steps.filter((s) => s.phase === phase);
  if (phaseSteps.length === 0) return null;

  const passed = phaseSteps.filter((s) => s.status === "passed").length;
  const failed = phaseSteps.filter((s) => s.status === "failed").length;
  const running = phaseSteps.some((s) => s.status === "running");
  const allDone = phaseSteps.every(
    (s) => s.status === "passed" || s.status === "failed" || s.status === "skipped"
  );

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 cursor-pointer hover:bg-slate-800/70 transition-colors"
        onClick={onToggle}
      >
        {running ? (
          <Loader2 size={16} className="text-indigo-400 animate-spin" />
        ) : allDone && failed === 0 ? (
          <CheckCircle2 size={16} className="text-emerald-400" />
        ) : failed > 0 ? (
          <XCircle size={16} className="text-red-400" />
        ) : (
          <Clock size={16} className="text-slate-500" />
        )}
        <span className="text-sm font-medium text-slate-200 flex-1">
          {PHASE_LABELS[phase]}
        </span>
        <span className="text-xs text-slate-500">
          {passed}/{phaseSteps.length} 通过
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-slate-500" />
        ) : (
          <ChevronDown size={14} className="text-slate-500" />
        )}
      </div>
      {expanded && (
        <div className="p-2 space-y-1">
          {phaseSteps.map((step) => (
            <StepItem key={step.step} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}

function StepItem({ step }: { step: AcceptanceStepResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
          step.status === "passed"
            ? "hover:bg-emerald-500/5"
            : step.status === "failed"
            ? "hover:bg-red-500/5"
            : step.status === "running"
            ? "bg-indigo-500/10"
            : "hover:bg-slate-700/30"
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <StepStatusIcon status={step.status} />
        <span className="text-slate-500">{STEP_ICONS[step.step] || <Activity size={16} />}</span>
        <span
          className={`text-sm flex-1 ${
            step.status === "passed"
              ? "text-emerald-300"
              : step.status === "failed"
              ? "text-red-300"
              : step.status === "running"
              ? "text-indigo-300"
              : step.status === "skipped"
              ? "text-slate-500"
              : "text-slate-400"
          }`}
        >
          {step.label}
        </span>
        {step.detail && (
          <span className="text-xs text-slate-500 truncate max-w-[200px]">
            {step.detail}
          </span>
        )}
        {expanded ? (
          <ChevronUp size={14} className="text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />
        )}
      </div>
      {expanded && (step.detail || step.error || step.startedAt) && (
        <div className="ml-10 mr-3 p-3 bg-slate-800/50 rounded-md border border-slate-700/50 text-xs space-y-1">
          {step.detail && (
            <p className="text-slate-400">
              <span className="text-slate-500">详情: </span>
              {step.detail}
            </p>
          )}
          {step.error && (
            <p className="text-red-400">
              <span className="text-red-500/70">错误: </span>
              {step.error}
            </p>
          )}
          {step.startedAt && (
            <p className="text-slate-500">开始: {step.startedAt}</p>
          )}
          {step.finishedAt && (
            <p className="text-slate-500">结束: {step.finishedAt}</p>
          )}
        </div>
      )}
    </div>
  );
}

function RunHistory({
  runs,
  onSelect,
}: {
  runs: AcceptanceRun[];
  onSelect: (id: string) => void;
}) {
  if (runs.length === 0) {
    return (
      <p className="text-slate-500 text-sm py-4 text-center">
        暂无演练记录，点击上方按钮开始验收演练
      </p>
    );
  }
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {runs.map((run) => {
        const passed = run.steps.filter((s) => s.status === "passed").length;
        const failed = run.steps.filter((s) => s.status === "failed").length;
        const total = run.steps.filter((s) => s.status !== "skipped").length;
        return (
          <div
            key={run.id}
            onClick={() => onSelect(run.id)}
            className="flex items-center gap-4 px-4 py-3 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-slate-600 cursor-pointer transition-colors"
          >
            <div
              className={
                run.status === "completed"
                  ? "text-emerald-400"
                  : run.status === "failed"
                  ? "text-red-400"
                  : run.status === "running"
                  ? "text-indigo-400"
                  : "text-slate-500"
              }
            >
              {run.status === "completed" ? (
                <CheckCircle2 size={20} />
              ) : run.status === "failed" ? (
                <XCircle size={20} />
              ) : (
                <Loader2 size={20} className="animate-spin" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-200 font-medium truncate">
                  {run.name}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    run.status === "completed"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : run.status === "failed"
                      ? "bg-red-500/15 text-red-400"
                      : "bg-indigo-500/15 text-indigo-400"
                  }`}
                >
                  {run.status === "completed"
                    ? "全部通过"
                    : run.status === "failed"
                    ? "存在失败"
                    : run.status === "running"
                    ? "运行中"
                    : "待执行"}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {new Date(run.createdAt).toLocaleString()} · {passed}/
                {total} 步骤通过
                {failed > 0 ? ` · ${failed} 失败` : ""}
              </div>
            </div>
            <div className="flex gap-1">
              {[
                run.typeCheckPassed,
                run.buildCheckPassed,
                run.consistencyVerified,
                run.restartRecoveryVerified,
              ].map((ok, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    ok ? "bg-emerald-400" : "bg-slate-600"
                  }`}
                />
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
          <div
            key={i}
            className={`${
              log.includes("失败") || log.includes("异常") || log.includes("不一致")
                ? "text-red-400"
                : log.includes("通过") || log.includes("一致") || log.includes("完成")
                ? "text-emerald-400"
                : "text-slate-400"
            }`}
          >
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportFilesPanel({
  runId,
  files,
  onDownload,
}: {
  runId: string;
  files: { name: string; type: string; size: number; recordCount: number }[];
  onDownload: (filename: string) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-slate-500 flex items-center gap-1">
        <Package size={12} /> 验收包文件列表
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {files.map((file) => (
          <div
            key={file.name}
            className="flex items-center gap-3 px-3 py-2 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-slate-600 cursor-pointer transition-colors"
            onClick={() => onDownload(file.name)}
          >
            <div className="text-slate-400">
              <FileText size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300 truncate">{file.name}</p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB · {file.recordCount} 条记录
              </p>
            </div>
            <Download size={14} className="text-slate-500" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AcceptanceCenter() {
  const {
    acceptanceSummary,
    acceptanceCurrentRun,
    acceptanceRuns,
    acceptanceRunning,
    acceptanceFiles,
    fetchAcceptanceSummary,
    startAcceptanceDrill,
    resumeAcceptanceDrill,
    verifyRestartRecovery,
    fetchAcceptanceRuns,
    fetchAcceptanceRunDetail,
    fetchAcceptanceFiles,
    downloadAcceptanceFile,
  } = useStore();

  const [drillName, setDrillName] = useState("");
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({
    self_check: true,
    preparation: true,
    drill_run: true,
    restart_verification: true,
    final_packaging: true,
  });

  useEffect(() => {
    fetchAcceptanceSummary();
    fetchAcceptanceRuns();
  }, [fetchAcceptanceSummary, fetchAcceptanceRuns]);

  useEffect(() => {
    if (acceptanceCurrentRun && acceptanceCurrentRun.packageReady) {
      fetchAcceptanceFiles(acceptanceCurrentRun.id);
    }
  }, [acceptanceCurrentRun?.packageReady, acceptanceCurrentRun?.id, fetchAcceptanceFiles]);

  const handleStartDrill = async () => {
    try {
      const result = await startAcceptanceDrill(drillName || undefined);
      const allPassed = result.steps.every(
        (s) => s.status === "passed" || s.status === "skipped"
      );
      if (allPassed) {
        toast("success", "验收演练完成", "全部步骤通过");
      } else {
        const failedSteps = result.steps
          .filter((s) => s.status === "failed")
          .map((s) => s.label);
        toast("error", "验收演练存在失败", failedSteps.join(", "));
      }
    } catch (e: any) {
      toast("error", "验收演练启动失败", e.message);
    }
  };

  const handleResume = async () => {
    if (!acceptanceCurrentRun) return;
    try {
      const result = await resumeAcceptanceDrill(acceptanceCurrentRun.id);
      const allPassed = result.steps.every(
        (s) => s.status === "passed" || s.status === "skipped"
      );
      if (allPassed) {
        toast("success", "继续演练完成", "全部步骤通过");
      }
    } catch (e: any) {
      toast("error", "继续演练失败", e.message);
    }
  };

  const handleRestartVerify = async () => {
    if (!acceptanceCurrentRun) return;
    try {
      const result = await verifyRestartRecovery(acceptanceCurrentRun.id);
      if (result.restartRecoveryVerified) {
        toast("success", "重启回读验证通过", "状态成功恢复");
      } else {
        toast("error", "重启回读验证失败", "状态未能正确恢复");
      }
    } catch (e: any) {
      toast("error", "重启验证失败", e.message);
    }
  };

  const handleSelectRun = async (runId: string) => {
    await fetchAcceptanceRunDetail(runId);
    await fetchAcceptanceFiles(runId);
  };

  const handleDownloadFile = (filename: string) => {
    if (acceptanceCurrentRun) {
      downloadAcceptanceFile(acceptanceCurrentRun.id, filename);
    }
  };

  const togglePhase = (phase: string) => {
    setExpandedPhases((prev) => ({ ...prev, [phase]: !prev[phase] }));
  };

  const currentRun = acceptanceCurrentRun;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">验收演练中心</h1>
          <p className="text-slate-500 mt-1">
            样例准备 → 链路自检 → 演练执行 → 重启验证 → 结果打包 · 一站式独立跑通
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={drillName}
            onChange={(e) => setDrillName(e.target.value)}
            placeholder="演练名称（可选）"
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 w-52"
          />
          <button
            onClick={handleStartDrill}
            disabled={acceptanceRunning}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {acceptanceRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                演练中...
              </>
            ) : (
              <>
                <Play size={16} />
                开始验收演练
              </>
            )}
          </button>
        </div>
      </div>

      <Card title="验收总览" subtitle="四项核心验收指标">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="类型检查"
            ok={acceptanceSummary?.typeCheckVerified || false}
            icon={<CheckSquare size={16} />}
            subtitle="TypeScript 类型安全"
          />
          <SummaryCard
            label="构建检查"
            ok={acceptanceSummary?.buildCheckVerified || false}
            icon={<Zap size={16} />}
            subtitle="Vite 生产构建"
          />
          <SummaryCard
            label="两次演练一致"
            ok={acceptanceSummary?.consistencyVerified || false}
            icon={<GitBranch size={16} />}
            subtitle="连续两次结果一致"
          />
          <SummaryCard
            label="重启回读验证"
            ok={acceptanceSummary?.restartRecoveryVerified || false}
            icon={<Power size={16} />}
            subtitle="服务重启后状态恢复"
          />
        </div>
        {acceptanceSummary && (
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
            <span>累计演练: {acceptanceSummary.totalRuns} 次</span>
            <span>通过: {acceptanceSummary.totalPassed} 次</span>
            <span>失败: {acceptanceSummary.totalFailed} 次</span>
            {acceptanceSummary.lastRunAt && (
              <span>
                上次演练: {new Date(acceptanceSummary.lastRunAt).toLocaleString()}
              </span>
            )}
          </div>
        )}
      </Card>

      {currentRun && (
        <Card
          title="当前演练详情"
          subtitle={`${currentRun.name} · ${
            currentRun.steps.filter((s) => s.status === "passed").length
          }/${currentRun.steps.filter((s) => s.status !== "skipped").length} 步骤通过`}
          action={
            <div className="flex items-center gap-2">
              {currentRun.status !== "completed" &&
                currentRun.status !== "running" && (
                  <button
                    onClick={handleResume}
                    disabled={acceptanceRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    <Play size={12} /> 继续执行
                  </button>
                )}
              <button
                onClick={handleRestartVerify}
                disabled={acceptanceRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} /> 重启验证
              </button>
              <span
                className={`text-xs px-2.5 py-1 rounded-full ${
                  currentRun.status === "completed"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : currentRun.status === "failed"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-indigo-500/15 text-indigo-400"
                }`}
              >
                {currentRun.status === "completed"
                  ? "全部通过"
                  : currentRun.status === "failed"
                  ? "存在失败"
                  : currentRun.status === "running"
                  ? "运行中"
                  : "待执行"}
              </span>
            </div>
          }
        >
          <div className="space-y-3">
            {(
              ["self_check", "preparation", "drill_run", "restart_verification", "final_packaging"] as AcceptancePhase[]
            ).map((phase) => (
              <PhaseSection
                key={phase}
                phase={phase}
                steps={currentRun.steps}
                expanded={expandedPhases[phase] || false}
                onToggle={() => togglePhase(phase)}
              />
            ))}
          </div>

          <LogPanel logs={currentRun.logs} />

          {currentRun.packageReady && acceptanceFiles.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <ExportFilesPanel
                runId={currentRun.id}
                files={acceptanceFiles}
                onDownload={handleDownloadFile}
              />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              <CheckSquare
                size={12}
                className={currentRun.typeCheckPassed ? "text-emerald-400" : "text-red-400"}
              />
              <span className="text-slate-400">类型检查</span>
              <span
                className={currentRun.typeCheckPassed ? "text-emerald-400" : "text-red-400"}
              >
                {currentRun.typeCheckPassed ? "已通过" : "未通过"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Zap
                size={12}
                className={currentRun.buildCheckPassed ? "text-emerald-400" : "text-red-400"}
              />
              <span className="text-slate-400">构建检查</span>
              <span
                className={currentRun.buildCheckPassed ? "text-emerald-400" : "text-red-400"}
              >
                {currentRun.buildCheckPassed ? "已通过" : "未通过"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <GitBranch
                size={12}
                className={currentRun.consistencyVerified ? "text-emerald-400" : "text-red-400"}
              />
              <span className="text-slate-400">演练一致</span>
              <span
                className={currentRun.consistencyVerified ? "text-emerald-400" : "text-red-400"}
              >
                {currentRun.consistencyVerified ? "已验证" : "未验证"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Power
                size={12}
                className={currentRun.restartRecoveryVerified ? "text-emerald-400" : "text-slate-500"}
              />
              <span className="text-slate-400">重启回读</span>
              <span
                className={
                  currentRun.restartRecoveryVerified ? "text-emerald-400" : "text-slate-500"
                }
              >
                {currentRun.restartRecoveryVerified ? "已验证" : "待验证"}
              </span>
            </div>
          </div>
        </Card>
      )}

      <Card
        title="演练历史"
        subtitle="验收演练执行记录"
        action={
          <button
            onClick={() => {
              fetchAcceptanceRuns();
              fetchAcceptanceSummary();
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            <RotateCcw size={12} /> 刷新
          </button>
        }
      >
        <RunHistory runs={acceptanceRuns} onSelect={handleSelectRun} />
      </Card>
    </div>
  );
}
