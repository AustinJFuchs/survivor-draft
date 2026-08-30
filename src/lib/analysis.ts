// Drafter analysis: draft grades, badges, projections, paths to victory, and
// the what-if simulator. Pure functions over the scoring engine; used at build
// time (build-data.ts) and in the browser (What if… panel).

import { computeStandings, scoreContestants, sortEliminations, type ScoreInput } from "./scoring";
import type {
  Badge,
  DraftPick,
  Drafter,
  DrafterStanding,
  Elimination,
  Grade,
  HandicapConfig,
  HistoryPoint,
  Milestones,
  Paths,
  PickGrade,
  Projection,
  ScoringConfig,
  WeekSummary,
} from "./types";

// ---------------- Draft grades ----------------

export const GRADES_EARLY_UNTIL = 5; // eliminations

export function gradeFromGap(gap: number, total: number): Grade {
  // gap = rank − pick, normalised by the field size. Negative = beat the slot.
  const g = gap / total;
  if (g <= -0.2) return "A";
  if (g <= -0.05) return "B";
  if (g <= 0.1) return "C";
  if (g <= 0.3) return "D";
  return "F";
}

const GRADE_POINTS: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

export function computeGrades(
  picks: DraftPick[],
  rankBySlug: Map<string, number>,
  total: number,
): { grades: PickGrade[]; gpa?: number; steal?: PickGrade; reach?: PickGrade } {
  const grades = picks
    .filter((p) => p.contestantSlug && rankBySlug.has(p.contestantSlug))
    .map((p) => {
      const rank = rankBySlug.get(p.contestantSlug)!;
      const gap = rank - p.overall;
      return { pick: p, contestantSlug: p.contestantSlug, rank, gap, grade: gradeFromGap(gap, total) };
    })
    .sort((a, b) => a.pick.overall - b.pick.overall);
  if (grades.length === 0) return { grades };
  const gpa = Math.round((grades.reduce((s, g) => s + GRADE_POINTS[g.grade], 0) / grades.length) * 100) / 100;
  const byGap = [...grades].sort((a, b) => a.gap - b.gap);
  const steal = byGap[0]!.gap < 0 ? byGap[0] : undefined;
  const reach = byGap[byGap.length - 1]!.gap > 0 ? byGap[byGap.length - 1] : undefined;
  return { grades, gpa, steal, reach };
}

// ---------------- Weeks ----------------

export function weekSummaries(history: HistoryPoint[], drafterId: string): WeekSummary[] {
  // Collapse elimination steps into episodes.
  const byEp = new Map<number, { start: number; end: number }>();
  let prevTotal = history[0]?.totals[drafterId] ?? 0;
  for (const h of history.slice(1)) {
    if (h.episode === undefined) continue;
    const cur = byEp.get(h.episode) ?? { start: prevTotal, end: prevTotal };
    cur.end = h.totals[drafterId] ?? 0;
    byEp.set(h.episode, cur);
    prevTotal = cur.end;
  }
  return [...byEp.entries()].map(([episode, v]) => ({ episode, delta: v.end - v.start })).sort((a, b) => a.episode - b.episode);
}

// ---------------- Projections ----------------

export interface ProjectionInput {
  drafterId: string;
  picks: DraftPick[];
  standings: DrafterStanding[];
  eliminations: Elimination[];
  milestones: Milestones;
  totalContestants: number;
  scoring: ScoringConfig;
  handicap: HandicapConfig;
  points: Record<string, { total: number }>;
}

/**
 * Best case for one drafter: every living castaway survives to the final
 * three, one of them wins. Bonus points respect the best-N handicap loosely
 * (we cap counted castaways at N).
 */
export function computeProjection(inp: ProjectionInput): Projection {
  const gone = new Set(inp.eliminations.map((e) => e.contestantSlug));
  const finalists = 3;
  const eliminationsLeft = Math.max(0, inp.totalContestants - finalists - inp.eliminations.length);
  const mine = inp.picks.filter((p) => p.drafterId === inp.drafterId).map((p) => p.contestantSlug);
  const living = mine.filter((s) => !gone.has(s) && !inp.milestones.finalists.includes(s));
  const mergeDone = inp.milestones.merged.length > 0;
  // Before the merge every living castaway could still earn the merge bonus;
  // after it, the bonus is already settled for everyone.
  const mergeBonus = (s: string) => (!mergeDone && !inp.milestones.merged.includes(s) ? inp.scoring.merge : 0);
  // Best-case per living castaway, sorted by current + potential so best-N counts the top ones.
  const potentials = mine.map((s) => {
    const cur = inp.points[s]?.total ?? 0;
    if (gone.has(s)) return { s, cur, add: 0 };
    const isFinalist = inp.milestones.finalists.includes(s);
    const add = (isFinalist ? 0 : eliminationsLeft * inp.scoring.perEliminationSurvived + inp.scoring.finalTribal) + (isFinalist ? 0 : mergeBonus(s));
    return { s, cur, add };
  });
  const canWin = living.length > 0 || mine.some((s) => inp.milestones.finalists.includes(s));
  // Once the winner is known there's nothing left to win.
  const winBonus = !inp.milestones.winner && canWin ? inp.scoring.winner : 0;
  const sorted = potentials.sort((a, b) => b.cur + b.add - (a.cur + a.add));
  const counted = sorted.slice(0, inp.handicap.countBest);
  const maxPossible = counted.reduce((sum, p) => sum + p.cur + p.add, 0) + winBonus;
  const mineStanding = inp.standings.find((s) => s.drafterId === inp.drafterId);
  const current = mineStanding?.total ?? 0;
  const leaderTotal = Math.max(...inp.standings.map((s) => s.total));
  return { onTable: Math.max(0, maxPossible - current), maxPossible, alive: maxPossible >= leaderTotal, leaderTotal };
}

// ---------------- Paths to victory ----------------

export interface PathsInput {
  drafters: Drafter[];
  picks: DraftPick[];
  contestantSlugs: string[];
  eliminations: Elimination[];
  milestones: Milestones;
  scoring: ScoringConfig;
  handicap: HandicapConfig;
  maxRemaining?: number; // safety cap on enumeration
}

function combos<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...rest] = arr;
  return [...combos(rest, k - 1).map((c) => [head!, ...c]), ...combos(rest, k)];
}

/** Enumerate every final-three + winner from the remaining castaways. */
export function computePaths(inp: PathsInput): Record<string, Paths> {
  const gone = new Set(inp.eliminations.map((e) => e.contestantSlug));
  const remaining = inp.contestantSlugs.filter((s) => !gone.has(s));
  const active = inp.milestones.merged.length > 0 && remaining.length >= 3 && remaining.length <= (inp.maxRemaining ?? 14) && !inp.milestones.winner;
  const base: Record<string, Paths> = {};
  for (const d of inp.drafters) base[d.id] = { active, remaining: remaining.length, scenarios: 0, wins: 0, clinch: [], live: [] };
  if (!active) return base;

  const winsByWinner = new Map<string, Map<string, number>>(); // winner → drafter → wins
  const trioCount = new Map<string, number>(); // winner → scenarios
  let scenarios = 0;
  const nextOrder = inp.eliminations.length + 1;
  for (const trio of combos(remaining, 3)) {
    const others = remaining.filter((s) => !trio.includes(s));
    // Eliminate the others in an arbitrary order — survival points for the trio
    // are the same regardless of order.
    const extra: Elimination[] = others.map((s, i) => ({ order: nextOrder + i, contestantSlug: s, kind: "voted-out", episode: 99 }));
    for (const winner of trio) {
      scenarios++;
      const milestones: Milestones = { ...inp.milestones, finalists: trio, winner };
      const pts = scoreContestants({ contestantSlugs: inp.contestantSlugs, eliminations: [...inp.eliminations, ...extra], milestones, scoring: inp.scoring });
      const rows = computeStandings({ drafters: inp.drafters, picks: inp.picks, points: pts, eliminated: new Set([...gone, ...others]), handicap: inp.handicap });
      const top = rows.filter((r) => r.rank === 1);
      trioCount.set(winner, (trioCount.get(winner) ?? 0) + 1);
      for (const r of top) {
        const m = winsByWinner.get(winner) ?? new Map<string, number>();
        m.set(r.drafterId, (m.get(r.drafterId) ?? 0) + 1 / top.length);
        winsByWinner.set(winner, m);
        base[r.drafterId]!.wins += 1 / top.length;
      }
    }
  }
  for (const d of inp.drafters) {
    const p = base[d.id]!;
    p.scenarios = scenarios;
    p.wins = Math.round(p.wins * 100) / 100;
    for (const w of remaining) {
      const wins = winsByWinner.get(w)?.get(d.id) ?? 0;
      const total = trioCount.get(w) ?? 0;
      if (total > 0 && wins >= total - 1e-9) p.clinch.push(w);
      else if (wins > 0) p.live.push(w);
    }
  }
  return base;
}

// ---------------- Badges ----------------

export interface BadgeInput {
  drafters: Drafter[];
  picks: DraftPick[];
  standings: DrafterStanding[];
  history: HistoryPoint[];
  eliminations: Elimination[];
  milestones: Milestones;
  /** slug → count of individual immunity wins (from the ledger). */
  immunityWins: Record<string, number>;
  /** slug → idols + advantages found. */
  advantagesFound?: Record<string, number>;
  contestantName: (slug: string) => string;
}

export function computeBadges(inp: BadgeInput): Record<string, Badge[]> {
  const out: Record<string, Badge[]> = {};
  for (const d of inp.drafters) out[d.id] = [];
  const give = (id: string, badge: Badge) => out[id]?.push(badge);
  const elims = sortEliminations(inp.eliminations);
  const drafterOf = (slug: string) => inp.picks.find((p) => p.contestantSlug === slug)?.drafterId;
  const name = inp.contestantName;

  // First Blood — the drafter who lost the first castaway.
  const first = elims[0];
  if (first) {
    const d = drafterOf(first.contestantSlug);
    if (d) give(d, { id: "first-blood", emoji: "🩸", name: "First Blood", rule: "First drafter to lose a castaway", detail: `${name(first.contestantSlug)} went home first` });
  }

  // Torch Collector — most castaways gone (ties: all).
  const lost = new Map<string, number>();
  for (const e of elims) {
    const d = drafterOf(e.contestantSlug);
    if (d) lost.set(d, (lost.get(d) ?? 0) + 1);
  }
  const maxLost = Math.max(0, ...lost.values());
  if (maxLost >= 2) for (const [d, n] of lost) if (n === maxLost) give(d, { id: "torch-collector", emoji: "🔥", name: "Torch Collector", rule: "Most castaways voted out", detail: `${n} torches snuffed` });

  // Untouchable — still hasn't lost a castaway after at least three boots. Goes away the day it stops being true.
  if (elims.length >= 3) {
    for (const d of inp.drafters) {
      if ((lost.get(d.id) ?? 0) === 0) give(d.id, { id: "untouchable", emoji: "🛡️", name: "Untouchable", rule: "Hasn't lost a single castaway yet (after 3+ eliminations)", detail: `${elims.length} boots, none theirs` });
    }
  }

  // Merge Machine — every pick made the merge.
  if (inp.milestones.merged.length > 0) {
    for (const d of inp.drafters) {
      const mine = inp.picks.filter((p) => p.drafterId === d.id).map((p) => p.contestantSlug);
      if (mine.length > 0 && mine.every((s) => inp.milestones.merged.includes(s))) give(d.id, { id: "merge-machine", emoji: "🤝", name: "Merge Machine", rule: "Every castaway on the roster made the merge" });
    }
  }

  // Leftover Luck — the leftover pick outscores one of the drafter's first N picks.
  const leftover = inp.picks.find((p) => p.leftover);
  if (leftover) {
    const st = inp.standings.find((s) => s.drafterId === leftover.drafterId);
    if (st && st.counted.includes(leftover.contestantSlug) && st.dropped) {
      give(leftover.drafterId, { id: "leftover-luck", emoji: "🎟️", name: "Leftover Luck", rule: "The leftover pick is outscoring one of the drafted four", detail: `${name(leftover.contestantSlug)} counts; ${name(st.dropped)} is dropped` });
    }
  }

  // Comeback / Wire-to-Wire — from the history of ranks.
  if (inp.history.length > 2) {
    const rankAt = (h: HistoryPoint) => {
      const sorted = [...inp.drafters].sort((a, b) => (h.totals[b.id] ?? 0) - (h.totals[a.id] ?? 0));
      const r = new Map<string, number>();
      sorted.forEach((d, i) => r.set(d.id, i > 0 && h.totals[sorted[i - 1]!.id] === h.totals[d.id] ? r.get(sorted[i - 1]!.id)! : i + 1));
      return r;
    };
    const ranks = inp.history.slice(1).map(rankAt);
    const last = ranks[ranks.length - 1]!;
    for (const d of inp.drafters) {
      const mine = ranks.map((r) => r.get(d.id) ?? 1);
      const wasLast = mine.some((r) => r === inp.drafters.length);
      if (wasLast && last.get(d.id) === 1) give(d.id, { id: "comeback", emoji: "📈", name: "Comeback", rule: "Went from last place to first" });
      if (ranks.length >= 4 && mine.every((r) => r === 1)) give(d.id, { id: "wire-to-wire", emoji: "🏁", name: "Wire-to-Wire", rule: "Led (or co-led) after every single elimination" });
    }
  }

  // Kingmaker — drafted the Sole Survivor.
  if (inp.milestones.winner) {
    const d = drafterOf(inp.milestones.winner);
    if (d) give(d, { id: "kingmaker", emoji: "👑", name: "Kingmaker", rule: "Drafted the Sole Survivor", detail: name(inp.milestones.winner) });
  }

  // Jury Duty — most jury members (ties: all, min 2).
  const jury = new Map<string, number>();
  for (const e of elims) {
    if (!e.juryMember) continue;
    const d = drafterOf(e.contestantSlug);
    if (d) jury.set(d, (jury.get(d) ?? 0) + 1);
  }
  const maxJury = Math.max(0, ...jury.values());
  if (maxJury >= 2) for (const [d, n] of jury) if (n === maxJury) give(d, { id: "jury-duty", emoji: "⚖️", name: "Jury Duty", rule: "Most castaways sitting on the jury", detail: `${n} jurors` });

  // Immunity Hoarder — most individual immunity wins on the roster (min 2).
  const imm = new Map<string, number>();
  for (const [slug, n] of Object.entries(inp.immunityWins)) {
    const d = drafterOf(slug);
    if (d && n > 0) imm.set(d, (imm.get(d) ?? 0) + n);
  }
  const maxImm = Math.max(0, ...imm.values());
  if (maxImm >= 2) for (const [d, n] of imm) if (n === maxImm) give(d, { id: "immunity-hoarder", emoji: "🏆", name: "Immunity Hoarder", rule: "Most individual immunity wins across the roster", detail: `${n} necklaces` });

  // Idol Whisperer — most idols/advantages found across the roster (min 2).
  const adv = new Map<string, number>();
  for (const [slug, n] of Object.entries(inp.advantagesFound ?? {})) {
    const d = drafterOf(slug);
    if (d && n > 0) adv.set(d, (adv.get(d) ?? 0) + n);
  }
  const maxAdv = Math.max(0, ...adv.values());
  if (maxAdv >= 2) for (const [d, n] of adv) if (n === maxAdv) give(d, { id: "idol-whisperer", emoji: "🗿", name: "Idol Whisperer", rule: "Most idols and advantages found across the roster", detail: `${n} found` });

  return out;
}

// ---------------- What-if (browser) ----------------

export interface WhatIfInput {
  base: ScoreInput;
  drafters: Drafter[];
  picks: DraftPick[];
  handicap: HandicapConfig;
  /** Extra boots in order. */
  boots: string[];
  /** Treat the merge as reached (everyone still in gets the merge bonus). */
  mergeNow?: boolean;
  winner?: string;
}

export function simulate(inp: WhatIfInput): DrafterStanding[] {
  const gone = new Set(inp.base.eliminations.map((e) => e.contestantSlug));
  const next = inp.base.eliminations.length + 1;
  const extra: Elimination[] = inp.boots.filter((s) => !gone.has(s)).map((s, i) => ({ order: next + i, contestantSlug: s, kind: "voted-out", episode: 99 }));
  const allGone = new Set([...gone, ...extra.map((e) => e.contestantSlug)]);
  let milestones = inp.base.milestones;
  if (inp.mergeNow && milestones.merged.length === 0) {
    milestones = { ...milestones, merged: inp.base.contestantSlugs.filter((s) => !allGone.has(s)), mergeEpisode: 99 };
  }
  if (inp.winner && !allGone.has(inp.winner)) {
    milestones = { ...milestones, winner: inp.winner, finalists: [...new Set([...milestones.finalists, inp.winner])] };
  }
  const pts = scoreContestants({ ...inp.base, eliminations: [...inp.base.eliminations, ...extra], milestones });
  return computeStandings({ drafters: inp.drafters, picks: inp.picks, points: pts, eliminated: allGone, handicap: inp.handicap });
}
