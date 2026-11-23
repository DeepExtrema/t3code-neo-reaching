// Writes theme.json, the Neo Reaching theme: Reaching's picture and reading lane, Nyx's aurora redrawn on Reaching's
// dot grid, and Nyx Plus's panels, sidebar rows and model picker.
//   node build.mjs
// Nothing is restyled here from scratch. Reaching's rules come from vendor/reaching/theme.json and Nyx's from
// vendor/nyx/, each taken whole by its selector, so a rule either matches its source or the build stops.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const HERE = new URL(".", import.meta.url).pathname;
const read = (file) => JSON.parse(fs.readFileSync(HERE + file, "utf8"));

export const MAX_CSS = 100000;        // T3 Code's limit for a theme's css
export const MODEL_PICKER = true;     // Nyx Plus's model picker; false leaves T3 Code's own
// The aurora: Nyx's picture stretched over the window and shown only through dots on Reaching's grid.
// `x`, `y` is one resting dot of the hands and `dx`, `dy` the grid's pitch, in the scene's own units.
export const AURORA = { x: 7.7, y: 360.4, dx: 11.2, dy: 21.1, dot: 6.5, place: "50% 58%/112% 128%", filter: "brightness(1.5) saturate(1.15)" };

/** The top-level rules of a stylesheet, as [prelude, whole rule]. Braces inside strings do not count. */
export function rules(css) {
  const out = []; let depth = 0, start = 0, open = -1, quote = "";
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) { if (c === quote) quote = ""; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === "{") { if (depth++ === 0) open = i; }
    else if (c === "}" && --depth === 0) { out.push([css.slice(start, open), css.slice(start, i + 1)]); start = i + 1; }
  }
  if (depth || quote || css.slice(start).trim()) throw new Error("the stylesheet did not split into whole rules");
  return out;
}
const take = (list, source, preludes) => preludes.map((p) => {
  const found = list.filter(([prelude]) => prelude === p);
  if (found.length !== 1) throw new Error(`${source}: ${found.length} rules for ${p}`);
  return found[0][1];
}).join("");
const one = (text, re, what) => { const m = text.match(re); if (!m) throw new Error(`${what} not found`); return m[1]; };
const enc = (s) => s.replace(/%/g, "%25").replace(/#/g, "%23").replace(/</g, "%3C").replace(/"/g, "'");

export function buildTheme() {
  const reaching = read("vendor/reaching/theme.json"), nyx = read("vendor/nyx/nyx.json"), plus = read("vendor/nyx/nyx-plus.json");
  const mark = reaching.css.indexOf("/*panels*/");
  if (mark < 0) throw new Error("Reaching: the panels marker is gone");
  const panels = rules(reaching.css.slice(mark + "/*panels*/".length)), nyxRules = rules(plus.css);
  // The scene opens with a black sheet over its whole viewBox. The page behind it is black already, and without
  // the sheet the aurora can sit under the scene.
  const sheet = /(%3Csvg viewBox='[^']+' preserveAspectRatio='[^']+'>)%3Crect x='-?[\d.]+' width='[\d.]+' height='[\d.]+' fill='%23000'\/>/;
  const backdrop = reaching.css.slice(0, mark).replace(sheet, "$1");
  if (backdrop.length === mark) throw new Error("Reaching: the scene's black sheet was not found");

  // ---- the picture ----
  // The dots are one dashed line per row, the way the scene draws its own, inside the scene's viewBox: the two
  // layers scale and crop together at any window size. Rows run left and right in turn; a row is a whole number
  // of pitches long, so both directions put their dots on the same columns.
  const view = one(backdrop, /%3Csvg (viewBox='[^']+' preserveAspectRatio='[^']+')>/, "Reaching: the scene's viewBox").replace(/'/g, '"');
  const [left, top, width, height] = one(view, /viewBox="([^"]+)"/, "viewBox").split(" ").map(Number);
  const { x, y, dx, dy, dot } = AURORA, n = (v) => String(+v.toFixed(2));
  const x0 = x - Math.ceil((x - left) / dx) * dx, run = n(Math.ceil((left + width - x0) / dx) * dx);
  const y0 = y - Math.floor((y - top) / dy) * dy, rows = Math.floor((top + height - y0) / dy) + 1;
  const dots = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><svg ${view}><path fill="none" stroke="#000" stroke-width="${dot}" ` +
    `stroke-linecap="round" stroke-dasharray="0 ${dx}" d="M${n(x0)} ${n(y0)}${Array.from({ length: rows }, (_, i) => `${i ? `m0 ${dy}` : ""}h${i % 2 ? "-" : ""}${run}`).join("")}"/></svg></svg>`;
  // Under Reaching's layer, so the hands, the wave and the scene's dark edges all draw over the aurora.
  const aurora = `html::after{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;background:var(--a) ${AURORA.place} no-repeat;` +
    `filter:${AURORA.filter};mask:url("data:image/svg+xml,${enc(dots)}") 50% 50%/100% 100% no-repeat}`;

  // ---- Nyx's variables: the panel sheen, the key shine and the picture ----
  const vars = nyxRules.find(([prelude]) => prelude === ".dark")?.[1] ?? "";
  const nyxArt = one(nyx.css, /(url\(data:image\/webp;base64,[A-Za-z0-9+/=]+\))/, "Nyx: the picture");
  const root = `html{--s:${one(vars, /--s:([^;}]+)/, "Nyx: --s")};--h:${one(vars, /--h:([^;}]+)/, "Nyx: --h")};--a:${nyxArt}}`;

  // ---- Reaching: the picture shows through the app's boxes, the reading lane, and one glass layer for the composer ----
  const fromReaching = take(panels, "Reaching", [
    `[data-slot="sidebar-wrapper"],[data-slot="sidebar"],[data-slot="sidebar-inset"],div:has(>[data-chat-column]),[data-chat-column],.messages-timeline-scroll,[data-timeline-loading]`,
    `[data-workspace-area="conversation"]`,
    `@media (min-width:768px)`,
    `[data-slot="composer-shell"]`,
    `[data-slot="composer-shell"]::before,[data-slot="composer-host"]::before`,
    `[data-slot="composer-host"]::after`,
    `@media (prefers-reduced-motion:reduce)`,
  ]);
  // Reaching's composer card in Nyx's colours: its tint, its violet sheen along the bottom edge
  const composer = `[data-slot="composer-host"]{-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);background:linear-gradient(90deg,#8a7fe830,#6f8cff12 60%,#6f8cff05),rgb(11 10 30 / .62)!important;` +
    `border:1px solid transparent!important;border-radius:18px;transition:box-shadow .18s;box-shadow:0 20px 36px -16px rgb(0 0 0 / .87),inset 0 -18px 28px -20px #7864ff66,inset 0 1px #ffffff0d}` +
    `[data-slot="composer-host"]:focus-within{border-color:transparent!important;box-shadow:0 22px 38px -16px rgb(0 0 0 / .87),0 0 24px -12px #a99fff80,inset 0 -18px 28px -20px #7864ff8c,inset 0 1px #ffffff14}`;

  // ---- Nyx Plus: its panels, as it wrote them ----
  // Left out: its pixel sky and what is drawn with it (the dialog backdrop, the "T3" wordmark), its flat dimming of
  // the chat (the lane does that), and its see-through settings pages, which would put the hands behind the text.
  const fromNyx = take(nyxRules, "Nyx Plus", [
    `.dark[data-theme-id]`,
    `.dark,[data-app-sidebar],[data-workspace-area=settings-nav]`,
    `[data-workspace-area=panel],[data-workspace-area=pull-requests]`,
    `[data-slot=sidebar-container]`,
    `[data-slot=sidebar-inner]`,
    `[data-thread-item] [aria-current=page]`,
    `[data-chat-header]`,
    `[data-chat-column]:not(:has(.messages-timeline-scroll)) [data-chat-header]`,
    `[data-user-message-bubble]`,
    `[data-slot=composer-context-strip]`,
    `[data-thread-details-card]`,
    `[data-slot=switch][data-checked]`,
    `[data-slot=toggle][aria-pressed=true],[data-environment-identification=pill],[data-model-picker-sidebar] [aria-pressed=true]`,
    `[data-chat-composer-form] button[class~=bg-message-action]:not(:disabled),[data-chat-composer-form] button[class~="bg-destructive/90"]`,
    `[data-chat-composer-form] button[class~="bg-destructive/90"]`,
    `[data-slot=switch-thumb]`,
    `[data-slot=popover-popup]:not(:has([data-thread-details-card])),[data-slot=menu-popup]`,
    `[data-app-modal]`,
    `[data-sidebar-row]`,
    `.min-w-8.text-xs`,
    ...(MODEL_PICKER ? [`[data-slot=popover-popup]:has([data-model-picker-content])`] : []),
  ]);
  const glue = `[data-workspace-area=panel] :is([class~=bg-background],[class~=bg-card]),[data-workspace-area=pull-requests] header{background:#0000}` +
    `[data-workspace-area=settings-nav] [data-slot=sidebar-menu-button][data-active=true]{background:linear-gradient(90deg,#8a7fe847,#6f8cff1a 60%,#6f8cff08);box-shadow:var(--s)}`;

  const css = backdrop + root + aurora + fromReaching + composer + fromNyx + glue;
  const theme = { version: 1, name: "Neo Reaching", appearance: "dark", colors: plus.colors, css };
  return { theme, parts: { "Reaching's picture": backdrop.length, "Nyx's picture": nyxArt.length, "aurora dots": aurora.length, "Reaching's rules": fromReaching.length + composer.length, "Nyx Plus's rules": fromNyx.length + glue.length + root.length - nyxArt.length } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { theme, parts } = buildTheme();
  if (theme.css.length > MAX_CSS) throw new Error(`css is ${theme.css.length} chars, over T3 Code's ${MAX_CSS}`);
  fs.writeFileSync(HERE + "theme.json", JSON.stringify(theme, null, 2) + "\n");
  console.log(`theme.json written: css ${theme.css.length} of ${MAX_CSS} chars (${Object.entries(parts).map(([k, v]) => `${k} ${v}`).join(", ")})`);
}
