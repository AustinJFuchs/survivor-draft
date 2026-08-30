# Survivor 51 Draft

A read-only fantasy-draft site for five people, auto-updated from Wikipedia after each episode,
with Jeff Probst–voiced recaps. See [`docs/design.md`](docs/design.md) for every decision.

## Commands

```sh
npm run dev         # rebuild data + Vite dev server
npm run build       # rebuild data, typecheck, production build → dist/
npm run scrape      # Wikipedia + Survivor Wiki → data/51/scraped.json
npm run summarize   # Probst commentary for new episodes (needs ANTHROPIC_API_KEY)
npm run data        # merge data/ → src/generated/season.json
npm run photos      # downscale public/photos/51/*.jpg (needs Node ≥ 20)
npm test            # parser + scoring tests
```

## Weekly flow

Nothing to do. The GitHub Action scrapes Wednesday night / Thursday morning, generates commentary,
commits the data, and redeploys. If something's wrong, run `/episode-update` in Claude Code.

## Layout

- `data/51/` — hand-maintained config (`season`, `contestants`, `draft`, `sources`), machine-owned
  `scraped.json`, human-owned `overrides.json`, generated `commentary/`.
- `scripts/` — scrape, summarize, build-data, fetch-photos, plus parsers in `scripts/lib/`.
- `src/` — the React app. `src/lib/scoring.ts` is the scoring engine.
- `.github/workflows/pipeline.yml` — schedule + deploy.
- `.claude/skills/episode-update/` — the admin skill.
