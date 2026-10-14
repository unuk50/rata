// Loads @rata/core (TypeScript source) into plain Node without a TS runner.
// It bundles packages/core/src/index.ts with the esbuild that Vite already installs.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "../..");

function loadEsbuild() {
  const fromWeb = createRequire(join(repoRoot, "apps/web/package.json"));
  try {
    return fromWeb("esbuild");
  } catch {
    const vite = fromWeb.resolve("vite");
    return createRequire(vite)("esbuild");
  }
}

export async function loadCore() {
  const esbuild = loadEsbuild();
  const outDir = join(tmpdir(), "rata-sample-data");
  mkdirSync(outDir, { recursive: true });
  const outfile = join(outDir, `core-${process.pid}.mjs`);
  await esbuild.build({
    entryPoints: [join(repoRoot, "packages/core/src/index.ts")],
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}
