import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const jsonPath = process.argv[2] || path.join(projectRoot, "public", "data", "parties.json");

function flattenParty(p) {
  let cur = p;
  while (cur && typeof cur === "object" && cur.party) {
    const { party, ...rest } = cur;
    cur = { ...rest, ...party, id: rest.id ?? party.id };
  }
  const { party, ...rest } = cur;
  return rest;
}

const raw = await fs.readFile(jsonPath, "utf8");
await fs.writeFile(jsonPath + ".bak", raw);

const data = JSON.parse(raw);
const arr = Array.isArray(data) ? data : data.parties;
if (!Array.isArray(arr)) throw new Error("Expected an array or an object with a 'parties' array.");

const flat = arr.map(flattenParty);
await fs.writeFile(jsonPath, JSON.stringify(flat, null, 2));
console.log(`Normalized ${flat.length} parties → ${jsonPath}`);
