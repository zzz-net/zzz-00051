import { useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
} from "recharts";
import { useStore } from "@/store/useStore";
import Card from "@/components/Card";
import {
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { dashboardStats, fetchDashboardStats, fetchStores, loading } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStats();
    fetchStores();
  }, [fetchDashboardStats, fetchStores]);

  const stats = [
    {
      label: "总门店数",
      value: dashboardStats?.totalStores || 0,
      icon: Building2,
      color: "text-blue-400",
      bgColor: "bg-blue-500/15",
      delta: null,
    },
    {
      label: "异常门店数",
      value: dashboardStats?.anomalyStores || 0,
      icon: AlertTriangle,
      color: "text-amber-400",
      bgColor: "bg-amber-500/15",
      delta: null,
    },
    {
      label: "待复核",
      value: dashboardStats?.pendingCount || 0,
      icon: Clock,
      color: "text-purple-400",
      bgColor: "bg-purple-500/15",
      delta: null,
    },
    {
      label: "已确认",
      value: dashboardStats?.confirmedCount || 0,
      icon: CheckCircle2,
      color: "text-red-400",
      bgColor: "bg-red-500/15",
      delta: null,
    },
    {
      label: "误报",
      value: dashboardStats?.falsePositiveCount || 0,
      icon: XCircle,
      color: "text-slate-400",
      bgColor: "bg-slate-500/15",
      delta: null,
    },
  ];

  const trendData = dashboardStats?.recentTrend?.length
    ? dashboardStats.recentTrend
    : Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return { date: d.toISOString().slice(0, 10), count: 0 };
      });

  const distributionData = dashboardStats?.storeDistribution?.length
    ? dashboardStats.storeDistribution
    : [];

  const barColors = ["#ef4444", "#f59e0b", "#f97316", "#eab308", "#84cc16", "#22c55e"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">总览看板</h1>
          <p className="text-slate-500 mt-1">实时能耗异常概览与趋势</p>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <History size={16} />
          <span>数据更新于 {new Date().toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all duration-300 hover:shadow-lg hover:shadow-black/20 group"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-lg ${stat.bgColor} ${stat.color}`}>
                  <Icon size={20} />
                </div>
                {stat.delta && (
                  <div className="flex items-center gap-1 text-emerald-400 text-xs">
                    <ArrowUpRight size={14} />
                    {stat.delta}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <p className="font-display text-3xl font-bold text-white">
                  {loading ? "..." : stat.value}
                </p>
                <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="近期异常趋势"
          subtitle="近7天每日新增异常数量"
          action={
            <button
              onClick={() => navigate("/anomaly")}
              className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <TrendingUp size={16} />
              查看详情
            </button>
          }
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                  }}
                  labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="异常数量"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ fill: "#6366f1", r: 4 }}
                  activeDot={{ r: 6, fill: "#818cf8" }}
                  fill="url(#colorTrend)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          title="门店异常分布"
          subtitle="各门店累计异常数量"
          action={
            <button
              onClick={() => navigate("/anomaly")}
              className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <TrendingUp size={16} />
              查看详情
            </button>
          }
        >
            <div className="h-72">
              {distributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={distributionData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 110, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="storeName"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        color: "#e2e8f0",
                      }}
                    />
                    <Bar dataKey="anomalyCount" name="异常数量" radius={[0, 4, 4, 0]}>
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">
                暂无数据
              </div>
              )}
            </div>
        </Card>
      </div>
    </div>
  );
}
