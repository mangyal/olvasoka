# Olvasóka – Specifikáció

Verzió: **2.0** · Nyelv: magyar (UI és tartalom) · Célplatform: statikus weboldal GitHub Pagesen

Az 1.x változatok Claude.ai artifactra, egyetlen HTML-fájlra készültek. A 2.0 a GitHubra költözött,
bontott változatot írja le. Ahol egy pont az 1.2-höz képest változott, a 0. fejezet táblázata és a
10. fejezet döntési naplója mondja meg, mi és miért.

---

## 0. Változások

### 2.0 (az 1.2-höz képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Név | A program neve **Olvasóka** (korábban: Beszéd- és kiejtésgyakorló). | 1. |
| 2 | Platform | Statikus oldal GitHub Pagesen, natív ES modulokra bontva, build lépés nélkül. Nem egyetlen fájl. | N2, 11. |
| 3 | Listák forrása | A listák a repó `lists.json` fájljából jönnek, az alkalmazásban **csak olvashatók**. Szerkesztés a GitHubon. Megszűnt: listakezelés, mentés, export/import. | 3., F-A1–F-A10, U-A3–U-A13 |
| 4 | Duplikátum | Az ismétlődő tétel **kimarad** (korábban: megengedett). | F-A3, 4.1 |
| 5 | Tételforrás | Új beállítás: **Kijelölt lista / Összes lista**. | F-A5, 3.2 |
| 6 | Felvillanás | **0–25 mp**, alapérték **10 mp**. A **0 kézi léptetést** jelent. | 3.2, F-P1 |
| 7 | Betűtípus | **Arial** (tartalék: Arimo). Az Andika megszűnt. | 6.1, F-F1, F-F2 |
| 8 | Számláló | A jobb felső sarokban mindig látszik: `3/10`. | F-P9, F-P12, 9.6, U2 |
| 9 | Időjelző | A tétel alatt fogyó csík mutatja a hátralévő időt, szünetben megáll. | F-P9, F-P14 |
| 10 | Vezérlők | A ◀ ⏸/▶ ▶ gyakorlás közben **végig látszik**. A ✕ marad egérmozgásra. | F-P10, 9.7 |
| 11 | → az utolsón | A **→ az utolsó tételen is a jutalomra vált**. | F-P7, 8., 9.5 |
| 12 | Betűméret | A tétel legfeljebb a magasság **62%**-át foglalja (korábban 70%), hogy a csík és a vezérlők elférjenek. | F-P13 |
| 13 | Tesztek | Beépített önteszt helyett `node --test` és GitHub Actions. A kör logikája tiszta állapotgép. | N7 |

### Korábbi változatok

Az 1.0 (interjú), 1.1 (technikai review) és 1.2 (UX-terv) döntései a 10. fejezetben vannak.
Ami azokból továbbra is érvényes, beépült a lenti fejezetekbe.

---

## 1. Cél és kontextus

Otthoni gyakorlóprogram egy 7 éves gyereknek. A program felvillantja a szülő által összeállított betűket,
szótagokat vagy szavakat, a gyerek hangosan kimondja őket. **A kiejtést a szülő ellenőrzi, aki a gyerek
mellett ül.** A program nem hallgat, nem értékel, nem ad hangot.

A cél a **betűalak rögzítése**, nem a szó–kép asszociáció. Ezért a gyerek képernyőjén soha nem jelenik meg
a tételhez kapcsolódó kép. Ugyanezért a betűalak a kör alatt **nem változik** (azonos font, azonos méret).

A tartalom gyakran változik. A szülő a listákat a GitHubon szerkeszti, telefonról is.

### Nem cél
- Mikrofon, beszédfelismerés, kiejtés-értékelés
- Bármilyen hang (se zene, se effekt, se felolvasás)
- Tételekhez rendelt képek
- Pontszám, hibajelölés, statisztika
- Listaszerkesztés az alkalmazáson belül; visszaírás a repóba
- Bejelentkezés, szerveroldali tárolás, több eszköz közötti szinkron (a listák a repóból mindenhol
  ugyanazok, a beállítások böngészőnként külön tárolódnak)
- Tablet/telefon támogatás a gyakorláshoz (laptop/asztali gép, billentyűzet + egér)
- Teljes képernyős mód

---

## 2. Szerepkörök és nézetek

| Nézet | Ki használja | Tartalom |
|---|---|---|
| **Szülői felület (admin)** | szülő | lista kiválasztása, beállítások, kör indítása |
| **Gyakorlónézet** | gyerek (a szülő vezérli) | a villantott tétel, időjelző, számláló, vezérlők, dekoráció |
| **Jutalomnézet** | gyerek | lufipukkasztó játék |

Állapotgép: `ADMIN → PRACTICE → REWARD → ADMIN`. Az **Esc** a PRACTICE és REWARD állapotból bármikor
visszavisz ADMIN-ba.

A PRACTICE állapotot a `js/core/round.js` írja le:
`{ seq, flash, gap, index, phase: 'showing' | 'gap', paused, deadline, remaining, done }`.

---

## 3. Listák és beállítások

### 3.1 A `lists.json`
- **F-L1** A listák a repó gyökerében lévő `lists.json`-ban vannak:
  ```json
  {
    "v": 1,
    "lists": [
      { "name": "Magánhangzók", "items": ["a", "á", "e", "é"] },
      { "name": "45. oldal", "items": ["fa", "ke-fe"] }
    ]
  }
  ```
- **F-L2** A listák sorrendje a fájlbeli sorrend.
- **F-L3** A listanév **egyedi** (levágva, kis-/nagybetűre nem érzékenyen). A második azonos nevű lista
  kimarad, a szülői felület figyelmeztet.
- **F-L4** Név nélküli lista kimarad; `items` nélküli lista üresként jelenik meg. Mindkettőről figyelmeztetés.
- **F-L5** Tételek tisztítása, ebben a sorrendben:
  1. Unicode NFC-normalizálás.
  2. A két végén szóköz levágva.
  3. Üres tétel eldobva.
  4. `#`-tel kezdődő tétel eldobva.
  5. **Ismétlődő tétel eldobva** (pontos egyezés; az `a` és az `A` két külön tétel).
  6. Max. 20 karakter (kódpontban). A hosszabb kimarad, a szülői felület megnevezi.

  A vessző elválasztónak számít: egy `"a, b"` tétel két tétel lesz. Szám típusú tétel szöveggé alakul.
- **F-L6** A tétel **pontosan úgy jelenik meg, ahogy le van írva**. Tilos a `text-transform` és
  bármilyen kis-/nagybetű konverzió.
- **F-L7** Hibás JSON vagy hiányzó `lists` tömb esetén a program nem omlik össze (F-L9).

### 3.2 Betöltés és gyorsítótár
- **F-L8** Induláskor a program azonnal megjeleníti a legutóbb letöltött listákat (ha vannak), és a háttérben
  letölti a `lists.json`-t `cache: 'no-cache'`-sel, 8 mp-es időkorláttal. Sikeres letöltés után a listák
  frissülnek, és az új változat a helyi tárolóba kerül.
- **F-L9** Ha a letöltés vagy az értelmezés nem sikerül:
  - van korábbi változat → az látszik, mellette figyelmeztetés a hibával és azzal, hogy a legutóbbi listák látszanak;
  - nincs korábbi változat → üres állapot a hibaüzenettel; az „Indítás” inaktív.
- **F-L10** A „Frissítés” gomb újra letölti a `lists.json`-t. Mellette: „Frissítve: 20:49”, illetve
  kapcsolat nélkül „Nincs kapcsolat – a nov. 7. 20:49 állapot látszik”.
- **F-L11** A „Listák szerkesztése a GitHubon ↗” link a `lists.json` GitHub-szerkesztőjét nyitja új lapon.
  Commit után kb. egy perccel a Frissítés már az új listát hozza.

### 3.3 Beállítások (a kör indítása előtt)

| Beállítás | Tartomány | Alapérték |
|---|---|---|
| Tételek forrása | Kijelölt lista / Összes lista | **Kijelölt lista** |
| Felvillanási idő | 0–25 mp, 0,5 mp lépés; **0 = kézi** | **10 mp** |
| Szünet a tételek között | 0–3 mp, 0,5 mp lépés | **0 mp** |
| Tételszám a körben | 1–50 | **10** |

- **F-S1 Összes lista:** a kör az összes lista tételeinek uniójából épül, ismétlődés nélkül.
  Az „Indítás” mellett: „4 lista, 98 különböző tétel”.
- **F-S2 Kézi léptetés (0 mp):** a tétel addig látszik, amíg Space-t vagy →-t nem nyomnak.
  A csúszka mellett „kézi”, a becsült hossz helyén „kézi léptetés” áll.

### 3.4 Helyi tárolás
- **F-S3** A beállítások, a legutóbb kijelölt lista neve és a legutóbb letöltött `lists.json` a
  `localStorage`-ban, `olvasoka` kulcs alatt:
  ```json
  { "v": 2, "settings": { "flashMs": 10000, "gapMs": 0, "count": 10, "source": "list" },
    "lastList": "45. oldal", "cache": { "data": { "v": 1, "lists": [] }, "fetchedAt": 1794080000000 } }
  ```
- **F-S4** Minden hozzáférés `try/catch` között. Sérült adatnál alapállapot. Tárolás nélkül (privát ablak)
  a program fut, figyelmeztetéssel: a beállítások nem maradnak meg, és hálózat nélkül nem lesz lista.
- **F-S5** A tárolás böngészőnként és címenként külön él. A listák a repóból jönnek, ezért nem vesznek el.

---

## 4. Gyakorlókör (PRACTICE)

### 4.1 Sorozat előállítása („húzózsák”)
A kör indulásakor a program **előre legenerálja a teljes sorozatot** a kör tételeinek indexeiből.

1. `N` = kért tételszám, `L` = a kör különböző tételeinek száma.
2. Az indexek véletlen keverése (Fisher–Yates), hozzáfűzés a sorozathoz; ismétlés, amíg `N` hosszú nem lesz.
3. Minden keverésen belül minden index pontosan egyszer szerepel.
4. Az utolsó, részleges keverésből az első `k` elem kerül be.
5. Ha az új keverés első indexe egyezik az előző keverés utolsójával (és `L > 1`), az első elem egy
   véletlen `j ≥ 1` pozícióval cserél, a levágás előtt.

Mivel a tételek egyediek (F-L5), **két azonos tétel soha nem kerül egymás után** (`L = 1` kivételével).
A véletlenszám-forrás paraméter (`buildSequence(L, N, rng)`), a tesztek seedelt `rng`-t használnak.

### 4.2 Lejátszás
- **F-P1** A tétel a beállított ideig látszik, majd magától vált. Kézi léptetésnél nem vált magától.
- **F-P2** Szünet > 0 esetén a lejárat után üres képernyő (csak dekoráció) a szünet idejére, aztán a
  következő tétel. A tételváltás soha nem animált.
- **F-P3** **Space:** azonnal a következő tétel; az utolsón (vagy az utána lévő szünetben) jutalom.
  Pause alatt nincs hatása.
- **F-P4** Az utolsó tétel idejének (és az utána lévő szünetnek) lejárta jutalomra vált.
- **F-P5** **Pause (P vagy ⏸):** az idő megáll, a képernyő marad. Folytatáskor a hátralévő idő fut le.
- **F-P6** **Vissza (←):** `showing` fázisban az előző tétel teljes idővel; `gap` fázisban a most lejárt
  tétel teljes idővel; az első tétel `showing` fázisában nincs hatása.
- **F-P7** **Előre (→):** a következő tétel teljes idővel; **az utolsó tételen (és az utána lévő szünetben)
  jutalomra vált**, mint a Space.
- **F-P7a** ← és → pause alatt is működik, és a kör folytatódik. Ha ← nem lehetséges, a pause megmarad.
- **F-P8** Automatikus pause, ha a fül háttérbe kerül vagy az ablak fókuszt veszt. Visszatéréskor pause marad.

### 4.3 Képernyőtartalom
- **F-P9** A képernyőn: a tétel, az időjelző (F-P14), a számláló (F-P15), a vezérlősor (F-P10),
  a dekoráció, pause alatt a pause-jelző. **Nincs** pontszám, hibajelölés, szöveges felirat.
- **F-P10** **Vezérlősor** (◀ ⏸/▶ ▶) alul középen, **végig látszik**. A **✕ kilépés** a bal felső sarokban
  csak egérmozgásra (≥ 8 px) jelenik meg, 2,5 mp mozdulatlanság után eltűnik. A ◀ az első tételen
  halványított; a ▶ mindig aktív. Az ikonok szöveg nélküliek, `aria-label`-lel, `tabindex="-1"`.
- **F-P11** Mozdulatlanságnál a kurzor elrejtődik (a gombok fölött látszik), mozgásra visszajön.
- **F-P12** **Pause-jelző:** pause alatt kis ⏸ jel a jobb felső sarokban, a számlálótól balra.
- **F-P13** **Betűméret:** a kör indulásakor egyetlen méret, amellyel a kör legszélesebb tétele elfér a
  szélesség 85%-án, a tételek közös tinta-doboza a magasság 62%-án, és a betűméret legfeljebb a magasság
  62%-a. Az alapvonal a körön belül állandó; a közös tinta-doboz közepe a magasság 46%-án van.
  Átméretezéskor újraszámolódik.
- **F-P14** **Időjelző:** a tétel alatt 6 px magas, lekerekített csík a kör legszélesebb tételének
  szélességében (min. 160 px, max. a szélesség 70%-a). A kitöltés balról jobbra fogy a hátralévő idő
  arányában. Pause alatt áll, ← és → után tele csíkkal indul újra. A szünetben és kézi léptetésnél nem látszik.
- **F-P15** **Számláló:** a jobb felső sarokban `index/N` formában (pl. `3/10`), `--ink-2` színnel,
  egérmozgástól függetlenül. A szünetben a most lejárt tétel sorszámát mutatja. A jutalomnál nincs.

### 4.4 Billentyűk

| Billentyű (`e.code`) | Funkció |
|---|---|
| `Space` | következő tétel / utolsón: jutalom |
| `ArrowRight` | következő tétel / utolsón: jutalom |
| `ArrowLeft` | előző tétel (teljes idővel) |
| `KeyP` | pause / folytatás |
| `Escape` | kilépés ADMIN-ba |
| `Ctrl`/`Cmd` + `Enter` | kör indítása (ADMIN) |

- Azonosítás `e.code` alapján; `e.repeat` eseményeket eldobjuk; a Space és a nyilak görgetését
  `preventDefault` tiltja; induláskor a fókuszban lévő elem elveszíti a fókuszt.

---

## 5. Jutalom (REWARD)

- **F-R1** A kör végén a háttér 1,8 mp alatt papírszínről égkékre vált, a dekoráció elhalványul,
  utána a lufik alulról a helyükre emelkednek (1,2 mp, 80 ms eltolással).
- **F-R2** 10–15 lufi, pasztell színekkel, 90–140 px szélességben, lassú lebegéssel (±6 px, ±2°).
- **F-R3** Pukkasztás `pointerdown`-ra; a pukkanás 120 ms-os zsugorodás és 6–8 apró részecske. Hang nincs.
- **F-R4** Nincs pontszám, időnyomás, felirat. A találati terület a lufinál ~20%-kal nagyobb;
  átfedésnél csak a legfelső pukkan. A ✕ környéke (120 × 120 px) szabadon marad.
- **F-R5** Az utolsó pukkanás után 1,2 mp csend, a háttér 600 ms alatt vissza, majd ADMIN.
- **F-R6** Esc vagy ✕ bármikor kilép. A kurzor a jutalom alatt végig látható, 32 px-es nyíl.
- **F-R7** A jutalom független a gyakorolt tételektől.

---

## 6. Vizuális stílus

- Visszafogott, nyugodt, gyerekbarát, nem túldíszített. A tétel a vizuális középpont.
- Gyakorló háttér: sík papírszín (`--paper`) enyhe vignettával, három statikus folt a sarkokban;
  a középső 60% × 60% üres.
- Tokenek, layout és interakció: 12. fejezet.

### 6.1 Betűtípus
- **F-F1** A gyakorló betű **Arial** (`Arial, 'Arimo', Helvetica, sans-serif`). Ugyanez a tétel-előnézetben
  és a betűtesztben, hogy a szülő ugyanazt az alakot lássa, mint a gyerek.
- **F-F2 Betöltés-kapu:** ha a gépen van Arial (canvas-méréssel felismerve), az „Indítás” azonnal aktív.
  Ha nincs, az Ariallal azonos betűalakú **Arimo** töltődik a Google Fontsról; addig az „Indítás” inaktív,
  legfeljebb 5 mp-ig. Sikertelen betöltésnél aktív, figyelmeztetéssel: „A betűk alakja eltérhet.”
  Ha az Arimo később mégis megjön, a figyelmeztetés eltűnik.
- **F-F3 Betűteszt** (fejléc, jobb oldal): `a á e é i í o ó ö ő u ú ü ű` és nagybetűs párja 32 px-en,
  alatta az ellenőrzés eredménye (Arial / Arimo / nem a gyakorló betű). Feltétel: az `ő` és `ű`
  dupla hosszú ékezettel jelenik meg, nem `ô`/`û` alakban.

---

## 7. Nem funkcionális követelmények

- **N1** Hang semmilyen formában (nincs `Audio`, `AudioContext`, `speechSynthesis`, média).
- **N2** Statikus oldal, natív ES modulok, **build lépés és futásidejű függőség nélkül**. Az egyetlen
  külső kérés a Google Fonts (Arimo), és csak ha nincs Arial. Az oldal HTTP-n keresztül fut
  (GitHub Pages vagy `python3 -m http.server`); fájlként megnyitva nem.
- **N3** Időzítés abszolút határidővel: tételváltáskor `deadline = now + időtartam`, egyetlen
  `setTimeout` a határidőig. Pause-nál `remaining = deadline − now`, folytatáskor új határidő.
- **N4** A gyakorlónézetben fade csak a ✕-en és a pause-jelzőn van. `prefers-reduced-motion: reduce`
  esetén minden fade és lebegés kikapcsol; az időjelző ekkor is frissül (információ, nem díszítés).
- **N5** Hibatűrés: hibás vagy elérhetetlen `lists.json`, üres lista, hiányzó tárolás, be nem töltött
  font nem okozhat összeomlást.
- **N6** Világos téma, explicit `body` háttérrel.
- **N7 Tesztelhetőség:** a logika a `js/core/` modulokban van, DOM nélkül. Tesztek: `node --test`
  (Node 20+), minden pushnál és PR-nél GitHub Actionsben. A tesztek a repó `lists.json`-ját is
  ellenőrzik, így egy hibás commit pirosra vált.

### 7.1 Felépítés

```
index.html          markup
lists.json          a listák
css/                tokens · szülői felület · gyakorló és jutalom
js/core/            tiszta logika: sequence, round, items, lists, settings
js/data/            store (localStorage), remote (lists.json letöltése)
js/ui/              admin, practice, reward
js/font.js          betűtípus-kapu
js/main.js          indítás, állapotváltás
test/               node --test
```

Függőségi irány: `core` ← `data` ← `ui` ← `main`. A `core` nem importál a többiből.

---

## 8. Éles esetek

| Eset | Elvárt viselkedés |
|---|---|
| Első megnyitás, a letöltés folyamatban | „Listák töltődnek…”, az „Indítás” inaktív |
| A `lists.json` nem tölthető le, van korábbi változat | A korábbi listák, figyelmeztetéssel |
| A `lists.json` nem tölthető le, nincs korábbi | Üres állapot a hibaüzenettel, „Indítás” inaktív |
| Hibás JSON | Mint az előző két sor; a teszt a repóban pirosra vált |
| Azonos nevű listák | A második kimarad, figyelmeztetés |
| Túl hosszú tétel | Kimarad, a figyelmeztetés megnevezi |
| Ismétlődő tétel | Kimarad, figyelmeztetés nélkül |
| A legutóbb kijelölt lista már nincs a fájlban | Az első lista lesz kijelölve |
| Üres lista kiválasztva | „Indítás” inaktív: „A listában nincs tétel.” |
| Összes lista, mind üres | „Indítás” inaktív: „Egyik listában sincs tétel.” |
| Font még töltődik (nincs Arial) | „Indítás” inaktív, max. 5 mp |
| Tételszám > tételek száma | Több keverés egymás után |
| Lista hossza = 1 | Ugyanaz a tétel ismétlődik, megengedett |
| Felvillanás = 0 | Kézi léptetés, nincs időjelző |
| Space / → a szünetben | Azonnal a következő tétel (az utolsó után: jutalom) |
| ← a szünetben | A most lejárt tétel, teljes idővel |
| Pause alatt Space | Nincs hatása |
| Pause alatt ← / → | Lép és folytat; ← az első tételen: pause marad |
| → az utolsó tételen | Jutalom |
| Nyomva tartott billentyű | Csak az első lenyomás számít |
| Esc közben | Azonnal ADMIN, nincs jutalom |
| Fül háttérbe / fókuszvesztés | Automatikus pause |
| Ablak átméretezése | A betűméret és az időjelző újraszámolódik |
| Tárolás nem elérhető | Működik, figyelmeztetéssel |

---

## 9. Elfogadási kritériumok

Az „automata” jelölésűeket a `test/` alatti tesztek ellenőrzik.

1. *(automata)* 4 tételes listával és 10-es körrel: az első 4 és a következő 4 tétel mindegyike pontosan
   egyszer szerepel, az utolsó 2 különböző; a 4–5. és a 8–9. tétel nem azonos. 500 seeddel.
2. *(automata)* `L > 1` esetén soha nincs két azonos index egymás után.
3. A felvillanási idő 0 és 25 mp között állítható; az átváltás a beállított idő ±100 ms-on belül történik.
4. *(automata)* Pause megállítja az időt, folytatáskor a hátralévő idő fut le. ← az előző tételt,
   a szünetben a most lejártat hozza, teljes idővel.
5. *(automata)* Pause alatt ← és → lép és folytat. → és Space az utolsó tételen jutalomra vált.
6. *(automata)* Felvillanás = 0 esetén nincs automatikus váltás.
7. Gyakorlás közben egérmozgás nélkül a tétel, az időjelző, a számláló, a vezérlősor és a dekoráció
   látszik (pause alatt + pause-jelző); a ✕ nem.
8. Az időjelző a hátralévő idővel arányosan fogy, pause alatt áll.
9. Egy körön belül minden tétel azonos betűmérettel és alapvonallal jelenik meg; a leghosszabb is egy
   sorban, levágás nélkül elfér, és nem fedi az időjelzőt vagy a vezérlősort.
10. A kör végén átmenet, majd 10–15 lufi; minden kattintás egyet pukkaszt, hang nélkül; az utolsó után
    ADMIN. A kurzor a jutalom alatt végig látható.
11. Esc a gyakorlásból és a jutalomból is ADMIN-ba visz.
12. *(automata)* A tisztítás NFC-normalizál, megtartja a kis-/nagybetűt, eldobja a `#`-es és ismétlődő
    tételt, jelzi a túl hosszút.
13. *(automata)* A `lists.json` hibatűrő értelmezése; a repó `lists.json`-ja hiba nélkül értelmezhető.
14. A betűteszt `ő`, `ű`, `Ő`, `Ű` karakterei dupla ékezettel, Arialban (vagy Arimóban) jelennek meg.
15. A beállítások és a kijelölt lista újratöltés után megmaradnak; hálózat nélkül a legutóbbi listák látszanak.
16. A `lists.json` GitHubon módosítva, commit után a Frissítés legfeljebb ~2 percen belül az új listát mutatja.
17. Sehol nincs hanglejátszás.

---

## 10. Döntési napló

**Interjú (1.0):** csak szöveg, kép nincs; a beírt kis-/nagybetű jelenik meg; több elnevezett lista;
húzózsák elv; automatikus váltás állítható szünettel, Space előrehoz; billentyűk és szöveg nélküli
ikonok; lufipukkasztó jutalom; laptop/asztali gép; hang egyáltalán nincs.

**Technikai review (1.1):** teljes képernyő nem kell; font-betöltés kapuja; billentyű-ismétlés eldobva;
fade csak az ikonokon; pause alatti navigáció lép és folytat; `#`-es tétel kimarad; vágólap-tartalék;
határidő-alapú időzítés.

**UX-terv (1.2):** komponens- és ikon-library nincs, saját tokenréteg és inline SVG; papírszerű,
egyszínű kiemelésű felület (12. fejezet); S1 azonnali indulás; S2 egérrel pukkaszt; S3 sík papír háttér.
Az S4 (explicit mentés) a 2.0-ban tárgytalan, mert az alkalmazásban nincs szerkesztés.

**Használat közbeni visszajelzések és a GitHub-költözés (2.0, 2026-11-07):**

| Döntés | Indok |
|---|---|
| Felvillanás alapértéke 10 mp, tartománya 0–25 mp | A gyereknek több idő kell; a 3 mp kevés volt. |
| 0 mp = kézi léptetés | A szülő diktálja a tempót, ha a gyerek elakad. |
| Arial betűtípus | A szülő döntése; az iskolai anyagokkal egyező betűalak. Az Andika és a Didact Gothic kipróbálva, elvetve. |
| Számláló a sarokban | A szülőnek látnia kell, hol tart a kör. Felülírja az 1.0 „nincs haladásjelző” döntését. |
| Időjelző a tétel alatt | A gyerek látja, mennyi ideje van még. Felülírja az 1.0 „nincs időjelző” döntését. |
| A vezérlősor végig látszik | Egérrel is gyorsan kezelhető, nem kell előbb megmozdítani. |
| → az utolsón jutalomra vált | Az 1.1-es tiltás használatban zavaró volt: a → „nem működött”. |
| Ismétlődő tétel kimarad | Két egyforma tétel egymás után zavaró volt; egy listán belül az ismétlésnek nincs értelme. |
| Összes lista mód | Vegyes ismétlés több leckéből. |
| Név: Olvasóka | A szülő választása. |
| GitHub Pages, ES modulok, build nélkül | Hostolt listák; a claude.ai artifact nem tölthet be külső JSON-t. |
| Listák a `lists.json`-ban, az appban csak olvashatók (A változat) | Egy adatforrás, nincs bejelentkezés és token. Szerkesztés a GitHubon, telefonról is. A vegyes (B) és a visszaíró (C) változat elvetve. |
| Publikus repo | Ingyenes Pages; a listák tartalma nem érzékeny. |
| Kör-logika tiszta reducerben, `node --test`, GitHub Actions | Az időzítés és a navigáció automatikusan tesztelhető; hibás `lists.json` már a commitnál kiderül. |

---

## 11. Nyitott pontok

- A `lists.json` szerkesztése telefonon hibalehetőséges (vessző, idézőjel). Ha gyakori lesz, egyszerűbb
  szöveges formátum (`# Lista neve` + soronként egy tétel) jöhet a JSON mellé vagy helyette.
- A „44. oldal” listában szereplő `sk` tétel valószínűleg elírás; a tartalomgazda ellenőrzi.
- A 12. fejezet számértékeitől ±20%-on belül indoklás nélkül el lehet térni; a színektől csak a
  kontrasztkövetelmény (12.6) megtartásával.

---

## 12. UX-specifikáció

### 12.1 Tervezési elvek
- **U-E1 Két közönség, két karakter.** A szülői felület eszköz: sűrű, gyors, szöveges. A gyerek nézetei
  szinte üresek, egyetlen fókusszal.
- **U-E2 Rövid fő út.** Megnyitás → a legutóbbi lista kijelölve → „Indítás” (vagy Ctrl+Enter).
- **U-E3 Vakon vezérelhető.** Minden gyakorlás közbeni művelet billentyűvel megy, fókusztól függetlenül.
- **U-E4 A gyerek nézet nem „alkalmazás”.** Nincs fejléc, menü, szöveg, logó. A számláló és a
  vezérlősor visszafogott, a tételnél jóval kisebb vizuális súlyú.
- **U-E5 Tiltott klisék.** Színátmenetes gombok és hátterek, üveghatás, emoji ikonként, árnyékos
  kártyarács, pill badge-ek. Helyette: sík, papírszerű felület, egy kiemelőszín, vékony vonalak.

### 12.2 Design tokenek

| Token | Érték | Használat |
|---|---|---|
| `--paper` | `#F5F0E6` | alap háttér |
| `--paper-2` | `#ECE5D6` | kijelölt lista, hover, dekoráció |
| `--line` | `#D9CFBE` | vonalak, keretek, az időjelző sávja |
| `--ink` | `#1E2A32` | tétel, fő szöveg |
| `--ink-2` | `#5A6670` | másodlagos szöveg, számláló |
| `--accent` | `#2E6B66` | elsődleges gomb, kijelölés, fókusz, az időjelző kitöltése (75%) |
| `--warn` | `#94560F` | figyelmeztetés |
| `--error` | `#A23B2A` | hiba |
| `--sky` | `#DCE9EF` | jutalom háttér |

Lufik: `#F2B5A7` · `#F5D58F` · `#B5D5BB` · `#A7C8E0` · `#CBB8DE` · `#EFC2D3`, fehér, 25%-os fényfolttal.

Tipográfia: tétel Arial 400 (F-F1); szülői felület `system-ui`, 13 / 15 / 18 / 24 px, alap 15 px;
számok `tabular-nums`. Térköz 4 px-es rács. Sarok: 6 px vezérlők, 10 px dialógus.
Időtartamok: 150 ms (hover), 300 ms (fade), 1800 ms (jutalom háttér).

### 12.3 Szülői felület

```
┌───────────────────────────────────────────────────────────────────┐
│ Olvasóka                                               Betűteszt   │
├───────────────────────────────────────────────────────────────────┤
│ ▌ figyelmeztetések (ha vannak)                                   ✕ │
├────────────────┬──────────────────────────────────────────────────┤
│ LISTÁK         │ 45. oldal                              46 tétel  │
│ ▌45. oldal  46 │ [f] [m] [k] [l] [c] [ó] [ú] …                    │
│  44. oldal  59 │ ──────────────────────────────────────────────── │
│  Á-A-E      27 │ Frissítve: 20:49  [Frissítés]  Listák szerk. ↗   │
├────────────────┴──────────────────────────────────────────────────┤
│ Tételek [Kijelölt|Összes]  Felvillanás ──●── 10 mp  Szünet [0…3]  Tétel − 10 + │
│ kb. 1 perc 40 mp   Space tovább · ← → lépés · P szünet · Esc kilép   [Indítás] │
└───────────────────────────────────────────────────────────────────┘
```

- **U-A1** Listasáv: a fájlbeli sorrend, név mellett a tételszám. Kijelölt: `--paper-2` háttér +
  3 px `--accent` bal szegély. 900 px alatt lenyíló választó a lista fölött.
- **U-A2** Megnyitáskor a `lastList` szerinti lista, ha nincs, az első.
- **U-A3** A kijelölt lista tételei vékony keretes címkékként, Arialban, a fájlbeli sorrendben.
- **U-A4** Forrássor: frissítési állapot, „Frissítés” gomb, GitHub-szerkesztő link.
- **U-A5** Figyelmeztető sáv a fejléc alatt, `--warn` bal szegéllyel, egyenként bezárható.
- **U-A6** Kör-sáv alul, mindig látható; az „Indítás” az oldal egyetlen elsődleges gombja. Állapotai:

  | Állapot | Gomb | Szöveg mellette |
  |---|---|---|
  | kész | aktív | – (Összes listánál: „4 lista, 98 különböző tétel”) |
  | listák töltődnek, nincs korábbi | inaktív, „Listák töltődnek…” | – |
  | font töltődik | inaktív, „Betűtípus töltődik…” | – |
  | font nem töltődött be | aktív | `--warn`: „A betűk alakja eltérhet.” |
  | nincs lista | inaktív | „Nincs elérhető lista.” |
  | üres lista / mind üres | inaktív | „A listában nincs tétel.” / „Egyik listában sincs tétel.” |

- **U-A7** Mikroszöveg: tegező, rövid, felkiáltójel nélkül; hibánál a teendőt mondja.

### 12.4 Gyakorlónézet
- **U-P1** Háttér: sík `--paper`, enyhe vignetta, három statikus `--paper-2` folt a sarkokban.
- **U-P2** Tétel: `--ink`, vízszintesen középen, a közös tinta-doboz közepe a magasság 46%-án (F-P13).
- **U-P3** Időjelző: F-P14; sáv `--line`, kitöltés `--accent` 75%, a tinta-doboz alatt
  max(16 px, a magasság 3,5%-a) távolságra, de legalább 110 px-re az alsó széltől.
- **U-P4** Vezérlősor: ◀ ⏸/▶ ▶ alul középen, 24 px-re az aljától, 16 px közzel; 56 px kerek találati
  terület, 28 px ikon, `--ink` 55%; hoverre 8%-os kör háttér és 85%. Inaktív: 20%.
- **U-P5** ✕: bal felső sarok, egérmozgásra, fade be 150 ms, ki 300 ms.
- **U-P6** Számláló: jobb felső sarok, 24 px-re a szélektől, 20 px, `--ink-2`, `tabular-nums`.
- **U-P7** Pause-jelző: a számlálótól balra, 28 px, két lekerekített sáv, `--ink` 35%, fade 300 ms.
- **U-P8** Belépés animáció nélkül, az első tétel azonnal, teljes idővel. Kilépés azonnal.

### 12.5 Jutalomnézet
- **U-R1** Lufi: tojásdad (sz/m ≈ 0,82), háromszög csomó, 1 px madzag (`--ink` 25%), egy fényfolt;
  nincs arc, szöveg, minta. Rács alapú elhelyezés véletlen eltolással, max. 30% átfedés.
- **U-R2** Kurzor: 32 px-es nyíl (`--ink` kitöltés, fehér körvonal), lufi fölött sem vált kézre.

### 12.6 Akadálymentesség
- Kontraszt: tétel ≥ 7:1, admin szöveg ≥ 4,5:1, ikonok és keretek ≥ 3:1.
- Az admin minden funkciója billentyűzettel elérhető; fókuszgyűrű 2 px `--accent`, csak `:focus-visible`.
- Az ikon gombok `aria-label`-t kapnak („Szünet”, „Folytatás”, „Előző”, „Következő”, „Kilépés”).
- Elsődleges képernyő: 1366×768 és 1920×1080; támogatott minimum: 1024×600.
