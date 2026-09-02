// Survivor 51 Draft — iOS home-screen widget for the Scriptable app (free).
// 1. Install Scriptable from the App Store.  2. New script → paste this file.
// 3. Add a Scriptable widget to your home screen, choose this script (medium size looks best).
// Optional: set `ME` to your drafter id (tami / taylor / kylie / tim / austin) to highlight your row.

const URL = "https://austinjfuchs.github.io/survivor-draft/api/standings.json";
const ME = "";

const colors = ["#ff7a59", "#ff69b4", "#c084fc", "#fbbf24", "#a3e635", "#60a5fa"];
const req = new Request(URL + "?t=" + Date.now());
const d = await req.loadJSON();

const w = new ListWidget();
w.backgroundColor = new Color("#0b1a17");
w.setPadding(12, 14, 10, 14);
w.url = "https://austinjfuchs.github.io/survivor-draft/";

const title = w.addText("🔥 SURVIVOR 51 DRAFT");
title.font = Font.boldSystemFont(11);
title.textColor = new Color("#ffb347");
if (d.headline) {
  const h = w.addText(d.headline);
  h.font = Font.mediumSystemFont(11);
  h.textColor = new Color("#d9bf8a");
  h.lineLimit = 2;
}
w.addSpacer(6);

for (const s of d.standings.slice(0, 5)) {
  const row = w.addStack();
  row.centerAlignContent();
  const rank = row.addText(String(s.rank));
  rank.font = Font.boldSystemFont(13);
  rank.textColor = new Color(colors[s.index % colors.length]);
  row.addSpacer(6);
  const name = row.addText(s.name + (s.id === ME ? " ★" : ""));
  name.font = s.id === ME ? Font.boldSystemFont(13) : Font.mediumSystemFont(13);
  name.textColor = new Color("#f7ecd6");
  row.addSpacer(4);
  const sub = row.addText(`${s.remaining}/${s.rosterSize} in`);
  sub.font = Font.systemFont(10);
  sub.textColor = new Color("#b99a5f");
  row.addSpacer();
  const pts = row.addText(String(s.total));
  pts.font = Font.boldSystemFont(14);
  pts.textColor = new Color("#f7ecd6");
  w.addSpacer(3);
}

w.addSpacer(4);
const foot = w.addText(d.latestEpisode ? `After Ep ${d.latestEpisode}` : d.seasonStarted ? "" : `Premieres ${d.premiereDate}`);
foot.font = Font.systemFont(9);
foot.textColor = new Color("#6f7f75");

Script.setWidget(w);
Script.complete();
w.presentMedium();
