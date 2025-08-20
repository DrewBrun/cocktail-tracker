// Usage:
//   node migrate-drinks.mjs <input.json> --out <output.json>
//   node migrate-drinks.mjs <input.json> --dry-run

import fs from "fs";

function exitErr(msg) { console.error(msg); process.exit(1); }

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-");
}

const args = process.argv.slice(2);
if (args.length < 1) exitErr("Provide an input JSON path.");
const inPath = args[0];
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
const dryRun = args.includes("--dry-run");

if (!fs.existsSync(inPath)) exitErr(`Input not found: ${inPath}`);

let text = fs.readFileSync(inPath, "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

let parsed;
try {
  parsed = JSON.parse(text);
} catch (e) {
  exitErr(`Failed to parse JSON: ${e.message}`);
}

let arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.drinks) ? parsed.drinks : null);
if (!Array.isArray(arr)) exitErr("Input must be a JSON array (or { drinks: [...] }).");

const now = Date.now();
const seen = new Map(); // slug -> index
const out = [];

const score = (r) =>
  (r.description ? 1 : 0) +
  (r.recipe ? 1 : 0) +
  ((r.ingredients?.length) || 0) +
  ((r.categories?.length) || 0);

for (const rec of arr) {
  const base = { ...rec };
  const slug = base.slug || slugify(base.title);

  if (!Array.isArray(base.ingredients)) base.ingredients = [];
  if (!Array.isArray(base.categories)) base.categories = [];
  if (typeof base.selected !== "boolean") base.selected = false;
  if (!Number.isFinite(base.createdAt)) base.createdAt = now;
  if (!Number.isFinite(base.updatedAt)) base.updatedAt = now;

  base.slug = slug;

  if (!seen.has(slug)) {
    seen.set(slug, out.push(base) - 1);
  } else {
    const idx = seen.get(slug);
    const prev = out[idx];
    out[idx] = score(base) > score(prev) ? { ...prev, ...base } : { ...base, ...prev };
  }
}

console.error(`Read ${arr.length} records. Wrote ${out.length} unique by slug.`);

if (dryRun) {
  console.error("Dry run only (no file written). Example slugs:", out.slice(0, 5).map(d => d.slug));
  process.exit(0);
}

if (!outPath) exitErr("No --out <path> provided.");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.error(`Wrote: ${outPath}`);
