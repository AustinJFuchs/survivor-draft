// Generate the home-screen / favicon PNGs from an inline SVG: a flame on a
// dark-jungle rounded square with "51". Run once; outputs are committed.
//
//   npx tsx scripts/make-icons.ts

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { ROOT } from "./lib/paths";

const out = join(ROOT, "public", "icons");
mkdirSync(out, { recursive: true });

function svg(maskable: boolean): string {
  // Maskable icons need content inside the central 80% "safe zone".
  const pad = maskable ? 0.18 : 0.08;
  const s = 512;
  const inner = s * (1 - 2 * pad);
  const x = s * pad;
  const flame = `M256 ${x + inner * 0.12}
    c${inner * 0.09} ${inner * 0.28} ${inner * 0.32} ${inner * 0.33} ${inner * 0.32} ${inner * 0.62}
    a${inner * 0.32} ${inner * 0.32} 0 0 1 -${inner * 0.64} 0
    c0 -${inner * 0.13} ${inner * 0.07} -${inner * 0.2} ${inner * 0.14} -${inner * 0.27}
    c0 ${inner * 0.12} ${inner * 0.06} ${inner * 0.18} ${inner * 0.13} ${inner * 0.18}
    c0 -${inner * 0.2} -${inner * 0.07} -${inner * 0.38} ${inner * 0.05} -${inner * 0.53}Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#173229"/><stop offset="1" stop-color="#07110f"/>
    </linearGradient>
    <linearGradient id="fl" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#e8621a"/><stop offset="0.55" stop-color="#ff8a2b"/><stop offset="1" stop-color="#ffb347"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${maskable ? 0 : 96}" fill="url(#bg)"/>
  <circle cx="${s * 0.5}" cy="${s * 0.42}" r="${inner * 0.42}" fill="#ff8a2b" opacity="0.12"/>
  <path d="${flame}" fill="url(#fl)"/>
  <text x="50%" y="${x + inner * 0.96}" text-anchor="middle" font-family="Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif" font-weight="700" font-size="${inner * 0.26}" fill="#f7ecd6" letter-spacing="2">51</text>
</svg>`;
}

async function main() {
  const normal = Buffer.from(svg(false));
  const mask = Buffer.from(svg(true));
  for (const size of [32, 180, 192, 512]) {
    await sharp(normal).resize(size, size).png().toFile(join(out, `icon-${size}.png`));
  }
  await sharp(mask).resize(512, 512).png().toFile(join(out, "icon-512-maskable.png"));
  console.log("icons written to", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
