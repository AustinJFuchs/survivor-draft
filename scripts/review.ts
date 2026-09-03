// Season in review — generated once the Sole Survivor is known → data/<season>/review.json.
//
//   npm run review            # no-op until a winner exists; regenerates only if the final facts changed
//   npm run review -- --force
//   npm run review -- --dry

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import type { Review, SeasonData } from "../src/lib/types";
import { buildSeasonData, loadInputs } from "./build-data";
import { dataPath, readJson, writeJson } from "./lib/paths";
import { anthropicKey, skipNotice } from "./lib/anthropic-key";
import { rundownSource } from "./rundown";

const MODEL = "claude-opus-5";

/** Deterministic parts of the review (the model only writes prose around them). */
export function reviewFacts(data: SeasonData) {
  const name = (s: string) => data.contestants.find((c) => c.slug === s)?.shortName ?? s;
  const champion = data.standings.filter((s) => s.rank === 1).map((s) => s.drafterId);
  const mvp = [...data.contestants].sort((a, b) => b.points.total - a.points.total)[0];
  const allGrades = data.drafterStats.flatMap((s) => s.grades.map((g) => ({ ...g, drafterId: s.drafterId })));
  const pickOfYear = [...allGrades].sort((a, b) => a.gap - b.gap)[0];
  const bustOfYear = [...allGrades].sort((a, b) => b.gap - a.gap)[0];
  const badgeTally = data.drafterStats.map((s) => ({ drafterId: s.drafterId, count: s.badges.length, badges: s.badges.map((b) => b.name) }));
  const bestWeeks = data.drafterStats.map((s) => ({ drafterId: s.drafterId, week: s.bestWeek }));
  return { champion, mvp: mvp?.slug, pickOfYear: pickOfYear ? { ...pickOfYear, name: name(pickOfYear.contestantSlug) } : undefined, bustOfYear: bustOfYear ? { ...bustOfYear, name: name(bustOfYear.contestantSlug) } : undefined, badgeTally, bestWeeks };
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");
  const dry = argv.includes("--dry");
  const data = buildSeasonData(loadInputs());
  if (!data.milestones.winner) {
    console.log("No Sole Survivor yet — nothing to review.");
    return;
  }
  const facts = reviewFacts(data);
  const src = `${rundownSource(data, Math.max(...data.episodes.filter((e) => e.eliminations.length > 0).map((e) => e.number)))}\n\nFinal facts: champion ${facts.champion.join(" & ")}; MVP castaway ${facts.mvp}; pick of the year ${facts.pickOfYear?.name} (#${facts.pickOfYear?.pick.overall} → rank ${facts.pickOfYear?.rank}, ${facts.pickOfYear?.drafterId}); bust of the year ${facts.bustOfYear?.name} (#${facts.bustOfYear?.pick.overall} → rank ${facts.bustOfYear?.rank}, ${facts.bustOfYear?.drafterId}); badges: ${facts.badgeTally.map((b) => `${b.drafterId} ${b.count}`).join(", ")}.`;
  const hash = createHash("sha1").update(src).digest("hex").slice(0, 12);
  const file = dataPath("review.json");
  const existing = readJson<Review | undefined>(file, undefined);
  if (existing && existing.sourceHash === hash && !force) {
    console.log("Season review is up to date.");
    return;
  }
  const prompt = `Facts:\n\n${src}\n\nWrite the season-in-review column as JSON only:\n{\n  "headline": "one line, max 12 words",\n  "howItWent": "180-240 words, Jeff's voice, the story of the draft season from the first boot to the finale — who led, who fell, the turning points, and who won the family prize",\n  "mvpLine": "one sentence about the MVP castaway",\n  "pickLine": "one sentence about the pick of the year",\n  "bustLine": "one sentence about the bust of the year",\n  "signoff": "one short Probst sign-off line"\n}`;
  if (dry) {
    console.log(prompt);
    return;
  }
  const apiKey = anthropicKey();
  if (!apiKey) {
    skipNotice("the season-in-review column");
    return;
  }
  const client = new Anthropic({ apiKey });
  const params = {
    model: MODEL,
    max_tokens: 2000,
    system: "You are Jeff Probst writing the season-ending column for a five-person family fantasy draft. Warm, theatrical, precise with the numbers you're given; never invent facts.",
    messages: [{ role: "user" as const, content: prompt }],
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    stream: false as const,
  };
  const res = (await client.beta.messages.create(params as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming)) as Anthropic.Beta.BetaMessage;
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const json = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!json) throw new Error(`No JSON: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(json) as Pick<Review, "headline" | "howItWent" | "mvpLine" | "pickLine" | "bustLine" | "signoff">;
  const review: Review = {
    ...parsed,
    champion: facts.champion,
    mvp: facts.mvp,
    pickOfYear: facts.pickOfYear ? { drafterId: facts.pickOfYear.drafterId, contestantSlug: facts.pickOfYear.contestantSlug, pick: facts.pickOfYear.pick.overall, rank: facts.pickOfYear.rank } : undefined,
    bustOfYear: facts.bustOfYear ? { drafterId: facts.bustOfYear.drafterId, contestantSlug: facts.bustOfYear.contestantSlug, pick: facts.bustOfYear.pick.overall, rank: facts.bustOfYear.rank } : undefined,
    generatedAt: new Date().toISOString(),
    model: res.model ?? MODEL,
    sourceHash: hash,
  };
  writeJson(file, review);
  console.log(`review: "${review.headline}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
