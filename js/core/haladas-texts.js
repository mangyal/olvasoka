// A Haladás nézet minden felületi szövege egy helyen (docs/haladas-specifikacio.md, 8.). Tiszta modul.
// Tegező forma, gondolatjel nélkül. A „tétel” szó ideiglenes: a TERM cseréjével mindenhol változik.
//
// A kiemelt részeket tartalmazó mondatok részek tömbjeként jönnek ([szöveg, kiemelt?]), így a felület
// szövegként (nem HTML-ként) rakja össze őket.

import { fromSuffix } from './progress.js';
import { art } from './items.js';

export const TERM = Object.freeze({ nom: 'tétel', acc: 'tételt', from: 'tételből' });

export const T = Object.freeze({
  open: 'Haladás',
  title: 'Hogy halad az olvasás?',
  back: '← Vissza',
  backToOverview: '← Vissza az áttekintéshez',
  statTitle: 'Ez csak statisztika',
  statFirst: `Többet számít, amit te látsz, és amit a gyereked érez egy-egy ${TERM.nom}nél.`,
  statRest: `Ha szerinted egy ${TERM.nom} már megy, akkor valószínűleg megy, bármit mutat itt a program. Használd segítségnek, de ne hagyatkozz rá teljesen, és ne a számokat akard javítani: az a cél, hogy szívesen olvasson.`,
  more: 'Bővebben ▾',
  less: 'Kevesebb ▴',
  perList: 'Listánként',
  grey: 'A szürke rész: még nem látott vagy épp most ismerkedik vele.',
  howTitle: 'Honnan tudja ezt az Olvasóka?',
  how: `Az Olvasóka nem tudja a helyes válaszokat, ezt te hallod a gyerek mellett. Így csak azt figyeli, mennyi idő alatt lapoztok tovább, és kellett-e takarás vagy visszalépés. Egy ${TERM.nom} akkor „megy”, ha több különböző napon is gyorsan, segítség nélkül olvasta.`,
  local: 'Az adatok csak ezen az eszközön vannak.',
  noStorage: 'Ezen az eszközön nem menthető a haladás, mert a böngésző nem engedi az adatok tárolását.',
  emptyCard: `Még nincs ilyen ${TERM.nom}.`,
  emptyTitle: 'Még kevés adat a trendekhez',
  whenRead: 'Amikor olvasta',
  helped: 'segítséggel olvasta',
  helpedShort: 'segítséggel',
  unhelped: 'segítség nélkül',
  mayHelp: 'Mi segíthet?',
  footStat: `Ez csak statisztika. Többet számít, amit te látsz, és amit a gyereked érez ennél a ${TERM.nom}nél.`,
});

export const CARDS = Object.freeze({
  fluent: { title: 'Már megy', means: 'Több különböző napon is gyorsan, segítség nélkül olvasta.', color: '#2E6B66' },
  improving: { title: 'Egyre jobban megy', means: 'Napról napra gyorsabban és kevesebb segítséggel olvassa.', color: '#8DBDB6' },
  practice: { title: 'Gyakoroljuk még', means: 'Több napja olvassa, de még most is sokszor kell hozzá takarás vagy segítség.', color: '#E7B96A' },
});
export const CARD_ORDER = Object.freeze(['fluent', 'improving', 'practice']);
export const STATE_NAME = Object.freeze({ ...Object.fromEntries(CARD_ORDER.map((k) => [k, CARDS[k].title])), new: 'Még ismerkedik vele', unseen: 'Még nem olvasta' });

/** „a 76-ból”, „az 5-ből” */
const from = (n) => `${art(n)} ${n}-${fromSuffix(n)}`;

/** „Eddig 63 tételt olvasott a 76-ból. 30 már megy, 16 egyre jobban megy, és 7 tételt érdemes még gyakorolni.” */
export function summary({ seen, total, counts }) {
  const parts = [['Eddig '], [`${seen} ${TERM.acc}`, true], [` olvasott ${art(total)} `], [`${total}`, true], [`-${fromSuffix(total)}.`]];
  const clauses = [
    counts.fluent && [[`${counts.fluent} már megy`, true]],
    counts.improving && [[`${counts.improving} egyre jobban megy`, true]],
    counts.practice && [[`${counts.practice} ${TERM.acc} érdemes még gyakorolni`, true]],
  ].filter(Boolean);
  clauses.forEach((c, k) => {
    parts.push([k === 0 ? ' ' : k === clauses.length - 1 ? ', és ' : ', '], ...c);
  });
  if (clauses.length) parts.push(['.']);
  return parts;
}

/** A csempék alatti szám, ha nem fér ki mind. */
export const moreText = (n) => `+ ${n} további ${TERM.nom}`;

export const listText = (fluent, total) => `${fluent} megy ${from(total)}`;
export const listAria = (l) => `${l.name}: ${l.fluent} megy, ${l.improving} egyre jobban megy, ${l.practice} gyakorolni való, ${l.total} ${TERM.from}`;

/** Az üres állapot mondata (8.4). */
export const emptyText = (days, items) => [
  ['Eddig '], [`${days} napon`, true], [' gyakoroltatok, '], [`${items} ${TERM.acc}`, true],
  [' olvasott. Legalább 3 gyakorlási nap után látszik, mi megy már könnyen, és mi kér több gyakorlást.'],
];
export const emptyAria = (have, need) => `${need} szükséges napból ${have} megvan`;
export const emptyCount = (have, need) => `${have} / ${need} nap`;

const NUM = ['', 'Egy', 'Két', 'Három', 'Négy', 'Öt', 'Hat', 'Hét', 'Nyolc', 'Kilenc', 'Tíz', 'Tizenegy', 'Tizenkét'];
const num = (n) => NUM[n] || String(n);

/**
 * Időtartam szövegesen (8.4b): egy hónap alatt fél hetekre kerekítve, utána egész hónapokra.
 * 0–3 nap: „Pár napja”.
 */
export function durationText(days) {
  if (days < 4) return 'Pár napja';
  if (days < 30) {
    const halves = Math.max(2, Math.round(days / 3.5));       // fél hetek, legalább egy hét
    const w = Math.floor(halves / 2), half = halves % 2 === 1;
    if (w === 1 && half) return 'Másfél hete';
    return `${num(w)}${half ? ' és fél' : ''} hete`;
  }
  return `${num(Math.max(1, Math.round(days / 30)))} hónapja`;
}

const MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
/** „2026-10-24” → „okt. 24.” */
export const dateLabel = (day) => `${MONTHS[+day.slice(5, 7) - 1]} ${+day.slice(8, 10)}.`;

/**
 * A tétel részleteinek mondata (8.3). A „Gyakoroljuk még” sablon a spec szerint változatlan; a
 * „szinte mindig” 80% fölött, a „takarás”, ha a legutóbbi napokon a takarás volt a több segítség.
 */
export function detailSentence(d) {
  switch (d.state) {
    case 'fluent': return 'Több napon is gyorsan, segítség nélkül olvasta.';
    case 'improving': return 'Egyre gyorsabban és kevesebb segítséggel olvassa.';
    case 'practice':
      return `${durationText(d.sinceFirst)} olvassa, de még most is ${d.helpRecent > 0.8 ? 'szinte mindig' : 'gyakran'} kell hozzá ${d.coverMostly ? 'takarás' : 'segítség'}${d.slower ? ', és nem lett gyorsabb' : ''}.`;
    case 'new': return 'Most ismerkedik vele, még kevés alkalommal olvasta.';
    default: return 'Még nem olvasta.';
  }
}

export const mayHelpText = (letter) => [
  [`Ezek a ${TERM.nom}ek is nehezebben mennek, mindegyikben `], [`„${letter}”`, true],
  [` van. Lehet, hogy nem a ${TERM.nom}, hanem ez a betű a nehéz.`],
];
export const cardNote = (letter) => `A legtöbbjükben „${letter}” van.`;
export const footLists = (names) => (names.length ? `Szerepel: ${names.join(', ')}` : '');
export const tileLabel = (item, state) => `${item}, ${STATE_NAME[state].toLowerCase()}`;
export const dayAria = (day, helped) => `${dateLabel(day)} ${helped ? T.helped : T.unhelped}`;
