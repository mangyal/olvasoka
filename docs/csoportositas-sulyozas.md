# Olvasóka – Csoportosítás és súlyozás

2026-11-16 · mangyal · A fő spec 2.14-es változatának alapja ([specifikacio.md](specifikacio.md), 0. fejezet)

## Cél

Egy Meixner-szakember visszajelzése alapján a magánhangzók, a mássalhangzók és a különböző felépítésű
szótagok ne keveredjenek gyakorlás közben. Ezzel együtt a listák hangsúlyát (mire jusson több gyakorlás)
a lista szerzője határozza meg, nem a program.

Három változás:

1. **Csoportok:** minden tétel automatikusan egy csoportba kerül (magánhangzó, mássalhangzó, VC, CV, egyéb szótag, szó szótagszám szerint).
2. **Súlyozás ismétléssel:** egy tétel többször is szerepelhet egy listában. Ahányszor szerepel, annyiszor nagyobb eséllyel kerül a körbe.
3. **Felolvasás:** a kör csoportonként, fix sorrendben jön. Egy új **Kevert sorrend** kapcsolóval visszakapható a vegyes sorrend.
   **Keresd meg!:** egy feladat csak egy csoport tételeiből áll.

**Nem része:**
- A Felolvasás kör becslése az Indítás mellett („10 tétel · kb. 40 mp”) a kör hossza, nem változik.
- A listák tartalma (`lists.txt`, Google táblázat) nem változik; a program a mostani listákon is működik.
- A Haladás csoportjainak számítása, küszöbei és felülete nem változik.
- A Keresd meg! nem kap kapcsolót, és továbbra sem naplóz.

## Fogalmak

| Fogalom | Jelentés |
|---|---|
| Sor | A lista egy bejegyzése (cella vagy `lists.txt` sor, vesszővel bontva). Ismétlődhet. |
| Tétel | Egy sor szövege. Két sor ugyanaz a tétel, ha a tételkulcsuk (`itemKey`: NFC, levágva) egyezik. A `ma`, `ma-ma`, `mama`, `Ma` négy különböző tétel. |
| Súly | Ahány sor a tételhez tartozik a kijelölt listákban (több listán át összeadva). |
| Csoport | A tétel betűszerkezetéből számolt osztály, lásd 1. |
| Blokk | A Felolvasás körében egy csoport egymás utáni tételei. |

## 1. Csoportok

- **C-1** A csoport a tételből számolódik a meglévő `tokenize()` szerint (kisbetű, kötőjel nélkül, a többjegyű betű egy betű: `cs`, `dzs`, `sz` …). Magánhangzó: `a á e é i í o ó ö ő u ú ü ű`. Minden más betű mássalhangzó. A listákon semmit nem kell jelölni.
- **C-2** A csoportok és a fix sorrendjük:

  | # | Csoport | Szabály | Példa |
  |---|---|---|---|
  | 1 | Magánhangzó | 1 betű, magánhangzó | `a`, `ő` |
  | 2 | Mássalhangzó | 1 betű, mássalhangzó | `m`, `sz`, `dzs` |
  | 3 | VC szótag | 2 betű: magánhangzó + mássalhangzó | `ók`, `el`, `asz` |
  | 4 | CV szótag | 2 betű: mássalhangzó + magánhangzó | `fa`, `szó` |
  | 5 | Egyéb szótag | Pontosan 1 magánhangzó, más szerkezet. **Minden szerkezet külön csoport** (CVC, CCV, VCC …). | `kap`, `pré` |
  | 6 | Szó | Legalább 2 magánhangzó. **Szótagszámonként külön csoport** (a szótagszám a magánhangzók száma). | `ke-fe`, `pi-ló-ta` |

- **C-3** Az 5. csoporton belül a szerkezetek sorrendje: kevesebb betű előbb, azonos betűszámnál a szerkezet ábécérendje (`C` < `V`, pl. `CCV` < `CVC` < `VCC`). A 6. csoportban növekvő szótagszám: a 2 szótagú szavak előbb, aztán a 3 szótagúak, és így tovább.
- **C-4** A csoportosító tiszta függvény egy új core modulban (javaslat: `js/core/groups.js`): `groupOf(item) → { key, rank }`, ahol a `rank` a C-2/C-3 szerinti teljes sorrend. A Felolvasás és a Keresd meg! ugyanezt használja. A meglévő `typeOf()` (betű / szótag / szó) a Haladás típusonkénti tempójánál marad, azt ez a változás nem érinti.

## 2. Súlyozás ismétléssel

- **S-1** A listák betöltésekor az ismétlődő tétel **nem marad ki** (F-L5 4. lépése megszűnik). A sor megmarad a helyén, a lista sorainak száma tartalmazza az ismétléseket. A teszt `duplicates` jelzése megszűnik.
- **S-2** Több lista kijelölésekor a sorok összeadódnak: ha a `ka` két kijelölt listán egyszer-egyszer szerepel, a súlya 2 (`itemsOf` nem szűr).
- **S-3 A súly a felületen nem látszik.** A szülői felület mindenhol a **különböző tételeket** mutatja, első előfordulásuk sorrendjében, és a tételszám is a különböző tételek száma. Ez vonatkozik a listasáv számlálóira, a középső rész tételfelsorolására és fejlécére, a mobilos lista-lenyílóra és a kijelölés összegzésére. Az összegzés formátuma marad („2 lista · 38 tétel”), csak a szám a különböző tételeké. Példa: az `a, e, a, e, o` lista a felületen `a e o`, „3 tétel”. A kör összeállítása közben viszont a lista mind az 5 sora számít (az `a` és az `e` súlya 2, az `o`-é 1). Az F-S8 feltétele (legalább 2 különböző tétel) változatlan.
- **S-4** A Haladás a különböző tételekkel dolgozik: a lista nézetek tételenként egy sort mutatnak, és a lista tartalmi hash-e a **különböző** tételkulcsokból számol. A meglévő hash-ek ismétlés nélküli listán nem változnak.

## 3. Felolvasás

### 3.1 Kapcsoló
- **F-1** A Felolvasás beállításai között új kapcsoló: **Kevert sorrend**. Alapérték: **kikapcsolva**. A szülő utolsó választása megmarad.
- **F-2** Tárolás: `settings.mixed: true|false` az `olvasoka` kulcs alatt (F-S3). Hiányzó vagy érvénytelen érték: `false`. Csak hozzáadás, a `v` marad 4.
- **F-3** A kapcsoló egy jelölőnégyzet „Kevert sorrend” felirattal. Alatta magyarázat ugyanabban a komponensben, mint a Keresd meg! Nehézség alatti Meixner-tájékoztató (`.info-box`, ikonnal): **„Bekapcsolva a betűk, szótagok és szavak összekeverve jönnek.”** Mindig látszik, nem kell hozzá kattintani, és a panel szélességén belül tördelődik. A Keresd meg! beállításai között a kapcsoló nem jelenik meg. *(Döntés 2026-11-16: az eredeti terv `.hint` stílusú, egysoros súgósort kért doboz és ikon nélkül; a Meixner-dobozzal azonos komponens jobban jelzi, hogy ez is módszertani magyarázat.)*

### 3.2 A kör összeállítása
A 4.1 „húzózsák” helyébe lép. A kör indulásakor a teljes sorozat előre elkészül; bemenete a kijelölt listák sorai (ismétlésekkel), a kért tételszám (N), a kapcsoló állása és egy `rng`.

- **F-4 Húzás.** A program a sorok közül húz, visszatevés nélkül, egyenletes véletlennel. Így egy tétel annyiszor nagyobb eséllyel kerül a körbe, ahány sora van. Ha a sorok elfogytak, és a kör még nem teljes, a sorok újra húzhatók (új keverés).
- **F-5 Szomszédsági szabály.** Ugyanaz a tétel soha nem jöhet kétszer közvetlenül egymás után. A húzás ezt előre biztosítja: egy sor csak akkor kerülhet a körbe, ha a tétele utána is elfér a blokkjában szomszédos ismétlés nélkül, vagyis a tétel előfordulásainak száma a blokkban legfeljebb ⌈blokkméret / 2⌉. Kikapcsolt kapcsolónál a blokk a tétel csoportja, bekapcsoltnál az egész kör.
- **F-6 Kihagyott sor.** Ha egy húzott sor az F-5 miatt nem fér be, a program félreteszi, és a következő sort húzza. A félretett sorokat minden befogadott sor után újra megpróbálja (előbb a félretetteket, aztán a még húzatlanokat), így a súlyozás csak a szükséges mértékben torzul. Újrakeveréskor (F-4) a még félretett sorok eldobódnak: az új keverésben úgyis benne vannak, és így egy sokszor visszafogott tétel félretett példányai nem halmozódnak fel menetről menetre. *(Döntés 2026-11-16.)*
- **F-7 Kör hossza.** A kör mindig N tételes. Rövidebb csak akkor, ha egyetlen húzható sor sem felel meg az F-5-nek (pl. a kijelölés csak `a` sorokból áll, ekkor a kör 1 tételes). A számláló (F-P9) a tényleges hosszt mutatja.
- **F-8 Sorrend, kikapcsolt kapcsolónál.** A húzott tételek blokkokba kerülnek a C-2/C-3 sorrendben. Egy blokkon belül a sorrend véletlen, és betartja az F-5-öt. Az üres csoportok kimaradnak.
- **F-9 Sorrend, bekapcsolt kapcsolónál.** A húzott tételek csoportosítás nélkül, véletlen sorrendben jönnek, az F-5 betartásával.
- **F-10 Elrendezés egy blokkon belül.** Az F-5 miatt a blokk mindig elrendezhető. Javasolt módszer: mohó véletlen építés, minden lépésben az előzőtől eltérő tételek közül súlyozott húzás a hátralévő darabszám szerint, és ha egy tétel hátralévő darabszáma eléri a hátralévő helyek felét (felfelé kerekítve), akkor kötelezően az jön.
- **F-11** Tiszta modul, DOM nélkül; a `rng` paraméter, a tesztek seedeltek (mint 4.1). A szótag-takarás, a léptetés és a lejátszás (4.2–4.5) változatlan.

### 3.3 Példák
- 45. oldal, 20-as kör, kikapcsolt kapcsoló: pl. `e i á` · `k f m` · `fa mó ki fú le …` (CV-blokk) · `ke-fe lu-fi fo-ci`.
- A tankönyvi `k m k s k l c k p k m` sor listaként: a `k` súlya 5. Egy 11-es körben az összes sor bekerülhet, a mássalhangzó-blokkban a `k` sosem áll két helyen egymás mellett.
- Egy VC szótag (`ók`) kétszer beírva: ha az első `ók` után a második is kihúzódik, a VC-blokk 1 tételes, a második `ók` félreteszi a program, és helyette egy másik sor jön.

## 4. Keresd meg!

A [keresd-meg-heurisztika.md](keresd-meg-heurisztika.md) „Típus és feltöltés” szabálya helyébe lép. A távolság, a súly, a kalibrált fokozat és a közös kezdet változatlan.

- **K-1 Készlet.** A rács jelöltjei a kijelölt listák **különböző** tételei (a kártyákon nincs ismétlés). Két tétel akkor azonos, ha a tételkulcsuk (`itemKey`) egyezik: a `ma`, a `Ma` és az `m-a` három különböző tétel, egy rácsban is szerepelhetnek. *(Döntés 2026-11-16: a kis- és nagybetű megkülönböztetése az egész appban kulcskérdés; korábban a Keresd meg! kisbetűsítve és kötőjel nélkül szűrt.)* A csoport és a távolság továbbra is a kisbetűsített betűsorozatból számol.
- **K-2 Csak a horgony csoportja.** A rács minden tétele a horgony csoportjából jön (C-2: a VC és a CV külön, a szavak szótagszám szerint külön). A más csoportból való feltöltés **megszűnik**, minden fokozaton.
- **K-3 Kevés tétel.** Ha a horgony csoportjában N-nél kevesebb különböző tétel van, a rács az összesből áll, **legalább 2 kártyával**. A beállított kártyaszám rácsa és a kártyaméret marad, a hiányos utolsó sor középen (F-K3, F-K12, változatlan).
- **K-4 Horgony.** A horgony **súlyozott** véletlennel jön: egy tétel esélye arányos a sorai számával (2. fejezet). Csak olyan tétel lehet horgony, amelynek csoportjában legalább 2 különböző tétel van; az 1 tételes csoport tétele a Keresd meg!-ben nem jelenik meg. Az előző feladat horgonya továbbra is kimarad (heurisztika 1. szabály).
- **K-5 Indíthatóság.** Az Indítás akkor aktív, ha van legalább egy csoport legalább 2 különböző tétellel. Különben inaktív, a mostani szöveggel: „A Keresd meg!-hez legalább két különböző tétel kell.”
- **K-6 Kalibrálás.** A deploy-kalibrálás (`calibrate.mjs`) módszere változatlan, de az új készletszabályokkal (K-2) számol. A görbék a következő deploynál maguktól frissülnek.

## 5. Haladás (naplózás)

- **H-1 Minden előfordulás mér.** Ha egy tétel egy körben többször jön, minden megjelenése megjelenés, és minden mért ideje bekerül, a mostani szabályok szerint (5.2). A „legalább 3 különböző nap” szabály és a csoportok számítása változatlan.
- **H-2 Sorrend módja.** A kör rekord új mezője: `order: "grouped" | "mixed"` (a kör indulásakor a kapcsoló állása). Hiányzó érték (minden korábbi kör): `"mixed"`, mert akkor a program még keverten működött.
- **H-3 Hányadik előfordulás.** Nem kell új mező: a kör tételsora pozíció szerint már tárolva van (4.2a), és az események pozíciót hordoznak, ebből a nyers napló megőrzési idején belül kiszámolható. Csak adatgyűjtés, a besorolás nem használja.
- **H-4 Tárolt formátum.** A kör sor új utolsó eleme `o` (`0` = mixed, `1` = grouped). A tárolt formátum **4. verzió** lesz, hogy egy gyorsítótárban maradt régebbi programváltozat ne írja vissza a sort a mező nélkül (a 3. verziós `flashDwell` bevezetés mintájára). A 3. verzió betöltéskor átalakul, a hiányzó `o` = 0.

## 6. Elfogadási kritériumok

- [x] `groupOf`: `a` → magánhangzó; `sz` → mássalhangzó; `ók` → VC; `szó` → CV; `kap` → egyéb (CVC); `ke-fe` és `kefe` → szó, 2 szótag; `pi-ló-ta` → szó, 3 szótag. A sorrend: magánhangzó < mássalhangzó < VC < CV < egyéb < szó (2) < szó (3).
- [x] Egy lista, amelyben a `k` kétszer szerepel, betöltés után 2 `k` sort tartalmaz, figyelmeztetés nélkül.
- [x] Az `a, e, a, e, o` lista a szülői felületen `a e o`-ként és „3 tétel”-ként jelenik meg (listasáv, felsorolás, lenyíló, összegzés), a húzásban viszont az `a` és az `e` kétszer akkora eséllyel jön, mint az `o`.
- [x] Kikapcsolt kapcsolónál a 45. oldallal indított 20-as kör blokkjai a C-2 sorrendben jönnek, minden blokk egy csoport.
- [x] Bekapcsolt kapcsolónál a kör nem csoportosított (seedelt teszt: legalább egy csoportváltás vissza).
- [x] Seedelt tesztben 10 000 körön át soha nincs két azonos tétel egymás után, mindkét kapcsolóállásnál.
- [x] Súly: egy 1× és egy 3× beírt tétel aránya a húzásokban sok körön át kb. 1 : 3 (az F-5-öt nem érintő listán).
- [x] Csak `a` sorokból álló kijelöléssel a Felolvasás 1 tételes kört ad, hiba nélkül.
- [x] Keresd meg!: egyetlen feladatban sincs két csoport tétele, egyik fokozaton sem (a mostani mérés szerint ma 6–57%).
- [x] Keresd meg!: 3 magánhangzós csoportnál 4-es beállítással 3 kártyás feladat jön, 2×2 rácsban, az utolsó sor középen. 1 tételes csoport tétele soha nem jelenik meg.
- [x] Keresd meg!: a kártyákon nincs ismétlődő tétel, ismétléses listával sem.
- [x] A kapcsoló állása újratöltés után megmarad; régi tárolt állapotnál kikapcsolt.
- [x] Haladás: az új kör rekordja `order: "grouped"` vagy `"mixed"`; a 3. verziós adat betöltése után a régi körök `"mixed"`-ek, a mentés 4. verziót ír.
- [x] Egy körön belül kétszer megjelenő tétel napi összesítőjében 2 megjelenés és (ha mért) 2 olvasási idő van.
- [x] Ismétlés nélküli lista hash-e nem változik a mostanihoz képest.
## 7. Megvalósítás (2026-11-16)

- `js/core/groups.js`: `groupOf`, `compareRank`, `shapeOf` (C-1–C-4).
- `js/core/sequence.js`: `buildReadSequence(rows, N, { mixed }, rng)` és `arrangeBlock` (F-4–F-11); a régi `buildSequence` megszűnt.
- `js/core/grid.js`: a készlet `itemKey` szerint, `weight` és `group` mezővel, `groupSize`; `anchorChoices`; a rács csak a horgony csoportjából; súlyozott horgony; a kalibrálás horgonymintája csak legalább 2 tételes csoportból (K-1–K-6).
- `js/core/find.js`: `canFind` (K-5); a `distinctCount` `itemKey` szerint számol.
- `js/core/lists.js`, `selection.js`, `items.js`: ismétlés megmarad, `distinctItems` (S-1–S-3).
- `js/data/progress-codec.js`: 4. verzió, `o` (H-2–H-4).
- Tesztek: `test/groups.test.js`, `test/sequence.test.js`, `test/haladas-sorrend.test.js`; átírva a `grid`, `kezdet`, `find`, `core`, `selection`, `source`, `settings`, `haladas-villantas` és az e2e tesztek.

**Mellékhatások:**
- Kis csoportban a hasonló párok nem kerülhetők el a Keresd meg!-ben: a 9 magánhangzó (a–á, o–ó …) 6 vagy 8 kártyánál a legkönnyebb fokozaton is ad közeli párokat (fixture-listán átlag 2,2, illetve 5,4 pár rácsonként; a nagy csoportokban gyakorlatilag 0). A „≤ 0,1 közeli pár a 0-s fokozaton” statisztikai feltétel ezért csak legalább 3 × N tételes csoportban mér.
- A Felolvasás beállításai közti térköz 18 px-ről a Keresd meg! 12 px-ére csökkent, hogy a Kevert sorrend 1280×800-on görgetés nélkül elférjen. 1024×768-on a beállítások görgetnek (az Indítás látszik).
