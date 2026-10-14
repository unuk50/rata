import {
  accessToken,
  foldEvents,
  type GroupSecret,
  type GroupState,
  open,
  type RataEvent,
  seal,
} from "@rata/core";
import { type GroupCache, type Pending, storage } from "./storage";

export type SyncStatus = "loading" | "syncing" | "live" | "offline";

interface Snapshot {
  state: GroupState;
  status: SyncStatus;
  pending: number;
}

type Listener = (s: Snapshot) => void;

/**
 * Keeps one group in sync. Writes go to the device first, then to the server in the background.
 * The server only sees sealed events.
 */
export class GroupSync {
  private cache: GroupCache = { last: 0, events: {} };
  private queue: Pending[] = [];
  private listeners = new Set<Listener>();
  private ws: WebSocket | null = null;
  private token: Promise<string>;
  private status: SyncStatus = "loading";
  private state: GroupState = foldEvents([]);
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private flushing = false;
  readonly ready: Promise<void>;

  constructor(readonly secret: GroupSecret) {
    this.token = accessToken(secret);
    this.ready = this.load();
  }

  private async load() {
    this.cache = await storage.cache(this.secret.gid);
    this.queue = await storage.pending(this.secret.gid);
    this.refold();
    this.connect();
    window.addEventListener("online", this.onOnline);
  }

  private onOnline = () => {
    this.retry = 0;
    this.connect();
  };

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  snapshot(): Snapshot {
    return { state: this.state, status: this.status, pending: this.queue.length };
  }

  private emit() {
    const s = this.snapshot();
    for (const fn of this.listeners) fn(s);
  }

  private setStatus(s: SyncStatus) {
    if (this.status !== s) {
      this.status = s;
      this.emit();
    }
  }

  private refold() {
    this.state = foldEvents(Object.values(this.cache.events));
    this.emit();
  }

  /** Apply events on this device now, then send them. */
  async add(events: RataEvent[]) {
    await this.ready;
    for (const e of events) this.cache.events[e.id] = e;
    this.refold();
    const sealed = await Promise.all(
      events.map(async (e) => ({ id: e.id, sealed: await seal(this.secret, e) })),
    );
    this.queue.push(...sealed);
    await Promise.all([
      storage.saveCache(this.secret.gid, this.cache),
      storage.savePending(this.secret.gid, this.queue),
    ]);
    this.emit();
    void this.flush();
  }

  private async headers() {
    return { authorization: `Bearer ${await this.token}`, "content-type": "application/json" };
  }

  private base() {
    return `/api/g/${this.secret.gid}`;
  }

  private async flush() {
    if (this.flushing || this.queue.length === 0 || this.closed) return;
    this.flushing = true;
    try {
      while (this.queue.length) {
        const batch = this.queue.slice(0, 200);
        const res = await fetch(`${this.base()}/events`, {
          method: "POST",
          headers: await this.headers(),
          body: JSON.stringify({ events: batch }),
        });
        if (!res.ok) throw new Error(`send failed ${res.status}`);
        const sent = new Set(batch.map((b) => b.id));
        this.queue = this.queue.filter((q) => !sent.has(q.id));
        await storage.savePending(this.secret.gid, this.queue);
        this.emit();
      }
    } catch {
      this.scheduleReconnect();
    } finally {
      this.flushing = false;
    }
  }

  private async ingest(rows: { seq: number; id: string; sealed: string }[]) {
    let changed = false;
    for (const r of rows) {
      if (!this.cache.events[r.id]) {
        try {
          this.cache.events[r.id] = await open<RataEvent>(this.secret, r.sealed);
          changed = true;
        } catch {
          // Not readable with this key. Skip it.
        }
      }
      this.cache.last = Math.max(this.cache.last, r.seq);
    }
    await storage.saveCache(this.secret.gid, this.cache);
    if (changed) this.refold();
  }

  private async pull() {
    for (;;) {
      const res = await fetch(`${this.base()}/events?after=${this.cache.last}`, {
        headers: await this.headers(),
      });
      if (!res.ok) throw new Error(`pull failed ${res.status}`);
      const body = (await res.json()) as {
        events: { seq: number; id: string; sealed: string }[];
        more?: boolean;
      };
      await this.ingest(body.events);
      if (!body.more) break;
    }
  }

  private async connect() {
    if (this.closed || (this.ws && this.ws.readyState <= 1)) return;
    if (!navigator.onLine) return this.setStatus("offline");
    this.setStatus("syncing");
    try {
      await this.flush();
      await this.pull();
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(
        `${proto}://${location.host}${this.base()}/ws?token=${encodeURIComponent(await this.token)}`,
      );
      this.ws = ws;
      ws.onopen = () => {
        this.retry = 0;
        this.setStatus("live");
        void this.pull().then(() => this.flush());
      };
      ws.onmessage = (m) => {
        if (typeof m.data !== "string" || m.data === "pong") return;
        const msg = JSON.parse(m.data) as {
          type: string;
          events?: { seq: number; id: string; sealed: string }[];
        };
        if (msg.type === "events" && msg.events) void this.ingest(msg.events);
      };
      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
    this.setStatus(navigator.onLine ? "syncing" : "offline");
    if (this.timer) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.retry++);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.connect();
    }, delay);
  }

  close() {
    this.closed = true;
    window.removeEventListener("online", this.onOnline);
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
  }
}

const live = new Map<string, GroupSync>();

export function getSync(secret: GroupSecret): GroupSync {
  let s = live.get(secret.gid);
  if (!s) {
    s = new GroupSync(secret);
    live.set(secret.gid, s);
  }
  return s;
}
