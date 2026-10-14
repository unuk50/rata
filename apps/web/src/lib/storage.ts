import type { GroupSecret, RataEvent } from "@rata/core";
import { createStore, del, get, set } from "idb-keyval";

const db = createStore("rata", "kv");

export interface SavedGroup extends GroupSecret {
  /** This device's member id in the group. */
  me?: string;
  name: string;
  addedAt: number;
  /** Avatar colour slot on Home, picked once when the group comes to this device. */
  colour?: number;
}

/** Number of avatar colours (HUES in ui.tsx). */
export const COLOURS = 10;

/**
 * The first free colour. The palette order spreads the hues, so the first groups get colours far
 * apart and slate grey comes last.
 */
function pickColour(used: Set<number>): number {
  for (let i = 0; i < COLOURS; i++) if (!used.has(i)) return i;
  return used.size % COLOURS;
}

/** Give a colour to each group that has none, in the order they were added. Others keep theirs. */
function withColours(all: SavedGroup[]): { list: SavedGroup[]; changed: boolean } {
  const used = new Set(all.flatMap((g) => (g.colour === undefined ? [] : [g.colour])));
  let changed = false;
  const list = [...all]
    .sort((a, b) => a.addedAt - b.addedAt)
    .map((g) => {
      if (g.colour !== undefined) return g;
      const colour = pickColour(used);
      used.add(colour);
      changed = true;
      return { ...g, colour };
    });
  const order = new Map(all.map((g, i) => [g.gid, i]));
  list.sort((a, b) => (order.get(a.gid) ?? 0) - (order.get(b.gid) ?? 0));
  return { list, changed };
}

export interface GroupCache {
  last: number;
  events: Record<string, RataEvent>;
}

export interface Pending {
  id: string;
  sealed: string;
}

export const storage = {
  async groups(): Promise<SavedGroup[]> {
    const { list, changed } = withColours((await get<SavedGroup[]>("groups", db)) ?? []);
    if (changed) await set("groups", list, db);
    return list;
  },
  saveGroups: (g: SavedGroup[]) => set("groups", g, db),
  async upsertGroup(g: SavedGroup) {
    const all = await storage.groups();
    const i = all.findIndex((x) => x.gid === g.gid);
    if (i >= 0) all[i] = { ...all[i], ...g };
    else all.push(g);
    await storage.saveGroups(withColours(all).list);
  },
  async removeGroup(gid: string) {
    await storage.saveGroups((await storage.groups()).filter((g) => g.gid !== gid));
    await del(`ev:${gid}`, db);
    await del(`pending:${gid}`, db);
  },
  cache: async (gid: string) => (await get<GroupCache>(`ev:${gid}`, db)) ?? { last: 0, events: {} },
  saveCache: (gid: string, c: GroupCache) => set(`ev:${gid}`, c, db),
  pending: async (gid: string) => (await get<Pending[]>(`pending:${gid}`, db)) ?? [],
  savePending: (gid: string, p: Pending[]) => set(`pending:${gid}`, p, db),
};
