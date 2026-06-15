import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  AlertTriangle,
  Settings,
  User,
  Plane,
  CheckCircle2,
} from "lucide-react";
import { useStore } from "@/store/useStore";

export default function Sidebar() {
  const location = useLocation();
  const { currentUser } = useStore();

  const navItems = [
    { path: "/", label: "总览看板", icon: LayoutDashboard },
    { path: "/data", label: "数据管理", icon: Database },
    { path: "/anomaly", label: "异常复盘", icon: AlertTriangle },
    { path: "/cockpit", label: "验收驾驶舱", icon: Plane },
    { path: "/acceptance", label: "验收演练中心", icon: CheckCircle2 },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col min-h-screen">
      <div className="p-6 border-b border-slate-800">
        <h1 className="font-display text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          能耗异常看板
        </h1>
        <p className="text-slate-500 text-sm mt-1">Energy Anomaly Review</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 rounded-lg">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
            <User size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{currentUser}</p>
            <p className="text-xs text-slate-500">能源管理岗</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
