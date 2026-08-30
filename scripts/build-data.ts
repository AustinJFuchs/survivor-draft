// Merge hand-maintained data + scraped.json + overrides.json + commentary/
// into src/generated/season.json for the app. Pure function `buildSeasonData`
// is exported for tests and the dry-run diff in the episode-update skill.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type {
  Commentary,
  Contestant,
  ContestantView,
  DraftConfig,
  Elimination,
  EpisodeView,
  LedgerRow,
  Milestones,
  Overrides,
  Profile,
  Quote,
  ScrapedData,
  SeasonConfig,
  SeasonData,
  ContestantTribes,
  VoteRecord,
} from "../src/lib/types";
import { computeHistory, computeStandings, scoreContestants, sortEliminations } from "../src/lib/scoring";
import { GRADES_EARLY_UNTIL, computeBadges, computeGrades, computePaths, computeProjection, weekSummaries } from "../src/lib/analysis";
import type { DrafterStats } from "../src/lib/types";
import { DATA_DIR, GENERATED_DIR, dataPath, readJson, writeJson } from "./lib/paths";

export interface BuildInputs {
  season: SeasonConfig;
  contestants: Contestant[];
  draft: DraftConfig;
  scraped: ScrapedData;
  overrides: Overrides;
  commentary: Commentary[];
  profiles: Record<string, Profile>;
}

export function loadInputs(): BuildInputs {
  const season = readJson<SeasonConfig>(dataPath("season.json"));
  const contestants = readJson<Contestant[]>(dataPath("contestants.json"));
  const draft = readJson<DraftConfig>(dataPath("draft.json"));
  const scraped = readJson<ScrapedData>(dataPath("scraped.json"));
  const overrides = readJson<Overrides>(dataPath("overrides.json"), {});
  const commentary: Commentary[] = [];
  const dir = join(DATA_DIR, "commentary");
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => /^ep-\d+\.json$/.test(f)).sort()) {
      commentary.push(readJson<Commentary>(join(dir, f)));
    }
  }
  const profiles = readJson<Record<string, Profile>>(dataPath("profiles.json"), {});
  return { season, contestants, draft, scraped, overrides, commentary, profiles };
}

export function buildSeasonData(inp: BuildInputs): SeasonData {
  const { season, draft, scraped, overrides } = inp;
  const warnings: string[] = [...(scraped.warnings ?? [])];
  const slugs = new Set(inp.contestants.map((c) => c.slug));

  // ----- draft validation -----
  const picks = draft.picks.filter((p) => p.contestantSlug);
  const seen = new Map<string, number>();
  for (const p of picks) {
    if (!slugs.has(p.contestantSlug)) warnings.push(`draft.json: unknown contestant "${p.contestantSlug}" at pick ${p.overall}`);
    if (seen.has(p.contestantSlug)) warnings.push(`draft.json: ${p.contestantSlug} picked twice (picks ${seen.get(p.contestantSlug)} and ${p.overall})`);
    seen.set(p.contestantSlug, p.overall);
    if (!season.drafters.some((d) => d.id === p.drafterId)) warnings.push(`draft.json: unknown drafter "${p.drafterId}" at pick ${p.overall}`);
  }
  const draftComplete = picks.length === draft.picks.length && draft.picks.length > 0;
  if (!draftComplete) warnings.push(`draft.json: ${draft.picks.length - picks.length} picks still empty`);

  // ----- eliminations: scraped, minus removals, with overrides merged by slug -----
  let eliminations: Elimination[] = sortEliminations(scraped.eliminations ?? []).map((e) => ({ ...e }));
  const removed = new Set(overrides.removeEliminations ?? []);
  eliminations = eliminations.filter((e) => !removed.has(e.contestantSlug));
  for (const o of overrides.eliminations ?? []) {
    if (!o.contestantSlug) continue;
    const existing = eliminations.find((e) => e.contestantSlug === o.contestantSlug);
    if (existing) Object.assign(existing, o);
    else {
      eliminations.push({
        order: o.order ?? eliminations.length + 1,
        contestantSlug: o.contestantSlug,
        kind: o.kind ?? "voted-out",
        episode: o.episode,
        day: o.day,
        placementText: o.placementText,
        juryMember: o.juryMember,
        note: o.note,
      });
    }
  }
  // Re-sequence: overrides may set explicit order; otherwise keep by (order, episode).
  eliminations = sortEliminations(eliminations).map((e, i) => ({ ...e, order: i + 1 }));
  for (const e of eliminations) if (!slugs.has(e.contestantSlug)) warnings.push(`elimination references unknown contestant "${e.contestantSlug}"`);

  // ----- milestones -----
  const milestones: Milestones = {
    merged: [...(scraped.milestones?.merged ?? [])],
    finalists: [...(scraped.milestones?.finalists ?? [])],
    placements: { ...(scraped.milestones?.placements ?? {}) },
    mergeEpisode: scraped.milestones?.mergeEpisode,
    winner: scraped.milestones?.winner,
  };
  if (overrides.milestones) {
    const m = overrides.milestones;
    if (m.merged) milestones.merged = m.merged;
    if (m.finalists) milestones.finalists = m.finalists;
    if (m.mergeEpisode !== undefined) milestones.mergeEpisode = m.mergeEpisode;
    if (m.winner !== undefined) milestones.winner = m.winner;
    if (m.placements) Object.assign(milestones.placements, m.placements);
  }
  // Eliminated contestants can't be finalists; finalists can't be eliminated.
  const eliminatedSet = new Set(eliminations.map((e) => e.contestantSlug));
  milestones.finalists = milestones.finalists.filter((s) => !eliminatedSet.has(s));

  // ----- scoring -----
  const contestantSlugs = inp.contestants.map((c) => c.slug);
  const scoreInput = { contestantSlugs, eliminations, milestones, scoring: season.scoring };
  const points = scoreContestants(scoreInput);
  const standingsInput = { drafters: season.drafters, picks, handicap: season.handicap };
  const standings = computeStandings({ ...standingsInput, points, eliminated: eliminatedSet });
  const history = computeHistory(scoreInput, standingsInput);

  // ----- episodes view -----
  const epMap = new Map<number, EpisodeView>();
  for (const e of scraped.episodes ?? []) epMap.set(e.number, { ...e, eliminations: [], quotes: [] });
  for (const o of overrides.episodes ?? []) {
    if (o.number === undefined) continue;
    const ex = epMap.get(o.number) ?? { number: o.number, eliminations: [], quotes: [] };
    epMap.set(o.number, { ...ex, ...o, eliminations: ex.eliminations, quotes: ex.quotes });
  }
  for (const e of eliminations) {
    if (e.episode === undefined) continue;
    const ep = epMap.get(e.episode) ?? { number: e.episode, eliminations: [], quotes: [] };
    ep.eliminations.push(e);
    epMap.set(e.episode, ep);
  }
  const commentaryByEp = new Map<number, Commentary>();
  for (const c of inp.commentary) commentaryByEp.set(c.episode, c);
  for (const [k, o] of Object.entries(overrides.commentary ?? {})) {
    const n = Number(k);
    const ex = commentaryByEp.get(n);
    if (ex) commentaryByEp.set(n, { ...ex, ...o, edited: true });
    else if (o.recap) commentaryByEp.set(n, { episode: n, generatedAt: "", model: "manual", recap: o.recap, bullets: o.bullets ?? [], draftImpact: o.draftImpact ?? "", sources: o.sources ?? [], edited: true });
  }
  for (const [n, c] of commentaryByEp) {
    const ep = epMap.get(n) ?? { number: n, eliminations: [], quotes: [] };
    ep.commentary = c;
    epMap.set(n, ep);
  }
  const quotes: Quote[] = overrides.quotes ?? [];
  for (const q of quotes) {
    if (q.episode === undefined) continue;
    const ep = epMap.get(q.episode) ?? { number: q.episode, eliminations: [], quotes: [] };
    ep.quotes.push(q);
    epMap.set(q.episode, ep);
  }
  const today = new Date().toISOString().slice(0, 10);
  const episodes = [...epMap.values()]
    .map((e) => ({ ...e, aired: e.aired ?? (e.airDate ? e.airDate <= today : e.eliminations.length > 0) }))
    .sort((a, b) => a.number - b.number);

  // ----- contestants view -----
  const pickBySlug = new Map(picks.map((p) => [p.contestantSlug, p]));
  const elimBySlug = new Map(eliminations.map((e) => [e.contestantSlug, e]));
  // Derived helpers for the sheet: rank, ledger, sparkline, mentions, linked quotes.
  const sortedByPoints = [...inp.contestants].map((c) => c.slug).sort((a, b) => (points[b]!.total - points[a]!.total) || a.localeCompare(b));
  const rankOf = new Map<string, number>();
  sortedByPoints.forEach((slug, i) => {
    const prev = sortedByPoints[i - 1];
    rankOf.set(slug, prev && points[prev]!.total === points[slug]!.total ? rankOf.get(prev)! : i + 1);
  });
  const sortedPicks = [...picks].sort((a, b) => a.overall - b.overall);
  const standingBySlugDrafter = new Map(standings.map((s) => [s.drafterId, s]));
  const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((t) => t.trim()).filter(Boolean);
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRe = (c: Contestant) => {
    const names = [c.name, c.shortName, c.nickname, c.name.split(" ")[0]].filter((n): n is string => !!n && n.length > 1);
    return new RegExp("\\b(" + names.map(escapeRe).join("|") + ")\\b", "i");
  };
  const votesBySlug = scraped.votes ?? {};

  const contestants: ContestantView[] = inp.contestants.map((base) => {
    const c: Contestant = { ...base, ...(overrides.contestants?.[base.slug] ?? {}) };
    const scrapedTribes = scraped.tribes?.[c.slug];
    const tribeOverride = overrides.tribes?.[c.slug] ?? {};
    const tribes: ContestantTribes = {
      ...(scrapedTribes ?? {}),
      ...tribeOverride,
      history: tribeOverride.history ?? scrapedTribes?.history ?? [],
    };
    if (!tribes.current) tribes.current = tribes.history[tribes.history.length - 1] ?? tribes.original;
    const elimination = elimBySlug.get(c.slug);
    const winner = milestones.winner === c.slug;
    const finalist = milestones.finalists.includes(c.slug);
    const status = winner ? "winner" : finalist ? "finalist" : elimination ? "eliminated" : "active";
    const wikiFacts = (scraped.extras?.[c.slug]?.trivia ?? []).map((t) => ({ text: t, source: "wiki" as const }));
    const manualFacts = (overrides.funFacts?.[c.slug] ?? []).map((t) => ({ text: t, source: "manual" as const }));
    const pick = pickBySlug.get(c.slug);
    const pickIdx = pick ? sortedPicks.findIndex((p) => p.overall === pick.overall) : -1;
    const standing = pick ? standingBySlugDrafter.get(pick.drafterId) : undefined;
    const rosterSlugs = standing ? picks.filter((p) => p.drafterId === standing.drafterId).map((p) => p.contestantSlug) : [];
    const rosterSorted = [...rosterSlugs].sort((a, b) => points[b]!.total - points[a]!.total || a.localeCompare(b));

    // Sparkline: cumulative points after each elimination event.
    const sparkline: number[] = [];
    for (let step = 0; step <= eliminations.length; step++) sparkline.push(scoreContestants(scoreInput, step)[c.slug]!.total);

    // Ledger: one row per aired episode with an elimination or a vote record.
    const myVotes: VoteRecord[] = votesBySlug[c.slug] ?? [];
    const ledger: LedgerRow[] = [];
    let prevTotal = 0;
    const epNumbers = [...new Set([...eliminations.map((e) => e.episode), ...myVotes.map((v) => v.episode)].filter((n): n is number => n !== undefined))].sort((a, b) => a - b);
    for (const n of epNumbers) {
      // Nothing to say about episodes after this castaway left.
      if (elimination?.episode !== undefined && n > elimination.episode) break;
      const ep = epMap.get(n);
      const stepsThroughEp = eliminations.filter((e) => e.episode !== undefined && e.episode <= n).length;
      const totalAfter = scoreContestants(scoreInput, stepsThroughEp)[c.slug]!.total;
      const outHere = elimination?.episode === n;
      const wasOutBefore = elimination?.episode !== undefined && elimination.episode < n;
      const re = nameRe(c);
      const v = myVotes.filter((x) => x.episode === n);
      ledger.push({
        episode: n,
        title: ep?.title,
        points: totalAfter - prevTotal,
        survived: !outHere && !wasOutBefore,
        eliminated: outHere,
        immunity: !!ep?.immunityWinners && re.test(ep.immunityWinners),
        reward: !!ep?.rewardWinners && re.test(ep.rewardWinners),
        votesAgainst: v.reduce((s, x) => s + x.votesAgainst, 0),
        voters: [...new Set(v.flatMap((x) => x.voters))],
        votedFor: v.find((x) => x.votedFor)?.votedFor,
        votedForText: v.find((x) => x.votedForText)?.votedForText,
        tally: v.find((x) => x.tally)?.tally,
      });
      prevTotal = totalAfter;
    }

    // Jeff's mentions.
    const mentions: { episode: number; text: string }[] = [];
    for (const [n, com] of commentaryByEp) {
      const re = nameRe(c);
      const text = [com.recap, ...com.bullets, com.draftImpact].join(" ");
      for (const sent of sentences(text)) if (re.test(sent)) mentions.push({ episode: n, text: sent });
    }

    const bd = scraped.extras?.[c.slug]?.birthdate;
    let ageOnDayOne: number | undefined;
    if (bd) {
      // Day 1 ≈ filming start; premiere date is a fine public proxy for "age this season".
      const d1 = new Date(season.premiereDate);
      const b = new Date(bd);
      ageOnDayOne = d1.getFullYear() - b.getFullYear() - (d1 < new Date(d1.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
    }

    return {
      ...c,
      drafterId: pick?.drafterId,
      pick,
      tribes,
      status,
      elimination,
      placement: milestones.placements[c.slug],
      merged: milestones.merged.includes(c.slug),
      finalist,
      winner,
      extras: scraped.extras?.[c.slug],
      funFacts: [...manualFacts, ...wikiFacts],
      points: points[c.slug]!,
      rank: rankOf.get(c.slug) ?? 0,
      rosterRank: rosterSorted.length ? rosterSorted.indexOf(c.slug) + 1 : undefined,
      counted: standing ? standing.counted.includes(c.slug) : undefined,
      pickBefore: pickIdx > 0 ? sortedPicks[pickIdx - 1] : undefined,
      pickAfter: pickIdx >= 0 && pickIdx < sortedPicks.length - 1 ? sortedPicks[pickIdx + 1] : undefined,
      sparkline,
      ledger,
      votes: myVotes,
      mentions,
      quotes: (overrides.quotes ?? []).filter((q) => q.contestantSlug === c.slug),
      ageOnDayOne,
      profile: mergeProfile(inp.profiles[c.slug], overrides.profiles?.[c.slug], c.slug),
    };
  });

  // ----- drafter analysis -----
  const contestantName = (slug: string) => contestants.find((c) => c.slug === slug)?.shortName ?? slug;
  const immunityWins: Record<string, number> = {};
  for (const c of contestants) immunityWins[c.slug] = c.ledger.filter((r) => r.immunity).length;
  const badgesByDrafter = computeBadges({ drafters: season.drafters, picks, standings, history, eliminations, milestones, immunityWins, contestantName });
  const paths = computePaths({ drafters: season.drafters, picks, contestantSlugs, eliminations, milestones, scoring: season.scoring, handicap: season.handicap });
  const drafterStats: DrafterStats[] = season.drafters.map((d) => {
    const mine = picks.filter((p) => p.drafterId === d.id);
    const g = computeGrades(mine, rankOf, contestants.length);
    const weeks = weekSummaries(history, d.id);
    const best = weeks.length ? weeks.reduce((a, b) => (b.delta > a.delta ? b : a)) : undefined;
    const worst = weeks.length ? weeks.reduce((a, b) => (b.delta < a.delta ? b : a)) : undefined;
    return {
      drafterId: d.id,
      grades: g.grades,
      gpa: g.gpa,
      gradesEarly: eliminations.length < GRADES_EARLY_UNTIL,
      steal: g.steal,
      reach: g.reach,
      badges: badgesByDrafter[d.id] ?? [],
      bestWeek: best,
      worstWeek: worst && worst !== best ? worst : undefined,
      projection: computeProjection({ drafterId: d.id, picks, standings, eliminations, milestones, totalContestants: contestants.length, scoring: season.scoring, handicap: season.handicap, points }),
      paths: paths[d.id]!,
    };
  });

  // ----- tribe colours: auto palette, overridable -----
  const TRIBE_PALETTE = ["#e0453a", "#2bb5a8", "#fbbf24", "#c084fc", "#4fae4a", "#60a5fa", "#ff8a2b", "#f472b6"];
  const tribeNames = [...new Set(contestants.flatMap((c) => c.tribes.history))].sort();
  const tribeColors: Record<string, string> = {};
  tribeNames.forEach((t, i) => (tribeColors[t] = TRIBE_PALETTE[i % TRIBE_PALETTE.length]!));
  Object.assign(tribeColors, overrides.tribeColors ?? {});

  return {
    season,
    contestants,
    drafterStats,
    tribeColors,
    draft: { ...draft, picks },
    episodes,
    eliminations,
    milestones,
    standings,
    history,
    syncedAt: scraped.syncedAt || undefined,
    builtAt: new Date().toISOString(),
    warnings,
    notes: overrides.notes ?? [],
    seasonStarted: eliminations.length > 0,
  };
}

function mergeProfile(generated: Profile | undefined, override: Partial<Pick<Profile, "summary" | "bullets">> | undefined, slug: string): Profile | undefined {
  if (!generated && !override?.summary) return undefined;
  const base: Profile = generated ?? { slug, summary: "", bullets: [], generatedAt: "", model: "manual", sourceHash: "" };
  if (!override) return base;
  return { ...base, ...override, edited: true };
}

/**
 * `--demo`: fabricate a mid-season state (random picks, 7 eliminations, a merge,
 * sample commentary and quotes) so the UI can be checked before the season starts.
 * Never used by the pipeline.
 */
export function applyDemo(inp: BuildInputs): BuildInputs {
  const slugs = inp.contestants.map((c) => c.slug);
  let seed = 51;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const shuffled = [...slugs].sort(() => rnd() - 0.5);
  const picks = inp.draft.picks.map((p, i) => ({ ...p, contestantSlug: shuffled[i] ?? "" }));
  const boots = shuffled.slice(-7);
  const eliminations: Elimination[] = boots.map((slug, i) => ({
    order: i + 1,
    contestantSlug: slug,
    episode: Math.min(6, i + 1),
    day: 3 + i * 2,
    kind: i === 2 ? "medevac" : "voted-out",
    placementText: i === 2 ? "Medically evacuated" : `${i + 1}${["st", "nd", "rd"][i] ?? "th"} voted out`,
  }));
  const merged = slugs.filter((s) => !boots.slice(0, 6).includes(s));
  const scraped: ScrapedData = {
    ...inp.scraped,
    eliminations,
    milestones: { merged, mergeEpisode: 6, finalists: [], placements: {} },
    episodes: Array.from({ length: 7 }, (_, i) => ({
      number: i + 1,
      title: ["Permanent Uncertainty", "Fire Is Life", "Open Season", "Blindside Buffet", "The Merge-ish", "Earn It", "Next Week"][i],
      airDate: new Date(Date.UTC(2026, 8, 23 + i * 7)).toISOString().slice(0, 10),
      aired: i < 6,
      immunityWinners: i < 6 ? (i % 2 ? "Toka" : "Savu") : undefined,
    })),
    tribes: Object.fromEntries(slugs.map((s, i) => [s, { original: i % 2 ? "Toka" : "Savu", current: merged.includes(s) ? "Mergeville" : i % 2 ? "Toka" : "Savu", history: [i % 2 ? "Toka" : "Savu"] }])),
  };
  const commentary: Commentary[] = [
    {
      episode: 3,
      generatedAt: new Date().toISOString(),
      model: "demo",
      recap: `Twenty-one castaways, two tribes, and one rule: anything can happen. Tonight it did. ${inp.contestants.find((c) => c.slug === boots[2])?.shortName ?? "Someone"} was evacuated before the first challenge, and the vote that followed was as messy as a Fijian rainstorm.`,
      bullets: ["The idol hunt went sideways in the first ten minutes.", "Two alliances formed, and one of them is already lying to the other.", "Nobody wants to be the first name written down at the next Tribal."],
      draftImpact: "Tami and Tim each lost a castaway tonight. Kylie's roster is untouched and she takes the lead. Austin, you're two points back — plenty of game left.",
      sources: [{ title: "Demo recap", url: "https://example.com" }],
    },
  ];
  const overrides: Overrides = {
    ...inp.overrides,
    quotes: [{ id: "q1", episode: 3, drafterId: "kylie", text: "I TOLD you not to draft the guy who said 'I'm a fan of blindsides' in his bio.", date: "2026-10-08", contestantSlug: boots[2] }],
    funFacts: { [shuffled[0]!]: ["Demo fun fact entered by hand."] },
  };
  // Fake Tribal Council votes for the first three boots so the ledger has something to show.
  scraped.votes = {};
  boots.slice(0, 3).forEach((victim, i) => {
    const ep = i + 1;
    const voters = slugs.filter((s) => s !== victim && !boots.slice(0, i).includes(s)).slice(0, 5 - i);
    for (const v of voters) (scraped.votes![v] ??= []).push({ episode: ep, day: 3 + i * 2, votedFor: victim, votesAgainst: 0, voters: [], tally: `${voters.length}–1` });
    (scraped.votes![victim] ??= []).push({ episode: ep, day: 3 + i * 2, votedFor: voters[0], votesAgainst: voters.length, voters, tally: `${voters.length}–1` });
  });
  return { ...inp, draft: { ...inp.draft, picks }, scraped, overrides, commentary };
}

const isMain = process.argv[1] && /build-data\.ts$/.test(process.argv[1]);
if (isMain) {
  const demo = process.argv.includes("--demo");
  const data = buildSeasonData(demo ? applyDemo(loadInputs()) : loadInputs());
  if (demo) console.log("DEMO DATA — run `npm run data` to restore the real build.");
  writeJson(join(GENERATED_DIR, "season.json"), data);
  console.log(
    `Built season ${data.season.id}: ${data.contestants.length} contestants, ${data.eliminations.length} eliminations, ${data.episodes.length} episodes.`,
  );
  for (const w of data.warnings) console.warn(`warn: ${w}`);
}
