// Assigns a canonical `cluster` key to ing[] entries that are true physical-form
// variants of the same ingredient (e.g. "Frozen Onion" vs "Yellow Onion"), so the
// Grocery List can group them without runtime fuzzy-matching. Hand-authored map,
// not an algorithm — deliberately conservative: only merges pairs verified by
// reading the full 198-name ingredient list, never different-but-similarly-named
// ingredients (e.g. green onion is never merged with yellow onion).
//
// No PDF dependency — operates only on DATA already committed to index.html.
// Usage: node scripts/cluster_ingredients.cjs [report|apply]  (default: report)
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'index.html');

// Each cluster: canonical display name -> exact ing[].n values that mean the same
// physical ingredient (in whatever form/phrasing appears in the source data).
// `frozenForms` marks which member names are the frozen form, used by the Grocery
// List UI to decide whether the fresh/frozen advisory tip applies (Unit 2, R3).
const CLUSTERS = [
  { name: 'Onion', members: ['Onion', 'Frozen Onion', 'Frozen Onions', 'Onion Frozen', 'Yellow Onion', 'Onion Cut Into', 'Onion Cut Into 1-Inch Slices'], frozenForms: ['Frozen Onion', 'Frozen Onions', 'Onion Frozen'] },
  { name: 'Carrots', members: ['Carrot', 'Carrots', 'Baby Carrots'] },
  { name: 'Celery', members: ['Celery', 'Celery Ribs', 'Stalk Celery', 'Stalks Celery'] },
  { name: 'Chicken Thighs', members: ['Chicken Thighs', 'Bonesless Chicken Thighs', '½ Lbs Chicken Thighs'] },
  { name: 'Beef Chuck Roast', members: ['Beef Chuck Roast', 'Chuck Roast', 'Stew Beef Or Beef Chuck Roast'] },
  { name: 'Cheddar Cheese', members: ['Cheddar Cheese', 'Cheddar Cheese, Shredded', 'Sharp Cheddar Cheese', 'Shredded Cheddar'] },
  { name: 'Coconut Milk', members: ['Coconut Milk', 'Full Fat Coconut Milk'] },
  { name: 'Lime Juice', members: ['Lime Juice', 'Lime Juice Juice 1 Lime', 'Lime Juice Juice From 2-3 Limes', 'Lime Juice Juice One Lime'] },
  { name: 'Basil', members: ['Basil', 'Fresh Basil'] },
  { name: 'Bay Leaf', members: ['Bay Leaf', 'Bay Leaves'] },
  { name: 'Spinach', members: ['Spinach', 'Frozen Spinach', 'Spinach, Frozen'], frozenForms: ['Frozen Spinach', 'Spinach, Frozen'] },
  { name: 'Parmesan Cheese', members: ['Parmesan', 'Parmesan Cheese'] },
  { name: 'Mozzarella Cheese', members: ['Mozzarella', 'Mozzarella Cheese'] },
  { name: 'Eggs', members: ['Egg', 'Eggs'] },
  { name: 'Uncooked Rice', members: ['Uncooked Rice', 'Uncooked Rice Jerk'] },
  { name: 'Salt', members: ['Salt', '½ Tsp Salt'] },
  { name: 'Green Bell Pepper', members: ['Green Bell Pepper', 'Green Pepper Cut Into 1- Inch Slices', 'Green Pepper Cut Into 1-Inch Strips'] },
  { name: 'Red Bell Pepper', members: ['Red Bell Pepper', 'Red Bell Pepper Rough', 'Red Pepper', 'Red Pepper Cut Into 1-Inch Slices'] },
  { name: 'Marinara Sauce', members: ['Marinara Sauce', 'Marinara Pasta Sauce'] },
  { name: 'Tortellini', members: ['Tortellini', 'Cheese Tortellini'] },
  { name: 'Heavy Cream', members: ['Heavy Cream', '½ Cup Heavy Cream'] },
];

const nameToCluster = new Map();
for (const c of CLUSTERS) {
  const key = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  for (const m of c.members) nameToCluster.set(m, { key, name: c.name, isFrozen: (c.frozenForms || []).includes(m) });
}

const mode = (process.argv[2] || 'report').toLowerCase();
const html = fs.readFileSync(FILE, 'utf8');
const m = html.match(/const DATA = (\[.*?\]);\n/s);
const DATA = JSON.parse(m[1]);

if (mode === 'report') {
  for (const c of CLUSTERS) {
    const hits = [];
    for (const r of DATA) for (const ing of r.ing) if (nameToCluster.has(ing.n) && nameToCluster.get(ing.n).key === c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')) hits.push(`${r.name}: "${ing.n}"`);
    console.log(`== ${c.name} (${c.members.length} member names, tip-eligible: ${!!(c.frozenForms && c.frozenForms.length)})`);
    hits.forEach((h) => console.log('   ' + h));
  }
  console.log(`\n${CLUSTERS.length} clusters defined, covering ${nameToCluster.size} of 198 ingredient names.`);
} else if (mode === 'apply') {
  let tagged = 0;
  for (const r of DATA) {
    for (const ing of r.ing) {
      const c = nameToCluster.get(ing.n);
      if (c) { ing.cluster = c.key; ing.clusterName = c.name; ing.clusterFrozenForm = c.isFrozen; tagged++; }
      else { delete ing.cluster; delete ing.clusterName; delete ing.clusterFrozenForm; }
    }
  }
  const out = html.replace(m[0], 'const DATA = ' + JSON.stringify(DATA) + ';\n');
  fs.writeFileSync(FILE, out);
  console.log(`applied: tagged ${tagged} ing[] entries across ${DATA.length} meals with a cluster key`);
} else {
  console.error('usage: node scripts/cluster_ingredients.cjs [report|apply]');
  process.exit(1);
}
