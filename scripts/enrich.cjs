// Enrich DATA in index.html with per-meal freezer-bag info derived from step text:
//   reserve  – ingredients kept OUT of the bag and added on cook day [{n, note}]
//   also     – items steps call for that aren't in the ingredient list ["4 cups chicken broth", ...]
//   serveWith– serving suggestion pulled from the steps ("buns", "tortillas", ...)
// Run:  node scripts/enrich.js audit   (print classification, change nothing)
//       node scripts/enrich.js apply   (rewrite DATA in index.html)
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'index.html');

const html = fs.readFileSync(FILE, 'utf8');
const m = html.match(/const DATA = (\[.*?\]);\n/s);
const data = JSON.parse(m[1]);

// ---- manual corrections from auditing the generated classification ----
const OVERRIDES = {
  r18: { dropReserve: ['Soy Sauce'] },          // in the bag; steps only offer extra at serving
  r33: { dropReserve: ['Salt', 'Pepper'] },     // used while browning meat during bag prep
  r23: { reserveNote: { 'Chimichurri Sauce': 'reserve extra for serving' } },
  r53: { dropReserve: ['Frozen Onions'] },      // "onions" alias falsely matched "green onions" garnish
};

const ADD_VERBS = /(add|stir in|plus|top with|topped with|garnish with|sprinkle|mix in|pour in|whisk in|season with|with)\s+(?:[\w\s,\/¼½¾()-]{0,40}?)?ING/i;
const COOKED_VERBS = /(shred|crumble|blend|break up|mash)[^.]{0,40}ING/i;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// vocabulary of pantry/serving items steps commonly call for that may be missing from ing
const PANTRY = ['chicken broth','broth','water','heavy cream','coconut milk','sour cream','cheddar cheese',
  'rice noodles','rice','tortillas','tortilla','buns','bun','chips','noodles','pasta',
  'gnocchi','tortellini','mozzarella','cheese','cilantro','lime','lettuce','basil',
  'spinach','green onion','cream cheese','butter','milk'];

function aliases(name) {
  const n = name.toLowerCase();
  const out = [n];
  if (n.endsWith('s')) out.push(n.slice(0, -1));
  const last = n.split(' ').slice(-1)[0];
  if (last !== n && last.length > 3) out.push(last); // "chicken broth" -> "broth"
  return out;
}

function classify(r) {
  const later = r.steps.slice(1);
  const reserve = [];
  const seen = new Set();
  for (const ing of r.ing) {
    if (seen.has(ing.n)) continue;
    for (const s of later) {
      const sl = s.toLowerCase();
      const alias = aliases(ing.n).find(a => sl.includes(a));
      if (!alias) continue;
      const isBagDump = /^(add|dump)[^.]*freezer bag/i.test(s.trim()) && !/plus/i.test(s);
      if (isBagDump) continue;
      const a = new RegExp(ADD_VERBS.source.replace('ING', esc(alias)), 'i');
      const c = new RegExp(COOKED_VERBS.source.replace('ING', esc(alias)), 'i');
      if (a.test(s) && !c.test(s)) {
        reserve.push({ n: ing.n, note: s.trim() });
        seen.add(ing.n);
        break;
      }
    }
  }
  // items steps call for that aren't in the ingredient list
  const ingText = r.ing.map(i => i.n.toLowerCase() + ' ' + i.raw.toLowerCase()).join(' | ');
  const also = new Set();
  const matched = new Set();
  for (const s of later) {
    const sl = s.toLowerCase();
    for (const p of PANTRY) {
      if (matched.has(p) || !sl.includes(p)) continue;
      if (PANTRY.some(q => q !== p && q.includes(p) && sl.includes(q) && !matched.has(q) === false)) {}
      if (ingText.includes(p)) { matched.add(p); continue; }
      // skip if a longer vocab item containing this one also matches (e.g. "rice" in "rice noodles")
      if (PANTRY.some(q => q !== p && q.includes(p) && sl.includes(q))) { matched.add(p); continue; }
      // only when the step is asking to add/serve it
      const a = new RegExp(ADD_VERBS.source.replace('ING', esc(p)), 'i');
      const serveRe = new RegExp('serve[^.]{0,40}' + esc(p), 'i');
      if (a.test(s) || serveRe.test(s)) {
        // pull a quantity if one directly precedes it
        const q = s.match(new RegExp('(\\d[\\d\\/\\s]*(?:cups?|cans?|cloves?|tbsp|tsp|oz|lbs?)?)\\s+(?:of\\s+)?' + esc(p), 'i'));
        also.add(q ? (q[1].trim() + ' ' + p) : p);
        matched.add(p);
      }
    }
  }
  // serving suggestion
  const serveM = r.steps.map(s => s.match(/serve (?:it )?(?:in|on|over|with) ([^.!]+)/i)).find(Boolean);
  const serveWith = serveM ? serveM[1].trim() : null;

  // apply overrides
  const ov = OVERRIDES[r.id] || {};
  let res = reserve.filter(x => !(ov.dropReserve || []).includes(x.n));
  for (const [n, note] of Object.entries(ov.reserveNote || {})) {
    const hit = res.find(x => x.n === n);
    if (hit) hit.extra = note;
  }
  (ov.also || []).forEach(x => also.add(x));
  return { reserve: res, also: [...also], serveWith };
}

const mode = process.argv[2] || 'audit';
for (const r of data) {
  const { reserve, also, serveWith } = classify(r);
  if (mode === 'audit') {
    const bits = [];
    if (reserve.length) bits.push('RESERVE: ' + reserve.map(x => x.n + (x.extra ? ' (' + x.extra + ')' : '')).join(', '));
    if (also.length) bits.push('ALSO: ' + also.join(', '));
    if (serveWith) bits.push('SERVE: ' + serveWith);
    if (bits.length) console.log(r.id + ' ' + r.name + '\n   ' + bits.join('\n   '));
  } else {
    r.reserve = reserve.map(x => x.extra ? { n: x.n, note: x.extra } : { n: x.n });
    r.also = also;
    if (serveWith) r.serveWith = serveWith;
  }
}

if (mode === 'apply') {
  const out = html.replace(m[0], 'const DATA = ' + JSON.stringify(data) + ';\n');
  fs.writeFileSync(FILE, out);
  console.log('index.html DATA updated:', data.length, 'meals enriched');
}
