# Survivor 51 Draft — Design

Settled 2026-08-30 in a grilling session. This is the decision record; the code follows it.

## The draft
- Five drafters in draft order: **Tami, Taylor, Kylie, Tim, Austin**. Snake draft over 21 castaways.
  Picks: Tami 1/10/11/20 + leftover 21; Taylor 2/9/12/19; Kylie 3/8/13/18; Tim 4/7/14/17; Austin 5/6/15/16.
- Rosters are **frozen** (no trades, waivers, or re-drafts).
- The draft picks live in `data/51/draft.json`.

## Scoring (`data/51/season.json`)
- **+1** to every castaway still in the game per *elimination event* (not per aired episode — handles
  2-hour premieres and double boots). Any exit counts: voted out, medevac, quit, fire.
- **+3** merge, **+5** Final Tribal Council, **+10** Sole Survivor. Nothing negative.
- A castaway earns only while in the game; if the Open Era brings someone back they resume earning.
- **Handicap:** a drafter with more than 4 castaways counts only their best 4 (Tami's best-4-of-5),
  applied from day one. Leaderboard shows the counted total; raw total is shown as a secondary stat.
- **Ties** are shown as ties. "Still in" count is displayed, not used as a tiebreak.
- **Prize:** no cash. "Winner chooses a family activity — attendance mandatory. Valid until the
  Survivor 52 premiere."

## Data model (`data/51/`)
| File | Owner | Purpose |
|---|---|---|
| `season.json` | human | drafters, scoring, handicap, prize, premiere date |
| `contestants.json` | human | official cast sheet (CBS announcement) + photo paths |
| `draft.json` | human | the picks |
| `scraped.json` | **scraper** | tribes, episodes, eliminations, milestones, wiki extras. Regenerated every run. |
| `overrides.json` | human | corrections, fun facts, drafter quotes, commentary edits, notes. Always wins. |
| `commentary/ep-N.json` | **summarizer** | Probst-voiced recap; generated once per episode |
| `sources.json` | human | recap sites the summarizer searches |

`scripts/build-data.ts` merges these into `src/generated/season.json`, which the app imports.
Scoring is computed at build time by `src/lib/scoring.ts` (pure; unit-tested).

## Sources & no-spoiler rule
- **Wikipedia** is the source of truth for scoring facts: contestant table (tribes, placement, day),
  voting-history table (elimination → episode), episode list (titles, air dates, synopses),
  season-summary table (reward/immunity winners, display only).
- The parser strips `{{void|…}}` templates and HTML comments first, so hidden/unofficial data
  (e.g. pre-premiere tribe names) never reaches the site. Tribes appear as soon as Wikipedia's
  *visible* table shows them.
- **Survivor Wiki (Fandom)** supplies display-only extras: bio, "3 words", trivia, challenge wins,
  votes against. Never scoring.
- Photos were downloaded once from Survivor Wiki (`public/photos/51/`, downscaled to 480px).

## Commentary
- Generated in the GitHub Action by `scripts/summarize.ts` with `claude-opus-5` (adaptive thinking,
  server-side refusal fallbacks, `max_tokens` cap). Roughly $0.15 per episode.
- Fires only when an episode has an elimination and no `ep-N.json` yet. Waits until ≥2 recap
  articles exist or 72 h have passed. Never regenerated unless forced (`--force` / workflow input).
- Voice: **Jeff Probst**, addressed to the five drafters by name. Recap paragraph + 3–5 bullets +
  "Draft impact" + source links. Draft-impact numbers are computed by the scoring engine and handed
  to the model; the model narrates, never computes. Sources dated after the next episode are dropped
  (spoiler guard).
- Sources: Inside Survivor, TVLine, The Wrap, Wikipedia synopsis (`sources.json`). Parade/EW/THR
  block automated fetching.
- Human edits go in `overrides.commentary["N"]` and survive regeneration.

## Pipeline & hosting
- Public GitHub repo `survivor-draft` → GitHub Pages (`/survivor-draft/` base path).
- `.github/workflows/pipeline.yml`: daily 9 AM ET, plus Wed 11 PM / Thu 1 AM / Thu 3 AM ET during the
  season, plus manual dispatch (with optional `regenerate` episode). Each run: scrape → summarize →
  commit data → build → deploy. Pushes to `main` build+deploy without scraping.
- Secrets: `ANTHROPIC_API_KEY` (from the user's `ETSY_ANTHROPIC_API_KEY`).
- Read-only site: no login, unlisted URL, `noindex`.

## Frontend
- Vite + React 19 + TypeScript + Tailwind v4 + recharts. Mobile-first, dark tropical theme
  (Bebas Neue display font, torch orange / lagoon teal / sand).
- Tabs: Draft Board (landing until the first boot, with premiere countdown) · Leaderboard (prize
  banner, counted totals, roster strip) · Rosters · Castaways grid (filters, sort) → contestant
  drawer (`#/contestant/<slug>`) · Episodes (boots, Jeff's take, group-chat quotes) · Chart
  (counted totals per elimination) · Rules.

## Admin
- Local only: `/episode-update` skill (`.claude/skills/episode-update/SKILL.md`) guides
  corrections, fun facts, quotes, commentary edits; shows the leaderboard diff; commits and pushes.
- `npm run scrape`, `npm run summarize`, `npm run data`, `npm run photos` are the underlying commands.
