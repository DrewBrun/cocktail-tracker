
// convert-drinks-xml-to-json.mjs
import fs from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

const xml = fs.readFileSync('Drinks.xml', 'utf8');
const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: true,
});

const data = parser.parse(xml);
// Adjust path to match your XML root/row structure
const rows = data?.dataroot?.Drinks || [];

const drinks = rows.map(r => ({
  title: r.Title,
  description: r.Description,
  recipe: r.Recipe,
  selected: r.Selected === -1 || r.Selected === true || String(r.Selected).toLowerCase() === 'yes',
  categoryId: r.CategoryId ? Number(r.CategoryId) : undefined
}));

const payload = {
  version: 1,
  exportedAt: new Date().toISOString(),
  categories: [],
  drinks,
  parties: [],
  partyDrinkList: []
};

fs.writeFileSync('drinks-import.json', JSON.stringify(payload, null, 2));
console.log(`Exported ${drinks.length} drinks to drinks-import.json`);
