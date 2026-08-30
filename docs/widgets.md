# Home-screen widgets

The site publishes two JSON files with every deploy (CORS-open):

- `https://austinjfuchs.github.io/survivor-draft/api/standings.json` — tiny: standings, latest episode, Jeff's headline, sync time.
- `https://austinjfuchs.github.io/survivor-draft/api/season.json` — everything the app has.

## iPhone / iPad — Scriptable (free)
Paste [`scriptable-widget.js`](scriptable-widget.js) into a new script in the Scriptable app, then add a
Scriptable widget to the home screen and pick the script. Set `ME` in the script to your drafter id to
star your row.

## Android (or iOS) — web widget
Open `https://austinjfuchs.github.io/survivor-draft/widget.html` — a chrome-less standings page that
refreshes itself. Pin it with any "web widget" app (e.g. *Web Widget*, *WebView Widget*, or Chrome →
Add to Home screen).

## Android — KWGT
In a KWGT text widget, use the `$wg()$` web-get formula against `api/standings.json`, for example:

```
$wg("https://austinjfuchs.github.io/survivor-draft/api/standings.json", json, ".standings[0].name")$ leads with $wg("https://austinjfuchs.github.io/survivor-draft/api/standings.json", json, ".standings[0].total")$ pts
```

Repeat with `.standings[1]…[4]` for the other rows; `.headline` gives Jeff's one-liner.
