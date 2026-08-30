// Wikitext utilities: cleaning, template extraction, and a rowspan/colspan-aware
// wikitable parser. Deliberately dependency-free.

/** Remove content that never renders: comments, refs, {{void|...}}, {{efn|...}}. */
export function stripInvisible(text: string): string {
  let t = text.replace(/<!--[\s\S]*?-->/g, "");
  t = t.replace(/<ref[^>]*\/>/gi, "");
  t = t.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  t = removeTemplates(t, ["void", "efn", "notelist", "reflist", "main", "see also"]);
  return t;
}

/** Remove every {{name|...}} template (balanced) whose name is in `names`. */
export function removeTemplates(text: string, names: string[]): string {
  const lower = names.map((n) => n.toLowerCase());
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("{{", i)) {
      const end = findTemplateEnd(text, i);
      const inner = text.slice(i + 2, end - 2);
      const name = inner.split("|")[0]!.trim().toLowerCase();
      if (lower.includes(name)) {
        i = end;
        continue;
      }
      out += text.slice(i, end);
      i = end;
      continue;
    }
    out += text[i];
    i++;
  }
  return out;
}

/** Index just past the matching "}}" for a template starting at `start`. */
export function findTemplateEnd(text: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    if (text.startsWith("{{", i)) {
      depth++;
      i += 2;
    } else if (text.startsWith("}}", i)) {
      depth--;
      i += 2;
      if (depth === 0) return i;
    } else {
      i++;
    }
  }
  return text.length;
}

/** Split a template body on top-level pipes (ignores pipes inside nested {{ }} / [[ ]]). */
export function splitTop(body: string): string[] {
  const parts: string[] = [];
  let depthT = 0;
  let depthL = 0;
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{") depthT++, (cur += two), i++;
    else if (two === "}}") depthT--, (cur += two), i++;
    else if (two === "[[") depthL++, (cur += two), i++;
    else if (two === "]]") depthL--, (cur += two), i++;
    else if (body[i] === "|" && depthT === 0 && depthL === 0) parts.push(cur), (cur = "");
    else cur += body[i];
  }
  parts.push(cur);
  return parts;
}

export interface Template {
  name: string;
  positional: string[];
  named: Record<string, string>;
  raw: string;
}

export function parseTemplate(raw: string): Template {
  const inner = raw.replace(/^\{\{/, "").replace(/\}\}$/, "");
  const parts = splitTop(inner);
  const name = parts.shift()!.trim();
  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    // Named param only if "=" appears before any nested template/link.
    const firstBrace = p.search(/\{\{|\[\[/);
    if (eq >= 0 && (firstBrace < 0 || eq < firstBrace)) {
      named[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
    } else {
      positional.push(p.trim());
    }
  }
  return { name, positional, named, raw };
}

/** All templates named `name` (case-insensitive) in `text`, top-level scan. */
export function findTemplates(text: string, name: string): Template[] {
  const out: Template[] = [];
  const lower = name.toLowerCase();
  let i = 0;
  while ((i = text.indexOf("{{", i)) >= 0) {
    const end = findTemplateEnd(text, i);
    const tpl = parseTemplate(text.slice(i, end));
    if (tpl.name.toLowerCase() === lower) out.push(tpl);
    // Also scan inside for nested matches.
    i += 2;
  }
  return out;
}

/** Convert a wikitext fragment to plain text. */
export function plain(text: string): string {
  let t = stripInvisible(text);
  // {{sortname|First|Last|...}} → "First Last"
  t = replaceTemplates(t, (tpl) => {
    const n = tpl.name.toLowerCase();
    if (n === "sortname") return `${tpl.positional[0] ?? ""} ${tpl.positional[1] ?? ""}`.trim();
    if (n === "nowrap" || n === "center") return tpl.positional[0] ?? "";
    if (n === "stribe" || n === "tribebox2" || n === "tribeicon" || n === "tribeicon4") {
      // {{stribe|kele}} → "Kele"; {{stribe|none|''None''}} → "None"; {{stribe|kele|Jake<br>(Kele)}} → label
      if (tpl.positional.length >= 2) return plain(tpl.positional[1]!);
      return titleCase(tpl.positional[0] ?? "");
    }
    if (n === "start date" || n === "end date") {
      const [y, m, d] = tpl.positional;
      return y && m && d ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "";
    }
    if (n === "s2" || n === "s") return `Survivor ${tpl.positional[0] ?? ""}`;
    if (n === "wp" || n === "dab") return tpl.positional[0] ?? "";
    if (n === "!") return "|";
    return tpl.positional[tpl.positional.length - 1] ?? "";
  });
  // [[Target|Label]] → Label ; [[Target]] → Target ; [[File:...]] → ""
  t = t.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "");
  t = t.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2");
  t = t.replace(/\[\[([^\]]*)\]\]/g, "$1");
  t = t.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1");
  t = t.replace(/<br\s*\/?>/gi, " ");
  t = t.replace(/<s>[\s\S]*?<\/s>/gi, "");
  t = t.replace(/<[^>]+>/g, "");
  t = t.replace(/'{2,}/g, "");
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&ndash;/g, "–");
  return t.replace(/\s+/g, " ").trim();
}

export function replaceTemplates(text: string, fn: (tpl: Template) => string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("{{", i)) {
      const end = findTemplateEnd(text, i);
      const raw = text.slice(i, end);
      const tpl = parseTemplate(raw);
      // Recurse into params so nested templates are resolved.
      tpl.positional = tpl.positional.map((p) => replaceTemplates(p, fn));
      out += fn(tpl);
      i = end;
    } else {
      out += text[i];
      i++;
    }
  }
  return out;
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------- Tables ----------------

export interface Cell {
  raw: string; // cell wikitext without attributes
  attrs: string; // attribute string, e.g. rowspan="2" bgcolor="darkgray"
  header: boolean;
  rowspan: number;
  colspan: number;
  /** Set when this grid position was filled by a span: "row" from a cell above, "col" from a cell to the left. */
  spanned?: "row" | "col";
}

export interface Table {
  caption?: string;
  rows: Cell[][]; // raw rows as written
  grid: Cell[][]; // expanded so grid[r][c] is defined for every column
}

/** Extract every top-level {| ... |} table in the text (nested tables not supported). */
export function extractTables(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while ((i = text.indexOf("{|", i)) >= 0) {
    let depth = 0;
    let j = i;
    while (j < text.length) {
      if (text.startsWith("{|", j)) depth++, (j += 2);
      else if (text.startsWith("|}", j)) {
        depth--;
        j += 2;
        if (depth === 0) break;
      } else j++;
    }
    out.push(text.slice(i, j));
    i = j;
  }
  return out;
}

/** Find the table whose caption (|+) matches. */
export function findTableByCaption(text: string, re: RegExp): Table | undefined {
  for (const raw of extractTables(text)) {
    const t = parseTable(raw);
    if (t.caption && re.test(t.caption)) return t;
  }
  return undefined;
}

export function parseTable(raw: string): Table {
  const lines = raw.split("\n");
  const rows: Cell[][] = [];
  let caption: string | undefined;
  let cur: Cell[] | null = null;
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li]!;
    const trimmed = line.trim();
    if (trimmed.startsWith("|}")) break;
    if (trimmed.startsWith("|+")) {
      caption = plain(trimmed.slice(2));
      continue;
    }
    if (trimmed.startsWith("|-")) {
      if (cur) rows.push(cur);
      cur = [];
      continue;
    }
    if (trimmed.startsWith("!") || trimmed.startsWith("|")) {
      if (!cur) cur = [];
      const header = trimmed.startsWith("!");
      // Multiple cells can share a line: "! a !! b" or "| a || b"
      const body = trimmed.slice(1);
      const parts = header ? body.split(/!!|\|\|/) : body.split("||");
      for (const p of parts) cur.push(makeCell(p, header));
      continue;
    }
    // Continuation of the previous cell (multi-line cell content).
    if (cur && cur.length > 0) cur[cur.length - 1]!.raw += "\n" + line;
  }
  if (cur && cur.length) rows.push(cur);
  // Drop rows that are empty (e.g. a trailing "|-").
  const nonEmpty = rows.filter((r) => r.length > 0);
  return { caption, rows: nonEmpty, grid: expandGrid(nonEmpty) };
}

// Leading HTML-ish attributes: rowspan="2" align="left" style=text-align:left
const ATTR_RE = /^\s*((?:[\w-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s|]+)\s*)+)(\|)?/;

function makeCell(text: string, header: boolean): Cell {
  // Attributes may be followed by an explicit "|" (`| rowspan="2" | text`) or
  // directly by a template that supplies its own pipe (`| rowspan="4" {{stribe|kele}}`).
  let attrs = "";
  let content = text;
  const m = ATTR_RE.exec(text);
  if (m) {
    attrs = m[1]!.trim();
    content = text.slice(m[0].length);
  }
  const rowspan = Number(/rowspan\s*=\s*"?(\d+)/i.exec(attrs)?.[1] ?? 1);
  const colspan = Number(/colspan\s*=\s*"?(\d+)/i.exec(attrs)?.[1] ?? 1);
  return { raw: content.trim(), attrs, header, rowspan, colspan };
}

function expandGrid(rows: Cell[][]): Cell[][] {
  const grid: Cell[][] = [];
  const pending = new Map<string, Cell>(); // "r,c" → spanned copy
  for (let r = 0; r < rows.length; r++) {
    const out: Cell[] = [];
    let c = 0;
    let idx = 0;
    while (idx < rows[r]!.length || pending.has(`${r},${c}`)) {
      const key = `${r},${c}`;
      if (pending.has(key)) {
        out[c] = pending.get(key)!;
        pending.delete(key);
        c++;
        continue;
      }
      const cell = rows[r]![idx++]!;
      for (let dc = 0; dc < cell.colspan; dc++) {
        for (let dr = 0; dr < cell.rowspan; dr++) {
          if (dr === 0 && dc === 0) continue;
          pending.set(`${r + dr},${c + dc}`, { ...cell, spanned: dr === 0 ? "col" : "row" });
        }
      }
      out[c] = cell;
      c += cell.colspan;
      // Fill columns consumed by colspan with spanned copies (same row).
      for (let dc = 1; dc < cell.colspan; dc++) {
        out[c - cell.colspan + dc] = { ...cell, spanned: "col" };
        pending.delete(`${r},${c - cell.colspan + dc}`);
      }
    }
    grid.push(out);
  }
  return grid;
}
