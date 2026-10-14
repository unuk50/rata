import { Hono } from "hono";
import { GroupDO } from "./group";
import { parseEcb } from "./rates";

export { GroupDO };

export interface Env {
  GROUP: DurableObjectNamespace<GroupDO>;
  ASSETS: Fetcher;
}

const GID = /^[A-Za-z0-9_-]{22}$/;

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

/** Daily reference rates from the European Central Bank. */
app.get("/api/rates", async (c) => {
  try {
    const res = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", {
      cf: { cacheTtl: 6 * 3600, cacheEverything: true },
    });
    if (!res.ok) return c.json({ error: "rates unavailable" }, 502);
    c.header("Cache-Control", "public, max-age=3600");
    return c.json({ base: "EUR", ...parseEcb(await res.text()) });
  } catch {
    return c.json({ error: "rates unavailable" }, 502);
  }
});

/** All group traffic goes to the group's own Durable Object. */
app.all("/api/g/:gid/*", (c) => {
  const gid = c.req.param("gid");
  if (!GID.test(gid)) return c.json({ error: "bad group id" }, 400);
  const stub = c.env.GROUP.get(c.env.GROUP.idFromName(gid));
  return stub.fetch(c.req.raw);
});

app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

export default app;
