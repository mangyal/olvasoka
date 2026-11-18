# Olvasóka: Kártyacsomagok, új elrendezés, első kör mérése

Verzió: 1.0 · 2026. november 18.
Képernyőtervek: „Olvasóka – Mit / Hogyan elrendezés” vászon (https://claude.ai/artifact/Cq9tGksWZtsB9qKBXjEEft): asztali Kijelölt és Összes állapot, telefon álló főképernyő és csomagválasztó lap, telefon fekvő főképernyő és csomagválasztó lap. Az asztali Kijelölt és a telefonos lap kattintható. Eltérés esetén ez a dokumentum az irányadó.

## 1. Cél

Egy új szülő 30 másodpercen belül értse meg, mi ez, mire jó, és hogyan indítson kört. Ehhez:

1. A „lista” helyett a felületen **kártyacsomag** / **csomag** a neve (2.).
2. Ami a tartalomról szól (csomagválasztás, Kijelölt / Összes, tétel-előnézet), az balra és középen van; a jobb oldali panel csak a játéké (3.).
3. Az üdvözlő ablak és a meta leírás új szöveget kap (6.).
4. Mérjük, mennyi idő telik el az oldal betöltésétől az első körig (7.). Ez a mérés az indulás (az osztály szülői csoportjában való megosztás) **előtt** élesedjen, hogy legyen kiinduló érték.

Nem változik: a táblázat határozza meg, mely csomagok vannak alapból kijelölve (F-L1d, `preset`); az álló tablet (600–899 px) elrendezése a 4.2 pont kivételével; a játékok beállításai; a Haladás.

## 2. Elnevezés: kártyacsomag

| Hol | Szó |
|---|---|
| Oszlop- és lapcím | Kártyacsomagok |
| Kapcsoló, számok, üzenetek | csomag / csomagok (pl. „2 csomag kijelölve”, „Jelölj ki legalább egy csomagot.”) |
| A csomagban lévő egység | tétel (nem változik) |

- Minden felhasználónak látszó „lista” szöveg cserélendő: fejlécek, kapcsoló, összegzések, üres állapotok, Indítás alatti üzenetek, figyelmeztetések, a táblázat hibáiról szóló üzenetek (a táblázatban egy oszlop egy csomag), Súgó, bemutató, Haladás („Listánként” → „Csomagonként”), tartalék-értesítés („Tartalékcsomagok láthatók…”).
- **Nem** változik: kódbeli nevek (`lists`, `lastLists`, `listNav`…), a táblázat formátuma, a tárolt adatok kulcsai, a statisztika eseménynevei, adatkulcsai és a `lists` értékei (az `(összes lista)` érték is marad, hogy a régi és új adatok összevethetők legyenek).
- A fejlesztő egy `grep -rn "list[aáàeé]"` futtatással gyűjtse össze a szövegeket, és a PR leírásában sorolja fel, mit cserélt és mit hagyott szándékosan.

## 3. Asztali elrendezés (≥ 900 px)

A három oszlop elrendezése a mostani marad (nincs új keret, kártya vagy margó). A három oszlop tetején **azonos stílusú cím**, egy vonalban:

| Oszlop | Cím |
|---|---|
| Bal (csomagok) | Kártyacsomagok |
| Közép (előnézet) | Ezekkel játszotok |
| Jobb (játék) | Játékok |

Stílus: 18 px, 600-as vastagság, sötét szöveg (`--ink`), sor-magasság 26 px (2026-11-18: az eredeti 20 px / 650 túl erős volt). A régi kis „LISTÁK” felirat megszűnik.

### 3.1 Bal oszlop

Fentről lefelé:
1. Cím: **Kártyacsomagok**
2. **Kapcsoló** (teljes szélességű, kétállású, szegmentált): `Kijelölt csomagok` | `Összes csomag`. Ez váltja ki a játékfülekről eltávolított „Tételek” kapcsolót (3.3). Ugyanaz a beállítás (`settings.source`: `list` / `all`).
3. Összegző sor: balra `{n} csomag kijelölve` vagy Összesnél `Mind a {N} csomag`; jobbra `Egyik sem` szöveges gomb (csak Kijelöltnél, ha legalább egy csomag ki van jelölve).
4. A csomagok **pipás sorokként** (név, jobbra a különböző tételek száma). Kijelölt sor: halvány háttér, félkövér név.
5. Tipp a lista alatt, csak egeres eszközön (`hover: hover`): „Tipp: egérrel végighúzva több csomagot is kijelölhetsz egyszerre.” A mostani Ctrl/⌘+kattintás tipp (`#navHint`) megszűnik.

Kijelölés:
- **Kattintás** egy sorra: a sor pipáját váltja (nem cseréli le a többit). Ez változás a mostanihoz képest, ahol a sima kattintás egyetlen listát jelöl ki.
- **Végighúzás**: egérgomb lenyomása egy soron, majd húzás más sorokra. A lenyomott sor új állapota (be vagy ki) érvényes minden sorra, amelyen az egér áthalad. Felengedéskor vagy az oszlopból kilépve vége. Csak `pointerType: mouse` (és toll) esetén; érintésnél a görgetés marad.
- **Shift + kattintás**: tartomány az előző kattintott sortól, a kattintott sor új állapotával.
- **Billentyűzet**: a sorok natív checkboxok vagy `role="checkbox"` gombok; Tab-bal elérhetők, Szóköz vált.

Összes csomag állapot:
- Minden sor bepipálva, a sorok és a pipák szürkék (de kattinthatók).
- Egy sor kipipálása vagy végighúzás: átvált **Kijelöltre**, és minden csomag kijelölve marad, kivéve azokat, amelyeket a szülő épp kivett. Megerősítő kérdés nincs.
- Új csomag a táblázatban: Összesnél automatikusan benne van (ahogy eddig is). Erről a felület nem ír semmit.
- Vissza **Kijelöltre** a kapcsolóval: a szülő legutóbbi saját kijelölése jön vissza (`lastLists`, ahogy most).

### 3.2 Középső oszlop (előnézet)

1. Cím: **Ezekkel játszotok**, jobbra `{k} különböző tétel · {n} csomag`.
2. Alatta információs ikonnal egy sor: „A játékban csak ezek a tételek jöhetnek elő, semmi más.”
3. A kijelölt csomagok tételei csomagonként csoportosítva (mint most). Összesnél minden csomag.
4. Ha nincs kijelölt csomag: szaggatott keretes üres állapot: „Jelölj ki legalább egy csomagot bal oldalt.”
5. Alul kicsi, szürke sor: `Frissítve: {óra:perc}` és `Frissítés` szöveges gomb.
6. **Megszűnik**: „Listák szerkesztése a táblázatban ↗” link (`#editLink`).
7. A cím és a magyarázó mondat közötti hely fenntartott: később ide kerül a betűk / szótagok / szavak szűrő. Most semmi nem kerül oda.

### 3.3 Jobb panel (Játékok)

- Cím: **Játékok**, alatta a mostani fülek, leírás, „Így játsszátok”, beállítások, Indítás.
- **Eltávolítandó** mindkét fülről a „Tételek: Kijelölt listák / Összes lista” mező (`#srcList`, `#srcAll`, `#srcListF`, `#srcAllF`).
- Az Indítás alatti üzenet üres kijelölésnél: „Jelölj ki legalább egy csomagot.”

## 4. Keskeny elrendezések

### 4.1 Telefon álló (≤ 600 px)

Fentről lefelé (lásd vászon):
1. Cím: **Kártyacsomagok** (16 px, 600, sötét). A „Játékok” cím ugyanilyen.
2. Csomag gomb (`#listsBtn`): felül kicsi szürke sor `Kijelölt csomagok · {k} tétel` vagy `Összes csomag · {k} tétel`, alatta a kijelölt csomagok neve vesszővel (hosszú esetén levágva), jobbra lefelé mutató nyíl.
3. Mondat: „A játékban csak ezek a tételek jöhetnek elő, semmi más:”
4. Tétel-előnézet: kis kártyák két sorban, a többi levágva.
5. Szöveges gomb: `Mind a {k} tétel megtekintése`. Koppintásra az előnézet helyben kinyílik (minden tétel, csomagonként), a gomb szövege `Kevesebb`. Nem nyitja meg a lapot.
6. Elválasztó vonal, majd **Játékok**: fülek, leírás, beállítások (a Tételek mező nélkül), alul a mostani Indítás sáv.

Csomagválasztó lap (`#dlgLists`):
- Cím: **Kártyacsomagok**
- Alatta a kapcsoló (`Kijelölt csomagok` | `Összes csomag`), teljes szélességben.
- Összegző sor és `Egyik sem`, mint asztalon. A **`Mind` gomb (`#listsAll`) megszűnik**, mert az Összes csomag kiváltja.
- Pipás sorok (legalább 48 px magasak), Összesnél szürkén; a 3.1 Összes-szabályai itt is érvényesek.
- Lábléc: `{k} különböző tétel` (üres kijelölésnél „Jelölj ki legalább egy csomagot.”) és `Kész`.

### 4.2 Álló tablet (600–899 px)

Marad a mostani pipálható chip-sor (`#listPick`), előnézet nélkül. Egy változás: a chip-sor fölé kerül a Kijelölt / Összes kapcsoló, a legend „Kártyacsomagok”, és a játékpanelről eltűnik a Tételek mező. Összesnél a chipek szürkén bepipálva, a 3.1 szabályaival.

### 4.3 Telefon fekvő (magasság ≤ 500 px)

Két oszlop, mint asztalon a tartalom és a játék szétválasztása:
- **Bal oszlop**: fejléc (Olvasóka, Haladás, Súgó ikonok), **Kártyacsomagok** cím, csomag gomb, a „csak ezek” mondat, előnézet (legfeljebb 3 sor), `Mind a {k} tétel megtekintése`.
- **Jobb oszlop**: **Játékok** cím, a fülek (ikon és név egy sorban, 48 px magas), leírás és „Így játsszátok”, beállítások görgethetően, alul az Indítás sáv.
- A mostani elrendezésben a fülek és az „Így játsszátok” a bal oszlopban vannak: ezek átkerülnek jobbra.
- A csomagválasztó lap fekvőben középre igazított, két oszlopban mutatja a csomagokat, a cím és a kapcsoló egy sorban.

## 5. Bemutató (Első lépések)

Négy lépés marad, a sorrend és a célelemek változatlanok; a Haladás a 3. lépés marad. `TOUR_VERSION` nem nő (élesben még nincs felhasználó).

1. lépés új szövegei (cím: **Válassz kártyacsomagot**):

| Célelem | Szöveg |
|---|---|
| `#sidebar` (az egész oszlop), egeres eszköz | Válaszd ki a kártyacsomagokat, amelyekkel játszotok. Egérrel végighúzva többet is kijelölhetsz. Középen látod, mely tételek jöhetnek elő a játékban. |
| `#sidebar` (az egész oszlop), érintéses eszköz | Koppints a csomagokra, amelyekkel játszotok. Középen látod, mely tételek jöhetnek elő a játékban. |
| `#listChecks` | Pipáld be a csomagokat, amelyekkel játszotok. A játékban csak ezek tételei jöhetnek elő. |
| `#listsBtn` | Koppints ide, és pipáld be a csomagokat. Alatta látod, mely tételek jöhetnek elő a játékban. |

A 2–4. lépés szövege változatlan. A `{MOD}` + kattintás szövegrész megszűnik.

## 6. Szövegek

Üdvözlő ablak (`#dlgWelcome`; a docs/bemutato-specifikacio.md 10. pontjának táblázatát ez felülírja, a többi elem változatlan):

| Elem | Régi | Új |
|---|---|---|
| Szöveg (`#welcomeText`) | Közös olvasásgyakorlás a könyv mellé: a gyerek olvas, te figyelsz. | Olvasásgyakorlás elsősöknek, együtt a szülővel, ahol ti választjátok ki, mit gyakoroltok. A gyerek olvas, te figyelsz. |
| Fő gomb (`#welcomeTour`) | Mutasd meg (30 mp) | Mutasd meg 30 mp-ben |

A zárójeles forma visszaszámlálót sugall; az új felirat azt mondja, mennyi ideig tart a bemutató.

Meta leírás (`<meta name="description">`, `manifest.webmanifest` `description`, `package.json` `description`): a „Hangtalan…” szöveg helyett:

> Olvasásgyakorló elsősöknek és szüleiknek. Betűk, szótagok és szavak, regisztráció nélkül.

Súgó (`#dlgHelp`): minden „lista” szó cseréje (2.), a Ctrl/⌘+kattintás és Shift mondat helyett: „Pipáld be a csomagokat bal oldalt. Egérrel végighúzva többet is kijelölhetsz, Shifttel egy tartományt.” Adatvédelem szöveg:

> A program névtelen használati statisztikát küld, például hogy hány kört játszotok, melyik játékkal, melyik csomagokból, és mennyi idő után indul az első kör. Sütit nem használ, regisztráció nincs. A gyerekről, a tételekről és a haladásról semmi nem hagyja el ezt a készüléket.

Szabály minden új szövegre: nincs gondolatjel, nincsenek sablonmondatok.

## 7. Mérés: idő az első körig

Kérdés: mennyi idő telik el egy új szülőnél az oldal betöltésétől az első kör indításáig. Landing oldal és `/app` még nincs, ezért az óra az **app betöltésekor** indul (az üdvözlő ablak ekkor jelenik meg).

Új Umami esemény (docs/analitika-specifikacio.md 3. bővítése, `test/analytics.test.js` engedélyezett nevei közé):

| Esemény | Mikor | Adatok |
|---|---|---|
| `first-round` | a készüléken legelőször induló kör, a `round-start` előtt | `sec`: egész másodperc az oldal betöltésétől (`performance.now()`) az Indításig; `firstVisit`: igaz, ha ez az oldalbetöltés volt a készüléken az első; `welcome`: `tour` / `skip` / `none` (ebben a betöltésben nem jelent meg); `tour`: `done` / `skipped` / `none` (ebben a betöltésben); `game`: `read` / `find` |

Szabályok:
- Két helyi jelző a `localStorage`-ban: az első oldalbetöltés ténye (`firstSeen`) és hogy az esemény már elment (`firstRoundSent`). A pontos kulcsnevek a meglévő elnevezési rendhez igazodjanak.
- Ha a készüléken már van Olvasóka adat (beállítás, haladás) ennek a kiadásnak az első betöltésekor, a `firstRoundSent` igazra áll küldés nélkül: régi felhasználóról nem kérünk első kört.
- Ha a tárolás nem elérhető (`storageOK` hamis, pl. privát böngészés), nincs `first-round` esemény, különben minden betöltés elsőnek számítana.
- Időkorlát nincs a küldésben; az elemzésnél a `firstVisit: true` esetek **mediánját** nézzük, és a 30 percnél hosszabbakat „később visszatért” csoportnak vesszük.
- Dev környezetben az Umami nem fut (egy webhelyes ingyenes csomag), ezért a küldést egységteszt ellenőrzi.

## 8. Elfogadási feltételek

1. ≥ 900 px: a három cím (Kártyacsomagok, Ezekkel játszotok, Játékok) azonos stílusú és egy vonalban van; a jobb panelen nincs Tételek mező; nincs „Listák szerkesztése” link.
2. Kattintás egy csomagra csak azt váltja; végighúzás egérrel több csomagot jelöl ki vagy vesz ki; Shift + kattintás tartományt; érintéssel a végighúzás görget.
3. Összesben egy csomag kivétele Kijelöltre vált, a többi kijelölve marad; a kapcsolóval visszaváltva a legutóbbi saját kijelölés jön vissza.
4. Első betöltéskor a táblázat szerinti alapkijelölés érvényes, mint eddig.
5. Telefonon álló és fekvő módban látszik a „csak ezek” mondat és az előnézet; a `Mind a {k} tétel megtekintése` helyben nyit és csuk; a lapon nincs `Mind` gomb, van kapcsoló.
6. Felhasználónak látszó szövegben nem marad „lista” (kivéve a 2. pontban szándékosan meghagyott, nem látszó helyeket); a meta leírásban nincs „Hangtalan”.
7. Az üdvözlő ablak szövege és fő gombja („Mutasd meg 30 mp-ben”), valamint az Adatvédelem szövege a 6. pont szerinti.
8. A `first-round` esemény egy készüléken legfeljebb egyszer megy el, régi adatú készüléken és tárolás nélkül egyszer sem; az adatai a 7. pont szerintiek, tétel nincs benne.
9. A 320×256-os minimum méret felett az összes nézet használható; a meglévő e2e elrendezés-tesztek (`e2e/layout.mjs`) frissítve az új címekre és a Tételek mező hiányára.