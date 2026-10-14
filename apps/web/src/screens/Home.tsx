import { decodeInvite } from "@rata/core";
import { useState } from "react";
import { go, useGroups } from "../lib/hooks";
import { Avatar } from "../lib/ui";

export function Home() {
  const [groups] = useGroups();
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");

  const join = () => {
    const s = decodeInvite(link);
    if (!s) return setErr("This is not a Rata invite link.");
    go(`/join/${s.gid}.${s.key}`);
  };

  return (
    <div className="space-y-8 pt-8">
      <div className="flex items-center gap-3">
        <img src="/icon.svg" alt="" className="h-10 w-10" />
        <div>
          <h1 className="title">rata</h1>
          <p className="caps">Share costs · No limits · No ads · Private</p>
        </div>
      </div>

      {groups && groups.length === 0 && (
        <div className="card space-y-3 p-5">
          <h2 className="text-xl leading-snug font-extrabold">
            Split costs with the people you trust.
          </h2>
          <p className="text-sm text-fg-2">
            Make a group for a trip, a home or a party. Share the link. Everyone adds what they
            paid, in any currency. Rata shows who owes whom.
          </p>
          <p className="text-sm text-fg-2">
            Your data is encrypted on this device. The key is in the invite link only, so our server
            cannot read amounts, names or notes.
          </p>
        </div>
      )}

      {groups && groups.length > 0 && (
        <section>
          <h2 className="caps mb-2">Your groups</h2>
          <ul className="card divider">
            {groups
              .slice()
              .sort((a, b) => b.addedAt - a.addedAt)
              .map((g) => (
                <li key={g.gid}>
                  <button
                    type="button"
                    className="row hover:bg-raised"
                    onClick={() => go(`/g/${g.gid}`)}
                  >
                    <Avatar name={g.name} />
                    <span className="flex-1 font-bold">{g.name}</span>
                    <span className="text-faint" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      <button type="button" className="btn-primary w-full" onClick={() => go("/new")}>
        New group
      </button>

      <div className="card space-y-2 p-4">
        <label className="label" htmlFor="invite">
          Have an invite link?
        </label>
        <div className="flex gap-2">
          <input
            id="invite"
            className="field"
            placeholder="Paste the link"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setErr("");
            }}
          />
          <button type="button" className="btn-secondary" onClick={join}>
            Join
          </button>
        </div>
        {err && <p className="text-sm text-owes">{err}</p>}
      </div>

      <p className="pb-8 text-center text-xs text-faint">
        Open source ·{" "}
        <a
          className="underline"
          href="https://github.com/unuk50/rata"
          target="_blank"
          rel="noreferrer"
          id="repo-link"
        >
          Code on GitHub
        </a>
      </p>
    </div>
  );
}
