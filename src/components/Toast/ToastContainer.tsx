import { useToastStore } from "./index";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  const typeStyles = {
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    error: "bg-red-500/10 border-red-500/30 text-red-400",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  };

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 w-96">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={`animate-slide-up border rounded-lg p-4 shadow-xl backdrop-blur-sm ${typeStyles[t.type]}`}
          >
            <div className="flex items-start gap-3">
              <Icon size={20} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t.message}</p>
                {t.description && <p className="text-sm opacity-80 mt-1">{t.description}</p>}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
