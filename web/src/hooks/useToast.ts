import { useSyncExternalStore } from "react";

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

let toasts: Toast[] = [];
let nextId = 1;
let listeners: (() => void)[] = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return toasts;
}

export function addToast(
  type: Toast["type"],
  message: string,
  duration = 4000,
) {
  const id = nextId++;
  toasts = [...toasts, { id, type, message }];
  emitChange();
  setTimeout(() => removeToast(id), duration);
}

export function removeToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emitChange();
}

export function useToast() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
