import { decodeInvite } from "@rata/core";
import { useState } from "react";
import { go, useGroups } from "../lib/hooks";
import { Avatar, Icon } from "../lib/ui";

export function Home() {
  const [groups] = useGroups();
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");

  const join = () => {
    const s = decodeInvite(link);
    if (!s) return setErr("Not a Rata link.");
    go(`/join/${s.gid}.${s.key}`);
  };

  return (
    <div className="space-y-8 pt-8 pb-10">
      <div className="flex items-center gap-3">
        <img src="/icon.svg" alt="" className="h-11 w-11" />
        <h1 className="title flex-1">rata</h1>
        <span className="caps flex items-center gap-1.5" title="Encrypted on your device">
          <Icon name="lock" size={14} />
          Private
        </span>
      </div>

      {groups && groups.length === 0 && (
        <p className="text-[34px] leading-[1.05] font-extrabold tracking-tight">
          Split costs.
          <br />
          <span className="text-accent">Not friendships.</span>
        </p>
      )}

      {groups && groups.length > 0 && (
        <ul className="card divider">
          {groups
            .slice()
            .sort((a, b) => b.addedAt - a.addedAt)
            .map((g) => (
              <li key={g.gid}>
                <button
                  type="button"
                  className="row min-h-16 hover:bg-raised"
                  onClick={() => go(`/g/${g.gid}`)}
                >
                  <Avatar name={g.name} />
                  <span className="min-w-0 flex-1 truncate text-lg font-bold">{g.name}</span>
                  <span className="text-muted">
                    <Icon name="arrow" />
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}

      <button type="button" className="btn-primary w-full" onClick={() => go("/new")}>
        <Icon name="plus" size={18} /> New group
      </button>

      <div>
        <div className="flex gap-2">
          <input
            id="invite"
            className="field min-w-0"
            placeholder="Paste an invite link"
            aria-label="Invite link"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setErr("");
            }}
          />
          <button type="button" className="btn-secondary" disabled={!link.trim()} onClick={join}>
            Join
          </button>
        </div>
        {err && <p className="mt-1 text-sm text-owes">{err}</p>}
      </div>

      <p className="text-center text-xs text-faint">
        <a
          className="underline"
          href="https://github.com/unuk50/rata"
          target="_blank"
          rel="noreferrer"
          id="repo-link"
        >
          Open source
        </a>
      </p>
    </div>
  );
}
