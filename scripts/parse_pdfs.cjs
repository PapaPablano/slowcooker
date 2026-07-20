// Parse the source meal-plan PDF text (extracted to scratchpad by pypdf) into
// per-recipe records: ingredients, prep/freezer directions, cooking directions,
// and the authoritative "except ..." freezer-bag exclusion list.
// Usage: node scripts/parse_pdfs.cjs <pdftext-dir> [report|json]
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const mode = process.argv[3] || 'report';
const files = fs.readdirSync(dir).filter(f => f.startsWith('Month') && f.endsWith('.txt') && !/ 2\.txt$/.test(f));

// canonical meal names from the app, used to identify recipe pages reliably
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const DATA = JSON.parse(html.match(/const DATA = (\[.*?\]);\n/s)[1]);
const norm = (s) => s.toUpperCase().replace(/W\//g, 'WITH').replace(/[^A-Z]/g, '');
const byNorm = Object.fromEntries(DATA.map(r => [norm(r.name), r.name]));

const HEADER_NOISE = /^(ingredients|prep\/freezer directions|cooking directions|RECIPE:|from the|kitchen of:|serves:?|prep time:?|cook time:?|supplies:?|menu|meal plan|Expiration date:|Notes?:?|\.+)$/i;
const VALUE_NOISE = /^(\d+(-\d+)?|\d+ MINUTES?|\d+-\d+ (HOURS?|MINUTES?)|\d+ HOURS?|CROCKPOT.*|OVEN.*|SHEET PAN.*|ALUMINUM TRAY.*|MEAL PLAN ?#?\d*|\d{2})$/i;

const recipes = {};
for (const f of files) {
  const pages = fs.readFileSync(path.join(dir, f), 'utf8').split('\f');
  for (const p of pages) {
    if (!/RECIPE:/.test(p) || !/ingredients/i.test(p) || !/prep\/freezer directions/i.test(p)) continue;
    // title line right after "RECIPE:" is the most reliable identifier
    const tm = p.match(/RECIPE:\s*\n\s*(.+?)\n/);
    const titleNorm = tm ? norm(tm[1]) : '';
    const keysByLen = Object.keys(byNorm).sort((a, b) => b.length - a.length);
    let nameKey = keysByLen.find(k => titleNorm === k) ||
                  keysByLen.find(k => titleNorm && titleNorm.includes(k)) ||
                  keysByLen.find(k => norm(p).includes(k));
    if (!nameKey) { console.error('!! page with no known meal name in', f); continue; }
    const name = byNorm[nameKey];
    if (recipes[name]) continue; // recipes are doubled per plan

    // pull out step groups first; what remains holds the ingredient lines
    const groupRe = /STEP 1:[\s\S]*?(?=STEP 1:|$)/g;
    const groups = p.match(groupRe) || [];
    let rest = p.replace(groupRe, '\n');

    let prep = [], cook = [];
    for (const g of groups) {
      const steps = g.split(/STEP \d+:/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
        .map(s => s.replace(/\s*\.\s*$/, '.'));
      const isCook = /THAW|COOK ON|PREHEAT|FROM FROZEN/i.test(g) && !/LABEL/i.test(g.split('.')[0]) && !/ADD ALL INGREDIENTS/i.test(g);
      if (isCook && !cook.length) cook = steps;
      else if (!prep.length) prep = steps;
      else if (!cook.length) cook = steps;
    }

    // ingredient lines: whatever remains that isn't header/footer noise
    const lines = rest.split('\n').map(s => s.trim()).filter(Boolean)
      .filter(s => !HEADER_NOISE.test(s) && !VALUE_NOISE.test(s));
    // drop the recipe-name line(s)
    const nameWords = norm(name);
    const ingLines = lines.filter(s => norm(s) !== nameWords && !(norm(s) && nameWords.includes(norm(s)) && s.length > 3));
    // merge continuation lines (a line with no digit/fraction/OPTIONAL start continues previous)
    const merged = [];
    for (const line of ingLines) {
      if (merged.length && !/^[\d½¼¾⅓⅔(]|^OPTIONAL|^JUICE|^ZEST/i.test(line)) merged[merged.length - 1] += ' ' + line;
      else merged.push(line);
    }

    // authoritative bag exclusions
    const prepJoined = prep.join(' ');
    let except = [];
    const BAG = '(?:TO|INTO)\\s+(?:(?:THE|A|AN|LABELED|GALLON|QUART|FREEZER|ALUMINUM)\\s+)*(?:BAG|BAGS|TRAY)';
    const em = prepJoined.match(new RegExp('ADD ALL INGREDIENTS,?\\s*EXCEPT\\s+([\\s\\S]*?),?\\s*' + BAG, 'i')) ||
               prepJoined.match(new RegExp('ADD ALL INGREDIENTS,?\\s*' + BAG + ',?\\s*EXCEPT\\s+([^.]*)', 'i'));
    if (em) except = em[1].split(/,|\sAND\s/i).map(s => s.trim().replace(/^THE\s+/i, '')).filter(Boolean);
    recipes[name] = { name, ing: merged, prep, cook, except, file: f };
  }
}

const list = Object.values(recipes);
const missing = DATA.map(r => r.name).filter(n => !recipes[n]);
if (mode === 'json') {
  fs.writeFileSync(path.join(dir, 'recipes.json'), JSON.stringify(list, null, 1));
  console.log('wrote recipes.json:', list.length, 'recipes; missing:', missing.join(', ') || 'none');
} else {
  console.log('recipes parsed:', list.length, '| missing:', missing.join(', ') || 'none');
  for (const r of list) {
    const flags = [];
    if (!r.ing.length) flags.push('NO-ING');
    if (!r.prep.length) flags.push('NO-PREP');
    if (!r.cook.length) flags.push('NO-COOK');
    console.log(r.name + ' | ing:' + r.ing.length + ' prep:' + r.prep.length + ' cook:' + r.cook.length +
      (r.except.length ? ' | EXCEPT: ' + r.except.join('; ') : '') + (flags.length ? ' ** ' + flags.join(',') : ''));
  }
}
