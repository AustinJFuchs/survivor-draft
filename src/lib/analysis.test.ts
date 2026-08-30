import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBadges, computeGrades, computePaths, computeProjection, gradeFromGap, simulate, weekSummaries } from "./analysis";
import { computeHistory, computeStandings, scoreContestants } from "./scoring";
import type { DraftPick, Elimination, Milestones, ScoringConfig } from "./types";

const scoring: ScoringConfig = { perEliminationSurvived: 1, merge: 3, finalTribal: 5, winner: 10 };
const handicap = { countBest: 2 };
const slugs = ["a", "b", "c", "d", "e", "f"];
const drafters = [
  { id: "x", name: "X", draftPosition: 1 },
  { id: "y", name: "Y", draftPosition: 2 },
];
const picks: DraftPick[] = [
  { round: 1, overall: 1, drafterId: "x", contestantSlug: "a" },
  { round: 1, overall: 2, drafterId: "y", contestantSlug: "b" },
  { round: 2, overall: 3, drafterId: "y", contestantSlug: "c" },
  { round: 2, overall: 4, drafterId: "x", contestantSlug: "d" },
  { round: 3, overall: 5, drafterId: "x", contestantSlug: "e", leftover: true },
  { round: 3, overall: 6, drafterId: "y", contestantSlug: "f" },
];

test("grades: beating the slot earns A, missing it earns F", () => {
  assert.equal(gradeFromGap(-10, 21), "A");
  assert.equal(gradeFromGap(0, 21), "C");
  assert.equal(gradeFromGap(12, 21), "F");
  const rank = new Map([["a", 6], ["d", 1], ["e", 3]]);
  const g = computeGrades(picks.filter((p) => p.drafterId === "x"), rank, 6);
  assert.equal(g.grades.length, 3);
  assert.equal(g.steal?.contestantSlug, "d");
  assert.equal(g.reach?.contestantSlug, "a");
  assert.ok(g.gpa !== undefined && g.gpa > 0);
});

test("simulate: extra boots and merge/winner toggles re-rank", () => {
  const elims: Elimination[] = [{ order: 1, contestantSlug: "f", kind: "voted-out", episode: 1 }];
  const ms: Milestones = { merged: [], finalists: [], placements: {} };
  const base = { contestantSlugs: slugs, eliminations: elims, milestones: ms, scoring };
  const rows = simulate({ base, drafters, picks, handicap, boots: ["a", "d"], mergeNow: true, winner: "c" });
  const y = rows.find((r) => r.drafterId === "y")!;
  const x = rows.find((r) => r.drafterId === "x")!;
  assert.equal(y.rank, 1);
  assert.ok(y.total > x.total);
  // c survives 3 boots (+3), merge +3, FTC +5, winner +10 = 21; b: 3 + 3 = 6 → y counted best-2 = 27
  assert.equal(y.total, 27);
});

test("paths: activates post-merge and finds clinches", () => {
  // After merge with 4 remaining: b, c (y's) and d, e (x's); a, f gone.
  const elims: Elimination[] = [
    { order: 1, contestantSlug: "a", kind: "voted-out", episode: 1 },
    { order: 2, contestantSlug: "f", kind: "voted-out", episode: 2 },
  ];
  const ms: Milestones = { merged: ["b", "c", "d", "e"], mergeEpisode: 2, finalists: [], placements: {} };
  const paths = computePaths({ drafters, picks, contestantSlugs: slugs, eliminations: elims, milestones: ms, scoring, handicap });
  assert.equal(paths["x"]!.active, true);
  assert.equal(paths["x"]!.scenarios, 12); // C(4,3) * 3
  // Symmetric setup: each side's castaways winning should favour that side.
  assert.ok(paths["y"]!.wins > 0 && paths["x"]!.wins > 0);
  assert.ok(paths["y"]!.clinch.includes("b") || paths["y"]!.live.includes("b"));
  // Pre-merge: inactive.
  const pre = computePaths({ drafters, picks, contestantSlugs: slugs, eliminations: elims, milestones: { merged: [], finalists: [], placements: {} }, scoring, handicap });
  assert.equal(pre["x"]!.active, false);
});

test("projection: alive when best case reaches the leader", () => {
  const elims: Elimination[] = [
    { order: 1, contestantSlug: "a", kind: "voted-out", episode: 1 },
    { order: 2, contestantSlug: "d", kind: "voted-out", episode: 1 },
    { order: 3, contestantSlug: "e", kind: "voted-out", episode: 2 },
  ];
  const ms: Milestones = { merged: [], finalists: [], placements: {} };
  const points = scoreContestants({ contestantSlugs: slugs, eliminations: elims, milestones: ms, scoring });
  const standings = computeStandings({ drafters, picks, points, eliminated: new Set(["a", "d", "e"]), handicap });
  const px = computeProjection({ drafterId: "x", picks, standings, eliminations: elims, milestones: ms, totalContestants: 6, scoring, handicap, points });
  const py = computeProjection({ drafterId: "y", picks, standings, eliminations: elims, milestones: ms, totalContestants: 6, scoring, handicap, points });
  assert.equal(px.alive, false); // x has nobody left
  assert.equal(px.onTable, 0);
  assert.equal(py.alive, true);
  assert.ok(py.onTable > 0);
});

test("badges: first blood, torch collector, kingmaker; week summaries", () => {
  const elims: Elimination[] = [
    { order: 1, contestantSlug: "a", kind: "voted-out", episode: 1 },
    { order: 2, contestantSlug: "d", kind: "voted-out", episode: 2 },
    { order: 3, contestantSlug: "b", kind: "voted-out", episode: 3, juryMember: true },
  ];
  const ms: Milestones = { merged: ["b", "c", "e", "f"], mergeEpisode: 3, finalists: ["c", "e", "f"], winner: "c", placements: {} };
  const scoreInput = { contestantSlugs: slugs, eliminations: elims, milestones: ms, scoring };
  const points = scoreContestants(scoreInput);
  const standings = computeStandings({ drafters, picks, points, eliminated: new Set(["a", "d", "b"]), handicap });
  const history = computeHistory(scoreInput, { drafters, picks, handicap });
  const badges = computeBadges({ drafters, picks, standings, history, eliminations: elims, milestones: ms, immunityWins: { c: 2 }, contestantName: (s) => s.toUpperCase() });
  const ids = (d: string) => badges[d]!.map((b) => b.id);
  assert.ok(ids("x").includes("first-blood"));
  assert.ok(ids("x").includes("torch-collector"));
  assert.ok(ids("y").includes("kingmaker"));
  assert.ok(ids("y").includes("immunity-hoarder"));
  assert.ok(ids("x").includes("leftover-luck")); // e (leftover) counts, d dropped
  const weeks = weekSummaries(history, "y");
  assert.equal(weeks.length, 3);
  assert.equal(weeks[0]!.episode, 1);
});
