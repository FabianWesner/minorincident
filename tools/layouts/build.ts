import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const districts = [
  "D-RES",
  "D-MAIN",
  "D-SCHOOL",
  "D-SHOP",
  "D-CIVIC",
  "D-PARK",
  "D-ZOO",
  "D-EDGE",
];
const files = (path: string): string[] =>
  readdirSync(path, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(`${path}/${e.name}`)
      : e.name.endsWith(".py")
        ? [`${path}/${e.name}`]
        : [],
  );
/** Only authoring inputs and referenced asset bytes enter this key. TS gameplay never does. */
export function layoutSourceHash(id: string): string {
  if (!districts.includes(id)) throw new Error(`Unknown district: ${id}`);
  const hash = createHash("sha256");
  for (const path of [
    `layouts/${id}/layout.py`,
    "tools/blender/build_layout.py",
    ...files("tools/blender/sslib").sort(),
  ])
    hash.update(path).update(readFileSync(path));
  // Literal placement references in this district and the shared authoring library.
  const source =
    readFileSync(`layouts/${id}/layout.py`, "utf8") +
    readFileSync("tools/blender/sslib/layout.py", "utf8");
  const ids = [
    ...new Set(
      [...source.matchAll(/['"]((?:bld|prop|veh)\.[\w-]+)['"]/g)].map(
        (m) => m[1],
      ),
    ),
  ].sort();
  const manifest = Object.fromEntries(JSON.parse(readFileSync("src/assets/manifest.json", "utf8")).map((asset: { id: string }) => [asset.id, asset]));
  for (const asset of ids) {
    const path = `assets/${asset}/model.glb`;
    hash
      .update(asset)
      .update(JSON.stringify(manifest[asset]))
      .update(existsSync(path) ? readFileSync(path) : "placeholder");
  }
  return hash.digest("hex");
}
export function buildLayout(
  id: string,
  force = false,
): { rebuilt: boolean; sourceHash: string } {
  const sourceHash = layoutSourceHash(id),
    cache = `.cache/layouts/${id}.json`;
  const outputs = [
    "layout.json",
    "base.glb",
    "w1.glb",
    "w2.glb",
    "w3.glb",
    "w4.glb",
    "w5.glb",
  ].map((suffix) => `public/assets/layouts/${id}.${suffix}`);
  if (
    !force &&
    existsSync(cache) &&
    JSON.parse(readFileSync(cache, "utf8")).sourceHash === sourceHash &&
    outputs.every(existsSync)
  )
    return { rebuilt: false, sourceHash };
  const result = spawnSync(
    "python3",
    ["tools/blender/run.py", "tools/blender/build_layout.py", id],
    { encoding: "utf8", env: { ...process.env, PYTHONHASHSEED: "0" } },
  );
  if (result.status !== 0 || !outputs.every(existsSync))
    throw new Error(
      `${result.error ?? ""}\n${result.stdout}\n${result.stderr}`,
    );
  mkdirSync(".cache/layouts", { recursive: true });
  writeFileSync(cache, JSON.stringify({ sourceHash }) + "\n");
  return { rebuilt: true, sourceHash };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const id = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  for (const district of id && id !== "--changed" ? [id] : districts)
    console.log(
      district,
      buildLayout(district, process.argv.includes("--force")),
    );
}
