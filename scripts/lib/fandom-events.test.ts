import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { episodeIn, namesIn, parseEventPage } from "./fandom-events";

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => readFileSync(join(here, "..", "fixtures", "fandom-events", `${name}.wikitext`), "utf8");

test("helpers: names and episodes", () => {
  assert.deepEqual(namesIn("[[File:S49 alex t.png|60px|link=Alex Moore]]<br />[[Alex Moore]]"), ["Alex Moore"]);
  assert.deepEqual(namesIn("{{Tribebox-pt|kele|S49 jake t.png|60px|Jake Latimer}}"), ["Jake Latimer"]);
  assert.equal(episodeIn("{{Ep|4903}}", "49"), 3);
  assert.equal(episodeIn("{{Ep|4903}}", "51"), undefined);
});

test("S49 hidden immunity idols: 4 found, plays with outcomes", () => {
  const ev = parseEventPage("Hidden_Immunity_Idol/History", fx("Hidden_Immunity_Idol_History"), "49");
  const found = ev.filter((e) => e.type === "idol-found");
  assert.equal(found.length, 4);
  assert.deepEqual(found.map((e) => e.contestant).sort(), ["Alex Moore", "Kristina Mills", "MC Chukwujekwu", "Rizo Velovic"].sort());
  const alex = found.find((e) => e.contestant === "Alex Moore")!;
  assert.equal(alex.episode, 2);
  assert.equal(alex.day, 5);
  const plays = ev.filter((e) => e.type === "idol-played");
  const alexPlay = plays.find((e) => e.contestant === "Alex Moore")!;
  assert.equal(alexPlay.episode, 3);
  assert.equal(alexPlay.outcome, "fail");
  // Kristina's idol was given to Steven, who played it in episode 10.
  const steven = plays.find((e) => e.contestant === "Steven Ramm")!;
  assert.equal(steven.episode, 10);
  // No S50 rows leak in.
  assert.ok(ev.every((e) => e.contestant !== "Aubry Bracco"));
});

test("S49 extra vote, vote blocker, knowledge is power, vote steal", () => {
  const ev = parseEventPage("Extra_Vote", fx("Extra_Vote"), "49");
  const found = ev.find((e) => e.type === "advantage-found")!;
  assert.equal(found.contestant, "Savannah Louie");
  assert.equal(found.episode, 8);
  assert.equal(found.day, 15);
  const played = ev.find((e) => e.type === "advantage-played")!;
  assert.equal(played.episode, 10);
  assert.equal(played.target, "Jawan Pitts");
  assert.equal(played.outcome, "success");

  const vb = parseEventPage("Vote_Blocker", fx("Vote_Blocker"), "49");
  assert.equal(vb.find((e) => e.type === "advantage-found")?.contestant, "Steven Ramm");
  assert.equal(vb.find((e) => e.type === "advantage-played")?.target, "Savannah Louie");
  assert.equal(vb.find((e) => e.type === "advantage-played")?.episode, 12);

  const kip = parseEventPage("Knowledge_is_Power_Advantage", fx("Knowledge_is_Power_Advantage"), "49");
  const kipPlay = kip.find((e) => e.type === "advantage-played")!;
  assert.equal(kipPlay.contestant, "Sophi Balerdi");
  assert.equal(kipPlay.target, "Steven Ramm");
  assert.equal(kipPlay.outcome, "fail");

  const vs = parseEventPage("Vote_Steal", fx("Vote_Steal"), "49");
  assert.equal(vs.find((e) => e.type === "advantage-found")?.contestant, "Jawan Pitts");
  assert.ok(vs.some((e) => e.type === "advantage-unused"));
});

test("S49 beware advantages and no shot in the dark", () => {
  const bw = parseEventPage("Beware_Advantage", fx("Beware_Advantage"), "49");
  assert.equal(bw.filter((e) => e.type === "advantage-found").length, 3);
  assert.ok(bw.every((e) => e.advantage));
  const sitd = parseEventPage("Shot_in_the_Dark", fx("Shot_in_the_Dark"), "49");
  assert.equal(sitd.length, 0);
});

test("S49 journeys list participants", () => {
  const j = parseEventPage("Journey", fx("Journey"), "49");
  assert.ok(j.length >= 3, `expected journeys, got ${j.length}`);
  assert.ok(j.every((e) => e.type === "journey" && e.contestant && e.episode));
});
