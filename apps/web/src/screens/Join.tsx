import { decodeInvite, newId } from "@rata/core";
import { useEffect, useMemo, useState } from "react";
import { go, useGroup } from "../lib/hooks";
import { storage } from "../lib/storage";
import { Avatar, Header, Icon } from "../lib/ui";

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
        <p className="text-muted">Opening…</p>
      ) : !state.group ? (
        <p>This group is empty or the link is wrong.</p>
      ) : (
        <div className="space-y-5">
          <div>
            <h2 className="caps mb-2">Tap your name</h2>
            <ul className="card divider">
              {state.members.map((m, i) => (
                <li key={m.mid}>
                  <button type="button" className="row hover:bg-raised" onClick={() => pick(m.mid)}>
                    <Avatar name={m.name} i={i} />
                    <span className="min-w-0 flex-1 truncate font-bold">{m.name}</span>
                    <span className="text-muted">
                      <Icon name="arrow" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="card space-y-2 p-4">
            <label className="label" htmlFor="newname">
              Not listed? Add yourself
            </label>
            <div className="flex gap-2">
              <input
                id="newname"
                className="field min-w-0"
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
