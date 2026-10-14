import { describe, expect, it } from "vitest";
import { accessToken, decodeInvite, encodeInvite, newGroupSecret, open, seal } from "../src";

describe("seal", () => {
  it("round-trips and fails with a wrong key", async () => {
    const s = newGroupSecret();
    const sealed = await seal(s, { hello: "world", n: 1 });
    expect(sealed).not.toContain("world");
    expect(await open(s, sealed)).toEqual({ hello: "world", n: 1 });
    await expect(open(newGroupSecret(), sealed)).rejects.toBeTruthy();
  });
  it("encodes invites and derives stable tokens", async () => {
    const s = newGroupSecret();
    expect(decodeInvite(`https://x/#/join/${encodeInvite(s)}`)).toEqual(s);
    expect(await accessToken(s)).toBe(await accessToken({ ...s }));
  });
});
