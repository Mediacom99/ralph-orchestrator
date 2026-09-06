import { useToast, removeToast } from "../hooks/useToast";
import { XIcon, CheckCircleIcon, AlertCircleIcon } from "./icons";

const iconMap = {
  success: CheckCircleIcon,
  error: AlertCircleIcon,
  info: AlertCircleIcon,
};

const colorMap = {
  success: "bg-emerald-900/80 border-emerald-700 text-emerald-200",
  error: "bg-red-900/80 border-red-700 text-red-200",
  info: "bg-blue-900/80 border-blue-700 text-blue-200",
};

export function ToastContainer() {
  const toasts = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 sm:w-80">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-3 rounded-lg border shadow-lg ${colorMap[toast.type]}`}
            style={{ animation: "toast-in 200ms ease-out" }}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-0.5 hover:opacity-70"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
