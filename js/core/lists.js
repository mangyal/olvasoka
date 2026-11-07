// A lists.json értelmezése. Tiszta modul: hibás részeknél nem dob, hanem kihagy és jelez.

import { analyzeItems, nameKey, art, MAXLEN } from './items.js';

/**
 * @param {string|object} input  a lists.json szövege vagy már feldolgozott objektuma
 * @returns {{ok:true, lists:{name:string,items:string[]}[], problems:string[]} | {ok:false, error:string}}
 */
export function parseListsJson(input) {
  let o = input;
  if (typeof o === 'string') {
    try { o = JSON.parse(o); }
    catch (e) { return { ok: false, error: `A lists.json nem érvényes JSON (${e.message}). Javítsd a GitHubon.` }; }
  }
  if (!o || typeof o !== 'object' || !Array.isArray(o.lists)) {
    return { ok: false, error: 'A lists.json-ban nincs „lists” tömb. Nézd meg a README-ben a formátumot.' };
  }
  const lists = [], problems = [], seen = new Set();
  o.lists.forEach((l, i) => {
    const pos = `${i + 1}.`;
    if (!l || typeof l.name !== 'string' || !l.name.trim()) {
      problems.push(`${cap(art(i + 1))} ${pos} listának nincs neve, kimaradt.`);
      return;
    }
    const name = l.name.normalize('NFC').trim();
    const k = nameKey(name);
    if (seen.has(k)) { problems.push(`A „${name}” lista kétszer szerepel, a második kimaradt.`); return; }
    seen.add(k);
    if (!Array.isArray(l.items)) {
      problems.push(`A „${name}” listában nincs „items” tömb, ezért üres.`);
      lists.push({ name, items: [] });
      return;
    }
    const strs = l.items.filter((x) => typeof x === 'string' || typeof x === 'number').map(String);
    const a = analyzeItems(strs.join('\n'));
    const long = a.entries.filter((e) => e.status === 'long');
    if (long.length) {
      problems.push(`„${name}”: túl hosszú tétel kimaradt (max. ${MAXLEN} karakter): ${long.map((e) => `„${e.text}”`).join(', ')}.`);
    }
    lists.push({ name, items: a.items });
  });
  return { ok: true, lists, problems };
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
