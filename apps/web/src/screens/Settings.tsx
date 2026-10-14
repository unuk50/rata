import { formatMoney, type GroupSecret, newId, owedShares, toMajor } from "@rata/core";
import { useEffect, useRef, useState } from "react";
import { go, useGroup } from "../lib/hooks";
import { type SavedGroup, storage } from "../lib/storage";
import { Avatar, Header, Icon } from "../lib/ui";

export function Settings({ saved }: { saved: SavedGroup & GroupSecret }) {
  const { state, sync } = useGroup(saved);
  const [newName, setNewName] = useState("");
  const [gname, setGname] = useState(state.group?.name ?? "");
  const [edited, setEdited] = useState(false);
  const pendingRename = useRef<Promise<void>>(Promise.resolve());
  const g = state.group;
  const loadedName = g?.name;
  // Follow renames from other devices until this person types in the field.
  useEffect(() => {
    if (loadedName && !edited) setGname(loadedName);
  }, [loadedName, edited]);

  const addMember = async () => {
    if (!newName.trim()) return;
    await sync?.add([
      {
        t: "member",
        id: newId(),
        ts: Date.now(),
        by: saved.me,
        mid: newId(),
        name: newName.trim(),
      },
    ]);
    setNewName("");
  };

  const rename = async () => {
    if (!g || !gname.trim()) return;
    await sync?.add([
      {
        t: "group",
        id: newId(),
        ts: Date.now(),
        by: saved.me,
        name: gname.trim(),
        currency: g.currency,
        kind: g.kind,
      },
    ]);
    await storage.upsertGroup({ ...saved, name: gname.trim() });
  };

  const exportCsv = () => {
    const name = (mid: string) => state.members.find((m) => m.mid === mid)?.name ?? mid;
    const cols = [
      "date",
      "description",
      "category",
      "currency",
      "amount",
      "paid_by",
      ...state.members.map((m) => `share_${m.name}`),
    ];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = state.expenses.map((e) => {
      const sh = owedShares(e);
      return [
        e.date,
        e.desc,
        e.category ?? "",
        e.currency,
        toMajor(e.amount, e.currency),
        Object.keys(e.paidBy).map(name).join(" + "),
        ...state.members.map((m) => toMajor(sh[m.mid] ?? 0, e.currency)),
      ];
    });
    for (const p of state.payments)
      rows.push([
        p.date,
        `Payment ${name(p.from)} to ${name(p.to)}`,
        "Payment",
        p.currency,
        toMajor(p.amount, p.currency),
        name(p.from),
        ...state.members.map(() => ""),
      ]);
    const csv = [cols, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${(g?.name ?? "rata").replace(/[^\w-]+/g, "_")}.csv`;
    a.click();
  };

  const leave = async () => {
    if (
      !confirm(
        "Remove this group from this device? The group stays for the other members. You can join again with the link.",
      )
    )
      return;
    await pendingRename.current;
    await storage.removeGroup(saved.gid);
    go("/");
  };

  const total: Record<string, number> = {};
  for (const e of state.expenses) total[e.currency] = (total[e.currency] ?? 0) + e.amount;

  return (
    <div className="pb-10">
      <Header title="Group settings" back={`/g/${saved.gid}`} />
      <div className="space-y-6">
        <section className="space-y-2">
          <label className="label" htmlFor="gname">
            Group name
          </label>
          <input
            id="gname"
            className="field text-lg font-bold"
            value={gname}
            onChange={(e) => {
              setGname(e.target.value);
              setEdited(true);
            }}
            onBlur={() => {
              if (edited && gname.trim() && gname.trim() !== g?.name) {
                pendingRename.current = rename();
              }
              setEdited(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <p className="caps">
            {g?.currency} ·{" "}
            {Object.entries(total)
              .map(([c, v]) => formatMoney(v, c))
              .join(" + ") || "Nothing spent"}
          </p>
        </section>
        <section>
          <h2 className="caps mb-2">People</h2>
          <ul className="card divider">
            {state.members.map((m, i) => (
              <li key={m.mid} className="row">
                <Avatar name={m.name} i={i} />
                <span className="min-w-0 flex-1 truncate font-bold">{m.name}</span>
                {m.mid === saved.me && <span className="caps">You</span>}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              className="field min-w-0"
              placeholder="Add a person"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="New person name"
            />
            <button
              type="button"
              className="btn-secondary"
              aria-label="Add person"
              disabled={!newName.trim()}
              onClick={addMember}
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
        </section>
        <section className="space-y-2">
          <button type="button" className="btn-secondary w-full" onClick={exportCsv}>
            Export CSV
          </button>
          <button type="button" className="btn-ghost w-full text-owes" onClick={leave}>
            Remove from this device
          </button>
        </section>
      </div>
    </div>
  );
}
