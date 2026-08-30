// Print the current merged state: standings, eliminations, milestones, warnings.
// Used by the /episode-update skill for before/after diffs.
//
//   npm run report
//   npm run report -- --json      # machine-readable

import { buildSeasonData, loadInputs } from "./build-data";

const data = buildSeasonData(loadInputs());
if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      {
        standings: data.standings,
        eliminations: data.eliminations,
        milestones: data.milestones,
        warnings: data.warnings,
        syncedAt: data.syncedAt,
      },
      null,
      2,
    ),
  );
} else {
  const name = (slug: string) => data.contestants.find((c) => c.slug === slug)?.name ?? slug;
  console.log(`\n${data.season.name} — synced ${data.syncedAt ?? "never"}\n`);
  console.log("STANDINGS");
  for (const s of data.standings) {
    const extra = s.dropped ? `  (raw ${s.rawTotal}, dropped ${name(s.dropped)})` : "";
    console.log(`  ${s.rank}${s.tied ? "=" : " "} ${s.name.padEnd(8)} ${String(s.total).padStart(3)} pts   ${s.remaining} still in${extra}`);
  }
  console.log("\nELIMINATIONS");
  if (data.eliminations.length === 0) console.log("  (none)");
  for (const e of data.eliminations) {
    console.log(`  #${e.order} ${name(e.contestantSlug).padEnd(22)} ep ${e.episode ?? "?"}  day ${e.day ?? "?"}  ${e.kind}${e.placementText ? `  (${e.placementText})` : ""}`);
  }
  const m = data.milestones;
  console.log("\nMILESTONES");
  console.log(`  merge: ${m.mergeEpisode !== undefined ? `episode ${m.mergeEpisode}` : "not yet"} — ${m.merged.length} merged`);
  console.log(`  finalists: ${m.finalists.map(name).join(", ") || "—"}`);
  console.log(`  winner: ${m.winner ? name(m.winner) : "—"}`);
  if (data.warnings.length) {
    console.log("\nWARNINGS");
    for (const w of data.warnings) console.log(`  - ${w}`);
  }
  console.log("");
}
