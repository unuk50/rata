import { encodeInvite, type GroupSecret } from "@rata/core";
import { useEffect, useState } from "react";
import { go, useGroup } from "../lib/hooks";
import type { SavedGroup } from "../lib/storage";
import { Header, Icon } from "../lib/ui";

/** Square QR code drawn as one SVG path. The library loads only on this screen. */
function Qr({ text }: { text: string }) {
  const [path, setPath] = useState<{ d: string; n: number } | null>(null);
  useEffect(() => {
    let live = true;
    void import("qrcode-generator").then(({ default: qrcode }) => {
      const qr = qrcode(0, "M");
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      let d = "";
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      if (live) setPath({ d, n });
    });
    return () => {
      live = false;
    };
  }, [text]);
  return (
    <div className="mx-auto aspect-square w-60 bg-white p-3">
      {path && (
        <svg
          viewBox={`0 0 ${path.n} ${path.n}`}
          className="h-full w-full"
          role="img"
          aria-label="Invite QR code"
        >
          <path d={path.d} fill="#0d0d0d" shapeRendering="crispEdges" />
        </svg>
      )}
    </div>
  );
}

export function Invite({ saved }: { saved: SavedGroup & GroupSecret }) {
  const { state } = useGroup(saved);
  const link = `${location.origin}/#/join/${encodeInvite(saved)}`;
  const [copied, setCopied] = useState(false);
  const name = state.group?.name ?? saved.name;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${name} on Rata`, url: link });
        return;
      } catch (err) {
        // The person closed the share sheet: do nothing. Other errors: copy instead.
        if ((err as Error).name === "AbortError") return;
      }
    }
    await copy();
  };

  return (
    <div className="pb-10">
      <Header title="Invite" back={`/g/${saved.gid}`} />
      <div className="space-y-6 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight">{name}</h2>
        <Qr text={link} />
        <p className="caps flex items-center justify-center gap-1.5">
          <Icon name="lock" size={14} /> Only people with this link can open it
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-primary flex-1" onClick={share}>
            Share link
          </button>
          <button
            type="button"
            className="btn-secondary w-12 px-0"
            onClick={copy}
            aria-label="Copy link"
          >
            <Icon name={copied ? "check" : "copy"} size={18} />
          </button>
        </div>
        <button type="button" className="btn-ghost w-full" onClick={() => go(`/g/${saved.gid}`)}>
          Done <Icon name="arrow" size={16} />
        </button>
        <input
          className="sr-only"
          readOnly
          value={link}
          aria-label="Invite link"
          data-invite-link
        />
      </div>
    </div>
  );
}
