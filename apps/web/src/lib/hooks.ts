import { foldEvents, type GroupSecret, type Rates } from "@rata/core";
import { useEffect, useState, useSyncExternalStore } from "react";
import { type SavedGroup, storage } from "./storage";
import { type GroupSync, getSync, type SyncStatus } from "./sync";

export function useRoute(): string[] {
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => location.hash,
  );
  return hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}

export function go(path: string) {
  location.hash = path.startsWith("/") ? path : `/${path}`;
}

export function useGroups(): [SavedGroup[] | null, () => void] {
  const [groups, setGroups] = useState<SavedGroup[] | null>(null);
  const [n, setN] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: n is a reload counter
  useEffect(() => {
    void storage.groups().then(setGroups);
  }, [n]);
  return [groups, () => setN((x) => x + 1)];
}

export function useGroup(secret: GroupSecret | null) {
  const [snap, setSnap] = useState({
    state: foldEvents([]),
    status: "loading" as SyncStatus,
    pending: 0,
  });
  const [sync, setSync] = useState<GroupSync | null>(null);
  useEffect(() => {
    if (!secret) return;
    const s = getSync(secret);
    setSync(s);
    return s.subscribe(setSnap);
  }, [secret]);
  return { ...snap, sync };
}

let ratesPromise: Promise<{ date: string | null; rates: Rates } | null> | null = null;

export function useRates() {
  const [r, setR] = useState<{ date: string | null; rates: Rates } | null>(null);
  useEffect(() => {
    ratesPromise ??= (async () => {
      try {
        const res = await fetch("/api/rates");
        if (res.ok) {
          const v = (await res.json()) as { date: string | null; rates: Rates };
          localStorage.setItem("rata.rates", JSON.stringify(v));
          return v;
        }
      } catch {
        // Offline. Use the last saved rates.
      }
      try {
        return JSON.parse(localStorage.getItem("rata.rates") ?? "null");
      } catch {
        return null;
      }
    })();
    void ratesPromise.then(setR);
  }, []);
  return r;
}
