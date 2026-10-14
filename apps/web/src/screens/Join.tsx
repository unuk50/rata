import { decodeInvite, newId } from "@rata/core";
import { useEffect, useMemo, useState } from "react";
import { go, useGroup } from "../lib/hooks";
import { storage } from "../lib/storage";
import { Avatar, Header } from "../lib/ui";

export function Join({ code }: { code: string }) {
  const secret = useMemo(() => decodeInvite(code), [code]);
  const { state, status, sync } = useGroup(secret);
  const [name, setName] = useState(localStorage.getItem("rata.myName") ?? "");

  useEffect(() => {
    if (!secret) return;
    void storage.groups().then((all) => {
      const g = all.find((x) => x.gid === secret.gid);
      if (g?.me) go(`/g/${secret.gid}`);
    });
  }, [secret]);

  if (!secret) {
    return (
      <div>
        <Header title="Invite" back="/" />
        <p>This invite link is not complete. Ask for a new link.</p>
      </div>
    );
  }

  const pick = async (mid: string) => {
    await storage.upsertGroup({
      ...secret,
      me: mid,
      name: state.group?.name ?? "Group",
      addedAt: Date.now(),
    });
    go(`/g/${secret.gid}`);
  };

  const addMe = async () => {
    if (!name.trim() || !sync) return;
    localStorage.setItem("rata.myName", name.trim());
    const mid = newId();
    await sync.add([{ t: "member", id: newId(), ts: Date.now(), by: mid, mid, name: name.trim() }]);
    await pick(mid);
  };

  const loading = !state.group && status !== "live";

  return (
    <div>
      <Header title={state.group ? `Join ${state.group.name}` : "Join group"} back="/" />
      {loading ? (
        <p className="text-stone-500">Opening the group…</p>
      ) : !state.group ? (
        <p>This group is empty or the link is wrong.</p>
      ) : (
        <div className="space-y-5">
          <div>
            <h2 className="mb-2 font-medium">Who are you?</h2>
            <ul className="card divide-y divide-stone-200 dark:divide-stone-800">
              {state.members.map((m) => (
                <li key={m.mid}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50"
                    onClick={() => pick(m.mid)}
                  >
                    <Avatar name={m.name} /> {m.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="card space-y-2 p-4">
            <label className="label" htmlFor="newname">
              Not in the list? Add yourself
            </label>
            <div className="flex gap-2">
              <input
                id="newname"
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
              <button type="button" className="btn-primary" disabled={!name.trim()} onClick={addMe}>
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
