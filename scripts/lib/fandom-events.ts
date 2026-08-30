// Idols, advantages, Shot in the Dark, journeys — parsed from the Survivor
// Wiki's per-type pages, whose "Summary"/"History" tables have one row per
// instance across all seasons (season cell may rowspan). Display only.

import { extractTables, parseTable, plain, stripInvisible, type Cell } from "./wikitext";
import type { GameEvent, GameEventType } from "../../src/lib/types";

/** Wiki page → handler. Pages without a season row are simply skipped. */
export const EVENT_PAGES = [
  "Hidden_Immunity_Idol/History",
  "Beware_Advantage",
  "Extra_Vote",
  "Vote_Steal",
  "Vote_Blocker",
  "Knowledge_is_Power_Advantage",
  "Safety_Without_Power",
  "Idol_Nullifier",
  "Advantage_Amulet",
  "Advantage_Menu",
  "Challenge_Advantage",
  "Shot_in_the_Dark",
  "Journey",
] as const;

export type EventPage = (typeof EVENT_PAGES)[number];

const PAGE_URL = (page: string) => `https://survivor.fandom.com/wiki/${page}`;

interface Row {
  get: (re: RegExp) => Cell | undefined;
  text: (re: RegExp) => string;
}

/** Names in a cell: `link=Name` in File embeds, `[[Name]]` links, `{{Tribebox-pt|..|Name}}`. */
export function namesIn(raw: string | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (n: string) => {
    const t = n.trim();
    if (t && !seen.has(t) && !/^(none|n\/a|—|-)$/i.test(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  for (const m of raw.matchAll(/link=([^\]|]+)/g)) push(m[1]!);
  for (const m of raw.matchAll(/\[\[(?!File:|Image:)([^\]|#]+)(?:\|[^\]]*)?\]\]/gi)) push(m[1]!);
  for (const m of raw.matchAll(/\{\{\s*Tribebox-pt\s*\|([^}]*)\}\}/gi)) {
    const parts = m[1]!.split("|").map((p) => p.trim());
    const last = parts[parts.length - 1];
    if (last && !/px$/.test(last) && !/\.(png|jpg)$/i.test(last)) push(last);
  }
  return out;
}

/** {{Ep|4903}} → 3 when season is 49. */
export function episodeIn(raw: string | undefined, season: string): number | undefined {
  if (!raw) return undefined;
  const m = new RegExp(`\\{\\{\\s*Ep\\s*\\|\\s*${season}(\\d{2})`, "i").exec(raw);
  return m ? Number(m[1]) : undefined;
}

export function dayIn(raw: string | undefined): number | undefined {
  const m = /\bDay\s+(\d+)/i.exec(raw ?? "");
  return m ? Number(m[1]) : undefined;
}

export function ynIn(raw: string | undefined): boolean | undefined {
  const m = /\{\{\s*yn\s*\|\s*([yn])/i.exec(raw ?? "");
  return m ? m[1]!.toLowerCase() === "y" : undefined;
}

function isSeason(raw: string | undefined, season: string): boolean {
  return new RegExp(`\\{\\{\\s*S2?\\s*\\|\\s*${season}\\s*(\\||\\}\\})`).test(raw ?? "");
}

/** Every data row (with headers resolved) for `season` across all tables on the page. */
export function seasonRows(wikitext: string, season: string): Row[] {
  const text = stripInvisible(wikitext);
  const rows: Row[] = [];
  for (const raw of extractTables(text)) {
    const table = parseTable(raw);
    const header = table.grid[0];
    if (!header || !header.some((c) => c.header && /^season$/i.test(plain(c.raw)))) continue;
    const labels = header.map((c) => plain(c.raw).toLowerCase());
    for (let r = 1; r < table.grid.length; r++) {
      const g = table.grid[r]!;
      const seasonIdx = labels.findIndex((l) => l === "season");
      if (!isSeason(g[seasonIdx]?.raw, season)) continue;
      const get = (re: RegExp) => {
        const i = labels.findIndex((l) => re.test(l));
        return i >= 0 ? g[i] : undefined;
      };
      rows.push({ get, text: (re) => plain(get(re)?.raw ?? "") });
    }
  }
  return rows;
}

let counter = 0;
const id = (prefix: string) => `${prefix}-${++counter}`;

/** Parse one page's wikitext into events for `season`. */
export function parseEventPage(page: EventPage, wikitext: string, season: string): GameEvent[] {
  counter = 0;
  const rows = seasonRows(wikitext, season);
  const out: GameEvent[] = [];
  const src = { page: page.replace(/_/g, " "), url: PAGE_URL(page) };
  const base = (type: GameEventType, extra: Partial<GameEvent>): GameEvent => ({
    id: id(page.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
    type,
    contestant: "",
    source: src,
    extracted: "table",
    ...extra,
  });

  for (const row of rows) {
    if (page === "Hidden_Immunity_Idol/History") {
      const finder = namesIn(row.get(/found by/)?.raw)[0];
      const holder = namesIn(row.get(/given to/)?.raw)[0] ?? finder;
      const notes = row.get(/notes/)?.raw ?? "";
      const foundEp = episodeIn(row.get(/episode found/)?.raw, season);
      const usedRaw = row.get(/episode used/)?.raw ?? "";
      const usedEp = episodeIn(usedRaw, season);
      const place = row.text(/hiding place|location/);
      if (finder) out.push(base("idol-found", { contestant: finder, episode: foundEp, day: dayIn(notes), detail: [place ? `Found at ${place}` : "", plain(notes).split(/\.\s+/)[0]].filter(Boolean).join(" · ") }));
      if (holder && usedEp !== undefined) {
        const ok = ynIn(row.get(/successful/)?.raw);
        const result = row.text(/successful/).replace(/^(yes|no)\s*/i, "");
        out.push(base("idol-played", { contestant: holder, episode: usedEp, outcome: ok === undefined ? undefined : ok ? "success" : "fail", detail: result || undefined, advantage: "Hidden Immunity Idol" }));
      } else if (holder && /eliminated|never|not used|unused/i.test(plain(usedRaw))) {
        out.push(base("idol-unused", { contestant: holder, detail: plain(usedRaw), advantage: "Hidden Immunity Idol" }));
      }
      continue;
    }

    if (page === "Shot_in_the_Dark") {
      const who = namesIn(row.get(/took gamble/)?.raw)[0];
      if (!who) continue;
      const result = row.text(/^result/);
      out.push(base("shot-in-the-dark", { contestant: who, episode: episodeIn(row.get(/^episode/)?.raw, season), outcome: /not safe/i.test(result) ? "fail" : /safe/i.test(result) ? "success" : undefined, detail: result || undefined }));
      continue;
    }

    if (page === "Journey") {
      const ep = episodeIn(row.get(/^episode/)?.raw, season);
      const summary = row.text(/summary/);
      // Participants span several columns; collect names from every non-summary cell.
      const names = new Set<string>();
      for (const re of [/participant/]) {
        const cell = row.get(re);
        for (const n of namesIn(cell?.raw)) names.add(n);
      }
      // Grid copies for colspan share raw, so also scan the whole row via text of each cell we can reach.
      for (const n of namesIn(row.get(/participant/)?.raw)) names.add(n);
      for (const who of names) out.push(base("journey", { contestant: who, episode: ep, detail: summary ? summary.slice(0, 220) : undefined }));
      continue;
    }

    // Generic advantage pages: acquired → found; used → played.
    const advName = page === "Beware_Advantage" ? "Beware Advantage" : src.page.replace(/ Advantage$/, "") + (page === "Knowledge_is_Power_Advantage" ? " Advantage" : "");
    const owner = namesIn(row.get(/original owner|^owner/)?.raw)[0];
    const holder = namesIn(row.get(/given to/)?.raw)[0] ?? owner;
    const location = row.text(/location/);
    const acquiredEp = episodeIn(row.get(/episode acquired|episode opened|^episode$/)?.raw, season);
    if (owner) {
      const advantage = page === "Beware_Advantage" ? row.text(/^advantage$/) || advName : advName;
      const task = page === "Beware_Advantage" ? row.text(/task/) : "";
      out.push(base("advantage-found", { contestant: owner, episode: acquiredEp, day: dayIn(location) ?? dayIn(row.get(/notes/)?.raw), advantage, detail: [location, task].filter(Boolean).join(" · ") || undefined }));
    }
    if (page === "Beware_Advantage") continue; // the resulting idol/advantage is tracked on its own page
    const usedRaw = row.get(/episode used/)?.raw;
    const usedEp = episodeIn(usedRaw, season);
    if (holder && usedEp !== undefined) {
      const ok = ynIn(row.get(/successful|outcome|result/)?.raw);
      const target = namesIn(row.get(/target|vote stolen|asked for/)?.raw)[0];
      const outcomeText = row.text(/successful|outcome|result/).replace(/^(yes|no)\s*/i, "");
      out.push(base("advantage-played", { contestant: holder, episode: usedEp, advantage: advName, outcome: ok === undefined ? undefined : ok ? "success" : "fail", target, detail: outcomeText || undefined }));
    } else if (holder && usedRaw && /not chosen|eliminated|never|expired|unused/i.test(plain(usedRaw))) {
      out.push(base("advantage-unused", { contestant: holder, advantage: advName, detail: plain(usedRaw) }));
    }
  }
  return out;
}
