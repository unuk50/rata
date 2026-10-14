import { useEffect, useState } from "react";
import { useRoute } from "./lib/hooks";
import { type SavedGroup, storage } from "./lib/storage";
import { ExpenseForm } from "./screens/ExpenseForm";
import { Group } from "./screens/Group";
import { Home } from "./screens/Home";
import { Invite } from "./screens/Invite";
import { Join } from "./screens/Join";
import { NewGroup } from "./screens/NewGroup";
import { Settings } from "./screens/Settings";
import { Settle } from "./screens/Settle";

function WithGroup({
  gid,
  children,
}: {
  gid: string;
  children: (g: SavedGroup) => React.ReactNode;
}) {
  const [g, setG] = useState<SavedGroup | null | undefined>(undefined);
  useEffect(() => {
    void storage.groups().then((all) => setG(all.find((x) => x.gid === gid) ?? null));
  }, [gid]);
  if (g === undefined) return null;
  if (g === null) {
    return (
      <div className="pt-10 text-center">
        <p className="mb-4">This group is not on this device. Open its invite link to join.</p>
        <a className="btn-primary" href="#/">
          Home
        </a>
      </div>
    );
  }
  return <>{children(g)}</>;
}

export function App() {
  const r = useRoute();
  const [a, b, c, ...rest] = r;
  let view: React.ReactNode;
  if (!a) view = <Home />;
  else if (a === "new") view = <NewGroup />;
  else if (a === "join" && b) view = <Join code={b} />;
  else if (a === "g" && b) {
    view = (
      <WithGroup gid={b} key={b}>
        {(g) => {
          if (c === "add") return <ExpenseForm saved={g} />;
          if (c === "e" && rest[0]) return <ExpenseForm saved={g} eid={rest[0]} key={rest[0]} />;
          if (c === "settle") return <Settle saved={g} prefill={rest} />;
          if (c === "invite") return <Invite saved={g} />;
          if (c === "settings") return <Settings saved={g} />;
          return <Group saved={g} />;
        }}
      </WithGroup>
    );
  } else view = <Home />;
  return <main className="mx-auto max-w-xl px-4">{view}</main>;
}
