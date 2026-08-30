// Downscale contestant portraits for the web. Originals (from Survivor Wiki,
// ~1536x2304) are read from `originals/` if present, else from the target dir
// itself, and written back as 480px-wide JPEGs (~40 KB). The cast photo is
// resized to 1600px wide.
//
//   npm run photos              # resize everything under public/photos/<season>/
//   npm run photos -- --force   # re-process even if already small

import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { ROOT, SEASON } from "./lib/paths";

const dir = join(ROOT, "public", "photos", SEASON);
const originals = join(dir, "originals");
const force = process.argv.includes("--force");

async function main() {
  if (!existsSync(dir)) throw new Error(`No photo dir: ${dir}`);
  mkdirSync(originals, { recursive: true });
  const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  for (const f of files) {
    const target = join(dir, f);
    const orig = join(originals, f);
    // Move full-size file into originals/ once, then always work from there.
    if (!existsSync(orig)) {
      const meta = await sharp(target).metadata();
      if ((meta.width ?? 0) > 800) renameSync(target, orig);
      else if (!force) continue; // already small and no original — leave as-is
      else continue;
    }
    if (!force && existsSync(target) && statSync(target).mtimeMs >= statSync(orig).mtimeMs) continue;
    const width = f === "cast.jpg" ? 1600 : 480;
    await sharp(orig).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(target.replace(/\.(png|webp)$/i, ".jpg"));
    console.log(`resized ${f} → ${width}px`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
