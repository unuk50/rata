import { encodeInvite, type GroupSecret } from "@rata/core";
import { useState } from "react";
import { go, useGroup } from "../lib/hooks";
import type { SavedGroup } from "../lib/storage";
import { Header } from "../lib/ui";

export function Invite({ saved }: { saved: SavedGroup & GroupSecret }) {
  const { state } = useGroup(saved);
  const link = `${location.origin}/#/join/${encodeInvite(saved)}`;
  const [copied, setCopied] = useState(false);
  const name = state.group?.name ?? saved.name;

  const share = async () => {
    const data = {
      title: `Join ${name} on Rata`,
      text: `Join "${name}" on Rata to split costs:`,
      url: link,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        // The person closed the share sheet. Copy instead.
      }
    }
    await navigator.clipboard.writeText(link);
    setCopied(true);
  };

  return (
    <div>
      <Header title="Invite people" back={`/g/${saved.gid}`} />
      <div className="space-y-4">
        <p>
          Send this link to the people in <b>{name}</b>. Anyone with the link can see and add
          expenses.
        </p>
        <div className="card break-all p-3 font-mono text-xs text-fg-2">{link}</div>
        <div className="flex gap-2">
          <button type="button" className="btn-primary flex-1" onClick={share}>
            {copied ? "Copied" : "Share link"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }}
          >
            Copy
          </button>
        </div>
        <div className="border-l-2 border-accent bg-panel p-3 text-sm text-fg-2">
          The part after <code>#</code> is the group key. Browsers never send it to our server, so
          only people with the link can read this group.
        </div>
        <button type="button" className="btn-ghost w-full" onClick={() => go(`/g/${saved.gid}`)}>
          Go to the group
        </button>
      </div>
    </div>
  );
}
