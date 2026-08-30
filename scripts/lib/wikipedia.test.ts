import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseContestantTable, parseEpisodeList, parsePlacement, parseSeasonSummary, parseVotingHistory } from "./wikipedia";
import { parseContestantPage } from "./fandom";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, "..", "fixtures", name), "utf8");

test("S49 contestant table: order, tribes, placements", () => {
  const rows = parseContestantTable(fixture("wikipedia-survivor-49.wikitext"));
  assert.equal(rows.length, 18);
  assert.equal(rows[0]!.name, "Nicole Mazullo");
  assert.equal(rows[0]!.tribes.original, "Kele");
  assert.equal(rows[0]!.placementText, "1st voted out");
  assert.equal(rows[0]!.day, 3);
  // rowspan propagation: Annie shares Nicole's original tribe cell
  assert.equal(rows[1]!.tribes.original, "Kele");
  assert.equal(rows[2]!.placementText, "Medically evacuated");
  const merged = rows.filter((r) => r.tribes.merged);
  assert.equal(merged.length, 11);
  assert.equal(merged[0]!.name, "Nate Moore");
  const last = rows[rows.length - 1]!;
  assert.equal(last.name, "Savannah Louie");
  assert.equal(last.placementText, "Sole Survivor");
  assert.equal(last.tribes.original, "Uli");
  assert.equal(last.day, 26);
  // Kristina's original tribe comes from Sophie's rowspan=3 cell
  const kristina = rows.find((r) => r.name === "Kristina Mills")!;
  assert.equal(kristina.tribes.original, "Hina");
  assert.deepEqual(kristina.tribes.switches, ["Kele", "Uli"]);
  assert.equal(kristina.tribes.merged, "Lewatu");
});

test("S51 pre-season table: names present, tribes hidden (void) are not leaked", () => {
  const rows = parseContestantTable(fixture("wikipedia-survivor-51.wikitext"));
  assert.equal(rows.length, 21);
  for (const r of rows) {
    assert.equal(r.tribes.original, undefined, `${r.name} should have no visible tribe`);
    assert.equal(r.placementText, undefined);
  }
  assert.ok(rows.some((r) => r.name === 'Angelica "Jelly" Loblack'));
});

test("placement parsing", () => {
  assert.deepEqual(parsePlacement("7th voted out 1st jury member"), { eliminated: true, kind: "voted-out", finalist: false, winner: false, juryMember: true });
  assert.equal(parsePlacement("Runner-up").finalRank, 2);
  assert.equal(parsePlacement("2nd runner-up").finalRank, 3);
  assert.equal(parsePlacement("Sole Survivor").winner, true);
  assert.equal(parsePlacement("Eliminated 8th jury member").kind, "fire");
  assert.equal(parsePlacement("").eliminated, false);
});

test("S49 voting history: eliminated to episode", () => {
  const vh = parseVotingHistory(fixture("wikipedia-survivor-49.wikitext"));
  const byName = new Map(vh.columns.map((c) => [c.eliminated, c]));
  assert.equal(byName.get("Nicole")?.episode, 1);
  assert.equal(byName.get("Jake")?.episode, 3);
  assert.equal(byName.get("Jeremiah")?.episode, 3);
  assert.equal(byName.get("Jawan")?.episode, 10);
  assert.equal(byName.get("Rizo")?.episode, 13);
  assert.equal(byName.get("Rizo")?.day, 25);
  assert.equal(vh.mergedTribe, "Lewatu");
});

test("S51 voting history: empty columns, no eliminations", () => {
  const vh = parseVotingHistory(fixture("wikipedia-survivor-51.wikitext"));
  assert.ok(vh.columns.length >= 13);
  assert.ok(vh.columns.every((c) => !c.eliminated));
});

test("episode list", () => {
  const eps = parseEpisodeList(fixture("wikipedia-survivor-51.wikitext"));
  assert.equal(eps.length, 1);
  assert.equal(eps[0]!.number, 1);
  assert.equal(eps[0]!.title, "Permanent Uncertainty");
  assert.equal(eps[0]!.airDate, "2026-09-23");
  const eps49 = parseEpisodeList(fixture("wikipedia-survivor-49.wikitext"));
  assert.ok(eps49.length >= 13);
  assert.ok(eps49[0]!.synopsis && eps49[0]!.synopsis.length > 50);
});

test("season summary immunity/reward (display only)", () => {
  const rows = parseSeasonSummary(fixture("wikipedia-survivor-49.wikitext"));
  const ep7 = rows.find((r) => r.episode === 7)!;
  assert.equal(ep7.immunity, "Sophie");
  assert.deepEqual(ep7.eliminated, ["Nate"]);
  const ep1 = rows.find((r) => r.episode === 1)!;
  assert.equal(ep1.immunity, "Hina; Uli");
  assert.equal(ep1.reward, "Hina; Uli");
  assert.deepEqual(ep1.eliminated, ["Nicole"]);
  const ep3 = rows.find((r) => r.episode === 3)!;
  assert.deepEqual(ep3.eliminated, ["Jake", "Jeremiah"]);
});

test("fandom contestant page extras", () => {
  const x = parseContestantPage(fixture("fandom-savannah-louie.wikitext"));
  assert.equal(x.challengeWins, 12);
  assert.equal(x.votesAgainst, 4);
  assert.equal(x.daysLasted, "26/26");
  assert.deepEqual(x.threeWords, ["adventurous", "no-nonsense", "curious"]);
  assert.ok(x.bio && x.bio.startsWith("Savannah Katlyn Louie is the Sole Survivor"));
  assert.ok(x.trivia && x.trivia.length >= 3);
  assert.ok(x.trivia![0]!.includes("applying for the show"));
});
