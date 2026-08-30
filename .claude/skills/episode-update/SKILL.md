---
name: episode-update
description: Record or correct Survivor draft data after an episode — boots, tribes, milestones, fun facts, drafter quotes, Probst commentary edits — then rebuild, show the leaderboard diff, and commit/push. Use when the user says an episode aired, Wikipedia has something wrong, wants to add a quote or fun fact, or wants commentary regenerated.
---

# /episode-update

You maintain `data/51/overrides.json` (human-owned; always wins over `scraped.json`) and
`data/51/commentary/ep-N.json`. Never edit `scraped.json` by hand — the scraper overwrites it.

## Workflow

1. **Sync first.** Run `npm run scrape` so you're correcting against the freshest scraped data.
   If the user just says "episode N aired", the scrape may already have everything — check
   before asking them to type anything.
2. **Show current state** for the episode in question: eliminations (with `order`, `episode`,
   `day`, `kind`), tribes changed, milestones (`merged`, `mergeEpisode`, `finalists`, `winner`).
   `npm run report` prints standings, eliminations, milestones, and warnings
   (`npm run report -- --json` for machine-readable).
3. **Ask a short checklist** only for what's missing or that the user is disputing:
   - Who was eliminated (name → slug from `data/51/contestants.json`), which episode, day, kind
     (`voted-out` | `medevac` | `quit` | `removed` | `fire` | `other`).
   - Any tribe swap / merge? (merge → set `milestones.mergeEpisode` and `milestones.merged`).
   - Finalists / winner (finale only).
   - Fun facts to add (`funFacts[slug][]`), quotes (`quotes[]` with `id`, `episode`, `drafterId`,
     `text`, `date`), house notes (`notes[]`).
   - Commentary: edit fields under `commentary["N"]`, or regenerate with
     `npm run summarize -- --episode N --force` (needs `ANTHROPIC_API_KEY`).
   - Castaway "About" blurbs: edit `profiles[slug].summary` / `.bullets` in overrides, or
     regenerate one with `npm run profiles -- --slug <slug> --force`.
4. **Write the override.** Shapes (all optional, merged by slug/episode):
   ```json
   {
     "eliminations": [{ "contestantSlug": "brady-booker", "episode": 3, "day": 7, "kind": "voted-out", "order": 3, "note": "…" }],
     "removeEliminations": ["some-slug"],
     "tribes": { "brady-booker": { "current": "Toka", "history": ["Toka"] } },
     "milestones": { "mergeEpisode": 7, "merged": ["…"], "finalists": ["…"], "winner": "…" },
     "episodes": [{ "number": 3, "title": "…", "airDate": "2026-10-07" }],
     "funFacts": { "brady-booker": ["…"] },
     "quotes": [{ "id": "q-ep3-1", "episode": 3, "drafterId": "kylie", "text": "…", "date": "2026-10-08", "contestantSlug": "brady-booker" }],
     "commentary": { "3": { "recap": "…" } },
     "notes": ["…"]
   }
   ```
   `order` matters: eliminations are sorted by `order` then renumbered. If adding a boot the
   scraper missed, give it the next order number (or the right one if it's out of sequence).
5. **Dry run.** `npm run data` then print the leaderboard before/after (standings from
   `src/generated/season.json`: rank, name, total, rawTotal, remaining, dropped). Show the diff
   to the user and wait for a yes.
6. **Prune stale overrides.** For each override elimination/tribe that now equals the scraped
   value, tell the user it's redundant and offer to delete it.
7. **Commit & push** with a message like `data: ep 3 — Brady out, Kylie quote` on `main`.
   The push triggers the pipeline, which rebuilds and deploys.

## Guardrails

- Never write unofficial/spoiler data (tribe names, twists) before it has aired.
- Don't touch `contestants.json` for scoring facts; it's the static cast sheet. Use
  `overrides.contestants[slug]` for bio/photo corrections.
- Commentary is generated once per episode. Regenerate only when the user asks; edits in
  `overrides.commentary` survive regeneration, so prefer editing over regenerating.
- Slugs: see `data/51/contestants.json`. Drafter ids: `tami`, `taylor`, `kylie`, `tim`, `austin`.
