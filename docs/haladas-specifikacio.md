# Olvasóka: Haladás (tétel-elsajátítás) specifikáció

Verzió: 1.5 · 2026. november 11.
Mellékletek: a jóváhagyott képernyőtervek képernyőképei (lásd 8. fejezet).

## 0. Változások

### 1.5 (az 1.4-hez képest)
- Tömör tárolt formátum (2. verzió, 4.2a): a valós dev adatokon 156 kB → 23 kB, ugyanazokkal az állapotokkal. Az 1. verzió betöltéskor átalakul. Az olvasási idők 100 ms-os felbontással tárolódnak.

### 1.4 (az 1.3-hoz képest)
- A nyers napló korlátja a napok mellett a körök száma is: a legutóbbi 30 kör (`tarolas.nyers_megorzes_kor`) (4.3, 7.1).

### 1.3 (az 1.2-höz képest, a fejlesztői kérdések alapján)
- Tételkulcs: a kis- és nagybetű **különbözik** (`ház` ≠ `Ház`); csak NFC és szélek levágása (3., 11.).
- Betűbontás: a hosszú többjegyű mássalhangzó két betű (`ssz` → `sz`+`sz`, `ggy` → `gy`+`gy`); a `tokenize()` javítva, a Keresd meg! is ezt használja (7.2).
- Olvasási idő: a megállítás alatt eltelt idő olvasási idő, ha az oldal látszik; az elrejtett oldal ideje nem. Az ablakfókusz elvesztése miatti automatikus megállítás nem segítség (5.2).
- Szünetből vagy időzítős továbblépés utáni ←: mindig valódi újraolvasás (5.2).
- Kilépés a kör közben: a látható tétel megjelenés, ha legalább 400 ms-ig látszott, olvasási idő nélkül (5.2).
- Napi összesítő: új `help` mező (megjelenésenként `0`/`1`, időrendben); a `dwellMs` és a `help` legfeljebb 20 elem, az első és az utolsó 10 (4.2).
- „Már megy”, típus-medián feltétel: legalább `megy_tipus_median_szorzo`-szor (0,8) gyorsabb a mediánnál (7., 7.1).
- „Mi segíthet?”: csak szótagnál és szónál (7.2).
- Keresd meg!: egyelőre semmi nem naplózódik (2.).
- Listaazonosság: az adat tárolódik, felülete nincs (6.).
- Felület: a „Mind” nézet kimarad (később), helyette „+ N további tétel” szöveg; hash-alapú navigáció; töréspontok; betűtípus; hiányzó szövegek (8.).
- Az áttekintés „összes” száma mindig az összes jelenlegi lista egyedi tételei, a szülői felület kijelölésétől függetlenül (8.2).
- A „Gyakoroljuk még” részletmondata a sablon szerint marad akkor is, ha a tétel csak a lassúság miatt került ide (8.3).
- A `haladas.json` ellenőrzése kiadáskor: `.github/scripts/check-haladas.mjs` (7.1).

## 1. Cél és alapelvek

A szülő lássa, hogy a gyereke mely tételeket (betű, szótag, szó) olvassa már biztosan, melyek mennek egyre jobban, és melyeket érdemes még gyakorolni.

Alapelvek, amelyek minden döntést felülírnak:

- **A program nem tudja a helyes választ.** A helyességet a szülő hallja. Semmilyen funkció nem kérheti a szülőt, hogy egyenként jelölje a jó vagy rossz olvasást.
- **Csak a meglévő interakciókból dolgozunk:** továbblépés, visszalépés, takarás, megállítás, és ezek időzítése.
- **Csak statisztika.** A felület mindig hangsúlyozza, hogy a szülő megfigyelése és a gyerek érzése többet számít.
- **Nincs fiók, nincs regisztráció, nincs adatfeltöltés.** Minden adat a szülő eszközén marad.
- **Nincs sorozat (streak), jelvény, pontszám, piros szín, és a gyerek semmit nem lát ebből.**
- **Szülőknek szól, nem adatelemzőknek:** egyszerű nyelv, kevés szám, magyarázattal.

## 2. Hatókör

### Benne van
1. Eseménynapló a gyakorlásról (Felolvasás mód), helyben tárolva.
2. Mellényomás-szűrés (javított mellényomás, véletlen átugrás).
3. Napi tételösszesítők és belőlük számolt tételállapotok.
4. Haladás nézet: áttekintés, tétel részletei, üres állapot. Asztali és telefonos (álló, fekvő) elrendezés.
5. Visszavonás-barát visszalépés: gyors visszalépés visszaállítja a tétel takarási állapotát és hátralévő idejét.
6. Konfigurálható küszöbök egy repóbeli JSON fájlban (lásd 7.1).
7. Környezeti változó a napszabályok kikapcsolására, hogy tesztelésnél ne kelljen napokat várni (lásd 10.).

### Nincs benne (később)
- **Átvitel másik eszközre (export/import): 2. fázis.** Az adatmodell már most támogatja (véletlen azonosítók, `deviceId`), de a funkció és a link nem készül el. A tervrajz lábléc-linkje és az üres állapot erre utaló mondata ezért most kimarad (lásd 8.2, 8.4, 9.).
- Gyerekválasztó (több gyerek egy eszközön). Az adatmodell előkészíti, lásd 4.2.
- Keresd meg! mód naplózása és hatása az állapotokra (egyelőre semmi nem naplózódik).
- Névtelen használati statisztika a fejlesztőnek.
- „Nagy billentyűk” kiosztás, prezentációs távirányító támogatás.
- Okos keverés (nehéz tételek gyakoribb sorsolása), kör végi összefoglaló.
- Gomb, amely tételt tesz a következő körbe (kifejezetten elvetve).

## 3. Fogalmak

| Fogalom | Jelentés |
|---|---|
| Tétel | Egy lista egy eleme (betű, szótag vagy szó). Ideiglenes elnevezés, később cserélhető, ezért a felületi szöveg egy helyről jöjjön. |
| Tételkulcs | A tétel szövege `itemKey()` szerint (NFC, trim). **A kis- és nagybetű különbözik** (`ház` és `Ház` két tétel), **a kötőjel megmarad**: `ma`, `ma-ma` és `mama` három külön tétel. |
| Megjelenés (exposure) | A tétel egyszeri, érvényes megjelenése egy körben (lásd 5.1). |
| Olvasási idő (dwell) | A tétel megjelenésétől a továbblépésig eltelt idő, csak kézi léptetésnél (villantás = 0). |
| Segítség | Takarás, megállítás vagy valódi visszalépés egy megjelenés alatt. |
| Kiindulás (baseline) | A tétel első 3 érvényes, kézi léptetéses megjelenésének medián olvasási ideje. |
| Relatív idő | A legutóbbi 3 kézi megjelenés medián ideje osztva a kiindulással. 1,0 = változatlan, 0,6 = 40%-kal gyorsabb. |
| Nap | Helyi naptári nap (Europe/Budapest a gyakorlatban; a böngésző helyi ideje). |

## 4. Adatmodell és tárolás

### 4.1 Tárolás
- localStorage, a meglévő környezetfüggő névvel kiegészítve: éles `olvasoka.haladas`, dev `olvasoka-dev.haladas` (az `ENV.storageKey` alapján, lásd `js/core/env.js`). Dev és éles soha nem írhatja egymás adatait.
- Minden hozzáférés try/catch között, a `js/data/store.js` mintájára. Ha a tárolás nem elérhető, a gyakorlás változatlanul működik, a Haladás nézet tájékoztat, hogy ezen az eszközön nem menthető a haladás.
- Javasolt új modulok: `js/data/progress-log.js` (napló, tárolás, tömörítés) és `js/core/mastery.js` (tiszta számítások, tesztelhetően). Minden időfüggő függvény kívülről kapja az időt (`now`), ahogy a `js/core/round.js` reducere is; a számításokban sehol ne legyen közvetlen `Date.now()`. A meglévő `js/core/progress.js` a körön belüli pöttyös jelző, azt nem kell módosítani.

### 4.2 Rekordok

```js
// Tárolt gyökér
{
  v: 1,
  deviceId: "r-8f3a…",          // véletlen, első induláskor
  child: "default",              // most konstans; a gyerekválasztó később ezt tölti
  events: [ /* nyers események, legfeljebb 30 napig */ ],
  daily:  [ /* napi tételösszesítők, véglegesen */ ],
  rounds: [ /* körök, véglegesen, rövid formában */ ],
  lists:  { /* listaazonosság, lásd 6. */ }
}

// Kör
{ id, child, t0, mode: "read", listNames: [...], listIds: [...], listHash: "a1b2c3d4",
  flashMs, gapMs, count, completed: true|false, abandonedAt: index|null, corrections: n,
  folded: true|false }                         // folded: a napi összesítőkbe már bekerült

// Esemény (nyers); i: a kör pozíciója; a villantási idő a körben van
{ id, round, t, i, item: "<tételkulcs>",
  type: "show"|"next"|"prev"|"pause"|"resume"|"blur"|"cover"|"uncover"|"hidden"|"visible"|"end"|"exit",
  auto?, fromGap?, coveredCount? }

// Napi összesítő (tétel × nap)
{ id: "<deviceId>|<child>|<item>|<YYYY-MM-DD>", child, item, day,
  exposures, manualExposures, dwellMs: [..],   // kézi megjelenések idői, legfeljebb 20 érték
  medianDwellMs, covers, pauses, prevs, supportedExposures,
  unsupportedFastFlash,                        // segítség nélkül, villantás ≤ 5000 ms mellett
  help: "0010…" }                              // megjelenésenként, időrendben: 1 = segítséggel
```

- Minden azonosító véletlen (pl. `crypto.randomUUID()`, ha nincs, saját véletlen).
- A tétel **szövegét** tároljuk, sosem a lista indexét.
- A kör a lista nevét **és tartalmi hash-ét** is tárolja (rövid, pl. 8 hexa karakter a rendezett tételkulcsokból).

### 4.2a Tárolt formátum (2. verzió)
A 4.2 rekordjai a program memóriájában ilyen olvasható alakban vannak; a localStorage-be tömör alak kerül (`js/data/progress-codec.js`):
- a körök és a napi összesítők mezőnevek nélküli tömbök; a napi összesítő azonosítója (eszköz|gyerek|tétel|nap) és mediánja betöltéskor áll elő;
- a kör a tételeit egyszer tárolja (pozíció szerint); az események körönként egy szövegben vannak (`eltelt idő,pozíció,kód`), tétel és saját azonosító nélkül;
- az olvasási idők 100 ms-os egységben;
- az azonosítók rövidek (10 karakter, véletlen).
Az 1. verziójú (olvasható) adat betöltéskor átalakul; ismeretlen, újabb verziót a program nem ír felül.

### 4.3 Tömörítés és méret
- A nyers események a legutóbbi 30 körből (`nyers_megorzes_kor`) és legfeljebb 30 napig (`nyers_megorzes_nap`) maradnak meg; ami bármelyik korláton túl van, törlődik. Így a nyers napló mérete a használat gyakoriságától függetlenül korlátos (kb. 150 kB). Törlés előtt bekerülnek a napi összesítőkbe: minden kör a lezárásakor (vagy ha a lap közben bezárult, a következő induláskor) egyszer hozzáadódik. Az összesítő az eseményekből újraszámolható, amíg azok megvannak (`js/core/exposures.js`).
- `dwellMs` és `help`: legfeljebb 20 elem; ha több, az első és az utolsó 10 marad (a kiindulás az elejéből, a legutóbbiak a végéből számolnak).
- Mért méretek (2. verzió): egy 16 tételes kör nyers naplója kb. 0,3 kB (a 30 körös korláttal legfeljebb kb. 10 kB); egy napi összesítő kb. 50–130 karakter az aznapi olvasások számától függően (napi 20 tétel×nap mellett évi kb. 0,5 MB). Valós dev adat 19 kör után: 23 kB (az 1. verzióban 156 kB).
- Ha az írás kvótahiba miatt sikertelen: előbb a legrégebbi nyers események törlődnek (összesítés után), a napi összesítők sosem.

## 5. Naplózás és mellényomás-szűrés

### 5.1 Mit naplózunk
A `js/core/round.js` állapotgép eseményei alapján (SPACE/NEXT, PREV, PAUSE, BLUR, COVER, COVER_DOWN, TICK okozta továbblépés, kilépés). A naplózás a reducer köré épül (`js/core/practice-log.js`: az átmenet előtti és utáni állapotból), a reducer tiszta marad. Az oldal elrejtése és újra megjelenése (`hidden`, `visible`) a felületi rétegből jön.

Takarásnál csak a takarás kezdete (`cover`: nem volt letakart szótag → van) és vége (`uncover`) naplózódik; a takarás okozta automatikus megállítás nem külön esemény.

### 5.2 Szűrési szabályok
Kezdőértékek; mind a 7.1 szerinti konfigurációs fájlból jön (`szures` szakasz):

| Minta | Értelmezés | Kezelés |
|---|---|---|
| Továbblépés, majd **2 mp-en belül** visszalépés | Javított mellényomás | Mindkettő törlődik, a tétel olvasási ideje a két szakasz összege. Nem segítség. A kör `corrections` számlálója nő. |
| …és a visszatérés után **3 mp-en belül** takarás | A gyerek takarni akart | Egy takarásnak számít, nem visszalépésnek. |
| A tétel **400 ms-nál rövidebb** ideig látszott | Véletlen átugrás | Nem megjelenés. |
| Takarás és felfedés **1 mp-en belül** | Ügyetlenség | Figyelmen kívül marad. |
| Visszalépés **2 mp-nél később**, vagy szünetből, vagy időzítős továbblépés után | Valódi újraolvasás | Segítség azon a tételen, ahová visszalép. Az újraolvasás ideje nem számít az olvasási időbe. |
| Olvasási idő **30 mp felett** | Közbejött valami | Az idő nem számít bele (a megjelenés igen). |
| Megállítás (P, ▶) | | Segítség; a megállítás ideje olvasási idő, ha az oldal látszik. |
| Az ablak elveszti a fókuszt (automatikus megállítás) | Nem a gyerek kérte | Nem segítség. |
| Az oldal nem látszik | | Az elrejtett idő nem olvasási idő. |
| Kilépés a kör közben | | A látható tétel megjelenés, ha legalább 400 ms-ig látszott, olvasási idő nélkül. |

Súlyozás az állapotszámításban: a takarás erős jel, a megállítás közepes, a visszalépés gyenge (a gyerek is nyomhatja).

### 5.3 Visszavonás-barát visszalépés
Ha a visszalépés 2 mp-en belül jön a továbblépés után, a tétel **pontosan úgy** jelenjen meg újra, ahogy elhagyta: ugyanaz a takarás, ugyanannyi hátralévő villantási idő, ugyanaz a megállított állapot. Egyéb esetben a jelenlegi viselkedés marad.

## 6. Listák változása

- A tételtörténet a tételkulcshoz tartozik, ezért tétel hozzáadása, törlése, áthelyezése, listák átrendezése nem érinti.
- A lista nézetek mindig a **jelenlegi** lista tartalmából számolnak.
- Szövegváltozás (pl. `haz` → `ház`, `ma-ma` → `mama`) új tételt jelent. A régi tétel története a betűstatisztikában megmarad, a listanézetben nem jelenik meg.
- Listaazonosság betöltéskor: azonos név → ugyanaz a lista. Eltérő név, de legalább 60% tételátfedés → átnevezett lista, a listaszintű történet átkerül. Egyébként új lista.

## 7. Állapotszámítás

Tételenként, a napi összesítőkből. Minden szám a táblázatban a 7.1 szerinti konfigurációból jön (`allapot` szakasz); az itt látható értékek az alapértelmezések.

| Állapot | Felületi név | Feltétel |
|---|---|---|
| Nem látott | (szürke sávrész) | 0 megjelenés |
| Új | „még ismerkedik vele” (szürke sávrész) | Kevesebb mint 3 különböző napon látta, vagy egyik alábbi feltétel sem teljesül |
| Már megy | Már megy | Legalább 3 napon látta, **és** az utolsó 3 megjelenésnél nem volt segítség, **és** az alábbiak egyike: relatív idő ≤ 0,8; az utolsó 3 kézi megjelenés karakterenkénti medián ideje legfeljebb 0,8-szorosa (`megy_tipus_median_szorzo`) a gyerek azonos típusú tételei karakterenkénti mediánjának (utolsó 30 nap); legalább 2 megjelenés segítség nélkül 5 mp vagy rövidebb villantással |
| Gyakoroljuk még | Gyakoroljuk még | Legalább 5 napon látta, az első megjelenés legalább 14 napja volt, nem „Már megy”, **és** (az utolsó 5 megjelenés legalább felénél segítség kellett, **vagy** relatív idő > 0,9) |
| Egyre jobban megy | Egyre jobban megy | Legalább 3 napon látta, nem „Már megy”, nem „Gyakoroljuk még”, **és** (relatív idő ≤ 0,9, **vagy** az utolsó 3 megjelenés segítségaránya kisebb, mint az első 3-é) |

Típus (betű, szótag, szó) és betűszám: a meglévő `typeOf()` és `tokenize()` (`js/core/grid.js`) szerint, így a karakterenkénti idő betűnként értendő, a többjegyű betűt egynek számolva.

### 7.1 Konfigurálható küszöbök
- Fájl: `haladas.json` a repó gyökerében, a `parok.json` mintájára (`_leiras` mezőkkel magyarázva). A program induláskor betölti; ha hiányzik vagy hibás, a kódba épített alapértékekkel fut, és a konzolra figyelmeztet.
- Ellenőrzés a `parok.json`-hoz hasonlóan (`js/core/haladas-config.js`, `validate`): ismeretlen vagy hiányzó kulcs, rossz típus vagy értelmetlen érték (pl. negatív idő, 0 és 1 közé nem eső arány) esetén **a deploy megáll** (`.github/scripts/check-haladas.mjs` a kiadásban, és a tesztek a PR-on).
- A szülő nem látja és nem állítja.
- Szerkezet és alapértékek:

```json
{
  "_leiras": "A Haladás nézet küszöbei. Idők ezredmásodpercben, arányok 0 és 1 között.",
  "szures": {
    "javitott_melle_ms": 2000,
    "takaras_szandek_ms": 3000,
    "veletlen_atugras_ms": 400,
    "takaras_ugyetlenseg_ms": 1000,
    "max_olvasasi_ido_ms": 30000
  },
  "allapot": {
    "kiindulas_n": 3,
    "uj_min_nap": 3,
    "megy_utolso_segitseg_nelkul": 3,
    "megy_relativ_ido_max": 0.8,
    "megy_tipus_median_szorzo": 0.8,
    "megy_gyors_villantas_ms": 5000,
    "megy_gyors_villantas_db": 2,
    "javul_relativ_ido_max": 0.9,
    "gyakorol_min_nap": 5,
    "gyakorol_min_eltelt_nap": 14,
    "gyakorol_utolso_n": 5,
    "gyakorol_segitseg_arany": 0.5,
    "gyakorol_relativ_ido_min": 0.9
  },
  "betu": {
    "ablak_nap": 30,
    "min_tetel": 3,
    "kiemeles_szorzo": 2,
    "kartya_megjegyzes_arany": 0.5,
    "kapcsolodo_max": 5
  },
  "tarolas": {
    "nyers_megorzes_nap": 30,
    "nyers_megorzes_kor": 30,
    "ures_allapot_min_nap": 3
  }
}
```

### 7.2 Betűk és a „leggyengébb rész”
- Betűbontás: **a meglévő `tokenize()` függvény** (`js/core/grid.js`), saját betűlistát nem szabad bevezetni. Ez kezeli a többjegyű betűket (`dzs`, majd `cs`, `dz`, `gy`, `ly`, `ny`, `sz`, `ty`, `zs`) és a hosszú többjegyű mássalhangzót két betűként (`ssz` → `sz`+`sz`, `ggy` → `gy`+`gy`); a hosszú és rövid magánhangzó külön betű (`o`, `ó`). A hasonló betűpárok (`parok.json`) ehhez a funkcióhoz nem kellenek.
- Betű segítségaránya = a betűt tartalmazó tételek megjelenéseinek hány százalékánál volt segítség (utolsó 30 nap, legalább 3 különböző tétel kell).
- Egy tétel leggyengébb betűje: a benne lévő betűk közül a legnagyobb segítségarányú.
- **Kártya megjegyzés** („A legtöbbjükben „gy” van.”): ha a „Gyakoroljuk még” tételek (legalább 2) legalább felében (`kartya_megjegyzes_arany`) ugyanaz a betű szerepel. Ha több ilyen betű is van, a nagyobb segítségarányú.
- **„Mi segíthet?” blokk** a tétel részleteinél, csak szótagnál és szónál (betűnél soha): akkor jelenik meg, ha a leggyengébb betű segítségaránya legalább kétszerese a betűt nem tartalmazó tételekének. Legfeljebb 5 kapcsolódó tételt mutat ugyanazzal a betűvel, „Gyakoroljuk még” vagy „Egyre jobban megy” állapotból. Ha a feltétel nem teljesül, a blokk nem jelenik meg.

## 8. Felület

A képernyőképek a jóváhagyott tervek. Szövegek: tegező forma, mint a program többi része, **gondolatjel (–, —) nélkül**. A felületi szövegek egy helyen legyenek (a „tétel” szó később cserélődhet).

| Képernyőkép | Tartalom |
|---|---|
| Szülői áttekintés (dashboard) | Asztali áttekintés |
| Tétel részletei: gyöngy | Asztali tétel nézet |
| Üres állapot: első napok | Kevés adat esetén |
| Telefon, álló: áttekintés / tétel | 390 px széles elrendezés |
| Telefon, fekvő: áttekintés / tétel | 844 × 390 elrendezés |

### 8.1 Belépési pont és navigáció
- A szülői felület fejlécében egy „Haladás” gomb ikonnal a Súgó és a Betűteszt mellett; telefonon, mint azok, csak ikon. Gyakorlás közben nem érhető el, a gyerek felületén nem jelenik meg.
- A Haladás a szülői felület helyére lép (mint a gyakorlónézet). Címek: `#haladas`, `#haladas/tetel/<tételkulcs>`, így a rendszer vissza gombja és gesztusa is működik.
- Esc: a tétel részleteiből vissza az áttekintéshez, az áttekintésből a szülői felületre. A „← Vissza” ugyanígy.

### 8.1a Elrendezések
- **Álló telefon:** 600 px-nél keskenyebb ablak. Az „Ez csak statisztika” összecsukható, alapból csukva.
- **Fekvő telefon:** legfeljebb 500 px magas, fekvő, legalább 560 px széles ablak (keskenyebben a három oszlop nem fér el, ott az álló elrendezés jön).
- **Asztali:** minden más (a tablet is).
- Csempék kártyánként: asztalon 6, álló telefonon 4, fekvőn 3.
- Betűtípus: a felület szövegei a program felületi betűjével (`--f-ui`), a tételek (csempék, a nagy tétel) a gyakorló betűvel (`--f-item`).

### 8.2 Áttekintés (felülről lefelé)
1. **Cím:** „Hogy halad az olvasás?”
2. **Összefoglaló mondat:** „Eddig **{látott} tételt** olvasott a **{összes}**-ból. **{megy} már megy**, **{javul} egyre jobban megy**, és **{gyakorol} tételt érdemes még gyakorolni**.” Az összes = az összes jelenlegi lista egyedi tételkulcsai (a szülői felület kijelölésétől függetlenül). A -ból/-ből rag a meglévő `fromSuffix()` szerint. Ha valamelyik szám 0, a hozzá tartozó tagmondat elmarad.
3. **„Ez csak statisztika” doboz** (világoskék háttér, kiemelt):
   > Többet számít, amit te látsz, és amit a gyereked érez egy-egy tételnél. Ha szerinted egy tétel már megy, akkor valószínűleg megy, bármit mutat itt a program. Használd segítségnek, de ne hagyatkozz rá teljesen, és ne a számokat akard javítani: az a cél, hogy szívesen olvasson.

   **Álló telefonon összecsukható**, alapból csukva: a cím, a „Bővebben ▾” gomb és az első mondat látszik, a többi kinyitáskor („Kevesebb ▴”). Valódi `<button>`, `aria-expanded`. Asztalon és fekvő telefonon mindig nyitva.
4. **Három kártya ebben a sorrendben:** Már megy, Egyre jobban megy, Gyakoroljuk még. Mindegyiken: cím, darabszám, egy mondat a jelentéséről, tétel-csempék (koppintásra a tétel részletei). Ha nem fér ki mind: „+ N további tétel” (szöveg, nem link); a „Mind” nézet egyelőre kimarad (később).
   - Már megy: „Több különböző napon is gyorsan, segítség nélkül olvasta.”
   - Egyre jobban megy: „Napról napra gyorsabban és kevesebb segítséggel olvassa.”
   - Gyakoroljuk még: „Több napja olvassa, de még most is sokszor kell hozzá takarás vagy segítség.” Közvetlenül alatta a 7.2 szerinti betű-megjegyzés, ha van.
   - Csempék sorrendje: Gyakoroljuk még kártyán a legtöbb segítséget igénylő elöl; a másik kettőn a legutóbb látott elöl. Darabszám: 8.1a.
   - Ha egy kártya üres: rövid, semleges szöveg (pl. „Még nincs ilyen tétel.”).
5. **Listánként:** listánként név, egy sáv (Már megy, Egyre jobban megy, Gyakoroljuk még színekkel, a maradék szürke), és „{megy} megy a {összes}-ból/-ből”. Alatta: „A szürke rész: még nem látott vagy épp most ismerkedik vele.” A sáv `role="img"` és teljes `aria-label`.
6. **„Honnan tudja ezt az Olvasóka?”** (halványabb, kisebb szöveg, mindig látható):
   > Az Olvasóka nem tudja a helyes válaszokat, ezt te hallod a gyerek mellett. Így csak azt figyeli, mennyi idő alatt lapoztok tovább, és kellett-e takarás vagy visszalépés. Egy tétel akkor „megy”, ha több különböző napon is gyorsan, segítség nélkül olvasta.
7. **Lábléc:** „Az adatok csak ezen az eszközön vannak.” Az „Átvitel másik eszközre” link a 2. fázisban kerül mellé (a képernyőképeken már látszik, most ne készüljön el).

### 8.3 Tétel részletei
1. „← Vissza az áttekintéshez”.
2. **Fő kártya:** a tétel nagy betűvel (a program betűtípusával, kötőjellel együtt), az állapot neve, és egy egyszerű mondat. Mondatsablonok:
   - Már megy: „Több napon is gyorsan, segítség nélkül olvasta.”
   - Egyre jobban megy: „Egyre gyorsabban és kevesebb segítséggel olvassa.”
   - Gyakoroljuk még: „{időtartam} olvassa, de még most is {gyakran / szinte mindig} kell hozzá {takarás / segítség}{, és nem lett gyorsabb}.” Az időtartam szövegesen (8.4b), a „szinte mindig” az utolsó 5 megjelenés 80%-a felett, a „takarás”, ha a legutóbbi 5 napon a takarás legalább annyi volt, mint a megállítás és a visszalépés együtt, a „nem lett gyorsabb” relatív idő > 0,9 esetén. A sablon akkor is ez, ha a tétel csak a lassúság miatt került ide.
   - Új: „Most ismerkedik vele, még kevés alkalommal olvasta.”
3. **„Amikor olvasta”:** a napok pöttyökkel (legfeljebb az utolsó 14 gyakorlási nap), dátummal. Kitöltött sárga: aznap volt segítség; fehér, zöld kerettel: aznap segítség nélkül. Jelmagyarázat alatta.
4. **„Mi segíthet?”** a 7.2 szerint, ha van. Szöveg: „Ezek a tételek is nehezebben mennek, mindegyikben „{betű}” van. Lehet, hogy nem a tétel, hanem ez a betű a nehéz.” Alatta a kapcsolódó tételek csempéi; koppintásra a saját részleteikre visznek.
5. **Lábléc:** „Szerepel: {listák} · Ez csak statisztika. Többet számít, amit te látsz, és amit a gyereked érez ennél a tételnél.”

### 8.4 Üres állapot
Ha kevesebb mint 3 különböző gyakorlási nap van: az oldal címe „Haladás”, „← Vissza” linkkel (mint az áttekintésen); alatta „Még kevés adat a trendekhez” cím, a mondat („Eddig {n} napon gyakoroltatok, {m} tételt olvasott. Legalább 3 gyakorlási nap után látszik, mi megy már könnyen, és mi kér több gyakorlást.”), és egy 3 részes haladásjelző. Alatta: „Az adatok csak ezen az eszközön vannak.” Az export/importra utaló második mondat a 2. fázisig kimarad.

### 8.4a Tárolás nem elérhető
Ha a böngésző nem engedi a tárolást: „Ezen az eszközön nem menthető a haladás, mert a böngésző nem engedi az adatok tárolását.”

### 8.4b Időtartam szövegesen
Egy hónap alatt fél hetekre kerekítve („Két hete”, „Két és fél hete”, „Három hete”), utána egész hónapokra („Egy hónapja”, „Két hónapja”).

### 8.5 Vizuális szabályok
- A meglévő tokenek (`css/tokens.css`): háttér `--paper`, kártya `--field`, keret `--line`, szöveg `--ink` / `--ink-2`, kiemelés `--accent`, az „Ez csak statisztika” doboz `--sky`.
- Állapotszínek, világosságban is eltérve: Már megy `#2E6B66`, Egyre jobban megy `#8DBDB6`, Gyakoroljuk még `#E7B96A`, szürke `#ECE5D6`. **Piros nincs.**
- Minden érinthető elem legalább 44 px magas. Szöveg kontraszt legalább 4,5:1.
- Reszponzív: a meglévő minimum (320 × 256) felett minden elrendezés működjön. Fekvő telefonon az összefoglaló és a statisztika doboz egymás mellett, a három kártya egy sorban, oldalt 48 px biztonsági margó.

## 9. Átvitel másik eszközre (export/import): 2. fázis, most nem készül

Csak tájékoztatásul, hogy az adatmodell már most ehhez igazodjon:
- **Export:** egy JSON fájl letöltése (`olvasoka-haladas-YYYY-MM-DD.json`) a teljes tárolt gyökérrel.
- **Import:** fájl kiválasztása, majd összefésülés: események és körök azonosító szerint (ismétlődés nélkül), napi összesítők az `id` szerint (eszköz|gyerek|tétel|nap, így két eszköz ugyanaznapi adatai összeadódnak, ugyanaz a fájl kétszer importálva nem duplikál). Utána állapotok újraszámolása.
- Hibás vagy más verziójú fájlnál érthető üzenet, és semmi nem íródik felül.
- A felület: egyszerű párbeszédablak két gombbal (Mentés fájlba, Betöltés fájlból) és egy mondattal, mire jó.

## 10. Tesztelés várakozás nélkül

Egyetlen kapcsoló: **a napszabályok kihagyása**, környezetenként, GitHub repository variable-ből, a táblázatcímek mintájára (`.github/scripts/write-sheet-config.mjs` írja be a `js/core/config.js`-be deploykor).

| Változó | Érték | Alapérték |
|---|---|---|
| `DEV_PROGRESS_SKIP_DAY_RULES` | `true` vagy üres | üres (a szabályok érvényesek) |
| `PROD_PROGRESS_SKIP_DAY_RULES` | `true` vagy üres | üres; ha élesben `true`, a deploy figyelmeztetést ír (`::warning::`) |

Ha a kapcsoló be van kapcsolva, minden **napszámon alapuló** feltétel nullának számít, így a statisztika az első gyakorlástól látszik, akár néhány megjelenés alapján is:
- `uj_min_nap`, `ures_allapot_min_nap`, `gyakorol_min_nap`, `gyakorol_min_eltelt_nap` → 0 (nincs üres állapot, nincs „még ismerkedik vele” a napok miatt).
- A többi feltétel (megjelenések száma, segítség, relatív idő) változatlanul érvényes.

Helyi futtatásnál (localhost) a `js/core/config.js` repóbeli értéke számít; alapból kikapcsolva.

Automatikus tesztek: egységtesztek (`node:test`) rögzített `now` értékekkel (szűrés, összesítés, állapotok határértékei, betűelemzés, listaazonosság, 30 napos tömörítés, konfiguráció-ellenőrzés, a kapcsoló mindkét állása). A számítások ehhez kívülről kapják az időt.

## 11. Elfogadási feltételek

Naplózás és szűrés:
- [ ] Felolvasás kör közben a 4.2 szerinti események naplózódnak, a kör vége és megszakítása is.
- [ ] → majd 2 mp-en belül ←: nincs segítség, az idő összeadódik, `corrections` nő; ha utána takarás jön, egy takarás számít.
- [ ] 400 ms alatti megjelenés nem megjelenés; 30 mp feletti idő nem számít bele a mediánba.
- [ ] Gyors visszalépés után a tétel takarása és hátralévő ideje visszaáll.
- [ ] Dev és éles adatai külön kulcson vannak, egymást nem látják.
- [ ] Tiltott localStorage mellett a gyakorlás hibátlanul működik.

Számítás:
- [ ] `ma`, `ma-ma`, `mama` három külön tétel; `ház` és `ház ` ugyanaz; `Ház` és `ház` két tétel.
- [ ] A 7. fejezet minden állapotához legalább egy egységteszt, a küszöbök határértékeivel.
- [ ] Betűbontás: `dzsungel` → dzs-u-n-g-e-l; `gyöngy` → gy-ö-n-gy; `asszony` → a-sz-sz-o-ny.
- [ ] Listatartalom-változás után a listanézet a jelenlegi tartalomból számol; 60% feletti átfedésű átnevezett lista megtartja a listaszintű adatait.
- [ ] 30 napnál régebbi nyers események törlődnek, a napi összesítők megmaradnak.

Felület:
- [ ] Az áttekintés, a tétel részletei és az üres állapot a képernyőképeknek megfelelő tartalommal és sorrendben jelenik meg, asztalon, álló és fekvő telefonon.
- [ ] Álló telefonon az „Ez csak statisztika” alapból csukott, billentyűvel és képernyőolvasóval is nyitható.
- [ ] A felületi szövegekben nincs gondolatjel, nincs piros szín, nincs sorozat vagy pontszám.
- [ ] A Haladás gyakorlás közben nem érhető el.
- [ ] Nincs export/import link és funkció (2. fázis).

Konfiguráció:
- [ ] A `haladas.json` értékei hatnak a szűrésre és az állapotokra (teszt: egy küszöb átírása más állapotot ad ugyanarra az adatra).
- [ ] Hiányzó vagy hibás fájl esetén az alapértékekkel fut; hibás fájl esetén a deploy ellenőrzése megáll.

Napszabály-kapcsoló:
- [ ] `DEV_PROGRESS_SKIP_DAY_RULES=true` mellett a dev környezetben egyetlen gyakorlás után megjelennek a kártyák (nincs üres állapot), a „Gyakoroljuk még” is elérhető.
- [ ] Változó nélkül a 3 napos szabály érvényes; az éles kiadás alapból így megy.

## 12. Szállítás

- Minden változás a `dev` ágra megy PR-ban, a meglévő tesztekkel együtt (`node:test`), éles kiadás csak a tulajdonos jóváhagyásával.
- Javasolt sorrend:
  1. Napló, szűrés, visszavonás-barát visszalépés, napi összesítők, `haladas.json` (felület nélkül, tesztekkel).
  2. Állapotszámítás, Haladás nézet, napszabály-kapcsoló.
  3. Valós használat a dev környezetben, küszöbök hangolása a `haladas.json`-ban, majd éles kiadás jóváhagyással.
- **2. fázis:** export/import (9. fejezet).
- Az első szakasz adatformátuma később nem változtatható szabadon, ezért a tételkulcs (szöveg, kötőjellel) és a lista-hash már az első verzióban kötelező. A `v` mezővel verziózzuk, migráció csak felfelé.

## 13. Nyitott kérdések
- A „tétel” végleges elnevezése.
- A küszöbök (`haladas.json`) végleges értékei a próbaidőszak adatai alapján.
- A Keresd meg! eredményei később beszámítsanak-e az állapotokba.