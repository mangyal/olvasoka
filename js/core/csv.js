// CSV értelmezése (RFC 4180), a Google táblázat „Közzététel az interneten → CSV” kimenetéhez.
// Tiszta modul. Idézőjeles mező, benne vessző, sortörés és "" (escape-elt idézőjel) is lehet.

/**
 * @param {string} text
 * @returns {string[][]} sorok, soronként a mezők (a rövidebb sorok nincsenek kiegészítve)
 */
export function parseCsv(text) {
  const s = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', i = 0, quoted = false;
  while (i < s.length) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"' && field === '') { quoted = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r' || c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
      i += c === '\r' && s[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Oszlop betűjele: 0 → A, 25 → Z, 26 → AA. */
export function colName(i) {
  let n = i + 1, out = '';
  while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); }
  return out;
}
