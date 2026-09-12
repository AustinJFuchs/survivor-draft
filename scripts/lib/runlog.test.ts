import { strict as assert } from "node:assert";
import { test } from "node:test";
import { collectFacts, describeChange, type Reader, type RunFacts } from "./runlog";

// A tiny two-drafter season, enough to exercise scoring-driven consequences.
const SEASON = {
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
};

const CONTESTANTS = [
  { slug: "ana", name: "Ana Sani", shortName: "Ana", age: 30, hometown: "h", occupation: "o" },
  { slug: "bo", name: "Bo Booker", shortName: "Bo", age: 31, hometown: "h", occupation: "o" },
  { slug: "cy", name: "Cy Chavez", shortName: "Cy", age: 32, hometown: "h", occupation: "o" },
  { slug: "di", name: "Di Doore", shortName: "Di", age: 33, hometown: "h", occupation: "o" },
];

const DRAFT = {
  seasonId: "51",
  style: "snake",
  picks: [
    { round: 1, overall: 1, drafterId: "tami", contestantSlug: "ana" },
    { round: 1, overall: 2, drafterId: "austin", contestantSlug: "bo" },
    { round: 2, overall: 3, drafterId: "austin", contestantSlug: "cy" },
    { round: 2, overall: 4, drafterId: "tami", contestantSlug: "di" },
  ],
};

interface Files {
  scraped?: unknown;
  overrides?: unknown;
  profiles?: unknown;
  teams?: unknown;
  rundowns?: unknown;
  events?: unknown;
  commentary?: Record<string, unknown>;
}

/** Build a Reader over an in-memory season directory. */
function reader(files: Files): Reader {
  const base: Record<string, unknown> = {
    "season.json": SEASON,
    "contestants.json": CONTESTANTS,
    "draft.json": DRAFT,
    "scraped.json": files.scraped ?? { syncedAt: "x", sources: {}, tribes: {}, episodes: [], eliminations: [], milestones: { merged: [], finalists: [], placements: {} }, extras: {}, warnings: [] },
    "overrides.json": files.overrides ?? {},
  };
  for (const [k, v] of [["profiles.json", files.profiles], ["teams.json", files.teams], ["rundowns.json", files.rundowns], ["events.json", files.events]] as const) {
    if (v !== undefined) base[k] = v;
  }
  const commentary = files.commentary ?? {};
  return {
    read: (rel) => {
      if (rel.startsWith("commentary/")) {
        const c = commentary[rel.slice("commentary/".length)];
        return c === undefined ? undefined : JSON.stringify(c);
      }
      return rel in base ? JSON.stringify(base[rel]) : undefined;
    },
    list: (rel) => (rel === "commentary" ? Object.keys(commentary) : Object.keys(base)),
  };
}

const facts = (files: Files = {}): RunFacts => collectFacts(reader(files));

const scraped = (over: Record<string, unknown>) => ({
  syncedAt: "whenever",
  sources: {},
  tribes: {},
  episodes: [],
  eliminations: [],
  milestones: { merged: [], finalists: [], placements: {} },
  extras: {},
  warnings: [],
  ...over,
});

test("no prev state reads as the site going live", () => {
  const c = describeChange(undefined, facts());
  assert.equal(c.changed, true);
  assert.match(c.summary, /^The site went live — 4 castaways/);
});

test("identical data twice is not a change", () => {
  const c = describeChange(facts(), facts());
  assert.equal(c.changed, false);
  assert.equal(c.summary, "");
  assert.deepEqual(c.details, []);
});

test("a re-scrape that only moves timestamps is not a change", () => {
  // The real failure mode: scrape.ts stamps syncedAt every run, so a naive
  // file-level diff would report news every single morning.
  const before = facts({ scraped: scraped({ syncedAt: "2026-09-01T00:00:00Z" }) });
  const after = facts({ scraped: scraped({ syncedAt: "2026-09-02T00:00:00Z" }) });
  assert.equal(describeChange(before, after).changed, false);
});

test("regenerated text that came out identical is not a change", () => {
  const p = { ana: { slug: "ana", summary: "Same words.", bullets: ["a"], generatedAt: "2026-09-01T00:00:00Z", model: "m", sourceHash: "h1" } };
  const before = facts({ profiles: p });
  const after = facts({ profiles: { ana: { ...p.ana, generatedAt: "2026-09-03T00:00:00Z", sourceHash: "h2" } } });
  assert.equal(describeChange(before, after).changed, false);
});

test("boots are named, and the standings consequence follows", () => {
  const before = facts();
  const after = facts({
    scraped: scraped({
      eliminations: [{ order: 1, contestantSlug: "ana", episode: 3, kind: "voted-out" }],
      episodes: [{ number: 3, title: "Blindside" }],
    }),
  });
  const c = describeChange(before, after);
  assert.equal(c.changed, true);
  assert.match(c.summary, /Ep 3 aired and Ana was voted out/);
  // Tami loses Ana; Austin's two survivors each bank a point and he takes over.
  assert.match(c.summary, /Austin took the lead/);
  assert.equal(c.episode, 3);
  assert.ok(c.details.some((d) => d.includes("Ana voted out in Ep 3")));
});

test("an evacuation is not described as a vote", () => {
  const c = describeChange(facts(), facts({ scraped: scraped({ eliminations: [{ order: 1, contestantSlug: "bo", episode: 2, kind: "medevac" }] }) }));
  assert.match(c.summary, /Bo was evacuated/);
});

test("the merge and the winner each get said out loud", () => {
  const merged = facts({ scraped: scraped({ milestones: { merged: ["ana", "bo", "cy"], mergeEpisode: 5, finalists: [], placements: {} } }) });
  assert.match(describeChange(facts(), merged).summary, /merge landed in Ep 5 with 3 castaways across/);

  const won = facts({ scraped: scraped({ milestones: { merged: [], finalists: [], placements: {}, winner: "cy" } }) });
  assert.match(describeChange(facts(), won).summary, /Cy won Survivor 51/);
});

test("a file appearing for the first time reads as a feature landing, not as data", () => {
  const after = facts({ teams: { tami: { drafterId: "tami", nickname: "N", summary: "s", bullets: [], generatedAt: "g", model: "m", sourceHash: "h" } } });
  const c = describeChange(facts(), after);
  assert.match(c.summary, /team summaries arrived/i);
  // The phrase that would otherwise repeat it is suppressed from the summary...
  assert.doesNotMatch(c.summary, /refreshed/);
  // ...but the receipt is still in the details.
  assert.ok(c.details.some((d) => d.includes("Team summary refreshed for Tami")));
});

test("regenerating an existing file is ordinary news, not a landing", () => {
  const one = { tami: { drafterId: "tami", nickname: "N", summary: "first", bullets: [], generatedAt: "g", model: "m", sourceHash: "h" } };
  const c = describeChange(facts({ teams: one }), facts({ teams: { tami: { ...one.tami, summary: "second" } } }));
  assert.match(c.summary, /team summary refreshed/i);
  assert.doesNotMatch(c.summary, /arrived/);
});

test("a raised warning outranks everything else in the second sentence", () => {
  const before = facts({ events: { syncedAt: "a", events: [], warnings: [] } });
  const after = facts({
    scraped: scraped({ extras: { ana: { birthdate: "1990-01-01" } } }),
    events: { syncedAt: "b", events: [], warnings: ["ANTHROPIC_API_KEY not set — skipped Claude extraction of Open Era twists"] },
  });
  const c = describeChange(before, after);
  assert.equal(c.trouble, true);
  assert.match(c.summary, /⚠ Claude was unreachable, so extraction of Open Era twists was skipped\./);
  // Not "Claude was unreachable, so Claude extraction..." — the name isn't said twice.
  assert.doesNotMatch(c.summary, /so Claude/);
});

test("a warning clearing is worth a row on its own", () => {
  const warn = { syncedAt: "a", events: [], warnings: ["ANTHROPIC_API_KEY not set — skipped Claude extraction of Open Era twists"] };
  const c = describeChange(facts({ events: warn }), facts({ events: { ...warn, warnings: [] } }));
  assert.equal(c.changed, true);
  assert.equal(c.trouble, false);
  assert.match(c.summary, /Claude is working again\./);
});

test("the draft being entered is one line, not twenty-one", () => {
  const empty = { ...DRAFT, picks: DRAFT.picks.map((p) => ({ ...p, contestantSlug: "" })) };
  const before = collectFacts({
    read: (rel) => (rel === "draft.json" ? JSON.stringify(empty) : reader({}).read(rel)),
    list: (rel) => reader({}).list(rel),
  });
  const c = describeChange(before, facts());
  assert.match(c.summary, /The draft was entered — all 4 picks\./);
  assert.equal(c.details.length, 1);
});

test("hand edits to overrides are reported as hand edits", () => {
  const c = describeChange(facts(), facts({ overrides: { notes: ["a house rule"], quotes: [{ id: "q", drafterId: "tami", text: "t" }] } }));
  assert.match(c.summary, /1 house note added and 1 group-chat quote added\./);
});

test("summaries stay to two sentences however much happened at once", () => {
  const before = facts();
  const after = facts({
    scraped: scraped({
      eliminations: [{ order: 1, contestantSlug: "ana", episode: 3, kind: "voted-out" }],
      episodes: [{ number: 3, title: "Blindside", airDate: "2026-10-07" }],
      tribes: { ana: { current: "Savu", history: ["Savu"] } },
      extras: { bo: { birthdate: "1990-01-01" } },
    }),
    profiles: { bo: { slug: "bo", summary: "s", bullets: [], generatedAt: "g", model: "m", sourceHash: "h" } },
    overrides: { notes: ["n"] },
  });
  const c = describeChange(before, after);
  assert.ok(c.summary.split(/(?<=\.)\s+/).length <= 2, `too many sentences: ${c.summary}`);
  // Everything still shows up in the details even when the summary can't hold it.
  assert.ok(c.details.length > 4);
});

test("an empty commentary directory is not a feature landing", () => {
  // The directory exists on disk but never in a commit, so keying the landing off
  // the directory made the first local run invent "Jeff's episode recaps arrived".
  assert.equal(describeChange(facts({ commentary: {} }), facts({ commentary: {} })).changed, false);
  assert.equal(describeChange(facts(), facts({ commentary: {} })).changed, false);
});

test("the first recap file is the landing, and later ones are ordinary news", () => {
  const ep = (n: number, recap: string) => ({ [`ep-${n}.json`]: { episode: n, generatedAt: "g", model: "m", recap, bullets: [], draftImpact: "d", sources: [] } });
  const landing = describeChange(facts({ commentary: {} }), facts({ commentary: ep(1, "Twenty-one castaways.") }));
  assert.match(landing.summary, /Jeff's episode recaps arrived/);

  const later = describeChange(facts({ commentary: ep(1, "Twenty-one castaways.") }), facts({ commentary: { ...ep(1, "Twenty-one castaways."), ...ep(2, "Tonight, a blindside.") } }));
  assert.match(later.summary, /Jeff recapped Ep 2/);
  assert.doesNotMatch(later.summary, /arrived/);
});
