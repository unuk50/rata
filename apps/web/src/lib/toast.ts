import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function set(t: Toast | null) {
  current = t;
  for (const fn of listeners) fn();
}

/** Show a short message at the bottom for 6 seconds, with an optional action such as Undo. */
export function toast(text: string, action?: Toast["action"]) {
  if (timer) clearTimeout(timer);
  set({ id: Date.now(), text, action });
  timer = setTimeout(() => set(null), 6000);
}

export function dismissToast() {
  if (timer) clearTimeout(timer);
  set(null);
}

export function useToast(): Toast | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
