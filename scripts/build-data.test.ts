import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildSeasonData, type BuildInputs } from "./build-data";

// A tiny two-drafter season with one elimination, enough to build every view.
function inputs(overrides: Partial<BuildInputs> = {}): BuildInputs {
  return {
    season: {
      id: "51",
      name: "Survivor 51",
      premiereDate: "2026-09-23",
      timezone: "America/New_York",
      totalContestants: 4,
      drafters: [
        { id: "tami", name: "Tami", draftPosition: 1 },
        { id: "austin", name: "Austin", draftPosition: 2 },
      ],
      scoring: { perEliminationSurvived: 1, merge: 3, finalTribal: 5, winner: 10 },
      handicap: { countBest: 2 },
      prize: { title: "Prize", description: "d", validUntil: "v" },
    },
    contestants: [
      { slug: "ana", name: "Ana Sani", shortName: "Ana", age: 30, hometown: "h", occupation: "o" },
      { slug: "bo", name: "Bo Booker", shortName: "Bo", age: 31, hometown: "h", occupation: "o" },
      { slug: "cy", name: "Cy Chavez", shortName: "Cy", age: 32, hometown: "h", occupation: "o" },
      { slug: "di", name: "Di Doore", shortName: "Di", age: 33, hometown: "h", occupation: "o" },
    ],
    draft: {
      seasonId: "51",
      style: "snake",
      picks: [
        { round: 1, overall: 1, drafterId: "tami", contestantSlug: "ana" },
        { round: 1, overall: 2, drafterId: "austin", contestantSlug: "bo" },
        { round: 2, overall: 3, drafterId: "austin", contestantSlug: "cy" },
        { round: 2, overall: 4, drafterId: "tami", contestantSlug: "di" },
      ],
    },
    scraped: {
      syncedAt: "2026-10-22T08:25:00.000Z",
      sources: {},
      tribes: {},
      episodes: [{ number: 1, title: "One" }],
      eliminations: [{ order: 1, contestantSlug: "di", episode: 1, kind: "voted-out" }],
      milestones: { finalists: [], placements: {} },
      extras: {},
      warnings: [],
    },
    overrides: {},
    commentary: [],
    profiles: {},
    teams: {},
    rundowns: {},
    events: [],
    runLog: { entries: [], quietChecks: 0 },
    ...overrides,
  } as BuildInputs;
}

test("an advantage played on someone names the target in the ledger", () => {
  // Survivor 51 Ep 5: the first targeted event crashed the build (the label
  // looked the target up in the contestants view while it was being built).
  const data = buildSeasonData(
    inputs({
      events: [
        {
          id: "extra-vote-ana-advantage-played-1",
          type: "advantage-played",
          contestant: "Ana Sani",
          contestantSlug: "ana",
          episode: 1,
          advantage: "Extra Vote",
          outcome: "success",
          target: "Di Doore",
          targetSlug: "di",
          source: { page: "Extra Vote", url: "https://survivor.fandom.com/wiki/Extra_Vote" },
          extracted: "table",
        },
      ],
    }),
  );
  const ana = data.contestants.find((c) => c.slug === "ana")!;
  assert.deepEqual(ana.ledger.find((r) => r.episode === 1)?.events, ["played Extra Vote on Di"]);
});
