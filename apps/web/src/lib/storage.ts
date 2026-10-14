import type { GroupSecret, RataEvent } from "@rata/core";
import { createStore, del, get, set } from "idb-keyval";

const db = createStore("rata", "kv");

export interface SavedGroup extends GroupSecret {
  /** This device's member id in the group. */
  me?: string;
  name: string;
  addedAt: number;
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
  groups: async () => (await get<SavedGroup[]>("groups", db)) ?? [],
  saveGroups: (g: SavedGroup[]) => set("groups", g, db),
  async upsertGroup(g: SavedGroup) {
    const all = await storage.groups();
    const i = all.findIndex((x) => x.gid === g.gid);
    if (i >= 0) all[i] = { ...all[i], ...g };
    else all.push(g);
    await storage.saveGroups(all);
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
