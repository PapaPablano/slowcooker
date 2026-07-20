// Reconcile app DATA against the parsed source-PDF recipes (recipes.json):
//   - reserve: union of PDF "except ..." bag exclusions and the step-derived list
//   - missing ingredients: PDF ingredients absent from the app list get added
//     (reserved if they appear in the except list)
//   - prep: the PDF's prep/freezer directions, stored per meal
// Usage: node scripts/reconcile.cjs <pdftext-dir> [report|apply]
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const mode = process.argv[3] || 'report';
const FILE = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(FILE, 'utf8');
const dm = html.match(/const DATA = (\[.*?\]);\n/s);
const DATA = JSON.parse(dm[1]);
const pdf = JSON.parse(fs.readFileSync(path.join(dir, 'recipes.json'), 'utf8'));
const byName = Object.fromEntries(pdf.map(r => [r.name, r]));

const STOP = ['THE','AND','CAN','CANS','CUP','CUPS','FRESH','FROZEN','DICED','SHREDDED','SHARP','RAW','FULL','FAT','CHOICE','PREFERENCE','COOKED','UNCOOKED','MEDIUM','LARGE','SMALL','BAG','HALF','USED','TSP','TBSP','LBS','RACK','BUNCH','BUNCHES','STALK','STALKS','HEAD','PLUS','FILL','EACH','JAR','WITH','ADD','YOUR','FAVORITE','FOR','SERVING','OPTIONAL'];
const ALIAS = { PENNE: 'PASTA', MACARONI: 'PASTA', NOODLES: 'PASTA', STOCK: 'BROTH', SCALLIONS: 'ONIONS', ONION: 'ONIONS' };
const norm = (s) => s.toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter(w => w.length > 2 && !STOP.includes(w)).map(w => ALIAS[w] || w);

function overlapScore(aT, bT) {
  const o = aT.filter(t => bT.some(n => n.includes(t) || t.includes(n))).length;
  return o / Math.max(Math.min(aT.length, bT.length), 1);
}
function matchIng(item, ings) {
  const it = tokens(item);
  let best = null, bestScore = 0;
  for (const ing of ings) {
    const s = overlapScore(it, tokens(ing.n + ' ' + ing.raw));
    if (s >= 0.5 && s > bestScore) { best = ing; bestScore = s; }
  }
  return best;
}

function guessCat(n) {
  const s = n.toLowerCase();
  if (/cream|milk|cheese|butter|egg/.test(s)) return 'Dairy & Eggs';
  if (/broth|stock|sauce|paste|canned|jar/.test(s)) return 'Canned & Jarred';
  if (/noodle|pasta|penne|gnocchi|tortellini|rice|tortilla|bun|bread/.test(s)) return 'Pasta, Grains & Bread';
  if (/basil|spinach|onion|squash|lime|lemon|pepper bell|lettuce|cilantro/.test(s)) return 'Produce';
  if (/water|oil|honey|flour|sugar/.test(s)) return 'Pantry & Baking';
  return 'Pantry & Baking';
}
const FRACT = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
function parseQty(raw) {
  const m = raw.match(/^([\d½¼¾⅓⅔⅛][\d\/.\-½¼¾⅓⅔⅛]*)\s*(CUPS?|TBSP|TSP|OZ|LBS?)?\s/i);
  if (!m) return { q: 1, u: '' };
  let qs = m[1], q = 0;
  if (FRACT[qs[0]] !== undefined && qs.length === 1) q = FRACT[qs[0]];
  else if (/^\d+$/.test(qs)) q = parseInt(qs, 10);
  else if (/^\d+-\d+$/.test(qs)) q = parseInt(qs.split('-')[1], 10);
  else if (/^\d+\/\d+$/.test(qs)) { const [a, b] = qs.split('/'); q = a / b; }
  else q = parseFloat(qs) || 1;
  const u = (m[2] || '').toLowerCase().replace(/s$/, '').replace('lbs', 'lb');
  return { q, u };
}
const title = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const TRAILING_LABELS = /\s*(FOR SERVINGS?:?|OPTIONAL:|HOMEMADE TACO SEASONING:|BURGER SPICE BLEND:|SAUCE \((?:BLEND|WHISK) TOGETHER\):?|\(BLEND TOGETHER\):?)\s*$/i;
const cleanRaw = (s) => {
  let out = s.replace(/^cooking directions/i, '').replace(/\s+/g, ' ').trim();
  while (TRAILING_LABELS.test(out)) out = out.replace(TRAILING_LABELS, '').trim();
  return out;
};
// supplies lines, cook times, and glued headers are not ingredients
const JUNK = /ALUMINUM TRAY|STOVETOP|CROCKPOT|SHEET PAN|^\d[\d\-. ]*(HOURS?|HRS?|MIN(UTE)?S?)\b|SAUCE \(BLEND TOGETHER\)/i;

// per-meal manual corrections (audited)
const OVERRIDES = {
  'BBQ Ribs':       { rawFor: { 'BBQ SAUCE': 'BBQ SAUCE (TO FINISH RIBS)' } },
  'Pizza Pasta Casserole': { rawFor: { 'WATER': '2 CUPS WATER' } },
  'Butter Chicken': { lineFix: { 'UNCOOKED RICE BUTTER CHICKEN SAUCE': '2 CUPS UNCOOKED RICE (FOR SERVING)' } },
  'Burgers':        { lineFix: { '4-6 BUNS KETCHUP': '4-6 BUNS' }, extras: ['KETCHUP (FOR SERVING)'] },
  'General Tso Chicken': { lineFix: { '2 CUPS UNCOOKED RICE': '2 CUPS UNCOOKED RICE (FOR SERVING)' } },
  // serving-group items whose "FOR SERVING" label was lost to line gluing
  'Beef Tacos':      { forceReserve: ['SHREDDED CHEDDAR'] },
  'Chicken Fajitas': { forceReserve: ['CHEDDAR CHEESE'] },
};

function nameFromItem(item) {
  let s = cleanRaw(item)
    .replace(/^[\d½¼¾⅓⅔⅛][\d\/.\-]*\s*/, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^\s*(cups?|tbsp|tsp|oz|lbs?\.?|cans?|bags?|bunch(es)?)\s+/i, '')
    .split(/\s*\+\s*|\s+PLUS\s+/i)[0]
    .replace(/[,.]\s*$/, '').replace(/\s+/g, ' ').trim();
  return title(s.toLowerCase());
}

for (const r of DATA) {
  const p = byName[r.name];
  if (!p) { console.log('!! no PDF recipe for', r.name); continue; }
  const ov = OVERRIDES[r.name] || {};
  const notes = [];
  const reserve = new Set((r.reserve || []).map(x => x.n));
  const newIngs = [];

  const addMissing = (item, isReserve, qlineHint, nameHint) => {
    let raw = cleanRaw((ov.rawFor || {})[norm(item)] || qlineHint || item).toUpperCase();
    for (const [pat, rep] of Object.entries(ov.lineFix || {})) if (raw.includes(pat)) raw = rep;
    const n = nameHint || nameFromItem(raw);
    if (!n || !tokens(n).length) return;
    if (newIngs.some(x => x.n === n)) return;
    const { q, u } = parseQty(raw);
    // things served alongside or cooked separately never go in the bag
    if (/FOR SERVING|\bBUNS?\b|TORTILLA|UNCOOKED RICE|COOKED RICE/i.test(raw)) isReserve = true;
    newIngs.push({ q, u, n, c: guessCat(raw), raw });
    if (isReserve) reserve.add(n);
    notes.push(`MISSING ingredient added${isReserve ? ' (reserved)' : ''}: ${n} raw="${raw}"`);
  };

  // 1) authoritative bag exclusions
  for (const item of p.except) {
    if (/OPTIONAL/i.test(item)) continue;
    const hit = matchIng(item, r.ing);
    if (hit) {
      if (!reserve.has(hit.n)) notes.push(`PDF adds reserve: ${hit.n} (from "${item}")`);
      reserve.add(hit.n);
    } else {
      // qline supplies the qty text, but the except item itself names the ingredient
      const qline = p.ing.find(l => overlapScore(tokens(item), tokens(l)) >= 0.5) || null;
      addMissing(item, true, qline, nameFromItem(item));
    }
  }
  // 2) ingredient-gap pass: PDF ingredient lines absent from the app list
  for (const line of p.ing) {
    if (/OPTIONAL|TOPPINGS/i.test(line) || JUNK.test(cleanRaw(line))) continue;
    if (tokens(line).length === 0) continue;
    if (matchIng(line, r.ing.concat(newIngs))) continue;
    // reserved if the cook-day extras list already flags it (came from step text)
    const inAlso = (r.also || []).some(a => overlapScore(tokens(a), tokens(line)) >= 0.5);
    addMissing(line, inAlso, line);
  }
  for (const ex of ov.extras || []) addMissing(ex, false, ex);
  for (const fr of ov.forceReserve || []) {
    const hit = matchIng(fr, r.ing.concat(newIngs));
    if (hit) { reserve.add(hit.n); notes.push(`force reserve: ${hit.n}`); }
    else notes.push(`!! forceReserve no match: ${fr}`);
  }

  if (mode === 'report') {
    if (notes.length) console.log('== ' + r.name + '\n   ' + notes.join('\n   '));
  } else {
    r.ing = r.ing.concat(newIngs);
    r.reserve = [...reserve].map(n => {
      const old = (r.reserve || []).find(x => x.n === n);
      return old && old.note ? { n, note: old.note } : { n };
    });
    r.also = (r.also || []).filter(a =>
      ![...reserve].some(n => overlapScore(tokens(a), tokens(n)) >= 0.5) &&
      !newIngs.some(ni => overlapScore(tokens(a), tokens(ni.n)) >= 0.5));
    r.prep = p.prep;
  }
}

if (mode === 'apply') {
  const out = html.replace(dm[0], 'const DATA = ' + JSON.stringify(DATA) + ';\n');
  fs.writeFileSync(FILE, out);
  console.log('applied: DATA updated for', DATA.length, 'meals');
}
