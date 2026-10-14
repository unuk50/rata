import { decodeInvite, newId } from "@rata/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { go, useGroup } from "../lib/hooks";
import { storage } from "../lib/storage";
import { dropSync } from "../lib/sync";
import { Avatar, Header, Icon, Notice } from "../lib/ui";

export function Join({ code }: { code: string }) {
  const secret = useMemo(() => decodeInvite(code), [code]);
  const { state, status, sync } = useGroup(secret);
  const [name, setName] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const joined = useRef(false);

  useEffect(() => {
    if (!secret) return;
    let active = true;
    void storage.groups().then((all) => {
      const g = all.find((x) => x.gid === secret.gid);
      if (active && g?.me) {
        joined.current = true;
        go(`/g/${secret.gid}`);
      }
    });
    // Leaving without a pick: stop syncing a group that is not on this device.
    return () => {
      active = false;
      if (!joined.current) dropSync(secret.gid);
    };
  }, [secret]);

  // Suggest the saved name only if nobody in the group has it, so one tap cannot add a twin.
  const savedName = localStorage.getItem("rata.myName") ?? "";
  const taken = state.members.some(
    (m) => m.name.trim().toLowerCase() === savedName.trim().toLowerCase(),
  );
  const draft = name ?? (taken ? "" : savedName);

  if (!secret) {
    return (
      <div>
        <Header title="Invite" back="/" />
        <Notice icon="link" text="This invite link is not complete. Ask for a new one." />
      </div>
    );
  }

  const pick = async (mid: string) => {
    joined.current = true;
    await storage.upsertGroup({
      ...secret,
      me: mid,
      name: state.group?.name ?? "Group",
      addedAt: Date.now(),
    });
    go(`/g/${secret.gid}`);
  };

  const addMe = async () => {
    const n = draft.trim();
    if (!n || !sync) return;
    localStorage.setItem("rata.myName", n);
    const mid = newId();
    await sync.add([{ t: "member", id: newId(), ts: Date.now(), by: mid, mid, name: n }]);
    await pick(mid);
  };

  const problem =
    status === "invalid"
      ? "invalid"
      : !state.group && (status === "offline" || status === "empty")
        ? status
        : null;

  return (
    <div>
      <Header title={state.group ? `Join ${state.group.name}` : "Join group"} back="/" />
      {problem === "invalid" ? (
        <Notice icon="link" text="This link does not work. Ask for a new one." />
      ) : problem === "empty" ? (
        <Notice icon="link" text="Nothing here yet. Ask the sender to open Rata once." />
      ) : problem === "offline" ? (
        <Notice icon="wifiOff" text="You are offline. Open the link again when you are online." />
      ) : !state.group ? (
        <p className="text-muted">Opening…</p>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="meta mb-2">Tap your name</h2>
            <ul className="card divider">
              {state.members.map((m, i) => (
                <li key={m.mid}>
                  <button
                    type="button"
                    className="row min-h-16 hover:bg-raised"
                    onClick={() => pick(m.mid)}
                  >
                    <Avatar name={m.name} i={i} big />
                    <span className="min-w-0 flex-1 truncate text-lg font-bold">{m.name}</span>
                    <span className="text-muted">
                      <Icon name="arrow" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {adding ? (
            <div className="card space-y-2 p-4">
              <label className="label" htmlFor="newname">
                Your name
              </label>
              <div className="flex gap-2">
                <input
                  id="newname"
                  className="field min-w-0"
                  value={draft}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!draft.trim()}
                  onClick={addMe}
                >
                  Join
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-ghost w-full" onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} /> Not listed? Add yourself
            </button>
          )}
        </div>
      )}
    </div>
  );
}
