# Olvasóka: Haladás (tétel-elsajátítás) specifikáció

Verzió: 1.7 · 2026. november 12.
Jóváhagyott design: https://claude.ai/artifact/N4rE1aqK15kpWbLvWXtcAr (vászon: „Olvasóka – egyszerűsített Haladás nézet”). Ha a design és ez a dokumentum ellentmond egymásnak, a design a mérvadó (lásd 8. fejezet).

## 0. Változások

### 1.7 (az 1.6-hoz képest): egyszerűsített Haladás
- Öt állapot és 14 küszöb helyett **négy csoport**: Megy, Még bizonytalan, Még gyakorolni kell, Kevés adat; mindegyik egy mondattal elmagyarázva. A kártyák összege mindig kiadja a jelenlegi listák összes tételét (7., 8.2).
- A tempót a gyerek **saját, típusonkénti szokásos tempójához** méri, szótagonként (7.2–7.4). Megszűnt a relatív idő (első 3 / utolsó 3), a gyors villantás szabálya és a betűelemzés („Mi segíthet?”, kártya-megjegyzés).
- A számítás a csoport mellé **okot** is ad (`help` / `slow`), ebből lesz a tétel részleteinek fő mondata (7.6, 8.4).
- Új nézet: **csoport oldala** (`#haladas/csoport/<csoport>`), „Mutasd mindet →” linkkel minden nem üres kártyáról. Megszűnt a „+ N további tétel” (8.2, 8.3).
- A Haladás nézet **az első naptól** elérhető; a régi üres állapot megszűnt, helyette információs doboz (8.2).
- A tétel részleteinél az alkalmak és a napok száma, az első dátum; megszűnt a „Szerepel: …” (8.4).
- Visszalépéskor (link, Esc, böngésző) az előző görgetési pozíció áll vissza; előre lépve a lap tetejére görget (8.1).
- `haladas.json`: az `allapot` szakasz teljes cseréje (9 kulcs), a `betu` szakasz és a `tarolas.ures_allapot_min_nap` megszűnt. Az `unsupportedFastFlash` gyűjtésének küszöbe a `szures.gyors_villantas_ms` kulcsba költözött (érték változatlan, 5000). A kiadás ellenőrzi, hogy a „Megy” és a „Még gyakorolni kell” küszöbei ne fedjék át egymást (7.8).
- A napszabály-kapcsoló csak a `min_nap`-ot nullázza (10.).
- Az „Amikor olvasta” pöttyöknek három állapota van: segítséggel, segítség nélkül, és félig-félig, ha aznap segítséggel és anélkül is olvasta (8.4).
- Nem változik: a naplózás, a mellényomás-szűrés (5.2), a tárolt adat és formátum (3. verzió), a `flashDwell` gyűjtése.

### 1.6 (az 1.5-höz képest)
- Villantásos olvasási idő (3., 5.2): villantásos körben a villantás lejárta előtti gombnyomásos továbblépés ideje is tárolódik, **külön mezőben** (`flashDwell`), a villantás hosszával együtt. Csak adatgyűjtés: az állapotszámítás, a küszöbök, a meglévő mezők és a felület nem változnak.
- 3. tárolt verzió (4.2a): a napi sor és a kör sor egy-egy új elemmel bővül. Az 1. és 2. verzió betöltéskor átalakul.
- Egyszeri pótlás (4.3a): a korábban lezárt villantásos körök idői a még meglévő nyers eseményekből (legutóbbi 30 kör, legfeljebb 30 nap) pótlódnak.

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

A szülő lássa, hogy a gyereke mely tételeket (betű, szótag, szó) olvassa már biztosan, melyek bizonytalanok még, melyeket kell még gyakorolni, és melyekről van még kevés adat. Minden besorolási szabály egy mondatban elmagyarázható a szülőnek.

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
3. Napi tételösszesítők és belőlük számolt csoportok (okkal).
4. Haladás nézet: áttekintés, csoport oldala, tétel részletei. Asztali és telefonos (álló, fekvő) elrendezés.
5. Visszavonás-barát visszalépés: gyors visszalépés visszaállítja a tétel takarási állapotát és hátralévő idejét.
6. Konfigurálható küszöbök egy repóbeli JSON fájlban (lásd 7.8).
7. Környezeti változó a napszabály kikapcsolására, hogy tesztelésnél ne kelljen napokat várni (lásd 10.).

### Nincs benne (később)
- **Átvitel másik eszközre (export/import): 2. fázis.** Az adatmodell már most támogatja (véletlen azonosítók, `deviceId`), de a funkció és a link nem készül el. A tervrajz lábléc-linkje ezért most kimarad (lásd 8.2, 9.).
- Gyerekválasztó (több gyerek egy eszközön). Az adatmodell előkészíti, lásd 4.2.
- Keresd meg! mód naplózása és hatása a csoportokra (egyelőre semmi nem naplózódik).
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
| Villantásos olvasási idő (flashDwell) | Villantásos körben ugyanígy számolt idő, ha a gyerek a villantás lejárta előtt gombnyomással lépett tovább (5.2). A villantás hosszával együtt tárolódik. Rövid villantásnál csak a gyors olvasások kapnak időt (a lassabbaknál lejár a villantás), ezért az idők összevetésekor a villantás hosszát is figyelembe kell venni. A besorolás a kézi olvasási idővel együtt mért időként használja (7.1). |
| Segítség | Takarás, megállítás vagy valódi visszalépés egy megjelenés alatt. |
| Alkalom | Egy megjelenés a napi `help` sorban (kézi és villantásos egyaránt, a lejárt villantás is). |
| Olvasási nap | Nap, amelyen a tételnek legalább 1 megjelenése volt. Több eszköz ugyanazon napja egy napnak számít. |
| Szótagszám | A tételkulcs magánhangzóinak száma (legalább 1), lásd 7.2. |
| Szokásos tempó | A gyerek adott típusú (betű, szótag, szó) tételeinek szótagonkénti középértéke, lásd 7.3. |
| Friss idő, arány | A tétel utolsó 3 mért idejének szótagonkénti középértéke; az arány ez osztva a típus szokásos tempójával (7.4). 1,0 = a szokásos tempó, 2,0 = kétszer olyan lassú. |
| Ok | Miért került a tétel a Még bizonytalan vagy a Még gyakorolni kell csoportba: `help` (segítség) vagy `slow` (lassabb), lásd 7.6. |
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
  folded: true|false,                          // folded: a napi összesítőkbe már bekerült
  flashDwellDone: true|false }                 // a villantásos idői is bekerültek (új kör: a lezáráskor; régi: 4.3a)

// Esemény (nyers); i: a kör pozíciója; a villantási idő a körben van
{ id, round, t, i, item: "<tételkulcs>",
  type: "show"|"next"|"prev"|"pause"|"resume"|"blur"|"cover"|"uncover"|"hidden"|"visible"|"end"|"exit",
  auto?, fromGap?, coveredCount? }

// Napi összesítő (tétel × nap)
{ id: "<deviceId>|<child>|<item>|<YYYY-MM-DD>", child, item, day,
  exposures, manualExposures, dwellMs: [..],   // kézi megjelenések idői, legfeljebb 20 érték
  medianDwellMs, covers, pauses, prevs, supportedExposures,
  unsupportedFastFlash,                        // segítség nélkül, villantás ≤ 5000 ms mellett
  help: "0010…",                               // megjelenésenként, időrendben: 1 = segítséggel
  flashDwell: [{ ms, flashMs }, ..] }          // villantásos olvasási idők a villantás hosszával, időrendben,
                                               // legfeljebb 20 érték (mint a dwellMs); régi adatnál []
```

- Minden azonosító véletlen (pl. `crypto.randomUUID()`, ha nincs, saját véletlen).
- A tétel **szövegét** tároljuk, sosem a lista indexét.
- A kör a lista nevét **és tartalmi hash-ét** is tárolja (rövid, pl. 8 hexa karakter a rendezett tételkulcsokból).

### 4.2a Tárolt formátum (3. verzió)
A 4.2 rekordjai a program memóriájában ilyen olvasható alakban vannak; a localStorage-be tömör alak kerül (`js/data/progress-codec.js`):
- a körök és a napi összesítők mezőnevek nélküli tömbök; a napi összesítő azonosítója (eszköz|gyerek|tétel|nap) és mediánja betöltéskor áll elő;
- a kör a tételeit egyszer tárolja (pozíció szerint); az események körönként egy szövegben vannak (`eltelt idő,pozíció,kód`), tétel és saját azonosító nélkül;
- az olvasási idők 100 ms-os egységben; a villantásos olvasási idő `[idő, villantás]` pár, mindkettő 100 ms-os egységben (3,2 mp 10 mp-es villantásnál: `[32, 100]`);
- a napi sor: `[tétel, nap, megjelenés, kézi, idők, takarás, megállítás, visszalépés, segítséggel, gyors, segítség, villantásos idők, eszköz?]`; az eszköz csak akkor, ha eltér a saját eszköztől (a 2. verzióban ez volt a 12. elem, a villantásos idők nélkül);
- a kör sor utolsó eleme `fd` (0/1): a kör villantásos idői már a napi összesítőkben vannak;
- az azonosítók rövidek (10 karakter, véletlen).
Az 1. verziójú (olvasható) és a 2. verziójú adat betöltéskor átalakul (villantásos idő nélkül, `fd` = 0), a következő mentés már 3. verziót ír. Ismeretlen, újabb verziót a program nem ír felül: így egy gyorsítótárban maradt régebbi programváltozat a 3. verziót nem írja vissza 2.-ként (az új mezők nem vesznek el), csak memóriában dolgozik.

### 4.3 Tömörítés és méret
- A nyers események a legutóbbi 30 körből (`nyers_megorzes_kor`) és legfeljebb 30 napig (`nyers_megorzes_nap`) maradnak meg; ami bármelyik korláton túl van, törlődik. Így a nyers napló mérete a használat gyakoriságától függetlenül korlátos (kb. 150 kB). Törlés előtt bekerülnek a napi összesítőkbe: minden kör a lezárásakor (vagy ha a lap közben bezárult, a következő induláskor) egyszer hozzáadódik. Az összesítő az eseményekből újraszámolható, amíg azok megvannak (`js/core/exposures.js`).
- `dwellMs`, `flashDwell` és `help`: legfeljebb 20 elem; ha több, az első és az utolsó 10 marad (a kiindulás az elejéből, a legutóbbiak a végéből számolnak).
- Mért méretek (2. verzió): egy 16 tételes kör nyers naplója kb. 0,3 kB (a 30 körös korláttal legfeljebb kb. 10 kB); egy napi összesítő kb. 50–130 karakter az aznapi olvasások számától függően (napi 20 tétel×nap mellett évi kb. 0,5 MB). Valós dev adat 19 kör után: 23 kB (az 1. verzióban 156 kB).
- A 3. verzió többlete: napi összesítőnként 3 karakter, ha nincs villantásos idő, és kb. 10 karakter tárolt villantásos időnként (legfeljebb 20 → kb. 200 karakter). Mért érték egy 40 napos mintán (70 kör, 372 napi összesítő, a körök kb. kétharmada villantásos): 30,1 → 32,4 ezer karakter (+7,7%); körönként 2 karakter.
- Ha az írás kvótahiba miatt sikertelen: előbb a legrégebbi nyers események törlődnek (összesítés után), a napi összesítők sosem.

### 4.3a A villantásos idők egyszeri pótlása
Az 1.6 előtti adatban a villantásos körök idői nincsenek meg. Betöltéskor minden olyan körre, amely már a napi összesítőkben van (`folded`), de a villantásos idői még nem (`fd` = 0):
- ha villantásos Felolvasás kör, és a nyers eseményei teljesen megvannak, a megjelenései a nyers eseményekből újraszámolódnak (5.2), és a villantásos idők hozzáfűződnek a megfelelő napi összesítő `flashDwell` mezőjéhez (legfeljebb 20, mint fent). **Semmi más mező nem változik**, a megjelenések és a segítség már benne vannak;
- a nyers események hiányosak, ha az első esemény nem az első pozíció megjelenése (a kvótahiba vagy a napkorlát az elejéről töröl), vagy egy sincs meg. Ilyenkor a kör kimarad;
- kézi kör és hiányos kör: nincs mit pótolni;
- minden ilyen kör `fd` = 1 lesz, így a pótlás egyszer fut le (ismételt betöltéskor nem fűz hozzá újra).

A körök kezdési idő (`t0`) szerint, időrendben dolgozódnak fel. A pótlás **a félbemaradt körök lezárása előtt** fut: a lezárás törli a korlátokon túli nyers eseményeket, és a félbemaradt kör a legújabb, így az idői a régebbiek után kerülnek. Az új körök a lezáráskor a villantásos időket is kitöltik (`fd` = 1). Ami 30 körnél vagy 30 napnál régebbi, az nem pótolható.

## 5. Naplózás és mellényomás-szűrés

### 5.1 Mit naplózunk
A `js/core/round.js` állapotgép eseményei alapján (SPACE/NEXT, PREV, PAUSE, BLUR, COVER, COVER_DOWN, TICK okozta továbblépés, kilépés). A naplózás a reducer köré épül (`js/core/practice-log.js`: az átmenet előtti és utáni állapotból), a reducer tiszta marad. Az oldal elrejtése és újra megjelenése (`hidden`, `visible`) a felületi rétegből jön.

Takarásnál csak a takarás kezdete (`cover`: nem volt letakart szótag → van) és vége (`uncover`) naplózódik; a takarás okozta automatikus megállítás nem külön esemény.

### 5.2 Szűrési szabályok
Kezdőértékek; mind a 7.8 szerinti konfigurációs fájlból jön (`szures` szakasz):

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

**Villantásos olvasási idő.** Villantásos körben (villantás > 0) egy megjelenésnek pontosan akkor van villantásos olvasási ideje, ha a tétel utolsó, nem újraolvasó látogatása gombnyomásos továbblépéssel ért véget, miközben a tétel látszott, és az idő legfeljebb 30 mp. Az idő ugyanúgy számol, mint kézi körben: javított mellényomásnál a szakaszok összeadódnak, az újraolvasás ideje nem számít, az elrejtett oldal ideje nem olvasási idő, a megállításé igen. Nincs villantásos olvasási idő, ha a villantás magától járt le (akkor sem, ha előtte egy mellényomás javítva lett), ha a gombnyomás a tételek közti szünetben jött, a látható tételnél kör közbeni kilépéskor, és 30 mp felett. A megjelenés, a segítség és minden más ezekben az esetekben is ugyanúgy számít.

Súlyozás az állapotszámításban: a takarás erős jel, a megállítás közepes, a visszalépés gyenge (a gyerek is nyomhatja).

### 5.3 Visszavonás-barát visszalépés
Ha a visszalépés 2 mp-en belül jön a továbblépés után, a tétel **pontosan úgy** jelenjen meg újra, ahogy elhagyta: ugyanaz a takarás, ugyanannyi hátralévő villantási idő, ugyanaz a megállított állapot. Egyéb esetben a jelenlegi viselkedés marad.

## 6. Listák változása

- A tételtörténet a tételkulcshoz tartozik, ezért tétel hozzáadása, törlése, áthelyezése, listák átrendezése nem érinti.
- A lista nézetek mindig a **jelenlegi** lista tartalmából számolnak.
- Szövegváltozás (pl. `haz` → `ház`, `ma-ma` → `mama`) új tételt jelent. A régi tétel története a betűstatisztikában megmarad, a listanézetben nem jelenik meg.
- Listaazonosság betöltéskor: azonos név → ugyanaz a lista. Eltérő név, de legalább 60% tételátfedés → átnevezett lista, a listaszintű történet átkerül. Egyébként új lista.

## 7. Csoportok számítása

Minden a meglévő napi összesítőkből számolható, visszamenőleg is. Tiszta függvények, a `now` és a konfiguráció kívülről jön (`js/core/mastery.js`). Minden szám a 7.8 szerinti konfigurációból jön (`allapot` szakasz); az itt látható értékek az alapértelmezések.

### 7.1 Bemenetek tételenként
- **Olvasási napok:** azok a napok, amelyeken `exposures > 0`. Ugyanaz a nap több eszközről egy nap.
- **Segítségsor:** a napi `help` sorok időrendben összefűzve (`'1'` = segítséggel). Kézi és villantásos alkalom egyaránt, a lejárt villantás is (segítség nélküli alkalomnak számít; ezt elfogadtuk).
- **Mért idők:** napok szerint időrendben, egy napon belül előbb a `dwellMs` (kézi), utána a `flashDwell[].ms` (villantásos, gombnyomásos továbblépés). A két lista egymáshoz viszonyított sorrendje egy napon belül nem ismert; ezt elfogadjuk. Lejárt villantásnak nincs ideje.

### 7.2 Szótagszám
- A tétel kulcsában lévő magánhangzók száma: `a á e é i í o ó ö ő u ú ü ű` (kis- és nagybetű). A kötőjel nem számít.
- Ha 0, akkor 1. Példák: `pi-ló-ta` = 3, `pilóta` = 3, `ma` = 1, `b` = 1, `sz` = 1.
- Szótagonkénti idő = mért idő / szótagszám.

### 7.3 Szokásos tempó (típusonként)
- Típus: betű, szótag, szó (a meglévő `typeOf`, `js/core/grid.js`). Így pl. a `pi-ló-ta` és a `ka-bát` szó.
- Az adott típus összes tételének szótagonkénti mért ideje az utolsó `tempo_ablak_nap` napból, középértékkel. Az ablak **az utolsó gyakorlási naphoz** kötött (nem a mai naphoz), így hosszú szünet után sem ürül ki: az utolsó gyakorlási nap és az előtte lévő 29 nap.
- Csak akkor van szokásos tempó, ha legalább `tempo_min_meres` mért idő van az adott típusban. Ha nincs, az adott típusban nincs időfeltétel.

### 7.4 Friss idő (tételenként)
- Az utolsó `friss_meres_db` mért idő szótagonkénti értékének középértéke.
- Csak akkor van, ha legalább ennyi mért idő létezik.
- **Arány** = friss idő / a tétel típusának szokásos tempója. Ha bármelyik hiányzik, nincs arány.

### 7.5 Csoportok
A vizsgálat sorrendje:

1. **Kevés adat:** az olvasási napok száma kisebb, mint `min_nap`. Ide tartozik az is, amit még egyszer sem olvasott (a napszabály-kapcsolóval is).
2. **Még gyakorolni kell:** az utolsó `gyakorol_utolso_n` alkalomból legalább `gyakorol_segitseg_db` segítséggel volt, **vagy** az arány ≥ `gyakorol_ido_szorzo`. Ha `gyakorol_utolso_n`-nél kevesebb alkalom van, a meglévőkből számol.
3. **Megy:** az utolsó `megy_utolso_n` alkalom mind segítség nélkül, **és** (nincs arány, **vagy** az arány ≤ `megy_ido_szorzo`). Ha `megy_utolso_n`-nél kevesebb alkalom van (csak a napszabály-kapcsolóval fordulhat elő), a tétel Kevés adat.
4. **Még bizonytalan:** minden más.

A 2. és a 3. a kezdő értékekkel nem fedi át egymást (3 segítség nélküli alkalom után az utolsó 5-ből legfeljebb 2 segítséges; 1,5 < 2). A konfiguráció-ellenőrzés ezt kikényszeríti (7.8).

### 7.6 Ok
A számítás a csoport mellé egy okot is visszaad, ebből lesz a tétel részleteinek fő mondata (8.4). Egy tételhez mindig egy ok tartozik, ebben a sorrendben vizsgálva:

| Csoport | Ok | Mikor |
|---|---|---|
| Még gyakorolni kell | `help` | a segítség-feltétel teljesült (akkor is, ha az arány is ≥ `gyakorol_ido_szorzo`) |
| Még gyakorolni kell | `slow` | csak az arány-feltétel teljesült |
| Még bizonytalan | `help` | az utolsó `megy_utolso_n` alkalomban volt segítség |
| Még bizonytalan | `slow` | nem volt segítség, de az arány > `megy_ido_szorzo` |
| Megy, Kevés adat | nincs | |

`help` oknál a számítás a mondathoz szükséges két számot is visszaadja: hány alkalmat vizsgált (legfeljebb `gyakorol_utolso_n`) és ebből hányszor volt segítség.

### 7.7 Példák (szokásos tempó 1,5 mp/szótag)

| Tétel | Utolsó 3 mért idő | mp/szótag | Arány | Segítség (utolsó 5) | Napok | Csoport | Ok |
|---|---|---|---|---|---|---|---|
| pi-ló-ta | 4,2 / 3,9 / 4,0 | 1,33 | 0,89 | 0 1 0 0 0 | 4 | Megy | |
| ka-bát | 5,0 / 5,4 / 4,8 | 2,5 | 1,67 | 0 0 0 0 0 | 3 | Még bizonytalan | `slow` |
| me | 13 / 11 / 9 | 11 | 7,3 | 0 0 0 0 0 | 5 | Még gyakorolni kell | `slow` |
| bo-hó-c | (csak lejárt villantás) | nincs | nincs | 1 0 1 1 0 | 4 | Még gyakorolni kell | `help` (5-ből 3) |
| ma | 2,0 / 2,1 | nincs (2 mérés) | nincs | 0 0 0 | 3 | Megy | |
| la | 1,0 / 1,2 / 0,9 | 1,0 | 0,67 | 0 0 0 | 2 | Kevés adat | |
| ba | 1,8 / 2,0 / 1,7 | 1,8 | 1,2 | 1 1 0 | 3 | Még bizonytalan | `help` |

### 7.8 Konfigurálható küszöbök
- Fájl: `haladas.json` a repó gyökerében, a `parok.json` mintájára (`_leiras` mezőkkel magyarázva). A program induláskor betölti; ha hiányzik vagy hibás, a kódba épített alapértékekkel fut, és a konzolra figyelmeztet.
- Ellenőrzés (`js/core/haladas-config.js`, `validate`): ismeretlen vagy hiányzó kulcs, rossz típus vagy értelmetlen érték esetén **a deploy megáll** (`.github/scripts/check-haladas.mjs` a kiadásban, és a tesztek a PR-on). Kereszt-ellenőrzések:
  - `megy_ido_szorzo < gyakorol_ido_szorzo`;
  - `gyakorol_segitseg_db ≤ gyakorol_utolso_n`;
  - `gyakorol_segitseg_db > gyakorol_utolso_n − megy_utolso_n` (különben egy tétel egyszerre lehetne „Megy” és „Még gyakorolni kell”).
- A szülő nem látja és nem állítja.

`allapot` szakasz:

| Kulcs | Kezdő érték | Jelentés |
|---|---|---|
| `min_nap` | 3 | ennyi különböző olvasási nap kell a besoroláshoz |
| `megy_utolso_n` | 3 | „Megy”: az utolsó ennyi alkalom segítség nélkül |
| `megy_ido_szorzo` | 1.5 | „Megy”: arány legfeljebb ennyi |
| `gyakorol_utolso_n` | 5 | „Még gyakorolni kell”: ennyi utolsó alkalomból… |
| `gyakorol_segitseg_db` | 3 | …legalább ennyi segítséggel |
| `gyakorol_ido_szorzo` | 2 | „Még gyakorolni kell”: arány legalább ennyi |
| `friss_meres_db` | 3 | ennyi utolsó mért időből a friss idő |
| `tempo_ablak_nap` | 30 | a szokásos tempó időablaka (az utolsó gyakorlási naphoz kötve) |
| `tempo_min_meres` | 10 | ennyi mért idő kell típusonként a szokásos tempóhoz |

Teljes szerkezet:

```json
{
  "szures": {
    "javitott_melle_ms": 2000,
    "takaras_szandek_ms": 3000,
    "veletlen_atugras_ms": 400,
    "takaras_ugyetlenseg_ms": 1000,
    "max_olvasasi_ido_ms": 30000,
    "gyors_villantas_ms": 5000
  },
  "allapot": {
    "min_nap": 3,
    "megy_utolso_n": 3,
    "megy_ido_szorzo": 1.5,
    "gyakorol_utolso_n": 5,
    "gyakorol_segitseg_db": 3,
    "gyakorol_ido_szorzo": 2,
    "friss_meres_db": 3,
    "tempo_ablak_nap": 30,
    "tempo_min_meres": 10
  },
  "tarolas": {
    "nyers_megorzes_nap": 30,
    "nyers_megorzes_kor": 30
  }
}
```

A `szures.gyors_villantas_ms` csak adatgyűjtés: ennél rövidebb villantás segítség nélkül az `unsupportedFastFlash` mezőbe számít (tárolódik, a besorolás nem használja).

## 8. Felület

A jóváhagyott design (lásd a dokumentum elején) a mérvadó. Szövegek: tegező forma, mint a program többi része, **gondolatjel (–, —) nélkül**, egy helyen (`js/core/haladas-texts.js`). Minden szövegben a tétel megnevezése a `TERM`-ből jön (most „tétel”). A szövegekben szereplő küszöbszámok (3, 5) a konfigurációból jönnek. Napokra mindig a „napon” / „különböző napon” szóhasználat.

| Artboard | Mit mutat |
|---|---|
| Asztali – néhány hét után | áttekintés kevés csoportosított tétellel |
| Asztali – sok tétel (60 / 90 / 120 / 70) | áttekintés sok tétellel |
| Asztali – első nap | áttekintés, amikor még nincs csoportosított tétel |
| Asztali – csoport oldala (Megy, 60 tétel) | egy csoport összes tétele |
| Asztali – csoport oldala (Kevés adat, 128 tétel) | a Kevés adat csoport oldala két alcímmel |
| Asztali – tétel részletei (Még gyakorolni kell) | tétel részletei |
| Szövegkatalógus a fejlesztőnek | a tétel fő kártyája mind a 7 esetben |
| Telefon álló – áttekintés, tétel, csoport oldala | álló elrendezés |
| Telefon fekvő – áttekintés | fekvő elrendezés |

### 8.1 Nézetek és navigáció
- A szülői felület fejlécében egy „Haladás” gomb ikonnal a Súgó és a Betűteszt mellett; telefonon csak ikon. Gyakorlás közben nem érhető el, a gyerek felületén nem jelenik meg. A Haladás a szülői felület helyére lép.

| Nézet | Hash | Vissza (link és Esc) |
|---|---|---|
| Áttekintés | `#haladas` | a szülői felületre |
| Csoport oldala | `#haladas/csoport/<fluent\|unsure\|practice\|lowdata>` | az áttekintéshez |
| Tétel részletei | `#haladas/tetel/<kulcs>` | ahonnan jött (áttekintés vagy csoport oldala) |

- A csoport oldalán és a tétel részleteinél a vissza link szövege „← Vissza az áttekintéshez”. Ha a tételt a csoport oldaláról nyitotta meg, a vissza link és az Esc a csoport oldalára visz, a link szövege ilyenkor „← Vissza”. Azt, hogy honnan jött, a böngésző előzménye tárolja (`history.state`), így újratöltés után is megmarad. Közvetlenül megnyitott tételnél az áttekintéshez visz.
- Ismeretlen csoport-azonosítónál az áttekintés nyílik meg. Üres csoport oldala: a csoport kártyája „Még nincs ilyen tétel.” szöveggel.
- Előre lépve (új nézet) a lap tetejére görget; visszalépve (link, Esc, böngésző) az előző görgetési pozíció áll vissza. A fókusz mindig a címre kerül.

### 8.1a Elrendezések
- **Álló telefon:** 600 px-nél keskenyebb ablak. Az „Ez csak statisztika” összecsukható, alapból csukva.
- **Fekvő telefon:** legfeljebb 500 px magas, fekvő, legalább 560 px széles ablak.
- **Asztali:** minden más (a tablet is).
- Csempék kártyánként az áttekintésen: asztalon 6, álló telefonon 4, fekvőn 3.
- Betűtípus: a felület szövegei a felületi betűvel (`--f-ui`), a tételek a gyakorló betűvel (`--f-item`).

### 8.2 Áttekintés (felülről lefelé)
1. **Cím:** „Hogy halad az olvasás?”, fölötte „← Vissza”.
2. **Összefoglaló mondat**, mind a négy csoportról; a négy szám összege a jelenlegi listák összes tétele (a szülői felület kijelölésétől függetlenül):
   > Eddig **100 tételt** olvasott a **140**-ből. **12** már csoportba került: **5** megy, **4** még bizonytalan, **3**-at még gyakorolni kell. A többi **128** tételről még kevés az adat.
   - A második mondat száma az első három csoport összege. A 0 darabos csoportok kimaradnak a felsorolásból.
   - A „többi” mondatban benne vannak a még nem olvasott tételek is. Ha ez 0, a mondat elmarad.
   - Ha egyetlen tétel sincs csoportban: „Eddig **9 tételt** olvasott a **140**-ből. Még mind a **140** tételről kevés az adat.”
   - Ha még egy tételt sem olvasott: „Kezdd el használni a programot, hogy láthasd a haladást!”
3. **„Ez csak statisztika” doboz** (`--sky` háttér):
   > Többet számít, amit te látsz, és amit a gyereked érez egy-egy tételnél. Ha szerinted egy tétel már megy, akkor valószínűleg megy, bármit mutat itt a program. Használd segítségnek, de ne hagyatkozz rá teljesen, és ne a számokat akard javítani: az a cél, hogy szívesen olvasson. Egy tétel csoportja idővel változhat, ez természetes.

   Álló telefonon összecsukható, alapból csukva („Bővebben ▾” / „Kevesebb ▴”, valódi `<button>`, `aria-expanded`). Asztalon és fekvő telefonon mindig nyitva.
4. **Információs doboz**, ha egyetlen tétel sincs a Kevés adat csoporton kívül (ikon + szöveg, `role="status"`, nem figyelmeztetés-színű): „Az első tételek legkorábban a 3. napon kerülnek csoportba.” (A szám a `min_nap`-ból; `min_nap` = 0 mellett nincs doboz.)
5. **Négy kártya:**

| Kártya | Cím | Szöveg | Szín |
|---|---|---|---|
| 1 | Megy | Az utóbbi 3 alkalommal takarás, megállítás és visszalépés nélkül olvasta, és nem akadt el rajta. | `#2E6B66` |
| 2 | Még bizonytalan | Már olvasta segítség nélkül is, de néha még nehezen megy. | `#8DBDB6` |
| 3 | Még gyakorolni kell | Az utóbbi 5 alkalomból legalább 3-szor kellett segítség, vagy sokkal lassabban olvasta, mint a többi tételt. | `#E7B96A` |
| 4 | Kevés adat | Egy tételről csak akkor tudjuk a haladást megállapítani, ha legalább 3 különböző napon olvasta. | `#BDB4A4` |

   - Elrendezés: asztali és fekvő: az 1–3. kártya egy sorban, egyforma magasan; a Kevés adat kártya alattuk, teljes szélességben, egy sorban: balra cím, darabszám és szöveg, jobbra a link. Álló: mind a négy egymás alatt.
   - 1–3. kártya: fejléc (cím, darabszám), a kártya szövege, legfeljebb 8.1a szerinti számú csempe; alul „Mutasd mindet →” link, ha a csoportban legalább 1 tétel van (akkor is, ha minden kifér). A link a csoport oldalára visz, akadálymentes neve pl. „Megy: mind a 60 tétel”. A link a kártya aljához igazodik.
   - Kevés adat kártya: nincsenek csempék, csak cím, darabszám, szöveg és a link.
   - Üres kártya (0 tétel): szaggatott keret, átlátszó háttér, a felső színsáv megmarad; a darabszám halvány, nem félkövér; szöveg: „Még nincs ilyen tétel.”; nincs link. Átlátszósággal nem halványítunk (kontraszt).
   - Tételsorrend (a kártyán és a csoport oldalán ugyanaz): Megy és Még bizonytalan: a legutóbb olvasott elöl. Még gyakorolni kell: a legtöbb segítséget igénylő elöl (a segítség aránya, majd darabszáma), majd a nagyobb arány. Kevés adat: a több napon olvasott elöl, azonos napszámnál a legutóbb olvasott; a még nem olvasottak a végén, listasorrendben.
6. **Listánként:** listánként név, egy sáv és „{megy} megy a {összes}-ból/-ből”. A sáv négy része: Megy, Még bizonytalan, Még gyakorolni kell színe, majd a Kevés adat szürkéje; a részek együtt kiadják a sáv szélességét, köztük 2 px rés; 0 darabos részt nem rajzol. A sáv `role="img"`, címkéje mind a négy számot tartalmazza („Betűk: 2 megy, 1 még bizonytalan, 1 még gyakorolni kell, 16 kevés adat, 20 tételből”); ha minden tétel kevés adat: „Betűk: 20 tételből mindegyikről kevés az adat”. Alatta: „A szürke rész: erről a tételről még kevés az adat.”
7. **„Honnan tudja ezt az Olvasóka?”** (halvány szöveg), két bekezdés:
   > Az Olvasóka nem tudja a helyes válaszokat, ezt te hallod a gyerek mellett. Így csak azt figyeli, mennyi idő alatt lapoztok tovább, és kellett-e takarás vagy visszalépés.

   > A tempót mindig a gyereked saját tempójához méri, nem egy elvárt sebességhez. Csak azt nézi, hogy egy tételt nagyjából olyan gyorsan olvas-e, mint a többi betűt, szótagot vagy szót szokta. A hosszabb tételeknél a szótagok számával is számol. Más gyerekekhez nem hasonlítja.
8. **Lábléc:** „Az adatok csak ezen az eszközön vannak.”

### 8.3 Csoport oldala
- Fent a vissza link (8.1).
- Egy kártya a csoport színével: cím „Megy: 60 tétel” formában (csoport neve, kettőspont, darabszám, `TERM`), alatta a kártya szövege (8.2), alatta a csoport összes tétele csempeként, a 8.2 sorrendjében. Listánkénti csoportosítás nincs.
- Kevés adat oldalon a tételek két alcím alatt: „Olvasta, még kevés napon (88)” és „Még nem olvasta (40)”. Üres résznek az alcíme sem jelenik meg.
- Az oldal alján: „Ez csak statisztika. Többet számít, amit te látsz, és amit a gyereked érez.”
- Csempére kattintva a tétel részletei nyílnak meg (a vissza ide hoz).

### 8.4 Tétel részletei
**Fő kártya** (a csoport színével): a tétel nagy betűvel, a csoport neve címként, alatta a fő mondat:

| Csoport | Ok (7.6) | Fő mondat |
|---|---|---|
| Megy | | a kártya szövege (8.2) |
| Még bizonytalan | `help` | Már olvasta segítség nélkül is, de néha még kell hozzá segítség. |
| Még bizonytalan | `slow` | Segítség nélkül olvasta, de még lassabban, mint a többi {típus}. |
| Még gyakorolni kell | `help` | Az utóbbi {N} alkalomból {K}-szor kellett segítség. |
| Még gyakorolni kell | `slow` | Lassabban olvasta, mint a többi {típus}. |
| Kevés adat | | a kártya szövege (8.2) |

- {típus}: „betűt”, „szótagot” vagy „szót” a tétel típusa szerint.
- {N}: a vizsgált alkalmak száma (legfeljebb `gyakorol_utolso_n`), {K}: ebből a segítségesek száma, a „-szor/-szer/-ször” rag a szám kiejtése szerint. Példa: „Az utóbbi 4 alkalomból 3-szor kellett segítség.”
- A fő mondat alatt vékony vonal, alatta halványabb sor: „Eddig **X** alkalommal olvasta, **Y** különböző napon. Először: okt. 24.” Még nem olvasott tételnél ehelyett a kiemelt „Még nem olvasta.”
- **„Amikor olvasta” pöttyök** (legfeljebb az utolsó 14 olvasási nap): kitöltött sárga, ha aznap minden alkalommal kellett segítség; fehér, zöld kerettel, ha egyszer sem; függőlegesen elfelezve (bal fele sárga, jobb fele fehér, körben a fehér pötty zöld keretével), ha aznap segítséggel és anélkül is olvasta. Jelmagyarázat alatta mindhárom jellel („segítséggel olvasta”, „segítség nélkül”, „segítséggel és anélkül is”; fekvő telefonon röviden: „segítséggel”, „segítség nélkül”, „vegyesen”). Az akadálymentes címkében a napi alkalmak száma is: „okt. 28., 4 alkalom, segítséggel”, „nov. 11., 2 alkalom, segítséggel és anélkül is”.
- **Lábléc:** „Ez csak statisztika. Többet számít, amit te látsz, és amit a gyereked érez ennél a tételnél.”

### 8.4a Tárolás nem elérhető
Ha a böngésző nem engedi a tárolást: „Ezen az eszközön nem menthető a haladás, mert a böngésző nem engedi az adatok tárolását.”

### 8.5 Vizuális szabályok
- A meglévő tokenek (`css/tokens.css`): háttér `--paper`, kártya `--field`, keret `--line`, szöveg `--ink` / `--ink-2`, kiemelés `--accent`, az „Ez csak statisztika” doboz `--sky`.
- Csoportszínek: Megy `#2E6B66`, Még bizonytalan `#8DBDB6`, Még gyakorolni kell `#E7B96A`, Kevés adat `#BDB4A4`. **Piros nincs.**
- Minden érinthető elem legalább 44 px magas. Szöveg kontraszt legalább 4,5:1.
- Reszponzív: a meglévő minimum (320 × 256) felett minden elrendezés működjön. Fekvő telefonon az összefoglaló és a statisztika doboz egymás mellett, oldalt 48 px biztonsági margó.

## 9. Átvitel másik eszközre (export/import): 2. fázis, most nem készül

Csak tájékoztatásul, hogy az adatmodell már most ehhez igazodjon:
- **Export:** egy JSON fájl letöltése (`olvasoka-haladas-YYYY-MM-DD.json`) a teljes tárolt gyökérrel.
- **Import:** fájl kiválasztása, majd összefésülés: események és körök azonosító szerint (ismétlődés nélkül), napi összesítők az `id` szerint (eszköz|gyerek|tétel|nap, így két eszköz ugyanaznapi adatai összeadódnak, ugyanaz a fájl kétszer importálva nem duplikál). Utána állapotok újraszámolása.
- Hibás vagy más verziójú fájlnál érthető üzenet, és semmi nem íródik felül.
- A felület: egyszerű párbeszédablak két gombbal (Mentés fájlba, Betöltés fájlból) és egy mondattal, mire jó.

## 10. Tesztelés várakozás nélkül

Egyetlen kapcsoló: **a napszabály kihagyása**, környezetenként, GitHub repository variable-ből, a táblázatcímek mintájára (`.github/scripts/write-sheet-config.mjs` írja be a `js/core/config.js`-be deploykor).

| Változó | Érték | Alapérték |
|---|---|---|
| `DEV_PROGRESS_SKIP_DAY_RULES` | `true` vagy üres | üres (a szabályok érvényesek) |
| `PROD_PROGRESS_SKIP_DAY_RULES` | `true` vagy üres | üres; ha élesben `true`, a deploy figyelmeztetést ír (`::warning::`) |

Ha a kapcsoló be van kapcsolva, a `min_nap` nullának számít, így a besorolás az első gyakorlástól látszik, akár néhány megjelenés alapján is. A többi feltétel (alkalmak száma, segítség, arány) és a tempó ablaka (`tempo_ablak_nap`) változatlan. A még nem olvasott tétel ilyenkor is Kevés adat; „Megy”-hez ilyenkor is kell `megy_utolso_n` alkalom.

Helyi futtatásnál (localhost) a `js/core/config.js` repóbeli értéke számít; alapból kikapcsolva.

Automatikus tesztek: egységtesztek (`node:test`) rögzített `now` értékekkel (szűrés, összesítés, szótagszám, szokásos tempó, friss idő, csoportok és okok határértékei, listaazonosság, 30 napos tömörítés, konfiguráció-ellenőrzés, a kapcsoló mindkét állása). A számítások ehhez kívülről kapják az időt.

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
- [ ] A 7.7 táblázat minden sora egységtesztként, az okkal együtt; a küszöbök határértékei (arány 1,5 és 2; 2/5 és 3/5 segítség).
- [ ] Szótagszám a 7.2 szerint; szokásos tempó típusonként, az utolsó gyakorlási naphoz kötött 30 napos ablakkal, `tempo_min_meres` alatt nincs.
- [ ] Friss idő: kézi és villantásos idő együtt, napi sorrendben; 3-nál kevesebb mérésnél nincs; lejárt villantás nem számít.
- [ ] A négy darabszám összege = a jelenlegi listák összes tétele, listánként is.
- [ ] Listatartalom-változás után a listanézet a jelenlegi tartalomból számol; 60% feletti átfedésű átnevezett lista megtartja a listaszintű adatait.
- [ ] 30 napnál régebbi nyers események törlődnek, a napi összesítők megmaradnak.
- [ ] A tárolt adat és formátum nem változik; a meglévő adatokból azonnal helyes besorolás.

Felület:
- [ ] Négy kártya a 8.2 sorrendjében, elrendezésével és szövegeivel; minden nem üres kártyán „Mutasd mindet →” link a csoport oldalára; a csoport oldalán a csoport összes tétele.
- [ ] Az összefoglaló mondat a 8.2 szerint, mind a négy csoporttal.
- [ ] A Haladás nézet az első naptól elérhető; csoport nélkül megjelenik az információs doboz.
- [ ] A tétel részleteinél a fő mondat a 8.4 szerint, alatta az alkalmak és a napok száma és az első dátum.
- [ ] Navigáció: áttekintés → csoport → tétel → vissza a csoporthoz → vissza az áttekintéshez, Esc-kel és a böngészővel is; visszalépve az előző görgetési pozíció áll vissza.
- [ ] A „Honnan tudja ezt az Olvasóka?” rész a 8.2 szerint, a saját tempó magyarázatával.
- [ ] Nincs „Egyre jobban megy”, nincs betűelemzés, nincs „Még N napon…”, nincs „Szerepel: …”, nincs „+ N további tétel”, nincs régi üres állapot.
- [ ] Álló telefonon az „Ez csak statisztika” alapból csukott, billentyűvel és képernyőolvasóval is nyitható.
- [ ] A felületi szövegekben nincs gondolatjel, nincs piros szín, nincs sorozat vagy pontszám.
- [ ] A felület asztali, álló és fekvő elrendezésben megfelel a jóváhagyott designnak.
- [ ] A Haladás gyakorlás közben nem érhető el.
- [ ] Nincs export/import link és funkció (2. fázis).

Konfiguráció:
- [ ] Minden küszöb a `haladas.json`-ból jön; értékei hatnak a besorolásra (teszt: egy küszöb átírása más csoportot ad ugyanarra az adatra).
- [ ] Hiányzó vagy hibás fájl esetén az alapértékekkel fut; hibás vagy átfedő küszöbök esetén a deploy ellenőrzése megáll.

Napszabály-kapcsoló:
- [ ] `DEV_PROGRESS_SKIP_DAY_RULES=true` mellett a dev környezetben egyetlen gyakorlás után is van besorolás.
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