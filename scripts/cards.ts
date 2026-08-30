// Render shareable PNG cards (1080×1350) at build time with satori + resvg.
//   cards/standings.png     current leaderboard (also the og:image)
//   cards/draft.png         the draft board (pre-season)
//   cards/ep-N.png          one per aired episode with an elimination
//
//   npm run cards            (runs inside `npm run build`)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { SeasonData, ContestantView } from "../src/lib/types";
import { buildSeasonData, loadInputs } from "./build-data";
import { ROOT, SEASON } from "./lib/paths";

const W = 1080;
const H = 1350;
const OUT = join(ROOT, "public", "cards");
const FONTS = join(ROOT, "scripts", "fonts");
const PHOTOS = join(ROOT, "public");
const SITE = process.env.VITE_SITE_URL && process.env.VITE_SITE_URL !== "/" ? process.env.VITE_SITE_URL.replace(/\/$/, "") : "";

const C = {
  bg: "#0b1a17",
  bg2: "#07110f",
  card: "#10241f",
  line: "rgba(217,191,138,0.16)",
  sand: "#f7ecd6",
  sand3: "#d9bf8a",
  sand4: "#b99a5f",
  torch: "#ff8a2b",
  torch4: "#ffb347",
  lagoon: "#4fd1c5",
  ember: "#e0453a",
  drafters: ["#ff7a59", "#4fd1c5", "#c084fc", "#fbbf24", "#a3e635", "#60a5fa"],
};

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, props: Record<string, unknown> = {}, ...children: unknown[]): Node => {
  // satori chokes on `undefined` style values, so drop them.
  const style = props.style as Record<string, unknown> | undefined;
  const cleanStyle = Object.fromEntries(Object.entries(style ?? {}).filter(([, v]) => v !== undefined));
  // satori requires an explicit display for any element with several children.
  if (type === "div" && cleanStyle.display === undefined) cleanStyle.display = "flex";
  return { type, props: { ...props, style: cleanStyle, children: children.length === 1 ? children[0] : children } };
};

function photoDataUri(c: ContestantView): string | undefined {
  if (!c.photo) return undefined;
  const p = join(PHOTOS, c.photo);
  if (!existsSync(p)) return undefined;
  return `data:image/jpeg;base64,${readFileSync(p).toString("base64")}`;
}

function drafterColor(data: SeasonData, id: string | undefined): string {
  const i = data.season.drafters.findIndex((d) => d.id === id);
  return i < 0 ? C.sand4 : C.drafters[i % C.drafters.length]!;
}

const display = (size: number, color = C.sand, extra: Record<string, unknown> = {}) => ({
  fontFamily: "Bebas Neue",
  fontSize: size,
  color,
  letterSpacing: 1,
  lineHeight: 1,
  ...extra,
});
const body = (size: number, color = C.sand, extra: Record<string, unknown> = {}) => ({ fontFamily: "Inter", fontSize: size, color, lineHeight: 1.3, ...extra });

function frame(data: SeasonData, title: string, subtitle: string, ...content: (Node | null)[]): Node {
  return h(
    "div",
    {
      style: {
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(180deg, ${C.bg} 0%, ${C.bg2} 60%)`,
        padding: 56,
        color: C.sand,
      },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between" } },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        h("div", { style: display(30, C.torch4, { letterSpacing: 6 }) }, (data.season.groupName ?? "DRAFT").toUpperCase()),
        h("div", { style: display(110) }, data.season.name),
        h("div", { style: display(40, C.lagoon, { letterSpacing: 5 }) }, (data.season.subtitle ?? "").toUpperCase()),
      ),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } },
        h("div", { style: display(54, C.torch4) }, title),
        h("div", { style: body(24, C.sand3) }, subtitle),
      ),
    ),
    h("div", { style: { height: 2, background: C.line, marginTop: 28, marginBottom: 28 } }),
    ...content,
    h("div", { style: { flex: 1 } }),
    h(
      "div",
      { style: { display: "flex", justifyContent: "space-between", ...body(22, C.sand4) } },
      h("div", {}, SITE ? SITE.replace(/^https?:\/\//, "") : "survivor-draft"),
      h("div", {}, "Unofficial fan site"),
    ),
  );
}

function standingsBlock(data: SeasonData, opts: { photos?: boolean } = {}): Node {
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 14 } },
    ...data.standings.map((s) => {
      const color = drafterColor(data, s.drafterId);
      const picks = data.contestants.filter((c) => c.drafterId === s.drafterId).sort((a, b) => b.points.total - a.points.total);
      return h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 22, background: C.card, borderRadius: 22, padding: "18px 26px", borderLeft: `8px solid ${color}` } },
        h("div", { style: display(72, color, { width: 60, textAlign: "center" }) }, String(s.rank)),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", flex: 1 } },
          h("div", { style: display(52) }, s.name),
          h("div", { style: body(22, C.sand4) }, `${s.remaining} of ${picks.length} still in${s.dropped ? " · best 4 count" : ""}${s.tied ? " · tied" : ""}`),
        ),
        ...(opts.photos === false ? [] : [
          h(
            "div",
            { style: { display: "flex", gap: 8 } },
            ...picks.map((c) => {
              const uri = photoDataUri(c);
              const gone = c.status === "eliminated";
              return h(
                "div",
                { style: { width: 64, height: 88, borderRadius: 10, overflow: "hidden", background: "#173229", display: "flex", opacity: gone ? 0.35 : 1, filter: gone ? "grayscale(1)" : undefined } },
                uri ? h("img", { src: uri, width: 64, height: 88, style: { objectFit: "cover", objectPosition: "top" } }) : null,
              );
            }),
          )]),
        h("div", { style: display(76, C.sand, { width: 110, textAlign: "right" }) }, String(s.total)),
      );
    }),
  );
}

function standingsCard(data: SeasonData): Node {
  const gone = data.eliminations.length;
  const sub = data.seasonStarted ? `${gone} gone · ${data.contestants.length - gone} remain` : `Premieres ${data.season.premiereDate}`;
  const headline = data.latestRundown?.headline;
  return frame(
    data,
    "Standings",
    sub,
    ...(headline ? [h("div", { style: { display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 22 } }, h("div", { style: display(30, C.torch4) }, "JEFF:"), h("div", { style: display(40, C.sand, { flex: 1 }) }, headline))] : []),
    standingsBlock(data),
    h("div", { style: { height: 26 } }),
    h("div", { style: body(24, C.sand3) }, `Prize: ${data.season.prize.description}`),
  );
}

function draftCard(data: SeasonData): Node {
  const drafters = [...data.season.drafters].sort((a, b) => a.draftPosition - b.draftPosition);
  return frame(
    data,
    "Draft Board",
    `Snake draft · ${data.draft.picks.length} picks`,
    h(
      "div",
      { style: { display: "flex", gap: 14 } },
      ...drafters.map((d) =>
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", flex: 1, gap: 8 } },
          h("div", { style: display(40, drafterColor(data, d.id), { textAlign: "center" }) }, d.name),
          ...data.draft.picks
            .filter((p) => p.drafterId === d.id)
            .sort((a, b) => a.overall - b.overall)
            .map((p) => {
              const c = data.contestants.find((x) => x.slug === p.contestantSlug);
              const uri = c ? photoDataUri(c) : undefined;
              return h(
                "div",
                { style: { display: "flex", flexDirection: "column", alignItems: "center", background: C.card, borderRadius: 16, padding: 6, gap: 4 } },
                h("div", { style: { width: 104, height: 124, borderRadius: 10, overflow: "hidden", background: "#173229", display: "flex" } }, uri ? h("img", { src: uri, width: 104, height: 124, style: { objectFit: "cover", objectPosition: "top" } }) : null),
                h("div", { style: body(19, C.sand, { fontWeight: 600, textAlign: "center" }) }, c ? c.shortName : "?"),
                h("div", { style: body(15, C.sand4) }, `#${p.overall}${p.leftover ? " · leftover" : ""}`),
              );
            }),
        ),
      ),
    ),
  );
}

function episodeCard(data: SeasonData, ep: SeasonData["episodes"][number]): Node {
  const boots = ep.eliminations.map((e) => data.contestants.find((c) => c.slug === e.contestantSlug)).filter((c): c is ContestantView => !!c);
  const line = ep.commentary?.bullets[0] ?? ep.commentary?.recap.split(/(?<=[.!?])\s+/)[0] ?? "";
  return frame(
    data,
    `Episode ${ep.number}`,
    ep.title ? `“${ep.title}”` : "",
    h(
      "div",
      { style: { display: "flex", gap: 22, alignItems: "center", background: C.card, borderRadius: 22, padding: 22, marginBottom: 22 } },
      ...boots.map((c) => {
        const uri = photoDataUri(c);
        return h("div", { style: { width: 120, height: 160, borderRadius: 14, overflow: "hidden", background: "#173229", display: "flex", filter: "grayscale(1)", opacity: 0.8 } }, uri ? h("img", { src: uri, width: 120, height: 160, style: { objectFit: "cover", objectPosition: "top" } }) : null);
      }),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", flex: 1 } },
        h("div", { style: display(30, C.ember, { letterSpacing: 4 }) }, "TORCH SNUFFED"),
        h("div", { style: display(54) }, boots.map((c) => c.name).join(" & ") || "Nobody"),
        h(
          "div",
          { style: body(24, C.sand3) },
          boots
            .map((c) => {
              const d = data.season.drafters.find((x) => x.id === c.drafterId);
              return d ? `${d.name} loses ${c.shortName}` : c.shortName;
            })
            .join(" · "),
        ),
      ),
    ),
    standingsBlock(data, { photos: false }),
    line ? h("div", { style: { marginTop: 24, display: "flex", gap: 14, alignItems: "flex-start" } }, h("div", { style: display(30, C.torch4) }, "JEFF:"), h("div", { style: body(26, C.sand, { flex: 1 }) }, line)) : null,
  );
}

async function render(node: Node, file: string, fonts: { name: string; data: Buffer; weight: 400 | 600 }[]) {
  const svg = await satori(node as unknown as Parameters<typeof satori>[0], { width: W, height: H, fonts: fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: "normal" as const })) });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
  writeFileSync(join(OUT, file), png);
  console.log(`card: ${file} (${Math.round(png.length / 1024)} KB)`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const data = buildSeasonData(loadInputs());
  const fonts = [
    { name: "Bebas Neue", data: readFileSync(join(FONTS, "BebasNeue-Regular.ttf")), weight: 400 as const },
    { name: "Inter", data: readFileSync(join(FONTS, "Inter-Regular.woff")), weight: 400 as const },
    { name: "Inter", data: readFileSync(join(FONTS, "Inter-SemiBold.woff")), weight: 600 as const },
  ];
  await render(standingsCard(data), "standings.png", fonts);
  if (data.draft.picks.length) await render(draftCard(data), "draft.png", fonts);
  for (const ep of data.episodes.filter((e) => e.eliminations.length > 0)) {
    await render(episodeCard(data, ep), `ep-${ep.number}.png`, fonts);
  }
  console.log(`cards written to ${OUT} for season ${SEASON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
