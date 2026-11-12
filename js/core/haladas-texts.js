// A Haladás nézet minden felületi szövege egy helyen (docs/haladas-specifikacio.md, 8.). Tiszta modul.
// Tegező forma, gondolatjel nélkül. A „tétel” szó ideiglenes: a TERM cseréjével mindenhol változik.
// A szövegekben szereplő küszöbszámok a konfigurációból (haladas.json `allapot`) jönnek.
//
// A kiemelt részeket tartalmazó mondatok részek tömbjeként jönnek ([szöveg, kiemelt?]), így a felület
// szövegként (nem HTML-ként) rakja össze őket.

import { fromSuffix, accSuffix, timesSuffix } from './progress.js';
import { art } from './items.js';

export const TERM = Object.freeze({ nom: 'tétel', acc: 'tételt', from: 'tételből', about: 'tételről', pl: 'tételek' });

export const T = Object.freeze({
  open: 'Haladás',
  title: 'Hogy halad az olvasás?',
  back: '← Vissza',
  backToOverview: '← Vissza az áttekintéshez',
  statTitle: 'Ez csak statisztika',
  statFirst: `Többet számít, amit te látsz, és amit a gyereked érez egy-egy ${TERM.nom}nél.`,
  statRest: `Ha szerinted egy ${TERM.nom} már megy, akkor valószínűleg megy, bármit mutat itt a program. Használd segítségnek, de ne hagyatkozz rá teljesen, és ne a számokat akard javítani: az a cél, hogy szívesen olvasson. Egy ${TERM.nom} csoportja idővel változhat, ez természetes.`,
  more: 'Bővebben ▾',
  less: 'Kevesebb ▴',
  showAll: 'Mutasd mindet',
  perList: 'Listánként',
  grey: `A szürke rész: erről a ${TERM.about} még kevés az adat.`,
  howTitle: 'Honnan tudja ezt az Olvasóka?',
  how: [
    'Az Olvasóka nem tudja a helyes válaszokat, ezt te hallod a gyerek mellett. Így csak azt figyeli, mennyi idő alatt lapoztok tovább, és kellett-e takarás vagy visszalépés.',
    `A tempót mindig a gyereked saját tempójához méri, nem egy elvárt sebességhez. Csak azt nézi, hogy egy ${TERM.acc} nagyjából olyan gyorsan olvas-e, mint a többi betűt, szótagot vagy szót szokta. A hosszabb ${TERM.pl}nél a szótagok számával is számol. Más gyerekekhez nem hasonlítja.`,
  ],
  local: 'Az adatok csak ezen az eszközön vannak.',
  noStorage: 'Ezen az eszközön nem menthető a haladás, mert a böngésző nem engedi az adatok tárolását.',
  emptyCard: `Még nincs ilyen ${TERM.nom}.`,
  start: 'Kezdd el használni a programot, hogy láthasd a haladást!',
  partUnread: 'Még nem olvasta',
  notRead: 'Még nem olvasta.',
  whenRead: 'Amikor olvasta',
  helped: 'segítséggel olvasta',
  helpedShort: 'segítséggel',
  unhelped: 'segítség nélkül',
  mixed: 'segítséggel és anélkül is',
  mixedShort: 'vegyesen',
  groupFoot: 'Ez csak statisztika. Többet számít, amit te látsz, és amit a gyereked érez.',
  footStat: `Ez csak statisztika. Többet számít, amit te látsz, és amit a gyereked érez ennél a ${TERM.nom}nél.`,
});

/** A négy csoport neve és színe, a felületi sorrendben (8.2). */
export const CARDS = Object.freeze({
  fluent: { title: 'Megy', color: '#2E6B66', phrase: 'megy' },
  unsure: { title: 'Még bizonytalan', color: '#8DBDB6', phrase: 'még bizonytalan' },
  practice: { title: 'Még gyakorolni kell', color: '#E7B96A', phrase: 'még gyakorolni kell' },
  lowdata: { title: 'Kevés adat', color: '#BDB4A4', phrase: 'kevés adat' },
});
export const CARD_ORDER = Object.freeze(['fluent', 'unsure', 'practice', 'lowdata']);

/** Szám a ragjával: „3-at”, „5-ször”. */
const acc = (n) => `${n}-${accSuffix(n)}`;
const times = (n) => `${n}-${timesSuffix(n)}`;
/** „a 76-ból”, „az 5-ből” */
const from = (n) => `${art(n)} ${n}-${fromSuffix(n)}`;

/**
 * A kártyák magyarázó mondata (8.2). `a`: a konfiguráció `allapot` szakasza.
 * @returns {string}
 */
export function cardText(key, a) {
  switch (key) {
    case 'fluent': return `Az utóbbi ${a.megy_utolso_n} alkalommal takarás, megállítás és visszalépés nélkül olvasta, és nem akadt el rajta.`;
    case 'unsure': return 'Már olvasta segítség nélkül is, de néha még nehezen megy.';
    case 'practice': return `Az utóbbi ${a.gyakorol_utolso_n} alkalomból legalább ${times(a.gyakorol_segitseg_db)} kellett segítség, vagy sokkal lassabban olvasta, mint a többi ${TERM.acc}.`;
    default: return lowdataText(a);
  }
}

/**
 * A Kevés adat mondata (8.2, 8.4). `need` nélkül a csoport egészére: csak a ténylegesen érvényes feltételek
 * (a napszabály-kapcsolóval nincs napfeltétel; ha a napok száma már kiadja az alkalmakat, csak a napok).
 * `need`-del ('days' / 'count') egy tételre: a még hiányzó feltétel.
 */
export function lowdataText(a, need = null) {
  const head = `Egy ${TERM.about} csak akkor tudjuk a haladást megállapítani, ha`;
  const days = `legalább ${a.min_nap} különböző napon`, count = `legalább ${times(a.min_alkalom)}`;
  const useDays = need ? need === 'days' : a.min_nap > 0;
  const useCount = need ? need === 'count' : a.min_nap === 0 || a.min_alkalom > a.min_nap;
  if (useDays && useCount) return `${head} ${days} és összesen ${count} olvasta.`;
  return `${head} ${useDays ? days : count} olvasta.`;
}

/** A Kevés adat csoport oldalának „olvasta” alcíme (8.3): napszabály-kapcsolóval nem napokról szól. */
export const partRead = (a) => (a.min_nap > 0 ? 'Olvasta, még kevés napon' : 'Olvasta, még kevésszer');

/** Információs doboz, ha még egy tétel sincs csoportban (8.2). */
export const infoText = (minDays) => `Az első ${TERM.pl} legkorábban a ${minDays}. napon kerülnek csoportba.`;

/**
 * Az összefoglaló mondat (8.2): mind a négy csoportról, a 0 darabos csoportok nélkül.
 * „Eddig 100 tételt olvasott a 140-ből. 12 már csoportba került: 5 megy, 4 még bizonytalan, 3-at még
 * gyakorolni kell. A többi 128 tételről még kevés az adat.”
 */
export function summary({ seen, total, grouped, counts }) {
  if (!seen) return [[T.start]];
  const parts = [['Eddig '], [`${seen} ${TERM.acc}`, true], [` olvasott ${art(total)} `], [`${total}`, true], [`-${fromSuffix(total)}.`]];
  if (!grouped) return [...parts, [' Még mind a '], [`${total}`, true], [` ${TERM.about} kevés az adat.`]];
  parts.push([' '], [`${grouped}`, true], [' már csoportba került: ']);
  const clauses = [
    counts.fluent && [[`${counts.fluent}`, true], [' megy']],
    counts.unsure && [[`${counts.unsure}`, true], [' még bizonytalan']],
    counts.practice && [[`${counts.practice}`, true], [`-${accSuffix(counts.practice)} még gyakorolni kell`]],
  ].filter(Boolean);
  clauses.forEach((c, k) => { if (k) parts.push([', ']); parts.push(...c); });
  parts.push(['.']);
  if (counts.lowdata) parts.push([' A többi '], [`${counts.lowdata}`, true], [` ${TERM.about} még kevés az adat.`]);
  return parts;
}

export const listText = (fluent, total) => `${fluent} megy ${from(total)}`;
/** A listasáv akadálymentes címkéje: mind a négy szám, vagy ha mind kevés adat, ennyi. */
export function listAria(l) {
  if (l.total && l.lowdata === l.total) return `${l.name}: ${l.total} ${TERM.from} mindegyikről kevés az adat`;
  return `${l.name}: ${CARD_ORDER.map((k) => `${l[k]} ${CARDS[k].phrase}`).join(', ')}, ${l.total} ${TERM.from}`;
}

/** A csoport oldalának címe: „Megy: 60 tétel”. */
export const groupTitle = (key, n) => `${CARDS[key].title}: ${n} ${TERM.nom}`;
/** A „Mutasd mindet” akadálymentes neve: „Megy: mind a 60 tétel”. */
export const showAllAria = (key, n) => `${CARDS[key].title}: mind ${art(n)} ${n} ${TERM.nom}`;

const TYPE_ACC = Object.freeze({ betű: 'betűt', szótag: 'szótagot', szó: 'szót' });

/**
 * A tétel részleteinek fő mondata (8.4) a csoport és az ok szerint.
 * @param {{ group: string, reason: string|null, need?: string|null, type: string, helpN: number, helpK: number }} d
 */
export function reasonSentence(d, a) {
  const tw = TYPE_ACC[d.type] || TYPE_ACC.szó;
  if (d.group === 'unsure') {
    return d.reason === 'slow'
      ? `Segítség nélkül olvasta, de még lassabban, mint a többi ${tw}.`
      : 'Már olvasta segítség nélkül is, de néha még kell hozzá segítség.';
  }
  if (d.group === 'practice') {
    return d.reason === 'slow'
      ? `Lassabban olvasta, mint a többi ${tw}.`
      : `Az utóbbi ${d.helpN} alkalomból ${times(d.helpK)} kellett segítség.`;
  }
  if (d.group === 'lowdata') return lowdataText(a, d.need);
  return cardText(d.group, a);
}

const MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
/** „2026-10-24” → „okt. 24.” */
export const dateLabel = (day) => `${MONTHS[+day.slice(5, 7) - 1]} ${+day.slice(8, 10)}.`;

/** A tényeket mutató sor (8.4): „Eddig 9 alkalommal olvasta, 4 különböző napon. Először: okt. 24.” */
export const facts = (d) => [
  ['Eddig '], [`${d.exposures}`, true], [' alkalommal olvasta, '], [`${d.dayCount}`, true],
  [` különböző napon. Először: ${dateLabel(d.firstDay)}`],
];

const DAY_HELP = Object.freeze({ all: 'segítséggel', some: T.mixed, none: T.unhelped });
/** A pötty akadálymentes címkéje: „okt. 28., 4 alkalom, segítséggel” / „…, segítséggel és anélkül is”. */
export const dayAria = (day, count, help) => `${dateLabel(day)}, ${count} alkalom, ${DAY_HELP[help] || T.unhelped}`;
