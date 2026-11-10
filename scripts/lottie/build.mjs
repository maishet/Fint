import { writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FPS } from "./lib.mjs";
import * as coinDrop from "./coin-drop.mjs";
import * as coinPull from "./coin-pull.mjs";
import * as coinStack from "./coin-stack.mjs";

const GENERATORS = { "coin-drop": coinDrop, "coin-stack": coinStack, "coin-pull": coinPull };

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "lottie");
mkdirSync(out, { recursive: true });

const filter = process.argv[2];
const manifest = { version: 1, fps: FPS, animations: {} };

for (const [id, gen] of Object.entries(GENERATORS)) {
  const file = `${id}.json`;
  manifest.animations[id] = { file, segments: gen.segments, slots: gen.slots };
  if (filter && !id.includes(filter)) continue;
  writeFileSync(join(out, file), JSON.stringify(gen.build()));
  console.log(`${file}  ${(statSync(join(out, file)).size / 1024).toFixed(1)} KB`);
}

writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
