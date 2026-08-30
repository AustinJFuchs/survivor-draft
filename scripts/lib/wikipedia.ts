// Parse the Wikipedia season article (wikitext) into scoring facts:
// contestant table (tribes, placement, day), voting history (elimination →
// episode), episode list (titles/air dates/synopses), season summary
// (reward/immunity winners, display only).
//
// Only *visible* content is read: {{void|...}} and comments are stripped first,
// so hidden spoiler tags never leak in.

import { findTableByCaption, findTemplates, plain, stripInvisible, type Cell, type Table } from "./wikitext";
import type { EliminationKind } from "../../src/lib/types";

export interface ContestantRow {
  index: number; // row order in the table (= finish order, first out first)
  name: string;
  age?: number;
  from?: string;
  tribes: { original?: string; switches: string[]; merged?: string };
  placementText?: string;
  day?: number;
}

export interface ParsedPlacement {
  eliminated: boolean;
  kind?: EliminationKind;
  finalist: boolean;
  winner: boolean;
  juryMember: boolean;
  finalRank?: number; // 1 winner, 2 runner-up, 3 second runner-up
}

export function parsePlacement(text: string | undefined): ParsedPlacement {
  const t = (text ?? "").trim().toLowerCase();
  const none: ParsedPlacement = { eliminated: false, finalist: false, winner: false, juryMember: false };
  if (!t) return none;
  const juryMember = /jury member/.test(t);
  if (/sole survivor|winner/.test(t)) return { ...none, finalist: true, winner: true, finalRank: 1 };
  if (/2nd runner-up|second runner-up/.test(t)) return { ...none, finalist: true, finalRank: 3 };
  if (/runner-up/.test(t)) return { ...none, finalist: true, finalRank: 2 };
  let kind: EliminationKind | undefined;
  if (/voted out/.test(t)) kind = "voted-out";
  else if (/evacuat/.test(t)) kind = "medevac";
  else if (/quit|withdr/.test(t)) kind = "quit";
  else if (/removed|ejected|expelled/.test(t)) kind = "removed";
  else if (/^eliminated|lost fire|fire-making|fire making/.test(t)) kind = "fire";
  else if (/eliminated|out\b/.test(t)) kind = "other";
  if (!kind) return none;
  return { eliminated: true, kind, finalist: false, winner: false, juryMember };
}

function headerLabels(table: Table): string[] {
  // Two header rows; the second carries sub-column labels, spanned copies carry
  // the parent label for rowspan=2 columns.
  const r1 = table.grid[1] ?? [];
  const r0 = table.grid[0] ?? [];
  const width = Math.max(r0.length, r1.length);
  const labels: string[] = [];
  for (let c = 0; c < width; c++) {
    const cell = r1[c] ?? r0[c];
    labels.push(plain(cell?.raw ?? "").toLowerCase());
  }
  return labels;
}

function tribeFromCell(cell: Cell | undefined): string | undefined {
  if (!cell) return undefined;
  const raw = cell.raw;
  const m = /\{\{\s*stribe\s*\|\s*([^|}]+)/i.exec(raw);
  if (m) {
    const name = m[1]!.trim().toLowerCase();
    if (name === "none" || name === "") return undefined;
    return titleize(name);
  }
  const text = plain(raw);
  if (!text || /darkgray|none/i.test(text)) return undefined;
  return text;
}

function titleize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseContestantTable(wikitext: string): ContestantRow[] {
  const text = stripInvisible(wikitext);
  const table = findTableByCaption(text, /contestants/i);
  if (!table) return [];
  const labels = headerLabels(table);
  const col = (re: RegExp) => labels.findIndex((l) => re.test(l));
  const cName = 0;
  const cAge = col(/^age$/);
  const cFrom = col(/^from$/);
  const cOriginal = col(/original/);
  const cMerged = col(/merged/);
  const cPlacement = col(/placement|finish/);
  const cDay = col(/^day/);
  const switchCols = labels.map((l, i) => (/switch|swap|expanded|shuffle/.test(l) ? i : -1)).filter((i) => i >= 0);

  const rows: ContestantRow[] = [];
  for (let r = 2; r < table.grid.length; r++) {
    const g = table.grid[r]!;
    const nameCell = g[cName];
    if (!nameCell || !nameCell.header) continue; // data rows start with "!scope=row"
    const name = plain(nameCell.raw);
    if (!name) continue;
    const row: ContestantRow = {
      index: rows.length,
      name,
      tribes: { switches: [] },
    };
    if (cAge >= 0) {
      const n = Number(plain(g[cAge]?.raw ?? ""));
      if (Number.isFinite(n) && n > 0) row.age = n;
    }
    if (cFrom >= 0) row.from = plain(g[cFrom]?.raw ?? "") || undefined;
    if (cOriginal >= 0) row.tribes.original = tribeFromCell(g[cOriginal]);
    for (const c of switchCols) {
      const t = tribeFromCell(g[c]);
      if (t) row.tribes.switches.push(t);
    }
    if (cMerged >= 0) row.tribes.merged = tribeFromCell(g[cMerged]);
    if (cPlacement >= 0) {
      const p = plain(g[cPlacement]?.raw ?? "");
      row.placementText = p || undefined;
    }
    if (cDay >= 0) {
      const d = /(\d+)/.exec(plain(g[cDay]?.raw ?? ""));
      if (d) row.day = Number(d[1]);
    }
    rows.push(row);
  }
  return rows;
}

export interface VotingHistory {
  /** Column-aligned parallel arrays; one entry per elimination column. */
  columns: { episode?: number; day?: number; tribe?: string; eliminated?: string }[];
  mergedTribe?: string;
}

export function parseVotingHistory(wikitext: string): VotingHistory {
  const text = stripInvisible(wikitext);
  const table = findTableByCaption(text, /voting history/i);
  if (!table) return { columns: [] };
  const rowByLabel = (re: RegExp) => table.grid.find((g) => g[0] && re.test(plain(g[0].raw)));
  const epRow = rowByLabel(/^episode$/i);
  const dayRow = rowByLabel(/^day$/i);
  const tribeRow = rowByLabel(/^tribe$/i);
  const elimRow = rowByLabel(/^eliminated$/i);
  if (!epRow || !elimRow) return { columns: [] };
  const width = Math.max(epRow.length, elimRow.length);
  const columns: VotingHistory["columns"] = [];
  for (let c = 1; c < width; c++) {
    const ep = Number(plain(epRow[c]?.raw ?? "").replace(/[^\d]/g, ""));
    const eliminated = plain(elimRow[c]?.raw ?? "");
    const dayText = plain(dayRow?.[c]?.raw ?? "");
    const day = /(\d+)/.exec(dayText)?.[1];
    const tribe = tribeFromCell(tribeRow?.[c]);
    columns.push({
      episode: Number.isFinite(ep) && ep > 0 ? ep : undefined,
      day: day ? Number(day) : undefined,
      tribe,
      eliminated: eliminated || undefined,
    });
  }
  // Merged tribe: the top header row usually says "Merged tribe" over a span.
  let mergedTribe: string | undefined;
  const top = table.grid[0] ?? [];
  const mergedStart = top.findIndex((cell) => /merged/i.test(plain(cell?.raw ?? "")));
  if (mergedStart > 0) mergedTribe = columns[mergedStart - 1]?.tribe;
  return { columns, mergedTribe };
}

export interface ParsedEpisode {
  number: number;
  title?: string;
  airDate?: string;
  synopsis?: string;
}

export function parseEpisodeList(wikitext: string): ParsedEpisode[] {
  const out: ParsedEpisode[] = [];
  for (const tpl of findTemplates(wikitext, "#invoke:Episode list")) {
    const num = Number(tpl.named["episodenumber2"] ?? tpl.named["episodenumber"]);
    if (!Number.isFinite(num) || num <= 0) continue;
    const title = plain(tpl.named["title"] ?? "") || undefined;
    const airDate = plain(tpl.named["originalairdate"] ?? "") || undefined;
    const synopsis = plain(tpl.named["shortsummary"] ?? "") || undefined;
    out.push({ number: num, title, airDate: airDate && /^\d{4}-\d{2}-\d{2}$/.test(airDate) ? airDate : undefined, synopsis });
  }
  return out.sort((a, b) => a.number - b.number);
}

export interface SummaryRow {
  episode: number;
  reward?: string;
  immunity?: string;
  eliminated: string[];
}

export function parseSeasonSummary(wikitext: string): SummaryRow[] {
  const text = stripInvisible(wikitext);
  const table = findTableByCaption(text, /season summary/i);
  if (!table) return [];
  const labels = headerLabels(table);
  const col = (re: RegExp) => labels.findIndex((l) => re.test(l));
  const cNo = col(/^no/);
  const cReward = col(/reward/);
  const cImmunity = col(/immunity/);
  const cPlayer = col(/player/);
  const byEp = new Map<number, SummaryRow>();
  for (let r = 2; r < table.grid.length; r++) {
    const g = table.grid[r]!;
    const ep = Number(plain(g[cNo >= 0 ? cNo : 0]?.raw ?? ""));
    if (!Number.isFinite(ep) || ep <= 0) continue;
    const row = byEp.get(ep) ?? { episode: ep, eliminated: [] };
    const add = (key: "reward" | "immunity", c: number) => {
      if (c < 0) return;
      const cell = g[c];
      if (!cell || cell.spanned === "row") return; // a rowspan copy was already counted
      const v = plain(cell.raw);
      if (!v || /^none$/i.test(v)) return;
      if (row[key]?.split("; ").includes(v)) return;
      row[key] = row[key] ? `${row[key]}; ${v}` : v;
    };
    add("reward", cReward);
    add("immunity", cImmunity);
    if (cPlayer >= 0) {
      const cell = g[cPlayer];
      if (cell && cell.spanned !== "row") {
        const v = plain(cell.raw);
        if (v && !/^none$/i.test(v)) row.eliminated.push(v);
      }
    }
    byEp.set(ep, row);
  }
  return [...byEp.values()].sort((a, b) => a.episode - b.episode);
}

export function parseInfoboxWinner(wikitext: string): string | undefined {
  const m = /\|\s*winner\s*=\s*([^\n|]+)/i.exec(stripInvisible(wikitext));
  const v = m ? plain(m[1]!) : "";
  return v || undefined;
}
