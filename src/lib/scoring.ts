// Pure scoring engine. No I/O. Used by build-data.ts and by the app for
// "what-if" recomputation. Every rule from the design doc lives here:
//
//   - 1 pt (config) to every contestant still in the game per elimination event
//   - +merge / +finalTribal / +winner bonuses
//   - a drafter with more contestants than handicap.countBest counts only their
//     best N (Tami's best-4-of-5)
//   - ties share a rank; "remaining" is a visible secondary stat, not a tiebreak

import type {
  ContestantPoints,
  DraftPick,
  DrafterStanding,
  Elimination,
  HistoryPoint,
  Milestones,
  ScoringConfig,
  HandicapConfig,
  Drafter,
} from "./types";

export interface ScoreInput {
  contestantSlugs: string[];
  eliminations: Elimination[]; // any order; sorted by `order` internally
  milestones: Milestones;
  scoring: ScoringConfig;
}

export function sortEliminations(e: Elimination[]): Elimination[] {
  return [...e].sort((a, b) => a.order - b.order);
}

/**
 * Points per contestant after `upTo` elimination events (default: all).
 * Milestone bonuses are only applied when all eliminations are counted,
 * except merge, which applies once the merge has happened in the sequence.
 */
export function scoreContestants(
  input: ScoreInput,
  upTo?: number,
): Record<string, ContestantPoints> {
  const elims = sortEliminations(input.eliminations);
  const limit = upTo ?? elims.length;
  const counted = elims.slice(0, limit);
  const isFinal = limit >= elims.length;
  const out: Record<string, ContestantPoints> = {};
  const eliminatedBefore = new Map<string, number>(); // slug → order
  for (const e of counted) eliminatedBefore.set(e.contestantSlug, e.order);

  const mergedSet = new Set(input.milestones.merged);
  const finalistSet = new Set(input.milestones.finalists);

  // Merge happens once the merge episode's first elimination is reached, or —
  // when mergeEpisode is unknown — once every non-merged contestant is gone.
  const mergeReached = mergeHasHappened(counted, input.milestones, mergedSet, input.contestantSlugs);

  for (const slug of input.contestantSlugs) {
    let survival = 0;
    for (const e of counted) {
      const outAt = eliminatedBefore.get(slug);
      const stillIn = outAt === undefined || outAt > e.order;
      if (stillIn) survival += input.scoring.perEliminationSurvived;
    }
    const merge = mergeReached && mergedSet.has(slug) ? input.scoring.merge : 0;
    const finalTribal = isFinal && finalistSet.has(slug) ? input.scoring.finalTribal : 0;
    const winner = isFinal && input.milestones.winner === slug ? input.scoring.winner : 0;
    out[slug] = { survival, merge, finalTribal, winner, total: survival + merge + finalTribal + winner };
  }
  return out;
}

function mergeHasHappened(
  counted: Elimination[],
  milestones: Milestones,
  mergedSet: Set<string>,
  all: string[],
): boolean {
  if (mergedSet.size === 0) return false;
  if (milestones.mergeEpisode !== undefined) {
    return counted.some((e) => e.episode !== undefined && e.episode >= milestones.mergeEpisode!);
  }
  // Fallback: merge has happened when everyone not in the merged set is out.
  const gone = new Set(counted.map((e) => e.contestantSlug));
  return all.every((s) => mergedSet.has(s) || gone.has(s));
}

export interface StandingsInput {
  drafters: Drafter[];
  picks: DraftPick[];
  points: Record<string, ContestantPoints>;
  eliminated: Set<string>;
  handicap: HandicapConfig;
}

export function computeStandings(input: StandingsInput): DrafterStanding[] {
  const rows: DrafterStanding[] = input.drafters.map((d) => {
    const slugs = input.picks.filter((p) => p.drafterId === d.id).map((p) => p.contestantSlug);
    const scored = slugs
      .map((s) => ({ slug: s, total: input.points[s]?.total ?? 0 }))
      .sort((a, b) => b.total - a.total || a.slug.localeCompare(b.slug));
    const rawTotal = scored.reduce((sum, s) => sum + s.total, 0);
    let counted = scored;
    let dropped: string | undefined;
    if (scored.length > input.handicap.countBest) {
      counted = scored.slice(0, input.handicap.countBest);
      const last = scored[scored.length - 1]!;
      const lastCounted = counted[counted.length - 1]!;
      // Only name a dropped contestant when the cut is unambiguous; with a tie
      // at the cut line the total is the same whichever one is excluded.
      if (last.total < lastCounted.total) dropped = last.slug;
    }
    const total = counted.reduce((sum, s) => sum + s.total, 0);
    const remaining = slugs.filter((s) => !input.eliminated.has(s)).length;
    return {
      drafterId: d.id,
      name: d.name,
      rawTotal,
      total,
      counted: counted.map((c) => c.slug),
      dropped,
      remaining,
      rank: 0,
      tied: false,
    };
  });

  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  let rank = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (i === 0 || row.total !== rows[i - 1]!.total) rank = i + 1;
    row.rank = rank;
  }
  for (const row of rows) row.tied = rows.filter((r) => r.total === row.total).length > 1;
  return rows;
}

/** Counted totals per drafter after each elimination event, for the chart. */
export function computeHistory(
  score: ScoreInput,
  standings: Omit<StandingsInput, "points" | "eliminated">,
): HistoryPoint[] {
  const elims = sortEliminations(score.eliminations);
  const points: HistoryPoint[] = [];
  for (let step = 0; step <= elims.length; step++) {
    const pts = scoreContestants(score, step);
    const eliminated = new Set(elims.slice(0, step).map((e) => e.contestantSlug));
    const rows = computeStandings({ ...standings, points: pts, eliminated });
    const totals: Record<string, number> = {};
    for (const r of rows) totals[r.drafterId] = r.total;
    const e = step > 0 ? elims[step - 1] : undefined;
    points.push({
      step,
      label: step === 0 ? "Start" : `#${step}`,
      episode: e?.episode,
      totals,
    });
  }
  return points;
}
