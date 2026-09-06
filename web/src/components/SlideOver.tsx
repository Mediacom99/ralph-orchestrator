import { useEffect } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "./icons";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}

export function SlideOver({
  open,
  onClose,
  title,
  wide,
  children,
}: SlideOverProps) {
  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      style={{ animation: "fade-in 150ms ease-out" }}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`absolute inset-y-0 right-0 w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col`}
        style={{ animation: "slide-right 200ms ease-out" }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-white truncate pr-4">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 shrink-0"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
