export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "待复核", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    confirmed: { label: "已确认", className: "bg-red-500/15 text-red-400 border-red-500/30" },
    false_positive: { label: "误报", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
    closed: { label: "已关闭", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    success: { label: "成功", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    partial: { label: "部分成功", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    failed: { label: "失败", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const cfg = config[status] || { label: status, className: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export function AttributionBadge({ attribution }: { attribution: string | null }) {
  if (!attribution) return null;
  const config: Record<string, { label: string; className: string }> = {
    "读数倒退": { label: "读数倒退", className: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
    "维修干扰": { label: "维修干扰", className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
    "设备故障": { label: "设备故障", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
    "季节波动": { label: "季节波动", className: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
    "其他": { label: "其他", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
    "读数异常": { label: "读数异常", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  };
  const cfg = config[attribution] || { label: attribution, className: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
