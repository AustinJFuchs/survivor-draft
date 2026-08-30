import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHistory, computeStandings, scoreContestants } from "./scoring";
import type { Elimination, Milestones, ScoringConfig } from "./types";

const scoring: ScoringConfig = { perEliminationSurvived: 1, merge: 3, finalTribal: 5, winner: 10 };
const slugs = ["a", "b", "c", "d", "e", "f"];
const drafters = [
  { id: "x", name: "X", draftPosition: 1 },
  { id: "y", name: "Y", draftPosition: 2 },
];
// X holds a, b, c (3 contestants; handicap countBest=2 drops the lowest). Y holds d, e, f... wait, keep Y at 2.
const picks = [
  { round: 1, overall: 1, drafterId: "x", contestantSlug: "a" },
  { round: 1, overall: 2, drafterId: "y", contestantSlug: "d" },
  { round: 2, overall: 3, drafterId: "y", contestantSlug: "e" },
  { round: 2, overall: 4, drafterId: "x", contestantSlug: "b" },
  { round: 3, overall: 5, drafterId: "x", contestantSlug: "c", leftover: true },
];

test("survival points accrue per elimination event; eliminated player gets none for their own boot", () => {
  const elims: Elimination[] = [
    { order: 1, contestantSlug: "a", kind: "voted-out", episode: 1 },
    { order: 2, contestantSlug: "d", kind: "voted-out", episode: 2 },
  ];
  const ms: Milestones = { merged: [], finalists: [], placements: {} };
  const pts = scoreContestants({ contestantSlugs: slugs, eliminations: elims, milestones: ms, scoring });
  assert.equal(pts["a"]!.total, 0);
  assert.equal(pts["d"]!.total, 1);
  assert.equal(pts["b"]!.total, 2);
});

test("merge bonus applies only after the merge episode is reached", () => {
  const elims: Elimination[] = [
    { order: 1, contestantSlug: "a", kind: "voted-out", episode: 1 },
    { order: 2, contestantSlug: "b", kind: "voted-out", episode: 3 },
  ];
  const ms: Milestones = { merged: ["c", "d", "e", "f"], mergeEpisode: 3, finalists: [], placements: {} };
  const before = scoreContestants({ contestantSlugs: slugs, eliminations: elims, milestones: ms, scoring }, 1);
  assert.equal(before["c"]!.merge, 0);
  const after = scoreContestants({ contestantSlugs: slugs, eliminations: elims, milestones: ms, scoring });
  assert.equal(after["c"]!.merge, 3);
  assert.equal(after["c"]!.total, 5);
});

test("finalist and winner bonuses", () => {
  const elims: Elimination[] = slugs.slice(0, 3).map((s, i) => ({ order: i + 1, contestantSlug: s, kind: "voted-out" as const, episode: i + 1 }));
  const ms: Milestones = { merged: slugs, mergeEpisode: 1, finalists: ["d", "e", "f"], winner: "f", placements: {} };
  const pts = scoreContestants({ contestantSlugs: slugs, eliminations: elims, milestones: ms, scoring });
  assert.equal(pts["f"]!.total, 3 + 3 + 5 + 10);
  assert.equal(pts["d"]!.total, 3 + 3 + 5);
});

test("handicap: best N counted, ties share rank, remaining counted", () => {
  const points = {
    a: { survival: 5, merge: 0, finalTribal: 0, winner: 0, total: 5 },
    b: { survival: 2, merge: 0, finalTribal: 0, winner: 0, total: 2 },
    c: { survival: 1, merge: 0, finalTribal: 0, winner: 0, total: 1 },
    d: { survival: 4, merge: 0, finalTribal: 0, winner: 0, total: 4 },
    e: { survival: 3, merge: 0, finalTribal: 0, winner: 0, total: 3 },
    f: { survival: 0, merge: 0, finalTribal: 0, winner: 0, total: 0 },
  };
  const rows = computeStandings({ drafters, picks, points, eliminated: new Set(["c", "f"]), handicap: { countBest: 2 } });
  const x = rows.find((r) => r.drafterId === "x")!;
  const y = rows.find((r) => r.drafterId === "y")!;
  assert.equal(x.rawTotal, 8);
  assert.equal(x.total, 7);
  assert.equal(x.dropped, "c");
  assert.equal(x.remaining, 2);
  assert.equal(y.total, 7);
  assert.equal(y.dropped, undefined);
  assert.equal(x.rank, 1);
  assert.equal(y.rank, 1);
  assert.equal(x.tied, true);
});

test("history has one point per elimination plus start", () => {
  const elims: Elimination[] = [
    { order: 1, contestantSlug: "a", kind: "voted-out", episode: 1 },
    { order: 2, contestantSlug: "d", kind: "voted-out", episode: 2 },
  ];
  const ms: Milestones = { merged: [], finalists: [], placements: {} };
  const h = computeHistory({ contestantSlugs: slugs, eliminations: elims, milestones: ms, scoring }, { drafters, picks, handicap: { countBest: 2 } });
  assert.equal(h.length, 3);
  assert.deepEqual(h[0]!.totals, { x: 0, y: 0 });
  // After boot 1 (a out): b=1,c=1 → x best2 = 2; d=1,e=1 → y = 2
  assert.deepEqual(h[1]!.totals, { x: 2, y: 2 });
  // After boot 2 (d out): b=2,c=2 → x=4; d=1,e=2 → y=3
  assert.deepEqual(h[2]!.totals, { x: 4, y: 3 });
});
