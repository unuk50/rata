import { DurableObject } from "cloudflare:workers";

const MAX_EVENT_BYTES = 64 * 1024;
const MAX_BATCH = 500;
const PAGE = 1000;

type StoredEvent = {
  seq: number;
  id: string;
  sealed: string;
};

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return btoa(String.fromCharCode(...new Uint8Array(d)));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * One object per group. It stores sealed events in order and sends new events to open sockets.
 * It cannot read the events. A token hash proves that a caller holds the group key.
 */
export class GroupDO extends DurableObject<Record<string, never>> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Record<string, never>) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      sealed TEXT NOT NULL
    )`);
    this.sql.exec("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
  }

  private tokenHash(): string | null {
    const row = this.sql.exec<{ v: string }>("SELECT v FROM meta WHERE k = 'token'").toArray()[0];
    return row?.v ?? null;
  }

  /** The first writer sets the token hash. Later callers must match it. */
  private async authorize(token: string | null, create: boolean): Promise<boolean> {
    if (!token || token.length < 20) return false;
    const h = await sha256(token);
    const stored = this.tokenHash();
    if (stored) return stored === h;
    if (!create) return false;
    this.sql.exec("INSERT INTO meta (k, v) VALUES ('token', ?)", h);
    return true;
  }

  private lastSeq(): number {
    const row = this.sql
      .exec<{ s: number | null }>("SELECT MAX(seq) AS s FROM events")
      .toArray()[0];
    return row?.s ?? 0;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.split("/").slice(4).join("/");
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
    const token = bearer ?? url.searchParams.get("token");

    if (path === "ws") {
      if (req.headers.get("upgrade") !== "websocket")
        return json({ error: "expected websocket" }, 426);
      if (!(await this.authorize(token, false))) return json({ error: "unauthorized" }, 401);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (path === "events" && req.method === "GET") {
      if (!(await this.authorize(token, false))) {
        return this.tokenHash()
          ? json({ error: "unauthorized" }, 401)
          : json({ events: [], last: 0 });
      }
      const after = Math.max(0, Number(url.searchParams.get("after") ?? 0) || 0);
      const events = this.sql
        .exec<StoredEvent>(
          "SELECT seq, id, sealed FROM events WHERE seq > ? ORDER BY seq LIMIT ?",
          after,
          PAGE,
        )
        .toArray();
      return json({ events, last: this.lastSeq(), more: events.length === PAGE });
    }

    if (path === "events" && req.method === "POST") {
      if (!(await this.authorize(token, true))) return json({ error: "unauthorized" }, 401);
      let body: { events?: { id?: unknown; sealed?: unknown }[] };
      try {
        body = await req.json();
      } catch {
        return json({ error: "bad json" }, 400);
      }
      const list = Array.isArray(body.events) ? body.events : [];
      if (list.length === 0 || list.length > MAX_BATCH) return json({ error: "bad batch" }, 400);
      const added: StoredEvent[] = [];
      for (const e of list) {
        if (typeof e.id !== "string" || !/^[a-z0-9]{8,64}$/.test(e.id)) {
          return json({ error: "bad id" }, 400);
        }
        if (typeof e.sealed !== "string" || e.sealed.length > MAX_EVENT_BYTES) {
          return json({ error: "bad event" }, 400);
        }
        const row = this.sql
          .exec<{ seq: number }>(
            "INSERT INTO events (id, sealed) VALUES (?, ?) ON CONFLICT(id) DO NOTHING RETURNING seq",
            e.id,
            e.sealed,
          )
          .toArray()[0];
        if (row) added.push({ seq: row.seq, id: e.id, sealed: e.sealed });
      }
      if (added.length) {
        const msg = JSON.stringify({ type: "events", events: added });
        for (const ws of this.ctx.getWebSockets()) {
          try {
            ws.send(msg);
          } catch {
            // The socket closed. Hibernation cleans it up.
          }
        }
      }
      return json({ accepted: added.length, last: this.lastSeq() });
    }

    return json({ error: "not found" }, 404);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message === "ping") ws.send("pong");
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    ws.close(code === 1005 ? 1000 : code, "closed");
  }
}
