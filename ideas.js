// Gift-idea engine. The idea bank lives in ideas-1.js … ideas-4.js, one group per topic:
//   g(id, audience, keywordRegex, label, "name|lowPrice|highPrice\n…")
// audience: a = adults and teens, k = kids (about 3-12), b = babies and toddlers (under 3). keywordRegex null = general idea (fills the list).
(function () {
  const G = (window.IG = []);
  window.g = (id, aud, kw, lab, text) => G.push({
    id, aud, kw: kw ? new RegExp(kw, 'gi') : null, lab,
    items: text.trim().split('\n').map((l) => { const [n, a, b] = l.split('|'); return { n: n.trim(), lo: +a, hi: +b, g: id, lab }; }),
  });

  const STOP = new Set('the and for with set pack pair size from your you new'.split(' '));
  const stem = (w) => w.replace(/ies$/, 'y').replace(/s$/, '');
  const toks = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem));
  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const count = (re, s) => (s && re ? (s.match(re) || []).length : 0);

  // Which audience a person (or child) belongs to.
  window.audienceOf = (p) => {
    if (!p.isKid) return 'a';
    if (!p.birthYear) return 'k';
    const age = new Date().getFullYear() - p.birthYear;
    return age <= 2 ? 'b' : age <= 12 ? 'k' : 'a';
  };

  // Ideas that clearly suit only one gender are left out for the other (when a gender is set).
  const FEM = /leggings|\bdress|tutu|leotard|skirt|mary jane|scrunchie|hair (clip|towel|dryer|straight|curl|oil|bow)|claw clip|heatless|curling|straightener|makeup|\blip (balm|gloss|butter|scrub|mask)|lipstick|mascara|eyeshadow|eyelash|\bbrow\b|blush|foundation|nail|press-on|necklace|earring|bracelet|anklet|ring dish|stackable ring|jewelry|purse|handbag|crossbody|bag charm|bag scarf|wide-leg|perfume|body mist|candle warmer|bath bomb|fairy|princess|mermaid|skincare|serum|sheet mask|jade roller|facial|pearl|birthstone|locket|ear cuff|silk pillowcase|teddy|sephora/i;
  const MASC = /tie clip|cufflink|beard|shaving|razor|\bmen'?s\b|suspenders|bow tie|necktie|pocket square|cologne|aftershave|barber/i;

  // Ideas for one person: matched topics first (mixed together), then general ideas. Skips what is already on their list.
  let byName = null;
  const nameGroups = () => {
    if (!byName) { byName = {}; G.forEach((x) => x.items.forEach((it) => (byName[it.n] = byName[it.n] || []).push(x.id))); }
    return byName;
  };
  window.makeIdeas = (person, seed, votes) => {
    const aud = window.audienceOf(person);
    const r = rng(hash(person.id) + seed * 7919);
    const interests = String((person.info && person.info.interests) || '').toLowerCase();
    const names = person.items.map((i) => i.name).join(' | ').toLowerCase();
    const have = person.items.map((i) => toks(i.name));
    const g = person.info && person.info.gender;
    const wrongGender = g === 'male' ? FEM : g === 'female' ? MASC : null;
    const taken = (it) => {
      if (wrongGender && wrongGender.test(it.n)) return true;
      if (votes && votes[it.n] === -1) return true;
      const t = toks(it.n);
      if (t.size < 2) return false;
      return have.some((h) => { let k = 0; t.forEach((w) => { if (h.has(w)) k++; }); return k >= Math.max(2, Math.ceil(t.size * 0.6)); });
    };
    const groups = G.filter((x) => x.aud.includes(aud));
    // thumbs: each 👍 makes its topic count for more, each 👎 for less; a 👎 idea is never shown
    const ups = {}, downs = {};
    Object.entries(votes || {}).forEach(([name, v]) => (nameGroups()[name] || []).forEach((gid) => { const t = v > 0 ? ups : downs; t[gid] = (t[gid] || 0) + 1; }));
    const matched = groups.filter((x) => x.kw)
      .map((x) => ({ x, base: 3 * Math.min(count(x.kw, interests), 2) + Math.min(count(x.kw, names), 3) + 2 * Math.min(ups[x.id] || 0, 3) - Math.min(downs[x.id] || 0, 3) }))
      .filter((m) => m.base > 0).map((m) => ({ x: m.x, score: m.base + r() * 0.5 })).sort((a, b) => b.score - a.score);
    const general = groups.filter((x) => !x.kw);
    const seen = new Set(), out = [];
    const rounds = (lists) => {
      const q = lists.map((l) => ({ items: shuffle(l.x.items, r), per: l.score >= 6 ? 2 : 1 }));
      for (let more = true; more;) {
        more = false;
        q.forEach((l) => { for (let k = 0; k < l.per && l.items.length; k++) { const it = l.items.shift(); more = true; if (!seen.has(it.n) && !taken(it)) { seen.add(it.n); out.push(it); } } });
      }
    };
    rounds(matched);
    const topical = out.length;
    rounds(general.map((x) => ({ x, score: 0 })));
    // every kid topic suits a child, so the other kid topics also fill a child's list
    if (aud !== 'a') {
      const used = new Set(matched.map((m) => m.x.id));
      rounds(groups.filter((x) => x.kw && !used.has(x.id)).map((x) => ({ x, score: 0 })));
    }
    return { list: out, topical, basis: matched.slice(0, 8).map((m) => m.x.lab) };
  };
})();
